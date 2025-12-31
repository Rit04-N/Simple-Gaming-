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
let isGameRunning = false;

// --- AUDIO ENGINE (Simple beeps) ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function initAudio() { 
    if (!audioCtx) audioCtx = new AudioContext(); 
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq, type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = type;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.1);
    osc.stop(audioCtx.currentTime + 0.1);
}

// --- GAME LOGIC ---
function startGame() {
    initAudio();
    isGameRunning = true;
    isPaused = false;
    document.getElementById("gameOverOverlay").style.display = "none";
    document.getElementById("pauseBtn").innerText = "PAUSE"; // Reset text
    score = 0;
    document.getElementById("scoreDisplay").innerText = "Apples: 0";
    
    direction = "RIGHT";
    nextDirection = "RIGHT";
    snake = [{ x: 5*box, y: 5*box }, { x: 4*box, y: 5*box }, { x: 3*box, y: 5*box }]; 
    spawnFood();
    
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(draw, 150); 
}

function togglePause() {
    if (!isGameRunning) return;
    
    isPaused = !isPaused;
    const btn = document.getElementById("pauseBtn");
    
    if (isPaused) {
        btn.innerText = "RESUME";
        // Draw Pause Screen
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "30px Arial";
        ctx.textAlign = "center";
        ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
    } else {
        btn.innerText = "PAUSE";
    }
}

// --- JOYSTICK CONTROLLER ---
function setDir(newDir) {
    // Prevent default scrolling on mobile if needed
    if(isPaused || !isGameRunning) return;

    // Logic to prevent 180 degree turns
    if (newDir === "LEFT" && direction !== "RIGHT") nextDirection = "LEFT";
    else if (newDir === "UP" && direction !== "DOWN") nextDirection = "UP";
    else if (newDir === "RIGHT" && direction !== "LEFT") nextDirection = "RIGHT";
    else if (newDir === "DOWN" && direction !== "UP") nextDirection = "DOWN";
}

function spawnFood() {
    food = { x: Math.floor(Math.random()*29)*box, y: Math.floor(Math.random()*29)*box };
}

// --- KEYBOARD LISTENERS ---
document.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); togglePause(); }
    
    // Allow keyboard to work alongside joystick
    if (e.keyCode == 37) setDir("LEFT");
    else if (e.keyCode == 38) setDir("UP");
    else if (e.keyCode == 39) setDir("RIGHT");
    else if (e.keyCode == 40) setDir("DOWN");
});

// --- RENDER ---
function drawSnakePart(part, index) {
    const isHead = index === 0;
    ctx.fillStyle = isHead ? "#2ecc71" : "#27ae60";
    ctx.beginPath();
    ctx.roundRect(part.x+1, part.y+1, box-2, box-2, isHead?8:4);
    ctx.fill();
    
    if(isHead) { // Simple eyes
         ctx.fillStyle = "black";
         ctx.fillRect(part.x+5, part.y+5, 4, 4);
         ctx.fillRect(part.x+11, part.y+5, 4, 4);
    }
}

function draw() {
    if (isPaused) return;
    
    direction = nextDirection;
    
    // Clear Screen
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw Snake
    snake.forEach((part, index) => drawSnakePart(part, index));
    
    // Draw Food
    ctx.fillStyle = "#ff4d6d";
    ctx.beginPath(); 
    ctx.arc(food.x+box/2, food.y+box/2, box/2-2, 0, 2*Math.PI); 
    ctx.fill();

    // Move Head
    let sX = snake[0].x;
    let sY = snake[0].y;

    if (direction == "LEFT") sX -= box;
    if (direction == "UP") sY -= box;
    if (direction == "RIGHT") sX += box;
    if (direction == "DOWN") sY += box;

    // Check Collision (Food)
    if (sX == food.x && sY == food.y) {
        score++;
        playTone(600, 'triangle'); // Crunch sound
        document.getElementById("scoreDisplay").innerText = "Apples: " + score;
        spawnFood();
    } else {
        snake.pop(); // Remove tail
    }

    // Check Collision (Walls/Self)
    let newHead = { x: sX, y: sY };
    
    if (sX < 0 || sX >= canvas.width || sY < 0 || sY >= canvas.height || collision(newHead, snake)) {
        clearInterval(gameInterval);
        playTone(150, 'sawtooth'); // Game over sound
        isGameRunning = false;
        showGameOver();
        return;
    }
    
    snake.unshift(newHead);
}

function collision(head, array) {
    for (let i = 0; i < array.length; i++) {
        if (head.x == array[i].x && head.y == array[i].y) return true;
    }
    return false;
}

function showGameOver() {
    if (score > highScore) { 
        highScore = score; 
        localStorage.setItem("snakeHighScore", highScore); 
    }
    document.getElementById("finalScoreText").innerText = "Apples: " + score;
    document.getElementById("highScoreText").innerText = "High Score: " + highScore;
    document.getElementById("gameOverOverlay").style.display = "flex";
}
