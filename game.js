/* ==========================================================================
   Retro Audio Synthesizer Class (Web Audio API)
   ========================================================================== */
class RetroSynth {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(frequency, duration, type = 'square', volume = 0.08) {
    if (this.muted) return;
    this.init();
    
    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.value = frequency;
      
      gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
      // Exponential decay
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio playback failed: ", e);
    }
  }

  playClick() {
    // Vintage tactile button click
    this.playTone(1200, 0.04, 'triangle', 0.1);
  }

  playMove() {
    // Tiny subtle feedback for tick (optional, very quiet)
    this.playTone(600, 0.01, 'sine', 0.02);
  }

  playEat() {
    // Classic Nokia dual-beep high pitch eat tone
    const now = this.ctx ? this.ctx.currentTime : 0;
    this.playTone(987.77, 0.08, 'square', 0.08); // B5
    setTimeout(() => {
      this.playTone(1318.51, 0.12, 'square', 0.08); // E6
    }, 80);
  }

  playGameOver() {
    // Descending Nokia buzzer tone
    const notes = [440, 349.23, 293.66, 220]; // A4, F4, D4, A3
    notes.forEach((freq, index) => {
      setTimeout(() => {
        this.playTone(freq, 0.18, 'square', 0.1);
      }, index * 180);
    });
  }

  playHighScore() {
    // Upbeat little jingle
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, index) => {
      setTimeout(() => {
        this.playTone(freq, 0.1, 'square', 0.08);
      }, index * 100);
    });
  }

  playStart() {
    // Power-on classic chime
    const notes = [659.25, 587.33, 523.25, 587.33]; // E5, D5, C5, D5
    notes.forEach((freq, index) => {
      setTimeout(() => {
        this.playTone(freq, 0.12, 'square', 0.06);
      }, index * 120);
    });
  }
}

const synth = new RetroSynth();

/* ==========================================================================
   Game Constants & State
   ========================================================================== */
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Grid size settings
const CELL_SIZE = 16;
const GRID_WIDTH = canvas.width / CELL_SIZE;   // 20 cells
const GRID_HEIGHT = canvas.height / CELL_SIZE; // 15 cells

let gameLoopId = null;
let gameSpeed = 100; // ms per tick

// Game states: 'START', 'PLAYING', 'PAUSED', 'GAMEOVER', 'NAME_ENTRY'
let gameState = 'START'; 

let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = { x: 0, y: 0 };
let isSuperFood = false;
let superFoodTimer = 0;
let score = 0;
let obstacles = [];
let activeMode = 'classic';
let activeTheme = 'green';

// Local Stats
let stats = {
  gamesPlayed: 0,
  highScore: 0,
  foodsEaten: 0,
  totalScore: 0
};

// High Score Name Entry state variables
let initials = ['A', 'A', 'A'];
let initialIndex = 0;
const charsList = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789! ';
let charSelectIndices = [0, 0, 0];

// Color palettes for drawing on canvas matching LCD settings
const themes = {
  green: {
    bg: '#879b29',
    pixel: '#1e2402',
    pixelLight: 'rgba(30, 36, 2, 0.15)',
    gridLine: 'rgba(30, 36, 2, 0.04)'
  },
  amber: {
    bg: '#e69500',
    pixel: '#2b1800',
    pixelLight: 'rgba(43, 24, 0, 0.15)',
    gridLine: 'rgba(43, 24, 0, 0.04)'
  },
  cyan: {
    bg: '#52b2bf',
    pixel: '#052c30',
    pixelLight: 'rgba(5, 44, 48, 0.15)',
    gridLine: 'rgba(5, 44, 48, 0.04)'
  },
  mono: {
    bg: '#b0b5b3',
    pixel: '#111312',
    pixelLight: 'rgba(17, 19, 18, 0.15)',
    gridLine: 'rgba(17, 19, 18, 0.04)'
  }
};

/* ==========================================================================
   Initialization & UI Listeners
   ========================================================================== */
