const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 400;
canvas.height = 400;

// Game State
let gameActive = false;
let isPaused = true;
let animationFrameId;

// Entities
let mamaDuck = { x: 200, y: 200, baseSpeed: 3, boostSpeed: 7 };
let ducklings = [];
let history = []; 
let lostDuckling = { x: 100, y: 100 };
let nest = { x: 340, y: 60, size: 40 };
let pikeFish = { x: -50, y: 150, speed: 2.2 };
let crocodile = { x: 500, y: 300, speed: -1.2 };

// Stats
let score = 0;
let highScore = localStorage.getItem("duckRescueHighScore") || 0;
let lives = 5;
let deadDucklings = 0; 
let boostStamina = 100;
let isBoosting = false;

// Inputs
let keys = {};

// --- INITIAL SETUP ---
updateUI(); 

// --- CORE FUNCTIONS ---
window.startGame = function() {
    gameActive = true;
    isPaused = false;
    score = 0;
    lives = 5;
    deadDucklings = 0; 
    ducklings = [];
    history = [];
    boostStamina = 100;
    
    mamaDuck.x = 200; mamaDuck.y = 200;
    crocodile.x = 500; crocodile.y = 300;
    pikeFish.x = -100;
    
    document.getElementById("statusOverlay").style.display = "none";
    document.getElementById("finalDeathText").style.display = "none";
    
    spawnBaby();
    updateUI();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    loop();
};

window.togglePause = function() {
    if (!gameActive) return;
    isPaused = !isPaused;
    
    const overlay = document.getElementById("statusOverlay");
    if (isPaused) {
        overlay.style.display = "flex";
        document.getElementById("statusTitle").innerText = "PAUSED";
        const btn = document.querySelector(".start-btn");
        btn.innerText = "RESUME";
        btn.onclick = window.togglePause; 
    } else {
        overlay.style.display = "none";
        loop();
    }
};

// --- HELPER FUNCTIONS ---
function spawnBaby() {
    lostDuckling.x = 40 + Math.random() * 320;
    lostDuckling.y = 40 + Math.random() * 320;
}

function updateUI() {
    document.getElementById("scoreDisplay").innerText = score;
    document.getElementById("highScoreDisplay").innerText = highScore;
    document.getElementById("deathDisplay").innerText = deadDucklings;
    
    let hearts = ""; 
    for(let i=0; i<lives; i++) hearts += "❤";
    document.getElementById("livesDisplay").innerText = hearts;
}

function loseLife() {
    lives--;
    updateUI();
    if (lives <= 0) {
        gameOver();
    } else {
        // Reset Positions but keep stats
        mamaDuck.x = 200; 
        mamaDuck.y = 200;
        crocodile.x = 500; 
        pikeFish.x = -100;
        history = []; // Clear history to prevent instant snap collisions
    }
}

function gameOver() {
    gameActive = false;
    isPaused = true;
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem("duckRescueHighScore", highScore);
    }
    
    const overlay = document.getElementById("statusOverlay");
    overlay.style.display = "flex";
    document.getElementById("statusTitle").innerText = "GAME OVER";
    document.getElementById("highScoreText").innerText = "High Score: " + highScore;
    
    const dText = document.getElementById("finalDeathText");
    dText.innerText = "Total Casualties: " + deadDucklings;
    dText.style.display = "block";
    
    const btn = document.querySelector(".start-btn");
    btn.innerText = "▶ TRY AGAIN";
    btn.onclick = window.startGame;
}

