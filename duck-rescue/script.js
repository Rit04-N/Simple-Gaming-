// --- CONFIG & STATE ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 400; canvas.height = 400;

const SETTINGS = {
    controlType: localStorage.getItem('duckControl') || 'joystick', // 'joystick' or 'dpad'
    sensitivity: parseInt(localStorage.getItem('duckSens')) || 30,
    soundOn: true
};

let gameState = {
    active: false,
    paused: true,
    level: 1,
    score: 0,
    highScore: localStorage.getItem("duckRescueHighScore") || 0,
    lives: 5,
    deadDucklings: 0,
    ducksSavedInWave: 0,
    targetForWave: 3,
    boost: 100
};

// Entities
let mama = { x: 200, y: 200, baseSpeed: 3, boostSpeed: 7 };
let ducklings = [];
let history = []; 
let lostDuckling = { x: 100, y: 100 };
let nest = { x: 340, y: 60, size: 40 };
let enemies = []; // Array to hold pikes and crocs

// Inputs
let keys = {};
let joystick = { active: false, baseX: 0, baseY: 0, stickX: 0, stickY: 0, radius: 40, dx: 0, dy: 0 };
let isBoosting = false;
let loopId;

// --- AUDIO SYSTEM (RETRO) ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

const SoundManager = {
    play: (type) => {
        if(!SETTINGS.soundOn || audioCtx.state === 'suspended') audioCtx.resume();
        if(!SETTINGS.soundOn) return;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        if (type === 'collect') { // High Chirp
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'deposit') { // Fanfare
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.setValueAtTime(500, now + 0.1);
            osc.frequency.setValueAtTime(600, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.4);
            osc.start(now); osc.stop(now + 0.4);
        } else if (type === 'crunch') { // Low Noise
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start(now); osc.stop(now + 0.2);
        } else if (type === 'levelup') { // Success
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(880, now + 0.2);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start(now); osc.stop(now + 0.5);
        }
    }
};

// --- INITIALIZATION ---
applySettings();
updateUI();

// --- GAME LOGIC ---

function startGame() {
    gameState.active = true;
    gameState.paused = false;
    gameState.level = 1;
    gameState.score = 0;
    gameState.lives = 5;
    gameState.deadDucklings = 0;
    gameState.ducksSavedInWave = 0;
    gameState.boost = 100;
    ducklings = [];
    history = [];
    
    startWave(1);
    
    document.getElementById("statusOverlay").style.display = "none";
    document.getElementById("finalDeathText").innerText = "";
    if (loopId) cancelAnimationFrame(loopId);
    loop();
}

function startWave(lvl) {
    gameState.level = lvl;
    gameState.ducksSavedInWave = 0;
    
    // Difficulty Scaling
    gameState.targetForWave = 2 + lvl; // Level 1: 3, Level 2: 4, etc.
    let speedMult = 1 + (lvl * 0.1);
    
    // Reset Entities
    mama.x = 200; mama.y = 200;
    enemies = [];
    
    // Spawn Enemies based on Level
    // Level 1: Just Rescue.
    // Level 2+: Add Pike.
    // Level 3+: Add Croc.
    // Level 5+: 2 Crocs.
    
    if (lvl >= 2) {
        enemies.push({ type: 'pike', x: -50, y: 100, speed: 2 * speedMult });
    }
    if (lvl >= 3) {
        enemies.push({ type: 'croc', x: 500, y: 300, speed: -1.5 * speedMult });
    }
    if (lvl >= 5) {
         enemies.push({ type: 'croc', x: 500, y: 100, speed: -2 * speedMult });
    }
    
    spawnBaby();
    updateUI();
    
    // Notification
    const overlay = document.getElementById("levelUpOverlay");
    if (lvl > 1) {
        SoundManager.play('levelup');
        overlay.style.display = "flex";
        setTimeout(() => { overlay.style.display = "none"; }, 1500);
    }
}

function checkWaveProgress() {
    if (gameState.ducksSavedInWave >= gameState.targetForWave) {
        startWave(gameState.level + 1);
    }
}