window.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadLeaderboard();
  bindUIEvents();
  bindKeyboardEvents();
  
  // Set default state UI toggles
  setTheme(activeTheme);
  setSpeed(100); // normal
  setMode(activeMode);
  
  // Render the initial Start screen
  draw();
});

// Load stats from LocalStorage
function loadStats() {
  const storedStats = localStorage.getItem('nokia_snake_stats');
  if (storedStats) {
    try {
      stats = JSON.parse(storedStats);
    } catch (e) {
      console.error(e);
    }
  }
  updateStatsUI();
}

function updateStatsUI() {
  document.getElementById('stats-games-played').textContent = stats.gamesPlayed;
  document.getElementById('stats-high-score').textContent = stats.highScore;
  document.getElementById('stats-foods-eaten').textContent = stats.foodsEaten;
  
  const avg = stats.gamesPlayed > 0 ? Math.round(stats.totalScore / stats.gamesPlayed) : 0;
  document.getElementById('stats-avg-score').textContent = avg;
  
  document.getElementById('high-score-val').textContent = String(stats.highScore).padStart(4, '0');
}

function saveStats() {
  localStorage.setItem('nokia_snake_stats', JSON.stringify(stats));
  updateStatsUI();
}

// Leaderboard implementation
let leaderboard = [];

function loadLeaderboard() {
  const storedLeaderboard = localStorage.getItem('nokia_snake_leaderboard');
  if (storedLeaderboard) {
    try {
      leaderboard = JSON.parse(storedLeaderboard);
    } catch (e) {
      console.error(e);
    }
  } else {
    // Default retro high scores
    leaderboard = [
      { name: 'JOK', score: 320, mode: 'Classic' },
      { name: 'NIK', score: 250, mode: 'Warp' },
      { name: 'LEO', score: 180, mode: 'Obstacles' },
      { name: 'SNA', score: 120, mode: 'Classic' },
      { name: 'AAA', score: 50, mode: 'Classic' }
    ];
    saveLeaderboard();
  }
  updateLeaderboardUI();
}

function saveLeaderboard() {
  localStorage.setItem('nokia_snake_leaderboard', JSON.stringify(leaderboard));
}

