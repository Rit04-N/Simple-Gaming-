const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const box = 20; 
let snake = [];
let food = {};
let direction = "RIGHT";
let nextDirection = "RIGHT";
let gameInterval;
let score = 0;
let highScore = localStorage.getItem("snakeHighScore") || 0;
let isPaused = false;

// --- AUDIO ENGINE ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function initAudio() { 
    if (!audioCtx) audioCtx = new AudioContext(); 
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playNote(freq, startTime, duration, wave = 'sine') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.1, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(startTime); osc.stop(startTime + duration);
}

function playMelody(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    if (type === 'start') {
        playNote(261, now, 0.1); playNote(329, now+0.1, 0.1); playNote(523, now+0.2, 0.3);
    } else if (type === 'crunch') {
        playNote(400, now, 0.1, 'triangle');
    } else if (type === 'pause') {
        playNote(440, now, 0.05); playNote(330, now+0.05, 0.1);
    } else if (type === 'gameover') {
        playNote(392, now, 0.2); playNote(311, now+0.2, 0.2); playNote(261, now+0.4, 0.5, 'sawtooth');
    }
}

// --- GAME LOGIC ---
function startGame() {
    initAudio();
    playMelody('start');
    isPaused = false;
    document.getElementById("gameOverOverlay").style.display = "none";
    score = 0;
    document.getElementById("scoreDisplay").innerText = "Apples: 0";
    direction = "RIGHT";
    nextDirection = "RIGHT";
    snake = [{ x: 15*box, y: 15*box }, { x: 14*box, y: 15*box }, { x: 13*box, y: 15*box }]; 
    spawnFood();
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(draw, 150); 
}

function togglePause() {
    if (snake.length === 0) return;
    isPaused = !isPaused;
    playMelody('pause');
    if (isPaused) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "40px Arial";
        ctx.fillText("PAUSED", canvas.width / 2 - 80, canvas.height / 2);
    }
}

function spawnFood() {
    food = { x: Math.floor(Math.random()*29)*box, y: Math.floor(Math.random()*29)*box };
}

// --- INPUT LISTENERS ---
document.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); togglePause(); }
    if (isPaused) return;
    if (e.keyCode == 37 && direction != "RIGHT") nextDirection = "LEFT";
    else if (e.keyCode == 38 && direction != "DOWN") nextDirection = "UP";
    else if (e.keyCode == 39 && direction != "LEFT") nextDirection = "RIGHT";
    else if (e.keyCode == 40 && direction != "UP") nextDirection = "DOWN";
});

let touchStartX = 0, touchStartY = 0;
canvas.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, {passive: false});

canvas.addEventListener("touchend", (e) => {
    let diffX = e.changedTouches[0].screenX - touchStartX;
    let diffY = e.changedTouches[0].screenY - touchStartY;
    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 30 && direction != "LEFT") nextDirection = "RIGHT";
        else if (diffX < -30 && direction != "RIGHT") nextDirection = "LEFT";
    } else {
        if (diffY > 30 && direction != "UP") nextDirection = "DOWN";
        else if (diffY < -30 && direction != "DOWN") nextDirection = "UP";
    }
}, {passive: false});

// --- RENDER ---
function drawSnakePart(part, index) {
    const isHead = index === 0;
    ctx.fillStyle = isHead ? "#2ecc71" : "#27ae60";
    ctx.beginPath();
    ctx.roundRect(part.x+1, part.y+1, box-2, box-2, isHead?10:6);
    ctx.fill();

    if (isHead) {
        ctx.fillStyle = "white";
        if (direction === "UP" || direction === "DOWN") {
            ctx.beginPath(); ctx.arc(part.x+7, part.y+10, 3, 0, 7); ctx.fill();
            ctx.beginPath(); ctx.arc(part.x+13, part.y+10, 3, 0, 7); ctx.fill();
        } else {
            ctx.beginPath(); ctx.arc(part.x+10, part.y+7, 3, 0, 7); ctx.fill();
            ctx.beginPath(); ctx.arc(part.x+10, part.y+13, 3, 0, 7); ctx.fill();
        }
    }
}

function draw() {
    if (isPaused) return;
    direction = nextDirection;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    snake.forEach((part, index) => drawSnakePart(part, index));
    
    ctx.fillStyle = "#ff4d6d";
    ctx.beginPath(); ctx.arc(food.x+box/2, food.y+box/2, box/2-2, 0, 7); ctx.fill();

    let sX = snake[0].x, sY = snake[0].y;
    if (direction == "LEFT") sX -= box; if (direction == "UP") sY -= box;
    if (direction == "RIGHT") sX += box; if (direction == "DOWN") sY += box;

    if (sX == food.x && sY == food.y) {
        score++; playMelody('crunch');
        document.getElementById("scoreDisplay").innerText = "Apples: " + score;
        spawnFood();
    } else { snake.pop(); }

    let nH = { x: sX, y: sY };
    if (sX < 0 || sX >= canvas.width || sY < 0 || sY >= canvas.height || collision(nH, snake)) {
        clearInterval(gameInterval); playMelody('gameover');
        showGameOver(); return;
    }
    snake.unshift(nH);
}

function collision(h, a) {
    for (let i=0; i<a.length; i++) if (h.x == a[i].x && h.y == a[i].y) return true;
    return false;
}

function showGameOver() {
    if (score > highScore) { highScore = score; localStorage.setItem("snakeHighScore", highScore); }
    document.getElementById("finalScoreText").innerText = "Apples: " + score;
    document.getElementById("highScoreText").innerText = "High Score: " + highScore;
    document.getElementById("gameOverOverlay").style.display = "flex";
}