// --- GAME LOOP ---
function update() {
    if (isPaused || !gameActive) return;

    // 1. CALCULATE MOVEMENT (With Diagonal Normalization)
    let moveX = 0;
    let moveY = 0;

    if (keys["ArrowUp"] || keys["KeyW"]) moveY = -1;
    if (keys["ArrowDown"] || keys["KeyS"]) moveY = 1;
    if (keys["ArrowLeft"] || keys["KeyA"]) moveX = -1;
    if (keys["ArrowRight"] || keys["KeyD"]) moveX = 1;

    // Check Boost
    let speed = mamaDuck.baseSpeed;
    if (isBoosting && boostStamina > 0) {
        speed = mamaDuck.boostSpeed;
        boostStamina -= 1.5;
    } else {
        isBoosting = false;
        if (boostStamina < 100) boostStamina += 0.5;
    }
    const bar = document.getElementById("boostBar");
    if(bar) bar.style.width = boostStamina + "%";

    // Normalize vector (prevent fast diagonal speed)
    if (moveX !== 0 || moveY !== 0) {
        let length = Math.sqrt(moveX * moveX + moveY * moveY);
        moveX /= length;
        moveY /= length;
        
        mamaDuck.x += moveX * speed;
        mamaDuck.y += moveY * speed;
    }

    // Boundaries
    mamaDuck.x = Math.max(20, Math.min(380, mamaDuck.x));
    mamaDuck.y = Math.max(20, Math.min(380, mamaDuck.y));

    // History (Snake Trail)
    history.unshift({x: mamaDuck.x, y: mamaDuck.y});
    if (history.length > 300) history.pop(); 

    // Enemy AI
    pikeFish.x += pikeFish.speed;
    if (pikeFish.x > 450) { pikeFish.x = -50; pikeFish.y = 50 + Math.random() * 300; }
    
    crocodile.x += crocodile.speed;
    if (crocodile.x < -100) { crocodile.x = 500; crocodile.y = 50 + Math.random() * 300; }

    // --- COLLISIONS ---

    // 1. Crocodile vs Mama
    if (Math.hypot(mamaDuck.x - crocodile.x, mamaDuck.y - crocodile.y) < 30) {
        loseLife();
        return; 
    }

    // 2. Crocodile vs Babies (Line Cut Logic)
    // We iterate backwards to find the *first* point of impact closest to mama
    for (let i = 0; i < ducklings.length; i++) {
        let idx = (i + 1) * 15;
        if (history[idx]) {
            let dist = Math.hypot(history[idx].x - crocodile.x, history[idx].y - crocodile.y);
            
            // Collision detected at index i
            if (dist < 25) {
                // Number of ducks to die = Total - current index
                let lostCount = ducklings.length - i;
                deadDucklings += lostCount;
                
                // Cut the array
                ducklings = ducklings.slice(0, i); 
                
                updateUI();
                break; // Stop checking, the line is cut
            }
        }
    }

    // 3. Pike vs Babies (Scare logic - just removes them, no casualty count)
    for (let i = 0; i < ducklings.length; i++) {
        let idx = (i + 1) * 15;
        if (history[idx]) {
            let dist = Math.hypot(history[idx].x - pikeFish.x, history[idx].y - pikeFish.y);
            if (dist < 20) {
                ducklings = ducklings.slice(0, i); 
                break;
            }
        }
    }

    // 4. Rescue Baby
    if (Math.hypot(mamaDuck.x - lostDuckling.x, mamaDuck.y - lostDuckling.y) < 30) {
        ducklings.push({});
        spawnBaby();
    }

    // 5. Deposit at Nest
    if (Math.hypot(mamaDuck.x - nest.x, mamaDuck.y - nest.y) < nest.size && ducklings.length > 0) {
        score += ducklings.length;
        ducklings = []; // Successfully saved
        updateUI();
        if (score > highScore) {
            highScore = score;
            localStorage.setItem("duckRescueHighScore", highScore);
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, 400, 400);

    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 4;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";

    ctx.font = "45px serif"; ctx.fillText("🪺", nest.x, nest.y); 
    ctx.font = "30px serif"; ctx.fillText("🐟", pikeFish.x, pikeFish.y); 
    ctx.font = "45px serif"; ctx.fillText("🐊", crocodile.x, crocodile.y); 

    // Draw Mama
    ctx.save();
    ctx.translate(mamaDuck.x, mamaDuck.y);
    if (keys["ArrowLeft"] || keys["KeyA"]) ctx.scale(-1, 1);
    if (isBoosting) { ctx.shadowColor = "white"; ctx.shadowBlur = 15; }
    ctx.font = "40px serif"; ctx.fillText("🦢", 0, 0); 
    ctx.restore();

    if(!isBoosting) { ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 4; }

    // Draw Ducklings
    ducklings.forEach((d, i) => {
        let idx = (i + 1) * 15;
        if (history[idx]) {
            let bob = Math.sin(Date.now() * 0.01 + i) * 3;
            ctx.font = "20px serif";
            ctx.fillText("🐥", history[idx].x, history[idx].y + bob);
        }
    });

    ctx.font = "24px serif"; ctx.fillText("🐣", lostDuckling.x, lostDuckling.y); 
}

function loop() {
    if (!isPaused && gameActive) {
        update();
        draw();
        animationFrameId = requestAnimationFrame(loop);
    }
}

// --- INPUT LISTENERS ---

// 1. KEYBOARD (PC) - Prevent Default Scroll
window.addEventListener("keydown", (e) => { 
    // Prevent scrolling for Arrows and Space
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)) {
        e.preventDefault();
    }
    
    keys[e.code] = true; 
    if(e.code === "Space") isBoosting = true;
});

window.addEventListener("keyup", (e) => { 
    keys[e.code] = false; 
    if(e.code === "Space") isBoosting = false;
});

// 2. MOBILE D-PAD LISTENERS
const dPadBtns = document.querySelectorAll('.d-btn');

dPadBtns.forEach(btn => {
    // Touch Start / Mouse Down
    const startAction = (e) => {
        if(!gameActive) return;
        e.preventDefault(); // Stop long-press menus
        const dir = btn.dataset.key;
        
        // Reset inputs first
        if (dir !== "BOOST") {
             keys["ArrowUp"] = false; keys["ArrowDown"] = false;
             keys["ArrowLeft"] = false; keys["ArrowRight"] = false;
        }

        // Apply 8-way Logic
        if(dir === "UP") keys["ArrowUp"] = true;
        if(dir === "DOWN") keys["ArrowDown"] = true;
        if(dir === "LEFT") keys["ArrowLeft"] = true;
        if(dir === "RIGHT") keys["ArrowRight"] = true;
        
        if(dir === "UL") { keys["ArrowUp"] = true; keys["ArrowLeft"] = true; }
        if(dir === "UR") { keys["ArrowUp"] = true; keys["ArrowRight"] = true; }
        if(dir === "DL") { keys["ArrowDown"] = true; keys["ArrowLeft"] = true; }
        if(dir === "DR") { keys["ArrowDown"] = true; keys["ArrowRight"] = true; }
        
        if(dir === "BOOST") isBoosting = true;
        
        btn.style.transform = "scale(0.9)";
    };

    // Touch End / Mouse Up
    const endAction = (e) => {
        e.preventDefault();
        const dir = btn.dataset.key;
        
        if(dir === "BOOST") {
            isBoosting = false;
        } else {
            // Clear all directional keys for safety
            keys["ArrowUp"] = false; keys["ArrowDown"] = false;
            keys["ArrowLeft"] = false; keys["ArrowRight"] = false;
        }
        btn.style.transform = "scale(1)";
    };

    btn.addEventListener('mousedown', startAction);
    btn.addEventListener('touchstart', startAction, {passive: false});
    
    btn.addEventListener('mouseup', endAction);
    btn.addEventListener('mouseleave', endAction);
    btn.addEventListener('touchend', endAction);
});