function update() {
    if (gameState.paused || !gameState.active) return;

    // --- MOVEMENT ---
    let mx = 0, my = 0;

    // Keyboard
    if (keys["ArrowUp"] || keys["KeyW"]) my = -1;
    if (keys["ArrowDown"] || keys["KeyS"]) my = 1;
    if (keys["ArrowLeft"] || keys["KeyA"]) mx = -1;
    if (keys["ArrowRight"] || keys["KeyD"]) mx = 1;

    // Joystick Override
    if (SETTINGS.controlType === 'joystick' && joystick.active) {
        mx = joystick.dx;
        my = joystick.dy;
    }

    // Boost Logic
    let currentSpeed = mama.baseSpeed;
    if (isBoosting && gameState.boost > 0) {
        currentSpeed = mama.boostSpeed;
        gameState.boost -= 1.5;
    } else {
        isBoosting = false;
        if (gameState.boost < 100) gameState.boost += 0.5;
    }
    document.getElementById("boostBar").style.width = gameState.boost + "%";

    // Normalize Diagonal
    if (mx !== 0 || my !== 0) {
        // If using keyboard, normalize. Joystick already gives normalized-ish values
        if (!joystick.active) {
            let len = Math.sqrt(mx*mx + my*my);
            mx /= len; my /= len;
        }
        mama.x += mx * currentSpeed;
        mama.y += my * currentSpeed;
    }

    // Boundaries
    mama.x = Math.max(20, Math.min(380, mama.x));
    mama.y = Math.max(20, Math.min(380, mama.y));

    // History (Snake Trail)
    history.unshift({x: mama.x, y: mama.y});
    if (history.length > 300) history.pop();

    // --- ENTITIES ---
    enemies.forEach(e => {
        e.x += e.speed;
        // Wrap around
        if (e.speed > 0 && e.x > 450) { e.x = -50; e.y = 50 + Math.random()*300; }
        if (e.speed < 0 && e.x < -100) { e.x = 500; e.y = 50 + Math.random()*300; }
        
        // Collisions
        // 1. Enemy vs Mama
        if (Math.hypot(mama.x - e.x, mama.y - e.y) < 30) {
            SoundManager.play('crunch');
            loseLife(); 
        }

        // 2. Enemy vs Babies
        for (let i = 0; i < ducklings.length; i++) {
            let idx = (i+1)*15;
            if (history[idx]) {
                let dist = Math.hypot(history[idx].x - e.x, history[idx].y - e.y);
                
                if (dist < 25) {
                    if (e.type === 'croc') {
                        // CUT THE LINE logic
                        SoundManager.play('crunch');
                        let casualities = ducklings.length - i;
                        gameState.deadDucklings += casualities;
                        ducklings.splice(i); // Removes from i to end
                        updateUI();
                        break;
                    } else if (e.type === 'pike') {
                        // Scare logic (just remove, no death count)
                        ducklings.splice(i);
                        break;
                    }
                }
            }
        }
    });

    // Rescue
    if (Math.hypot(mama.x - lostDuckling.x, mama.y - lostDuckling.y) < 30) {
        SoundManager.play('collect');
        ducklings.push({});
        spawnBaby();
    }

    // Nest Deposit
    if (Math.hypot(mama.x - nest.x, mama.y - nest.y) < nest.size && ducklings.length > 0) {
        SoundManager.play('deposit');
        let count = ducklings.length;
        gameState.score += count;
        gameState.ducksSavedInWave += count;
        ducklings = [];
        updateUI();
        checkWaveProgress();
    }
}