function updateLeaderboardUI() {
  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '';
  
  if (leaderboard.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="no-records">No high scores yet!</td></tr>';
    return;
  }
  
  // Sort in descending order
  leaderboard.sort((a, b) => b.score - a.score);
  // Keep top 5
  leaderboard = leaderboard.slice(0, 5);
  saveLeaderboard();
  
  leaderboard.forEach((record, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${record.name}</td>
      <td>${record.score}</td>
      <td>${record.mode}</td>
    `;
    tbody.appendChild(tr);
  });
}

function checkHighScoreEligibility(score) {
  if (score === 0) return false;
  if (leaderboard.length < 5) return true;
  return score > leaderboard[leaderboard.length - 1].score;
}

function addLeaderboardRecord(name, score, mode) {
  leaderboard.push({ name: name.toUpperCase(), score: score, mode: mode.charAt(0).toUpperCase() + mode.slice(1) });
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, 5);
  saveLeaderboard();
  updateLeaderboardUI();
}

/* ==========================================================================
   UI Event Handlers
   ========================================================================== */
function bindUIEvents() {
  // Theme Buttons
  const themeButtons = ['theme-green', 'theme-amber', 'theme-cyan', 'theme-mono'];
  themeButtons.forEach(id => {
    document.getElementById(id).addEventListener('click', (e) => {
      synth.playClick();
      const themeName = e.target.getAttribute('data-theme');
      setTheme(themeName);
    });
  });

  // Speed Buttons
  const speedButtons = ['speed-slow', 'speed-normal', 'speed-fast', 'speed-hyper'];
  speedButtons.forEach(id => {
    document.getElementById(id).addEventListener('click', (e) => {
      synth.playClick();
      const speedVal = parseInt(e.target.getAttribute('data-speed'), 10);
      setSpeed(speedVal);
    });
  });

  // Mode Buttons
  const modeButtons = ['mode-classic', 'mode-warp', 'mode-obstacles'];
  modeButtons.forEach(id => {
    document.getElementById(id).addEventListener('click', (e) => {
      synth.playClick();
      const modeVal = e.target.getAttribute('data-mode');
      setMode(modeVal);
    });
  });

  // Sound Toggle
  const soundToggle = document.getElementById('sound-toggle');
  soundToggle.addEventListener('click', () => {
    synth.muted = !synth.muted;
    if (synth.muted) {
      soundToggle.classList.remove('active');
      soundToggle.textContent = 'Sound Muted';
      soundToggle.setAttribute('aria-pressed', 'false');
      document.getElementById('sound-indicator').textContent = '🔇';
    } else {
      synth.init();
      synth.playClick();
      soundToggle.classList.add('active');
      soundToggle.textContent = 'Sound Enabled';
      soundToggle.setAttribute('aria-pressed', 'true');
      document.getElementById('sound-indicator').textContent = '🔊';
    }
  });

  // Reset Leaderboard Button
  document.getElementById('btn-reset-leaderboard').addEventListener('click', () => {
    synth.playClick();
    if (confirm('Are you sure you want to reset the leaderboard?')) {
      leaderboard = [];
      saveLeaderboard();
      updateLeaderboardUI();
    }
  });

  // Nokia Phone Keypad Clicking
  document.querySelectorAll('.nokia-keypad .btn-num').forEach(button => {
    button.addEventListener('click', (e) => {
      // Find the closest button if clicked on label/small span
      const btn = e.target.closest('.btn-num');
      const val = btn.getAttribute('data-val');
      handleKeypadInput(val);
    });
  });

  // Soft Menu Buttons
  document.getElementById('btn-soft-left').addEventListener('click', () => {
    synth.playClick();
    handleSoftLeft();
  });
  
  document.getElementById('btn-soft-scroll').addEventListener('click', () => {
    synth.playClick();
    handleSoftCenter();
  });

  document.getElementById('btn-soft-right').addEventListener('click', () => {
    synth.playClick();
    handleSoftRight();
  });
}

function setTheme(themeName) {
  activeTheme = themeName;
  const glass = document.getElementById('screen-glass');
  
  // Remove existing themes
  glass.className = 'nokia-screen-glass';
  glass.classList.add(`theme-${themeName}`);
  
  // Highlight active button
  document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`theme-${themeName}`).classList.add('active');
  
  // Redraw LCD Screen with the new theme colors
  draw();
}

function setSpeed(speedMs) {
  gameSpeed = speedMs;
  
  // Update UI toggles
  document.querySelectorAll('.setting-group button[data-speed]').forEach(btn => {
    btn.classList.remove('active');
    if (parseInt(btn.getAttribute('data-speed'), 10) === speedMs) {
      btn.classList.add('active');
    }
  });
  
  // If playing, restart interval with new speed
  if (gameState === 'PLAYING') {
    clearInterval(gameLoopId);
    gameLoopId = setInterval(gameStep, gameSpeed);
  }
}

function setMode(mode) {
  if (gameState === 'PLAYING' || gameState === 'PAUSED') {
    if (!confirm('Change mode? Current game will progress reset.')) return;
  }
  
  activeMode = mode;
  document.getElementById('lcd-mode-indicator').textContent = mode.toUpperCase();
  
  // Update toggle buttons
  document.querySelectorAll('.setting-group button[data-mode]').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById(`mode-${mode}`).classList.add('active');
  
  // Build obstacles map for obstacles mode
  buildObstacles();
  
  // Reset game state to start
  resetGameToStart();
}

function buildObstacles() {
  obstacles = [];
  if (activeMode !== 'obstacles') return;
  
  // Obstacle Layout (classic brick patterns in corners and middle)
  // Left border bumper
  for (let y = 3; y < 7; y++) obstacles.push({ x: 4, y: y });
  for (let y = 8; y < 12; y++) obstacles.push({ x: 4, y: y });
  
  // Right border bumper
  for (let y = 3; y < 7; y++) obstacles.push({ x: GRID_WIDTH - 5, y: y });
  for (let y = 8; y < 12; y++) obstacles.push({ x: GRID_WIDTH - 5, y: y });
  
  // Center blocks
  obstacles.push({ x: 9, y: 7 });
  obstacles.push({ x: 10, y: 7 });
  obstacles.push({ x: 9, y: 8 });
  obstacles.push({ x: 10, y: 8 });
}

/* ==========================================================================
   Keyboard Input Mapping
   ========================================================================== */
function bindKeyboardEvents() {
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    
    // Prevent scrolling with arrows/space bar inside game area
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'spacebar'].includes(e.key)) {
      e.preventDefault();
    }
    
    // Direction inputs (only allowed during PLAYING state)
    if (gameState === 'PLAYING') {
      if ((key === 'arrowup' || key === 'w') && direction.y === 0) {
        nextDirection = { x: 0, y: -1 };
        synth.playMove();
      } else if ((key === 'arrowdown' || key === 's') && direction.y === 0) {
        nextDirection = { x: 0, y: 1 };
        synth.playMove();
      } else if ((key === 'arrowleft' || key === 'a') && direction.x === 0) {
        nextDirection = { x: -1, y: 0 };
        synth.playMove();
      } else if ((key === 'arrowright' || key === 'd') && direction.x === 0) {
        nextDirection = { x: 1, y: 0 };
        synth.playMove();
      }
    }
    
    // Pause / Resume key
    if (key === ' ' || key === 'p') {
      synth.playClick();
      togglePause();
    }
    
    // Restart key
    if (key === 'r') {
      synth.playClick();
      resetGameToStart();
    }
    
    // Keypad numbers mappings
    if (e.key === '2') handleKeypadInput('2');
    if (e.key === '8') handleKeypadInput('8');
    if (e.key === '4') handleKeypadInput('4');
    if (e.key === '6') handleKeypadInput('6');
    if (e.key === '5' || e.key === 'Enter') handleKeypadInput('5');
  });
}

function handleKeypadInput(key) {
  synth.playClick();
  
  if (gameState === 'PLAYING') {
    switch (key) {
      case '2': // UP
        if (direction.y === 0) { nextDirection = { x: 0, y: -1 }; synth.playMove(); }
        break;
      case '8': // DOWN
        if (direction.y === 0) { nextDirection = { x: 0, y: 1 }; synth.playMove(); }
        break;
      case '4': // LEFT
        if (direction.x === 0) { nextDirection = { x: -1, y: 0 }; synth.playMove(); }
        break;
      case '6': // RIGHT
        if (direction.x === 0) { nextDirection = { x: 1, y: 0 }; synth.playMove(); }
        break;
      case '5': // Center Action -> Pause
        togglePause();
        break;
    }
  } else if (gameState === 'START') {
    if (key === '5' || key === '2' || key === '8' || key === '4' || key === '6') {
      startGame();
    }
  } else if (gameState === 'GAMEOVER') {
    if (key === '5') {
      resetGameToStart();
    }
  } else if (gameState === 'NAME_ENTRY') {
    // High Score arcade scroll keys
    switch (key) {
      case '2': // UP -> cycle character up
        charSelectIndices[initialIndex] = (charSelectIndices[initialIndex] + 1) % charsList.length;
        initials[initialIndex] = charsList[charSelectIndices[initialIndex]];
        draw();
        break;
      case '8': // DOWN -> cycle character down
        charSelectIndices[initialIndex] = (charSelectIndices[initialIndex] - 1 + charsList.length) % charsList.length;
        initials[initialIndex] = charsList[charSelectIndices[initialIndex]];
        draw();
        break;
      case '4': // LEFT -> move cursor left
        if (initialIndex > 0) {
          initialIndex--;
          draw();
        }
        break;
      case '6': // RIGHT -> move cursor right
        if (initialIndex < 2) {
          initialIndex++;
          draw();
        }
        break;
      case '5': // SELECT -> confirm letter or submit
        if (initialIndex < 2) {
          initialIndex++;
        } else {
          // Finished entering name
          const finalInitials = initials.join('');
          addLeaderboardRecord(finalInitials, score, activeMode);
          synth.playHighScore();
          resetGameToStart();
        }
        draw();
        break;
    }
  }
}

// Phone soft buttons handlers
function handleSoftLeft() {
  // Start or Pause/Resume
  if (gameState === 'START') {
    startGame();
  } else if (gameState === 'PLAYING') {
    togglePause();
  } else if (gameState === 'PAUSED') {
    togglePause();
  } else if (gameState === 'GAMEOVER') {
    startGame();
  } else if (gameState === 'NAME_ENTRY') {
    // Simulate select key confirmation
    handleKeypadInput('5');
  }
}

function handleSoftCenter() {
  handleSoftLeft();
}

function handleSoftRight() {
  // Back/Reset
  if (gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'GAMEOVER') {
    resetGameToStart();
  } else if (gameState === 'NAME_ENTRY') {
    // Exit name entry without saving
    resetGameToStart();
  }
}

/* ==========================================================================
   Game Control Functions
   ========================================================================== */
function startGame() {
  synth.init();
  synth.playStart();
  
  gameState = 'PLAYING';
  
  // Set up initial snake (middle screen, length 4, heading right)
  const startY = Math.floor(GRID_HEIGHT / 2);
  snake = [
    { x: 6, y: startY },
    { x: 5, y: startY },
    { x: 4, y: startY },
    { x: 3, y: startY }
  ];
  
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  isSuperFood = false;
  superFoodTimer = 0;
  
  document.getElementById('score-val').textContent = '0000';
  
  spawnFood();
  
  clearInterval(gameLoopId);
  gameLoopId = setInterval(gameStep, gameSpeed);
  
  draw();
}

function togglePause() {
  if (gameState === 'PLAYING') {
    gameState = 'PAUSED';
    clearInterval(gameLoopId);
    draw();
  } else if (gameState === 'PAUSED') {
    gameState = 'PLAYING';
    gameLoopId = setInterval(gameStep, gameSpeed);
    draw();
  }
}

function resetGameToStart() {
  clearInterval(gameLoopId);
  gameState = 'START';
  score = 0;
  document.getElementById('score-val').textContent = '0000';
  draw();
}

function spawnFood() {
  // Generate coordinates that do not intersect snake or obstacles
  let valid = false;
  let newFood = { x: 0, y: 0 };
  
  while (!valid) {
    newFood.x = Math.floor(Math.random() * GRID_WIDTH);
    newFood.y = Math.floor(Math.random() * GRID_HEIGHT);
    
    // Check if on snake body
    const onSnake = snake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
    // Check if on obstacle
    const onObstacle = obstacles.some(obs => obs.x === newFood.x && obs.y === newFood.y);
    
    if (!onSnake && !onObstacle) {
      valid = true;
    }
  }
  
  food = newFood;
  
  // 15% chance to spawn high-value flashing superfood if snake is at least length 7
  if (snake.length >= 7 && Math.random() < 0.15) {
    isSuperFood = true;
    superFoodTimer = 40; // Ticks before disappearing
  } else {
    isSuperFood = false;
    superFoodTimer = 0;
  }
}

function triggerGameOver() {
  clearInterval(gameLoopId);
  synth.playGameOver();
  
  gameState = 'GAMEOVER';
  
  // Update statistics
  stats.gamesPlayed++;
  stats.foodsEaten += (snake.length - 4); // Starting length is 4
  stats.totalScore += score;
  if (score > stats.highScore) {
    stats.highScore = score;
  }
  saveStats();
  
  // Check high score board eligibility
  const eligible = checkHighScoreEligibility(score);
  if (eligible) {
    // Transition to arcade high score name entry screen
    gameState = 'NAME_ENTRY';
    initials = ['A', 'A', 'A'];
    initialIndex = 0;
    charSelectIndices = [0, 0, 0];
  }
  
  draw();
}

/* ==========================================================================
   Game Tick Engine
   ========================================================================== */
function gameStep() {
  direction = nextDirection;
  
  // Compute new head location
  const head = snake[0];
  const newHead = {
    x: head.x + direction.x,
    y: head.y + direction.y
  };
  
  // Check boundaries based on game mode
  if (activeMode === 'warp') {
    // Screen wrap-around
    if (newHead.x < 0) newHead.x = GRID_WIDTH - 1;
    if (newHead.x >= GRID_WIDTH) newHead.x = 0;
    if (newHead.y < 0) newHead.y = GRID_HEIGHT - 1;
    if (newHead.y >= GRID_HEIGHT) newHead.y = 0;
  } else {
    // Classic and Obstacles mode boundary check
    if (newHead.x < 0 || newHead.x >= GRID_WIDTH || newHead.y < 0 || newHead.y >= GRID_HEIGHT) {
      triggerGameOver();
      return;
    }
  }
  
  // Self collision check (avoid head colliding with snake body segment)
  // Note: Ignore the last segment since it will move unless the snake eats food in this step
  const selfCollision = snake.slice(0, -1).some(segment => segment.x === newHead.x && segment.y === newHead.y);
  if (selfCollision) {
    triggerGameOver();
    return;
  }
  
  // Obstacle collision check (Obstacles mode)
  if (activeMode === 'obstacles') {
    const obstacleCollision = obstacles.some(obs => obs.x === newHead.x && obs.y === newHead.y);
    if (obstacleCollision) {
      triggerGameOver();
      return;
    }
  }
  
  // Move snake
  snake.unshift(newHead);
  
  // Check food collision
  if (newHead.x === food.x && newHead.y === food.y) {
    synth.playEat();
    
    // Add score
    if (isSuperFood) {
      score += 50;
    } else {
      score += 10;
    }
    
    document.getElementById('score-val').textContent = String(score).padStart(4, '0');
    
    // Spawn next food item
    spawnFood();
  } else {
    // Pop tail if no food eaten
    snake.pop();
  }
  
  // Manage superfood timer decay
  if (isSuperFood) {
    superFoodTimer--;
    if (superFoodTimer <= 0) {
      isSuperFood = false;
      // Reposition standard food
      spawnFood();
    }
  }
  
  draw();
}

/* ==========================================================================
   Screen Canvas Rendering
   ========================================================================== */
function draw() {
  const p = themes[activeTheme];
  
  // 1. Clear Screen Canvas
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 2. Draw Subtle Retro Grid Lines (for grid feeling)
  ctx.strokeStyle = p.gridLine;
  ctx.lineWidth = 0.5;
  for (let x = 0; x < GRID_WIDTH; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL_SIZE, 0);
    ctx.lineTo(x * CELL_SIZE, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < GRID_HEIGHT; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL_SIZE);
    ctx.lineTo(canvas.width, y * CELL_SIZE);
    ctx.stroke();
  }

  // 3. Render States
  if (gameState === 'START') {
    drawStartScreen(p);
  } else if (gameState === 'PLAYING' || gameState === 'PAUSED') {
    drawGameplay(p);
    if (gameState === 'PAUSED') {
      drawPauseOverlay(p);
    }
  } else if (gameState === 'GAMEOVER') {
    drawGameOverScreen(p);
  } else if (gameState === 'NAME_ENTRY') {
    drawNameEntryScreen(p);
  }
}

function drawStartScreen(palette) {
  ctx.fillStyle = palette.pixel;
  ctx.textAlign = 'center';
  
  // Game Title
  ctx.font = 'bold 36px var(--font-retro)';
  ctx.fillText('SNAKE II', canvas.width / 2, 70);
  
  ctx.font = '20px var(--font-mono)';
  ctx.fillText('Nokia Classic Edition', canvas.width / 2, 98);
  
  // Decorative lines
  ctx.fillRect(40, 110, canvas.width - 80, 2);
  
  // Prompt instructions
  ctx.font = '16px var(--font-mono)';
  const blink = Math.floor(Date.now() / 600) % 2 === 0;
  if (blink) {
    ctx.fillText('Press [5] or OK to Start', canvas.width / 2, 145);
  } else {
    ctx.fillText('', canvas.width / 2, 145);
  }
  
  ctx.font = '13px var(--font-mono)';
  ctx.fillText('Use Keypad/Arrows to steer', canvas.width / 2, 175);
  ctx.fillText('Press [Space] to Pause', canvas.width / 2, 195);
  
  // Border decoration
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = palette.pixel;
}

function drawGameplay(palette) {
  ctx.fillStyle = palette.pixel;
  
  // Draw Obstacles (if in obstacles mode)
  if (activeMode === 'obstacles') {
    obstacles.forEach(obs => {
      // Crosshatch filled brick block style
      ctx.fillRect(obs.x * CELL_SIZE + 1, obs.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      ctx.fillStyle = palette.bg;
      ctx.fillRect(obs.x * CELL_SIZE + 4, obs.y * CELL_SIZE + 4, CELL_SIZE - 8, CELL_SIZE - 8);
      ctx.fillStyle = palette.pixel;
      ctx.fillRect(obs.x * CELL_SIZE + 6, obs.y * CELL_SIZE + 6, CELL_SIZE - 12, CELL_SIZE - 12);
    });
  }

  // Draw Food
  const fx = food.x * CELL_SIZE;
  const fy = food.y * CELL_SIZE;
  
  if (isSuperFood) {
    // Blinking large pixel block for superfood
    const blink = Math.floor(Date.now() / 150) % 2 === 0;
    if (blink) {
      ctx.fillRect(fx, fy, CELL_SIZE, CELL_SIZE);
      ctx.fillStyle = palette.bg;
      ctx.fillRect(fx + 3, fy + 3, CELL_SIZE - 6, CELL_SIZE - 6);
      ctx.fillStyle = palette.pixel;
      ctx.fillRect(fx + 6, fy + 6, CELL_SIZE - 12, CELL_SIZE - 12);
    }
  } else {
    // Normal Pixel Bug (rounded retro nokia pixel center with antenas style)
    ctx.fillRect(fx + 3, fy + 3, CELL_SIZE - 6, CELL_SIZE - 6);
    ctx.fillRect(fx + 1, fy + 1, 2, 2);
    ctx.fillRect(fx + CELL_SIZE - 3, fy + 1, 2, 2);
    ctx.fillRect(fx + 1, fy + CELL_SIZE - 3, 2, 2);
    ctx.fillRect(fx + CELL_SIZE - 3, fy + CELL_SIZE - 3, 2, 2);
  }
  
  ctx.fillStyle = palette.pixel;

  // Draw Snake body
  snake.forEach((segment, index) => {
    const sx = segment.x * CELL_SIZE;
    const sy = segment.y * CELL_SIZE;
    
    if (index === 0) {
      // Snake Head (distinct design with eyes)
      ctx.fillRect(sx + 1, sy + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      
      // Retro double-dot pixel eyes depending on travel direction
      ctx.fillStyle = palette.bg;
      if (direction.x !== 0) {
        ctx.fillRect(sx + (direction.x > 0 ? 10 : 3), sy + 3, 2, 2);
        ctx.fillRect(sx + (direction.x > 0 ? 10 : 3), sy + 10, 2, 2);
      } else {
        ctx.fillRect(sx + 3, sy + (direction.y > 0 ? 10 : 3), 2, 2);
        ctx.fillRect(sx + 10, sy + (direction.y > 0 ? 10 : 3), 2, 2);
      }
      ctx.fillStyle = palette.pixel;
    } else {
      // Body Segments - Rounded square with inset backlight grid look
      ctx.fillRect(sx + 2, sy + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      ctx.fillStyle = palette.bg;
      ctx.fillRect(sx + 5, sy + 5, CELL_SIZE - 10, CELL_SIZE - 10);
      ctx.fillStyle = palette.pixel;
      ctx.fillRect(sx + 7, sy + 7, CELL_SIZE - 14, CELL_SIZE - 14);
    }
  });
  
  // Border line of play grid for non-warp mode (classic boundaries)
  ctx.strokeStyle = palette.pixel;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
}

function drawPauseOverlay(palette) {
  // Semi-transparent shade overlay using canvas patterns or solid pixel borders
  ctx.fillStyle = palette.bg;
  ctx.fillRect(canvas.width / 2 - 60, canvas.height / 2 - 25, 120, 45);
  ctx.strokeStyle = palette.pixel;
  ctx.lineWidth = 2;
  ctx.strokeRect(canvas.width / 2 - 60, canvas.height / 2 - 25, 120, 45);
  
  ctx.fillStyle = palette.pixel;
  ctx.font = 'bold 20px var(--font-mono)';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 + 5);
}

function drawGameOverScreen(palette) {
  ctx.fillStyle = palette.pixel;
  ctx.textAlign = 'center';
  
  ctx.font = 'bold 36px var(--font-retro)';
  ctx.fillText('GAME OVER', canvas.width / 2, 85);
  
  ctx.font = '18px var(--font-mono)';
  ctx.fillText(`Final Score: ${score}`, canvas.width / 2, 125);
  
  ctx.fillRect(40, 145, canvas.width - 80, 2);
  
  ctx.font = '14px var(--font-mono)';
  ctx.fillText('Press [5] or OK to Continue', canvas.width / 2, 180);
  
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
}

function drawNameEntryScreen(palette) {
  ctx.fillStyle = palette.pixel;
  ctx.textAlign = 'center';
  
  ctx.font = '22px var(--font-mono)';
  ctx.fillText('NEW HIGH SCORE!', canvas.width / 2, 55);
  
  ctx.font = 'bold 36px var(--font-retro)';
  ctx.fillText(String(score), canvas.width / 2, 95);
  
  ctx.font = '16px var(--font-mono)';
  ctx.fillText('ENTER INITIALS:', canvas.width / 2, 130);
  
  // Render [A] [A] [A] letters layout
  ctx.font = 'bold 28px var(--font-retro)';
  const startX = canvas.width / 2 - 45;
  const spacing = 35;
  
  for (let i = 0; i < 3; i++) {
    const lx = startX + i * spacing;
    const ly = 175;
    
    // Draw Letter
    ctx.fillText(initials[i], lx, ly);
    
    // Underline indicator
    if (i === initialIndex) {
      // Blinking cursor underline
      const blink = Math.floor(Date.now() / 250) % 2 === 0;
      if (blink) {
        ctx.fillRect(lx - 10, ly + 5, 20, 3);
      }
    } else {
      ctx.fillRect(lx - 10, ly + 5, 20, 1);
    }
  }
  
  ctx.font = '11px var(--font-mono)';
  ctx.fillText('Keypad 2/8: Change letter | 5: Select', canvas.width / 2, 215);
  
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
}

/* ==========================================================================
   Continuous Blink Animations (Trigger redraws on START/NAME ENTRY blinking)
   ========================================================================== */
setInterval(() => {
  if (gameState === 'START' || gameState === 'NAME_ENTRY' || gameState === 'PAUSED') {
    draw();
  }
}, 100);

// Expose state globally for test automation tools (like Playwright)
window.getGameState = () => gameState;
window.getScore = () => score;
window.getSnake = () => snake;
window.getDirection = () => direction;
window.getActiveMode = () => activeMode;
window.getSpeed = () => gameSpeed;
window.getTheme = () => activeTheme;
window.startGame = startGame;
window.triggerGameOver = triggerGameOver;
window.resetGameToStart = resetGameToStart;
