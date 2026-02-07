const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameContainer = document.getElementById('game-container');

// Game State
let gameState = 'START'; // START, PLAYING, GAMEOVER, GAMECLEAR
let gameMode = 'MISSION'; // MISSION, CHALLENGE
let gameTheme = 'LIGHT'; // LIGHT, DARK

// Stats
// Mission Mode Stats
let distanceTravelled = 0; // Float for internal calculation
let displayDistance = 0;   // Integer UI display

// Challenge Mode Stats
let challengeScore = 0;
let bestChallengeScore = localStorage.getItem('skyClimberChallengeBest') || 0;

let gameSpeed = 3;
let baseSpeed = 3;
let speedBonus = 0; // Added for Challenge Mode speed items
const GOAL_DISTANCE = 1000;

// Player Setup
const player = {
    x: 0,
    y: 0,
    width: 30,
    height: 50,
    color: '#00ff88',
    speed: 5,
    lives: 2,
    maxLives: 2,
    invulnerableUntil: 0,
    animFrame: 0,
    animSpeed: 0.2 // Base animation speed
};

// Input Handling
const keys = {
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    w: false, s: false, a: false, d: false,
    Space: false
};

// Keyboard Events
window.addEventListener('keydown', (e) => {
    if (Object.keys(keys).includes(e.key) || e.code === 'Space') {
        keys[e.key] = true;
        // Space behavior depends on state
        if (e.code === 'Space') {
            if (gameState === 'GAMEOVER' || gameState === 'GAMECLEAR') {
                returnToStart();
            }
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (Object.keys(keys).includes(e.key)) {
        keys[e.key] = false;
    }
});

// Touch / Mouse Events for UI Buttons
const btnUp = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');

function setKey(key, value) {
    keys[key] = value;
}

// Helper to add listeners
function addBtnListeners(btn, key) {
    ['mousedown', 'touchstart'].forEach(evt =>
        btn.addEventListener(evt, (e) => { e.preventDefault(); setKey(key, true); btn.classList.add('active'); })
    );
    ['mouseup', 'mouseleave', 'touchend'].forEach(evt =>
        btn.addEventListener(evt, (e) => { e.preventDefault(); setKey(key, false); btn.classList.remove('active'); })
    );
}

addBtnListeners(btnUp, 'ArrowUp');
addBtnListeners(btnDown, 'ArrowDown');
addBtnListeners(btnLeft, 'ArrowLeft');
addBtnListeners(btnRight, 'ArrowRight');

// Tap anywhere to restart (only if game over)
gameContainer.addEventListener('touchstart', (e) => {
    if (e.target.tagName !== 'BUTTON') {
        if (gameState === 'GAMEOVER' || gameState === 'GAMECLEAR') returnToStart();
    }
});
gameContainer.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') {
        if (gameState === 'GAMEOVER' || gameState === 'GAMECLEAR') returnToStart();
    }
});

// Mode Selection (Global Function called from HTML)
window.selectMode = function (mode) {
    gameMode = mode;
    startGame();
};

window.setTheme = function (theme) {
    gameTheme = theme;

    // UI Update
    document.getElementById('btn-light').classList.toggle('active', theme === 'LIGHT');
    document.getElementById('btn-dark').classList.toggle('active', theme === 'DARK');

    // Body Background
    if (theme === 'DARK') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }

    // Redraw static frame if in start screen to update windows immediately
    if (gameState === 'START') {
        draw();
    }
};

// function returnToStart() removed (using the one at bottom)

// Lists
let obstacles = [];
let items = [];
let windows = [];

let frameCount = 0;

function resize() {
    canvas.width = document.getElementById('game-container').offsetWidth;
    canvas.height = document.getElementById('game-container').offsetHeight;

    if (gameState === 'START') {
        player.x = canvas.width / 2 - player.width / 2;
        player.y = canvas.height - player.height - 50;
    }
    initWindows();
}
window.addEventListener('resize', resize);

function initWindows() {
    windows = [];
    const rowHeight = 150;
    const numRows = Math.ceil(canvas.height / rowHeight) + 1;
    for (let i = 0; i < numRows; i++) {
        windows.push({ y: i * rowHeight });
    }
}