function draw() {
    ctx.clearRect(0, 0, 400, 400);

    // Labels
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 4;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";

    ctx.font = "45px serif"; ctx.fillText("🪺", nest.x, nest.y); 

    enemies.forEach(e => {
        ctx.font = (e.type === 'croc' ? "45px" : "30px") + " serif";
        ctx.fillText(e.type === 'croc' ? "🐊" : "🐟", e.x, e.y);
    });

    // Mama
    ctx.save();
    ctx.translate(mama.x, mama.y);
    if (keys["ArrowLeft"] || keys["KeyA"] || (joystick.active && joystick.dx < 0)) ctx.scale(-1, 1);
    if (isBoosting) { ctx.shadowColor = "white"; ctx.shadowBlur = 15; }
    ctx.font = "40px serif"; ctx.fillText("🦢", 0, 0);
    ctx.restore();

    ctx.shadowBlur = 0;

    // Babies
    ducklings.forEach((d, i) => {
        let idx = (i + 1) * 15;
        if (history[idx]) {
            let bob = Math.sin(Date.now() * 0.01 + i) * 3;
            ctx.font = "20px serif";
            ctx.fillText("🐥", history[idx].x, history[idx].y + bob);
        }
    });

    ctx.font = "24px serif"; ctx.fillText("🐣", lostDuckling.x, lostDuckling.y);

    // Joystick Overlay
    if (SETTINGS.controlType === 'joystick' && joystick.active) {
        ctx.beginPath();
        ctx.arc(joystick.baseX, joystick.baseY, joystick.radius, 0, Math.PI*2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)"; ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"; ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(joystick.stickX, joystick.stickY, 15, 0, Math.PI*2);
        ctx.fillStyle = "rgba(241, 196, 15, 0.8)"; ctx.fill();
    }
}

function loop() {
    update();
    draw();
    loopId = requestAnimationFrame(loop);
}

// --- HELPERS ---
function spawnBaby() {
    lostDuckling.x = 40 + Math.random() * 320;
    lostDuckling.y = 40 + Math.random() * 320;
}

function updateUI() {
    document.getElementById("scoreDisplay").innerText = gameState.score;
    document.getElementById("highScoreDisplay").innerText = gameState.highScore;
    document.getElementById("deathDisplay").innerText = gameState.deadDucklings;
    document.getElementById("levelDisplay").innerText = gameState.level;
    document.getElementById("savedDisplay").innerText = gameState.ducksSavedInWave;
    document.getElementById("targetDisplay").innerText = gameState.targetForWave;
    
    let h = ""; for(let i=0; i<gameState.lives; i++) h += "❤";
    document.getElementById("livesDisplay").innerText = h;
}

function loseLife() {
    gameState.lives--;
    updateUI();
    if (gameState.lives <= 0) {
        gameOver();
    } else {
        // Soft Reset
        mama.x = 200; mama.y = 200;
        history = [];
        enemies.forEach(e => {
             if(e.speed > 0) e.x = -50; else e.x = 500;
        });
    }
}

function gameOver() {
    gameState.active = false;
    gameState.paused = true;
    if (gameState.score > gameState.highScore) {
        localStorage.setItem("duckRescueHighScore", gameState.score);
    }
    
    document.getElementById("statusOverlay").style.display = "flex";
    document.getElementById("statusTitle").innerText = "GAME OVER";
    document.getElementById("waveInfo").innerText = "Reached Wave " + gameState.level;
    document.getElementById("finalDeathText").innerText = "Casualties: " + gameState.deadDucklings;
    document.querySelector(".start-btn").innerText = "▶ RESTART";
}

function togglePause() {
    if (!gameState.active) return;
    gameState.paused = !gameState.paused;
    document.getElementById("statusOverlay").style.display = gameState.paused ? "flex" : "none";
    if(gameState.paused) document.getElementById("statusTitle").innerText = "PAUSED";
}

// --- SETTINGS & CONTROL LOGIC ---

function openSettings() {
    gameState.paused = true; // Auto pause
    document.getElementById("settingsModal").style.display = "flex";
}

function closeSettings() {
    document.getElementById("settingsModal").style.display = "none";
    togglePause(); // Resume if appropriate, or show pause menu
}

function setControlType(type) {
    SETTINGS.controlType = type;
    localStorage.setItem('duckControl', type);
    applySettings();
}

