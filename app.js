// Neo Snake Game - Bug Fixes for Movement, Pause, Settings
class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Game settings
        this.settings = {
            gridSize: 20,
            initialSpeed: 200,
            speedIncrement: 10,
            maxSpeed: 80,
            canvasWidth: 600,
            canvasHeight: 400
        };

        /* Game State */
        this.gameState = 'start'; // start | playing | paused | gameOver
        this.score = 0;
        this.highScore = this.loadHighScore();
        this.level = 1;
        this.gameSpeed = this.settings.initialSpeed;

        /* Snake & Food */
        this.snake = [];
        this.direction = { x: 0, y: 0 }; // Start stationary until first input
        this.nextDirection = { x: 0, y: 0 };
        this.food = { x: 0, y: 0 };

        /* Runtime */
        this.lastTime = 0;
        this.gameLoop = null;

        /* Options */
        this.soundEnabled = true;
        this.gameMode = 'classic';
        this.speedSetting = 'normal';

        /* Flags */
        this.pausedBySettings = false;
        this.settingsOpen = false;

        /* Touch */
        this.touchStartX = 0;
        this.touchStartY = 0;

        this.init();
    }

    /* -------------------- INITIALISATION -------------------- */
    init() {
        this.setupCanvas();
        this.cacheDom();
        this.bindEvents();
        this.resetGame();
        this.updateScoreboard();
        this.showScreen('startScreen');
        console.log('Snake Game ready');
    }

    setupCanvas() {
        this.canvas.width = this.settings.canvasWidth;
        this.canvas.height = this.settings.canvasHeight;
        this.gridWidth = Math.floor(this.settings.canvasWidth / this.settings.gridSize);
        this.gridHeight = Math.floor(this.settings.canvasHeight / this.settings.gridSize);
    }

    cacheDom() {
        this.dom = {
            startBtn: document.getElementById('startBtn'),
            pauseBtn: document.getElementById('pauseBtn'),
            resumeBtn: document.getElementById('resumeBtn'),
            restartBtn: document.getElementById('restartBtn'),
            restartFromPause: document.getElementById('restartFromPause'),
            playAgainBtn: document.getElementById('playAgainBtn'),
            settingsBtn: document.getElementById('settingsBtn'),
            closeSettings: document.getElementById('closeSettings'),
            speedSetting: document.getElementById('speedSetting'),
            gameMode: document.getElementById('gameMode'),
            soundToggle: document.getElementById('soundToggle'),
            settingsPanel: document.getElementById('settingsPanel'),
            screens: {
                start: document.getElementById('startScreen'),
                pause: document.getElementById('pauseScreen'),
                over: document.getElementById('gameOverScreen')
            },
            // Scoreboard elements
            currentScore: document.getElementById('currentScore'),
            highScore: document.getElementById('highScore'),
            level: document.getElementById('level'),
            speed: document.getElementById('speed'),
            length: document.getElementById('length'),
            finalScore: document.getElementById('finalScore'),
            newHighScore: document.getElementById('newHighScore'),
            particleContainer: document.getElementById('particleContainer')
        };
    }

    bindEvents() {
        /* Buttons */
        this.dom.startBtn?.addEventListener('click', () => this.startGame());
        this.dom.pauseBtn?.addEventListener('click', () => this.pauseGame());
        this.dom.resumeBtn?.addEventListener('click', () => this.resumeGame());
        this.dom.restartBtn?.addEventListener('click', () => this.restartGame());
        this.dom.restartFromPause?.addEventListener('click', () => this.restartGame());
        this.dom.playAgainBtn?.addEventListener('click', () => this.restartGame());

        /* Settings */
        this.dom.settingsBtn?.addEventListener('click', () => this.openSettings());
        this.dom.closeSettings?.addEventListener('click', () => this.closeSettings());
        this.dom.speedSetting?.addEventListener('change', (e) => this.setSpeedSetting(e.target.value));
        this.dom.gameMode?.addEventListener('change', (e) => this.setGameMode(e.target.value));
        this.dom.soundToggle?.addEventListener('change', (e) => this.soundEnabled = e.target.checked);

        /* Keyboard */
        document.addEventListener('keydown', (e) => this.handleKeydown(e));

        /* Touch */
        this.setupTouchControls();
        this.setupSwipeControls();

        /* Resize */
        window.addEventListener('resize', () => this.setupCanvas());

        /* Visibility */
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.gameState === 'playing') this.pauseGame();
        });
    }

    /* -------------------- GAME STATE -------------------- */
    startGame() {
        if (this.gameState === 'playing') return;
        this.hideAllScreens();
        this.resetGame();
        this.gameState = 'playing';
        this.lastTime = performance.now();
        this.gameLoop = requestAnimationFrame((t) => this.loop(t));
        this.playTone('start');
    }

    pauseGame() {
        if (this.gameState !== 'playing') return;
        this.gameState = 'paused';
        this.stopLoop();
        this.showScreen('pauseScreen');
    }

    resumeGame() {
        if (this.gameState !== 'paused') return;
        this.hideAllScreens();
        this.gameState = 'playing';
        this.lastTime = performance.now();
        this.gameLoop = requestAnimationFrame((t) => this.loop(t));
    }

    restartGame() {
        this.stopLoop();
        this.gameState = 'start';
        this.hideAllScreens();
        this.startGame();
    }

    gameOver() {
        this.stopLoop();
        this.gameState = 'gameOver';
        this.dom.finalScore.textContent = this.score;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
            this.dom.newHighScore.style.display = 'block';
        } else {
            this.dom.newHighScore.style.display = 'none';
        }
        this.updateScoreboard();
        this.showScreen('gameOverScreen');
        this.playTone('gameOver');
    }

    stopLoop() {
        if (this.gameLoop) cancelAnimationFrame(this.gameLoop);
        this.gameLoop = null;
    }

    /* -------------------- SETTINGS PANEL -------------------- */
    openSettings() {
        if (this.settingsOpen) return;
        if (this.gameState === 'playing') {
            this.pauseGame();
            this.pausedBySettings = true;
        }
        this.dom.settingsPanel.classList.remove('hidden');
        this.settingsOpen = true;
    }

    closeSettings() {
        if (!this.settingsOpen) return;
        this.dom.settingsPanel.classList.add('hidden');
        this.settingsOpen = false;
        if (this.pausedBySettings) {
            this.pausedBySettings = false;
            this.resumeGame();
        }
    }

    setSpeedSetting(speed) {
        this.speedSetting = speed;
        this.gameSpeed = this.initialSpeed();
    }

    setGameMode(mode) {
        this.gameMode = mode;
    }

    /* -------------------- GAME INITIALISATION -------------------- */
    resetGame() {
        // Center snake
        const centerX = Math.floor(this.gridWidth / 2);
        const centerY = Math.floor(this.gridHeight / 2);
        this.snake = [{ x: centerX, y: centerY }];

        // Direction reset (stationary)
        this.direction = { x: 0, y: 0 };
        this.nextDirection = { x: 0, y: 0 };

        // Score / level
        this.score = 0;
        this.level = 1;
        this.gameSpeed = this.initialSpeed();

        // Food placement
        this.placeFood();
    }

    initialSpeed() {
        const map = { slow: 250, normal: 200, fast: 150 };
        return map[this.speedSetting] || 200;
    }

    /* -------------------- MAIN LOOP -------------------- */
    loop(timestamp) {
        if (this.gameState !== 'playing') return;

        const delta = timestamp - this.lastTime;
        if (delta >= this.gameSpeed) {
            this.update();
            this.lastTime = timestamp;
        }
        this.render();
        this.gameLoop = requestAnimationFrame((t) => this.loop(t));
    }

    /* -------------------- UPDATE -------------------- */
    update() {
        // Stay idle if no direction yet
        if (this.direction.x === 0 && this.direction.y === 0 && (this.nextDirection.x === 0 && this.nextDirection.y === 0)) {
            return;
        }

        // Apply next direction
        this.direction = { ...this.nextDirection };

        // Calculate new head
        const head = { x: this.snake[0].x + this.direction.x, y: this.snake[0].y + this.direction.y };

        // Boundary collision
        if (head.x < 0 || head.x >= this.gridWidth || head.y < 0 || head.y >= this.gridHeight) {
            return this.gameOver();
        }

        // Self collision
        if (this.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
            return this.gameOver();
        }

        // Move
        this.snake.unshift(head);

        // Food?
        if (head.x === this.food.x && head.y === this.food.y) {
            this.consumeFood();
        } else {
            this.snake.pop();
        }
    }

    consumeFood() {
        this.score += 10;
        this.updateLevelAndSpeed();
        this.placeFood();
        this.updateScoreboard();
        this.spawnParticles(this.food.x, this.food.y);
        this.playTone('eat');
    }

    updateLevelAndSpeed() {
        this.level = Math.floor(this.score / 50) + 1;
        this.gameSpeed = Math.max(this.initialSpeed() - (this.level - 1) * this.settings.speedIncrement, this.settings.maxSpeed);
    }

    placeFood() {
        do {
            this.food = {
                x: Math.floor(Math.random() * this.gridWidth),
                y: Math.floor(Math.random() * this.gridHeight)
            };
        } while (this.snake.some(seg => seg.x === this.food.x && seg.y === this.food.y));
    }

    /* -------------------- RENDER -------------------- */
    render() {
        // Clear
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // BG
        this.ctx.fillStyle = 'rgba(0,0,0,0.85)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        // Grid
        this.drawGrid();
        // Food
        this.drawFood();
        // Snake
        this.drawSnake();
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        this.ctx.lineWidth = 1;
        for (let x = 0; x <= this.gridWidth; x++) {
            const px = x * this.settings.gridSize;
            this.ctx.beginPath();
            this.ctx.moveTo(px, 0);
            this.ctx.lineTo(px, this.canvas.height);
            this.ctx.stroke();
        }
        for (let y = 0; y <= this.gridHeight; y++) {
            const py = y * this.settings.gridSize;
            this.ctx.beginPath();
            this.ctx.moveTo(0, py);
            this.ctx.lineTo(this.canvas.width, py);
            this.ctx.stroke();
        }
    }

    drawSnake() {
        this.snake.forEach((seg, idx) => {
            const px = seg.x * this.settings.gridSize;
            const py = seg.y * this.settings.gridSize;
            this.ctx.fillStyle = idx === 0 ? '#00FF41' : '#00CC33';
            this.ctx.shadowColor = this.ctx.fillStyle;
            this.ctx.shadowBlur = idx === 0 ? 12 : 6;
            this.ctx.fillRect(px + 1, py + 1, this.settings.gridSize - 2, this.settings.gridSize - 2);
            this.ctx.shadowBlur = 0;
        });
    }

    drawFood() {
        const px = this.food.x * this.settings.gridSize + this.settings.gridSize / 2;
        const py = this.food.y * this.settings.gridSize + this.settings.gridSize / 2;
        this.ctx.fillStyle = '#FF0080';
        this.ctx.shadowColor = '#FF0080';
        this.ctx.shadowBlur = 15;
        this.ctx.beginPath();
        this.ctx.arc(px, py, this.settings.gridSize / 2 - 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
    }

    /* -------------------- SCOREBOARD -------------------- */
    updateScoreboard() {
        this.dom.currentScore.textContent = this.score;
        this.dom.highScore.textContent = this.highScore;
        this.dom.level.textContent = this.level;
        this.dom.speed.textContent = (this.initialSpeed() / this.gameSpeed).toFixed(1) + 'x';
        this.dom.length.textContent = this.snake.length;
    }

    /* -------------------- PARTICLES -------------------- */
    spawnParticles(gridX, gridY) {
        const container = this.dom.particleContainer;
        if (!container) return;
        const baseLeft = gridX * this.settings.gridSize + this.settings.gridSize / 2;
        const baseTop = gridY * this.settings.gridSize + this.settings.gridSize / 2;
        for (let i = 0; i < 8; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = baseLeft + 'px';
            p.style.top = baseTop + 'px';
            p.style.transform = `translate(${(Math.random() - 0.5) * 80}px, ${(Math.random() - 0.5) * 80}px)`;
            container.appendChild(p);
            setTimeout(() => container.removeChild(p), 1000);
        }
    }

    /* -------------------- INPUT HANDLING -------------------- */
    handleKeydown(e) {
        const key = e.code;
        if (key === 'Space') {
            if (this.gameState === 'start') return this.startGame();
            if (this.gameState === 'playing') return this.pauseGame();
            if (this.gameState === 'paused') return this.resumeGame();
            if (this.gameState === 'gameOver') return this.restartGame();
        }
        if (key === 'Escape') {
            if (this.gameState === 'playing') return this.pauseGame();
            if (this.gameState === 'paused') return this.resumeGame();
        }
        if (this.gameState !== 'playing') return; // movement only while playing
        const dirMap = {
            ArrowUp: 'up', KeyW: 'up',
            ArrowDown: 'down', KeyS: 'down',
            ArrowLeft: 'left', KeyA: 'left',
            ArrowRight: 'right', KeyD: 'right'
        };
        if (dirMap[key]) {
            this.setNextDirection(dirMap[key]);
            e.preventDefault();
        }
    }

    setNextDirection(dir) {
        const dirs = { up: {x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
        const newDir = dirs[dir];
        if (!newDir) return;
        if (this.snake.length > 1) {
            // Prevent 180° turns
            if (this.direction.x === -newDir.x && this.direction.y === -newDir.y) return;
        }
        this.nextDirection = newDir;
        // If snake was stationary, apply immediately so first move happens quickly
        if (this.direction.x === 0 && this.direction.y === 0) {
            this.direction = newDir;
        }
    }

    setupTouchControls() {
        document.querySelectorAll('.dpad-btn').forEach(btn => {
            btn.addEventListener('touchstart', (ev) => {
                ev.preventDefault();
                this.setNextDirection(ev.target.dataset.direction);
            });
            btn.addEventListener('click', (ev) => {
                this.setNextDirection(ev.target.dataset.direction);
            });
        });
    }

    setupSwipeControls() {
        this.canvas.addEventListener('touchstart', (e) => {
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
        }, {passive:false});
        this.canvas.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - this.touchStartX;
            const dy = e.changedTouches[0].clientY - this.touchStartY;
            const absX = Math.abs(dx), absY = Math.abs(dy);
            if (Math.max(absX, absY) > 30) {
                if (absX > absY) this.setNextDirection(dx > 0 ? 'right' : 'left');
                else this.setNextDirection(dy > 0 ? 'down' : 'up');
            }
        }, {passive:false});
    }

    /* -------------------- PERSISTENCE -------------------- */
    loadHighScore() {
        try { return parseInt(localStorage.getItem('snakeHS')) || 0; } catch { return 0; }
    }
    saveHighScore() {
        try { localStorage.setItem('snakeHS', String(this.highScore)); } catch {}
    }

    /* -------------------- SOUND -------------------- */
    playTone(type) {
        if (!this.soundEnabled) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            const now = ctx.currentTime;
            if (type === 'eat') {
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.start(now); osc.stop(now + 0.13);
            } else if (type === 'gameOver') {
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.exponentialRampToValueAtTime(110, now + 0.4);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                osc.start(now); osc.stop(now + 0.41);
            } else if (type === 'start') {
                osc.frequency.setValueAtTime(660, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.start(now); osc.stop(now + 0.21);
            }
        } catch {
            /* noop */
        }
    }
}

/* -------------------- INIT -------------------- */
document.addEventListener('DOMContentLoaded', () => new SnakeGame());