function startGame() {
    if (gameState === 'PLAYING') return;

    gameState = 'PLAYING';
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('game-over-screen').classList.remove('active');
    document.getElementById('game-clear-screen').classList.remove('active');
    gameContainer.classList.remove('damage-flash');

    // Reset Stats
    distanceTravelled = 0;
    displayDistance = 0;
    challengeScore = 0;

    baseSpeed = 3;
    gameSpeed = baseSpeed;
    speedBonus = 0; // Reset bonus

    obstacles = [];
    items = [];

    player.lives = 2;
    player.invulnerableUntil = 0;
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - player.height - 50;
    player.animFrame = 0;

    // Toggle UI based on Mode
    if (gameMode === 'MISSION') {
        document.getElementById('mission-score-ui').style.display = 'block';
        document.getElementById('challenge-score-ui').style.display = 'none';
    } else {
        document.getElementById('mission-score-ui').style.display = 'none';
        document.getElementById('challenge-score-ui').style.display = 'block';
    }

    updateUI();
}

function gameOver() {
    if (gameState === 'GAMEOVER') return;

    gameState = 'GAMEOVER';
    document.getElementById('game-over-screen').classList.add('active');

    // Show result based on mode
    const missionRes = document.getElementById('result-mission');
    const challengeRes = document.getElementById('result-challenge');

    if (gameMode === 'MISSION') {
        missionRes.style.display = 'block';
        challengeRes.style.display = 'none';

        // Save to Leaderboard (Mission Mode - Distance on Game Over)
        saveScore('MISSION', displayDistance);

        document.getElementById('final-distance').innerText = displayDistance;
    } else {
        missionRes.style.display = 'none';
        challengeRes.style.display = 'block';

        if (challengeScore > bestChallengeScore) {
            bestChallengeScore = challengeScore;
            localStorage.setItem('skyClimberChallengeBest', bestChallengeScore);
        }

        // Save to Leaderboard
        saveScore('CHALLENGE', challengeScore);

        document.getElementById('final-challenge-score').innerText = challengeScore;
        document.getElementById('final-best-score').innerText = bestChallengeScore;
    }
}

function gameClear() {
    if (gameState === 'GAMECLEAR') return;

    gameState = 'GAMECLEAR';
    document.getElementById('game-clear-screen').classList.add('active');
    // document.getElementById('clear-score').innerText = 1000; 

    // Save to Leaderboard (Mission Mode - Max Score 1000m)
    saveScore('MISSION', 1000);
}

function updateUI() {
    if (gameMode === 'MISSION') {
        document.getElementById('current-distance').innerText = displayDistance;
    } else {
        document.getElementById('challenge-score').innerText = challengeScore;
    }

    // Speed Display
    let displaySpeed = Math.floor(gameSpeed * 10);
    document.getElementById('speed-display').innerText = displaySpeed;

    // Hearts display
    let hearts = '';
    for (let i = 0; i < player.lives; i++) hearts += '♥';
    document.getElementById('lives-container').innerText = hearts;
}

function takeDamage() {
    if (Date.now() < player.invulnerableUntil) return;

    player.lives--;
    player.invulnerableUntil = Date.now() + 2000;

    gameContainer.classList.add('damage-flash');
    setTimeout(() => {
        gameContainer.classList.remove('damage-flash');
    }, 500);

    updateUI();

    if (player.lives <= 0) {
        gameOver();
    }
}

function heal() {
    if (player.lives < player.maxLives) {
        player.lives++;
        updateUI();
    }
}

