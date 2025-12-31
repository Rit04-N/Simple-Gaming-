const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 400;
canvas.height = 400;

// Game Settings
let mamaDuck = { x: 200, y: 200, baseSpeed: 3, boostSpeed: 7 };
let target = { x: 200, y: 200 };
let ducklings = [];
let lostDuckling = { x: 100, y: 100 };
let history = [];
let nest = { x: 340, y: 60, size: 40 };
let score = 0;
let highScore = localStorage.getItem("duckRescueHighScore") || 0;
let isPaused = true; 
let boostStamina = 100;
let isBoosting = false;

// Enemies - FIXED: Renamed speedX to speed to match the update loop
let pikeFish = { x: -50, y: 150, speed: 2.2 };
let crocodile = { x: 500, y: 300, speed: -1.0 };

// Setup Displays - Safety Check
const highScoreEl = document.getElementById("highScoreDisplay");
if (highScoreEl) highScoreEl.innerText = highScore;

// --- CONTROLS ---
let keys = {};
window.addEventListener("keydown", (e) => { 
    keys[e.code] = true; 
    if(e.code === "Space") isBoosting = true;
});
window.addEventListener("keyup", (e) => { 
    keys[e.code] = false; 
    if(e.code === "Space") isBoosting = false;
});

// Touch/Swipe Logic
let touchStartX = null;
let touchStartY = null;

canvas.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    const rect = canvas.getBoundingClientRect();
    let tx = (touchStartX - rect.left) * (canvas.width / rect.width);
    let ty = (touchStartY - rect.top) * (canvas.height / rect.height);
    if(Math.hypot(mamaDuck.x - tx, mamaDuck.y - ty) < 40) isBoosting = true;
}, {passive: false});

canvas.addEventListener("touchmove", (e) => {
    if (!touchStartX || !touchStartY) return;
    e.preventDefault();
    let touchEndX = e.touches[0].clientX;
    let touchEndY = e.touches[0].clientY;
    
    keys["ArrowLeft"] = touchEndX < touchStartX - 15;
    keys["ArrowRight"] = touchEndX > touchStartX + 15;
    keys["ArrowUp"] = touchEndY < touchStartY - 15;
    keys["ArrowDown"] = touchEndY > touchStartY + 15;
}, {passive: false});

canvas.addEventListener("touchend", () => { 
    isBoosting = false; 
    keys = {}; 
    touchStartX = null; 
    touchStartY = null; 
});

function togglePause() {
    isPaused = !isPaused;
    const overlay = document.getElementById("statusOverlay");
    const statusText = document.getElementById("highScoreText");
    if (overlay) overlay.style.display = isPaused ? "flex" : "none";
    if (statusText) statusText.innerText = "Best Rescue: " + highScore;
}

function quack() { pikeFish.x = -100; }

function spawnBaby() {
    lostDuckling.x = 40 + Math.random() * 320;
    lostDuckling.y = 40 + Math.random() * 320;
}

// --- ENGINE ---
function update() {
    if (isPaused) return;

    // Boost logic
    let currentSpeed = (isBoosting && boostStamina > 0) ? mamaDuck.boostSpeed : mamaDuck.baseSpeed;
    if (isBoosting && boostStamina > 0) boostStamina -= 1.5;
    else if (boostStamina < 100) boostStamina += 0.5;
    
    const bBar = document.getElementById("boostBar");
    if (bBar) bBar.style.width = boostStamina + "%";

    // Movement
    if (keys["ArrowUp"] || keys["KeyW"]) mamaDuck.y -= currentSpeed;
    if (keys["ArrowDown"] || keys["KeyS"]) mamaDuck.y += currentSpeed;
    if (keys["ArrowLeft"] || keys["KeyA"]) mamaDuck.x -= currentSpeed;
    if (keys["ArrowRight"] || keys["KeyD"]) mamaDuck.x += currentSpeed;

    mamaDuck.x = Math.max(20, Math.min(380, mamaDuck.x));
    mamaDuck.y = Math.max(20, Math.min(380, mamaDuck.y));

    history.unshift({x: mamaDuck.x, y: mamaDuck.y});
    if (history.length > 200) history.pop();

    // Enemies - Fixed logic
    pikeFish.x += pikeFish.speed;
    if (pikeFish.x > 450) { pikeFish.x = -50; pikeFish.y = 50 + Math.random() * 300; }
    
    crocodile.x += crocodile.speed;
    if (crocodile.x < -100) { crocodile.x = 500; crocodile.y = 50 + Math.random() * 300; }

    // Collisions
    if (Math.hypot(mamaDuck.x - lostDuckling.x, mamaDuck.y - lostDuckling.y) < 25) {
        ducklings.push({});
        spawnBaby();
        const trailEl = document.getElementById("trailDisplay");
        if (trailEl) trailEl.innerText = ducklings.length;
    }

    if (Math.hypot(mamaDuck.x - nest.x, mamaDuck.y - nest.y) < nest.size && ducklings.length > 0) {
        score += ducklings.length;
        ducklings = [];
        const scoreEl = document.getElementById("scoreDisplay");
        const trailEl = document.getElementById("trailDisplay");
        if (scoreEl) scoreEl.innerText = score;
        if (trailEl) trailEl.innerText = "0";
        
        if (score > highScore) {
            highScore = score;
            localStorage.setItem("duckRescueHighScore", highScore);
            if (highScoreEl) highScoreEl.innerText = highScore;
        }
    }

    ducklings.forEach((d, i) => {
        let idx = (i + 1) * 15;
        if (history[idx] && Math.hypot(history[idx].x - pikeFish.x, history[idx].y - pikeFish.y) < 20) {
            ducklings = ducklings.slice(0, i);
            const trailEl = document.getElementById("trailDisplay");
            if (trailEl) trailEl.innerText = ducklings.length;
        }
    });
}

function draw() {
    ctx.clearRect(0, 0, 400, 400);
    ctx.font = "45px serif";
    ctx.fillText("🪺", nest.x - 22, nest.y + 15); 
    ctx.font = "30px serif";
    ctx.fillText("🐟", pikeFish.x - 15, pikeFish.y + 10); 
    ctx.font = "45px serif";
    ctx.fillText("🐊", crocodile.x - 22, crocodile.y + 15); 

    // Mama Swan
    ctx.save();
    ctx.translate(mamaDuck.x, mamaDuck.y);
    // Face the correct direction based on movement
    if (keys["ArrowLeft"] || keys["KeyA"]) ctx.scale(-1, 1);
    else if (keys["ArrowRight"] || keys["KeyD"]) ctx.scale(1, 1);

    if (isBoosting) { ctx.shadowBlur = 15; ctx.shadowColor = "white"; }
    ctx.font = "40px serif";
    ctx.fillText("🦢", -20, 15);
    ctx.restore();

    // Babies
    ducklings.forEach((d, i) => {
        let idx = (i + 1) * 15;
        if (history[idx]) {
            let bob = Math.sin(Date.now() * 0.01 + i) * 3;
            ctx.font = "20px serif";
            ctx.fillText("🐥", history[idx].x - 10, history[idx].y + 7 + bob);
        }
    });
    ctx.fillText("🐣", lostDuckling.x - 12, lostDuckling.y + 10); 
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();