function updateSens(val) {
    SETTINGS.sensitivity = parseInt(val);
    document.getElementById("sensValue").innerText = val;
    localStorage.setItem('duckSens', val);
}

function toggleSound() {
    SETTINGS.soundOn = !SETTINGS.soundOn;
    document.getElementById("btnSound").classList.toggle('active');
    document.getElementById("btnSound").innerText = SETTINGS.soundOn ? "ON" : "OFF";
}

function applySettings() {
    // UI Updates
    document.getElementById("btnJoystick").classList.toggle('active', SETTINGS.controlType === 'joystick');
    document.getElementById("btnDpad").classList.toggle('active', SETTINGS.controlType === 'dpad');
    document.getElementById("sensSlider").value = SETTINGS.sensitivity;
    document.getElementById("sensValue").innerText = SETTINGS.sensitivity;
    document.getElementById("dpadContainer").style.display = SETTINGS.controlType === 'dpad' ? 'flex' : 'none';
}

// --- INPUT LISTENERS ---
window.addEventListener("keydown", (e) => {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)) e.preventDefault();
    keys[e.code] = true;
    if(e.code === "Space") isBoosting = true;
});
window.addEventListener("keyup", (e) => keys[e.code] = false);

// TOUCH: JOYSTICK
canvas.addEventListener("touchstart", (e) => {
    if (SETTINGS.controlType !== 'joystick' || !gameState.active) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    
    joystick.active = true;
    joystick.baseX = (touch.clientX - rect.left) * (canvas.width / rect.width);
    joystick.baseY = (touch.clientY - rect.top) * (canvas.height / rect.height);
    joystick.stickX = joystick.baseX; joystick.stickY = joystick.baseY;
    
    // Quick Tap Boost
    const now = Date.now();
    if(now - joystick.lastTap < 300) isBoosting = true;
    joystick.lastTap = now;
}, {passive: false});

canvas.addEventListener("touchmove", (e) => {
    if (!joystick.active) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const tx = (touch.clientX - rect.left) * (canvas.width / rect.width);
    const ty = (touch.clientY - rect.top) * (canvas.height / rect.height);

    const dist = Math.hypot(tx - joystick.baseX, ty - joystick.baseY);
    const angle = Math.atan2(ty - joystick.baseY, tx - joystick.baseX);
    const limit = Math.min(dist, joystick.radius);

    joystick.stickX = joystick.baseX + Math.cos(angle) * limit;
    joystick.stickY = joystick.baseY + Math.sin(angle) * limit;

    // Calculate normalized output (0 to 1) based on Sensitivity
    // Higher sensitivity setting = reaches max speed with less movement
    const rawForce = dist / SETTINGS.sensitivity; 
    const force = Math.min(rawForce, 1);
    
    joystick.dx = Math.cos(angle) * force;
    joystick.dy = Math.sin(angle) * force;
}, {passive: false});

canvas.addEventListener("touchend", () => {
    joystick.active = false; isBoosting = false;
    joystick.dx = 0; joystick.dy = 0;
});

// TOUCH: D-PAD
document.querySelectorAll('.d-btn').forEach(btn => {
    const handler = (e) => {
        if(!gameState.active) return;
        e.preventDefault();
        const k = btn.dataset.key;
        if(k === 'BOOST') isBoosting = true;
        else {
            if(k.includes('U')) keys["ArrowUp"] = true;
            if(k.includes('D')) keys["ArrowDown"] = true;
            if(k.includes('L')) keys["ArrowLeft"] = true;
            if(k.includes('R')) keys["ArrowRight"] = true;
        }
    };
    const endHandler = (e) => {
        e.preventDefault();
        isBoosting = false;
        keys["ArrowUp"] = false; keys["ArrowDown"] = false; 
        keys["ArrowLeft"] = false; keys["ArrowRight"] = false;
    };
    btn.addEventListener('touchstart', handler, {passive: false});
    btn.addEventListener('touchend', endHandler);
    btn.addEventListener('mousedown', handler);
    btn.addEventListener('mouseup', endHandler);
});