function update() {
    if (gameState !== 'PLAYING') return;

    // Movement Lateral
    if (keys.ArrowLeft || keys.a) player.x -= player.speed;
    if (keys.ArrowRight || keys.d) player.x += player.speed;

    // Vertical Movement
    if (keys.ArrowUp || keys.w) player.y -= player.speed;
    if (keys.ArrowDown || keys.s) player.y += player.speed;

    // Animation Speed
    if (keys.ArrowUp || keys.w) {
        player.animSpeed = 0.4;
    } else if (keys.ArrowDown || keys.s) {
        player.animSpeed = 0.1;
    } else {
        player.animSpeed = 0.2;
    }
    player.animFrame += player.animSpeed;

    // Boundaries
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
    if (player.y < 0) player.y = 0;
    if (player.y + player.height > canvas.height) player.y = canvas.height - player.height;

    // Stats Updates
    let distDelta = gameSpeed / 60;
    distanceTravelled += distDelta;
    displayDistance = Math.floor(distanceTravelled);

    // Check Goal (Mission Mode Only)
    if (gameMode === 'MISSION' && distanceTravelled >= GOAL_DISTANCE) {
        gameClear();
        return;
    }

    // Difficulty Scaling
    let targetSpeed;
    if (gameMode === 'CHALLENGE') {
        // Challenge Mode: Speed up every 30m, NO LIMIT
        const speedLevel = Math.floor(distanceTravelled / 30);
        targetSpeed = 3 + speedLevel * 0.2 + speedBonus; // Add bonus to target
    } else {
        // Mission Mode: Speed up every 10m, Cap at 15
        const speedLevel = Math.floor(distanceTravelled / 10);
        targetSpeed = Math.min(15, 3 + speedLevel * 0.2);
    }

    if (gameSpeed < targetSpeed) {
        gameSpeed += 0.005;
    }

    // Move Background
    windows.forEach(w => {
        w.y += gameSpeed;
        if (w.y > canvas.height) {
            w.y = -150;
        }
    });

    // Spawner
    frameCount++;
    if (frameCount > 500 / (gameSpeed * 1.2)) {
        spawnObstacle();

        // Items logic
        if (gameMode === 'CHALLENGE') {
            // Score Item (5% chance)
            if (Math.random() < 0.05) {
                spawnItem('score');
            }
            // Speed Item (5% chance) - Red-Purple
            else if (Math.random() < 0.05) {
                spawnItem('speed');
            }
            // Warp Item (5% chance) - Confusion
            else if (Math.random() < 0.05) {
                spawnItem('warp');
            }
            // Heal Item (2% chance - rarer)
            else if (Math.random() < 0.02) {
                spawnItem('heart');
            }
        } else {
            // Mission Mode: Only Heal Items (5%)
            if (Math.random() < 0.05) {
                spawnItem('heart');
            }
        }

        frameCount = 0;
    }

    // Move & Collision: Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.y += gameSpeed + obs.speedOffset;
        obs.rotation += obs.rotSpeed;

        // Challenge Mode: Score for avoiding
        // Check if passed screen bottom
        if (obs.y > canvas.height) {
            if (gameMode === 'CHALLENGE' && !obs.processed) {
                challengeScore += 10; // Point for avoidance
            }
            obstacles.splice(i, 1);
            continue;
        }

        let hitboxPad = 8;
        if (
            player.x + hitboxPad < obs.x + obs.width - hitboxPad &&
            player.x + player.width - hitboxPad > obs.x + hitboxPad &&
            player.y + hitboxPad < obs.y + obs.height - hitboxPad &&
            player.y + player.height - hitboxPad > obs.y + hitboxPad
        ) {
            takeDamage();
            obstacles.splice(i, 1); // Remove obstacle on hit
        }
    }

    // Move & Collision: Items
    for (let i = items.length - 1; i >= 0; i--) {
        let item = items[i];
        item.y += gameSpeed;

        if (item.y > canvas.height) {
            items.splice(i, 1);
            continue;
        }

        if (
            player.x < item.x + item.width &&
            player.x + player.width > item.x &&
            player.y < item.y + item.height &&
            player.y + player.height > item.y
        ) {
            // Effect
            if (item.type === 'heart') {
                heal();
            } else if (item.type === 'score') {
                challengeScore += 100; // Big bonus
            } else if (item.type === 'speed') {
                gameSpeed += 1.0; // +10 display speed (Instant boost)
                speedBonus += 1.0; // Permanent curve shift
            } else if (item.type === 'warp') {
                // Random Warp
                player.x = Math.random() * (canvas.width - player.width);
                player.y = Math.random() * (canvas.height - player.height);
            }

            items.splice(i, 1);
        }
    }

    updateUI();
}

function spawnObstacle() {
    const types = ['debris', 'glass', 'pot'];
    const type = types[Math.floor(Math.random() * types.length)];
    const size = Math.random() * 30 + 30;

    let color = null;
    let strokeColor = null;

    if (gameTheme === 'LIGHT') {
        // Colorful, No Blue
        // Palette: Red, Orange, Yellow, Pink, Purple, Green
        const colors = ['#ff3366', '#ff9933', '#ffd700', '#ff66cc', '#9933ff', '#33cc33'];
        color = colors[Math.floor(Math.random() * colors.length)];
        strokeColor = '#fff';
    }

    obstacles.push({
        type: type,
        x: Math.random() * (canvas.width - size),
        y: -size,
        width: size,
        height: size,
        speedOffset: Math.random() * 3 + 2,
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.1,
        processed: false,
        themeColor: color, // Store pre-picked color for Light Mode
        themeStroke: strokeColor
    });
}

function spawnItem(type) {
    items.push({
        type: type,
        x: Math.random() * (canvas.width - 30),
        y: -30,
        width: 30,
        height: 30
    });
}

function drawPlayer(x, y, w, h) {
    if (Date.now() < player.invulnerableUntil && Math.floor(Date.now() / 100) % 2 === 0) {
        return;
    }

    ctx.fillStyle = player.color;
    // Head
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 10, 8, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillRect(x + w / 2 - 4, y + 15, 8, 20);

    // Limbs
    const limbOffset = Math.sin(player.animFrame) * 10;
    ctx.strokeStyle = player.color;
    ctx.lineWidth = 4;

    // Arms
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 4, y + 20);
    ctx.lineTo(x, y + 5 + limbOffset);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w / 2 + 4, y + 20);
    ctx.lineTo(x + w, y + 5 - limbOffset);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 2, y + 35);
    ctx.lineTo(x, y + h - 5 - limbOffset);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w / 2 + 2, y + 35);
    ctx.lineTo(x + w, y + h - 5 + limbOffset);
    ctx.stroke();
}

function drawObstacle(obs) {
    ctx.save();
    ctx.translate(obs.x + obs.width / 2, obs.y + obs.height / 2);
    ctx.rotate(obs.rotation);

    if (gameTheme === 'LIGHT' && obs.themeColor) {
        // Light Mode: Use the colorful pre-picked color
        ctx.fillStyle = obs.themeColor;

        if (obs.type === 'debris') {
            // Jagged shape for debris
            ctx.beginPath();
            ctx.moveTo(-obs.width / 2, -obs.height / 2);
            ctx.lineTo(obs.width / 2, -obs.height / 3);
            ctx.lineTo(obs.width / 3, obs.height / 2);
            ctx.lineTo(-obs.width / 2, obs.height / 3);
            ctx.fill();
        } else if (obs.type === 'glass') {
            // Shard shape
            ctx.beginPath();
            ctx.moveTo(0, -obs.height / 2);
            ctx.lineTo(obs.width / 2, obs.height / 2);
            ctx.lineTo(-obs.width / 2, 0);
            ctx.fill();
        } else {
            // Pot shape (Circle/Box) or just Box
            ctx.fillRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
        }

    } else {
        // Dark Mode: Original Colors
        if (obs.type === 'debris') {
            ctx.fillStyle = '#888';
            ctx.beginPath();
            ctx.moveTo(-obs.width / 2, -obs.height / 2);
            ctx.lineTo(obs.width / 2, -obs.height / 3);
            ctx.lineTo(obs.width / 3, obs.height / 2);
            ctx.lineTo(-obs.width / 2, obs.height / 3);
            ctx.fill();
        } else if (obs.type === 'glass') {
            ctx.fillStyle = 'rgba(200, 240, 255, 0.6)';
            ctx.beginPath();
            ctx.moveTo(0, -obs.height / 2);
            ctx.lineTo(obs.width / 2, obs.height / 2);
            ctx.lineTo(-obs.width / 2, 0);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (obs.type === 'pot') {
            ctx.fillStyle = '#d2691e';
            ctx.fillRect(-obs.width / 3, -obs.height / 3, obs.width * 0.6, obs.height * 0.6);
            ctx.fillStyle = 'forestgreen';
            ctx.beginPath();
            ctx.arc(0, -obs.height / 3, obs.width / 3, 0, Math.PI, true);
            ctx.fill();
        }
    }

    ctx.restore();
}

function drawItem(item) {
    if (item.type === 'heart') {
        ctx.fillStyle = '#ff3366';
        ctx.font = '30px Arial';
        ctx.fillText('♥', item.x, item.y + 25);
    } else if (item.type === 'score') {
        // Gold Coin / Gem visual
        ctx.fillStyle = '#ffd700'; // Gold
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffd700';

        ctx.beginPath();
        ctx.arc(item.x + 15, item.y + 15, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('$', item.x + 8, item.y + 22);

        ctx.shadowBlur = 0;
    } else if (item.type === 'speed') {
        // Speed Up Item - Red-Purple
        ctx.fillStyle = '#c71585'; // Medium Violet Red
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#c71585';

        ctx.beginPath();
        ctx.arc(item.x + 15, item.y + 15, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('UP', item.x + 4, item.y + 21);

        ctx.shadowBlur = 0;
    } else if (item.type === 'warp') {
        // Warp Item - Mystery Color
        ctx.fillStyle = '#4b0082'; // Indigo

        ctx.beginPath();
        ctx.moveTo(item.x + 15, item.y); // Top
        ctx.lineTo(item.x + 30, item.y + 15); // Right
        ctx.lineTo(item.x + 15, item.y + 30); // Bottom
        ctx.lineTo(item.x, item.y + 15); // Left
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('!?', item.x + 8, item.y + 21);
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = '#111'; // Building wall color (behind windows)
    windows.forEach(w => {
        const winWidth = 40;
        const winHeight = 60;
        const gap = (canvas.width - (winWidth * 4)) / 5;
        for (let c = 0; c < 4; c++) {
            let wx = gap + c * (winWidth + gap);

            if (gameTheme === 'LIGHT') {
                // Light Mode: Light Blue Windows
                ctx.fillStyle = 'rgba(100, 180, 255, 0.6)';
                ctx.fillRect(wx, w.y, winWidth, winHeight);
                // Highlight
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.fillRect(wx, w.y + winHeight - 5, winWidth, 5);
            } else {
                // Dark Mode: Dark/Black Windows (Original Style)
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(wx, w.y, winWidth, winHeight);
                // Highlight (Faint)
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.fillRect(wx, w.y + winHeight - 5, winWidth, 5);
            }
        }
    });

    drawPlayer(player.x, player.y, player.width, player.height);

    obstacles.forEach(obs => drawObstacle(obs));
    items.forEach(item => drawItem(item));
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

resize();
loop();

// Leaderboard System
let playerName = localStorage.getItem('skyClimberPlayerName') || `Player${Math.floor(Math.random() * 1000)}`;
const nameInput = document.getElementById('player-name-input');
if (nameInput) {
    nameInput.value = playerName;
    nameInput.addEventListener('change', (e) => {
        let newName = e.target.value.trim();
        if (newName.length > 0) {
            playerName = newName;
            localStorage.setItem('skyClimberPlayerName', playerName);
        } else {
            e.target.value = playerName;
        }
    });
}

function saveScore(mode, value) {
    let key = `skyClimberRanking_${mode}`;
    let ranking = JSON.parse(localStorage.getItem(key) || '[]');

    // Add new score
    ranking.push({ name: playerName, score: value, date: new Date().toISOString() });

    // Sort descending
    ranking.sort((a, b) => b.score - a.score);

    // Keep top 10
    ranking = ranking.slice(0, 10);

    localStorage.setItem(key, JSON.stringify(ranking));
}

function getRanking(mode) {
    let key = `skyClimberRanking_${mode}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
}

// UI Functions for Ranking
window.showRanking = function () {
    gameState = 'RANKING';
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('ranking-screen').style.display = 'block';
    renderRanking('CHALLENGE'); // Default tab
};

window.switchRankingTab = function (mode) {
    // Update tabs
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(t => t.classList.remove('active'));

    if (mode === 'CHALLENGE') tabs[0].classList.add('active');
    else tabs[1].classList.add('active');

    renderRanking(mode);
};

function renderRanking(mode) {
    const list = document.getElementById('ranking-list');
    list.innerHTML = '';

    const ranking = getRanking(mode);

    if (ranking.length === 0) {
        list.innerHTML = '<li style="color:#888; text-align:center;">No Records Yet</li>';
        return;
    }

    ranking.forEach((entry, index) => {
        const li = document.createElement('li');
        li.className = 'rank-item';

        let displayScore = entry.score;
        if (mode === 'MISSION') displayScore += 'm';

        li.innerHTML = `
            <span class="rank-rank">${index + 1}</span>
            <span class="rank-name">${entry.name.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>
            <span class="rank-score">${displayScore}</span>
        `;
        list.appendChild(li);
    });
}

function returnToStart() {
    gameState = 'START';
    document.getElementById('start-screen').classList.add('active');
    document.getElementById('game-over-screen').classList.remove('active');
    document.getElementById('game-clear-screen').classList.remove('active');
    document.getElementById('ranking-screen').style.display = 'none';

    // Reset visual
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - player.height - 50;
    draw();
}
