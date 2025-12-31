document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    // Internal resolution
    canvas.width = 400;
    canvas.height = 400;

    // --- GAME STATE VARIABLES ---
    let mamaDuck = { x: 200, y: 200, baseSpeed: 3, boostSpeed: 7, radius: 20 };
    let ducklings = [];
    let lostDuckling = { x: 100, y: 100 };
    let history = []; 
    let nest = { x: 340, y: 60, size: 40 };
    
    // Stats
    let score = 0;
    let highScore = localStorage.getItem("duckRescueHighScore") || 0;
    let lives = 5;
    let deadDucklings = 0;
    
    // Flags
    let isPaused = true; 
    let gameActive = false;
    let boostStamina = 100;
    let isBoosting = false;

    // Enemies
    let pikeFish = { x: -50, y: 150, speed: 2.2 };
    let crocodile = { x: 500, y: 300, speed: -1.2 };

    // Joystick
    let joystick = { active: false, baseX: 0, baseY: 0, stickX: 0, stickY: 0, radius: 40 };
    let lastTapTime = 0;
    let keys = {};

    // Initial Display Update
    updateUI();

    // --- INPUT LISTENERS ---
    window.addEventListener("keydown", (e) => { 
        keys[e.code] = true; 
        if(e.code === "Space") isBoosting = true;
    });
    window.addEventListener("keyup", (e) => { 
        keys[e.code] = false; 
        if(e.code === "Space") isBoosting = false;
    });

    // Mobile Inputs
    canvas.addEventListener("touchstart", (e) => {
        if(!gameActive) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const tx = (touch.clientX - rect.left) * (canvas.width / rect.width);
        const ty = (touch.clientY - rect.top) * (canvas.height / rect.height);

        // Double Tap
        const currentTime = Date.now();
        if (currentTime - lastTapTime < 300) isBoosting = true;
        lastTapTime = currentTime;

        // Joystick Start
        joystick.active = true;
        joystick.baseX = tx; joystick.baseY = ty;
        joystick.stickX = tx; joystick.stickY = ty;
    }, {passive: false});

    canvas.addEventListener("touchmove", (e) => {
        if(!gameActive || !joystick.active) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const tx = (touch.clientX - rect.left) * (canvas.width / rect.width);
        const ty = (touch.clientY - rect.top) * (canvas.height / rect.height);

        const dist = Math.hypot(tx - joystick.baseX, ty - joystick.baseY);
        const angle = Math.atan2(ty - joystick.baseY, tx - joystick.baseX);
        const moveDist = Math.min(dist, joystick.radius);

        joystick.stickX = joystick.baseX + Math.cos(angle) * moveDist;
        joystick.stickY = joystick.baseY + Math.sin(angle) * moveDist;

        // Convert Joystick to Keys
        const thres = 10;
        keys["ArrowLeft"] = (tx < joystick.baseX - thres);
        keys["ArrowRight"] = (tx > joystick.baseX + thres);
        keys["ArrowUp"] = (ty < joystick.baseY - thres);
        keys["ArrowDown"] = (ty > joystick.baseY + thres);
    }, {passive: false});

    canvas.addEventListener("touchend", () => { 
        joystick.active = false; isBoosting = false; keys = {}; 
    });

    // --- GAME LOGIC ---

    // GLOBAL Functions for HTML buttons
    window.startGame = function() {
        // Reset Everything
        score = 0;
        lives = 5;
        deadDucklings = 0;
        ducklings = [];
        history = [];
        mamaDuck.x = 200; mamaDuck.y = 200;
        crocodile.x = 500; // Move enemy away
        
        gameActive = true;
        isPaused = false;
        
        document.getElementById("statusOverlay").style.display = "none";
        spawnBaby();
        updateUI();
        loop();
    };

    window.togglePause = function() {
        if (!gameActive) return;
        isPaused = !isPaused;
        const overlay = document.getElementById("statusOverlay");
        if(isPaused) {
            overlay.style.display = "flex";
            document.getElementById("statusTitle").innerText = "PAUSED";
            document.querySelector(".start-btn").innerText = "RESUME";
            document.querySelector(".start-btn").onclick = togglePause; // Temporary switch function
        } else {
            overlay.style.display = "none";
            loop();
        }
    };

    function spawnBaby() {
        lostDuckling.x = 40 + Math.random() * 320;
        lostDuckling.y = 40 + Math.random() * 320;
    }

    function loseLife() {
        lives--;
        updateUI();
        
        // Visual Feedback (Shake/Flash could go here)
        
        if (lives <= 0) {
            gameOver();
        } else {
            // Respawn Safely
            mamaDuck.x = 200;
            mamaDuck.y = 200;
            // Push Crocodile away so you don't die instantly again
            crocodile.x = 500;
            crocodile.y = 300;
            // Clear keys to stop auto-running into danger
            keys = {};
            joystick.active = false;
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
        document.getElementById("finalDeathText").innerText = "Ducklings Lost: " + deadDucklings;
        
        // Reset button behavior
        const btn = document.querySelector(".start-btn");
        btn.innerText = "▶ TRY AGAIN";
        btn.onclick = window.startGame;
    }

    function updateUI() {
        document.getElementById("scoreDisplay").innerText = score;
        document.getElementById("highScoreDisplay").innerText = highScore;
        document.getElementById("deathDisplay").innerText = deadDucklings;
        
        // Generate Hearts String
        let heartString = "";
        for(let i=0; i<lives; i++) heartString += "❤";
        document.getElementById("livesDisplay").innerText = heartString;
    }

    function update() {
        if (isPaused || !gameActive) return;

        // Boost Logic
        let currentSpeed = (isBoosting && boostStamina > 0) ? mamaDuck.boostSpeed : mamaDuck.baseSpeed;
        if (isBoosting && boostStamina > 0) boostStamina -= 1.5;
        else { isBoosting = false; if (boostStamina < 100) boostStamina += 0.5; }
        document.getElementById("boostBar").style.width = boostStamina + "%";

        // Movement
        if (keys["ArrowUp"] || keys["KeyW"]) mamaDuck.y -= currentSpeed;
        if (keys["ArrowDown"] || keys["KeyS"]) mamaDuck.y += currentSpeed;
        if (keys["ArrowLeft"] || keys["KeyA"]) mamaDuck.x -= currentSpeed;
        if (keys["ArrowRight"] || keys["KeyD"]) mamaDuck.x += currentSpeed;

        // Boundaries
        mamaDuck.x = Math.max(20, Math.min(380, mamaDuck.x));
        mamaDuck.y = Math.max(20, Math.min(380, mamaDuck.y));

        // Trail History
        history.unshift({x: mamaDuck.x, y: mamaDuck.y});
        if (history.length > 200) history.pop();

        // --- ENEMIES ---
        
        // Pike Fish (Moves fast, breaks line)
        pikeFish.x += pikeFish.speed;
        if (pikeFish.x > 450) { pikeFish.x = -50; pikeFish.y = 50 + Math.random() * 300; }

        // Crocodile (Moves slow, EATS EVERYTHING)
        crocodile.x += crocodile.speed;
        if (crocodile.x < -100) { crocodile.x = 500; crocodile.y = 50 + Math.random() * 300; }

        // --- COLLISIONS ---

        // 1. Crocodile hits Mama?
        if (Math.hypot(mamaDuck.x - crocodile.x, mamaDuck.y - crocodile.y) < 30) {
            loseLife();
            return; // Stop update for this frame
        }

        // 2. Crocodile eats Ducklings?
        ducklings.forEach((d, i) => {
            let idx = (i + 1) * 15;
            if (history[idx]) {
                if (Math.hypot(history[idx].x - crocodile.x, history[idx].y - crocodile.y) < 25) {
                    // Count how many died
                    let lostCount = ducklings.length - i;
                    deadDucklings += lostCount;
                    updateUI();
                    
                    // Slice the array (remove eaten ones)
                    ducklings = ducklings.slice(0, i);
                }
            }
        });

        // 3. Pike Fish breaks line?
        ducklings.forEach((d, i) => {
            let idx = (i + 1) * 15;
            if (history[idx]) {
                if (Math.hypot(history[idx].x - pikeFish.x, history[idx].y - pikeFish.y) < 20) {
                    // Just scares them away (doesn't add to death count, just score loss)
                    ducklings = ducklings.slice(0, i);
                }
            }
        });

        // 4. Pick up Lost Duckling
        if (Math.hypot(mamaDuck.x - lostDuckling.x, mamaDuck.y - lostDuckling.y) < 30) {
            ducklings.push({});
            spawnBaby();
        }

        // 5. Deposit at Nest
        if (Math.hypot(mamaDuck.x - nest.x, mamaDuck.y - nest.y) < nest.size && ducklings.length > 0) {
            score += ducklings.length;
            ducklings = [];
            updateUI();
        }
    }

    function draw() {
        ctx.clearRect(0, 0, 400, 400);

        // Text Setup
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Nest
        ctx.font = "45px serif";
        ctx.fillText("🪺", nest.x, nest.y); 

        // Enemies
        ctx.font = "30px serif";
        ctx.fillText("🐟", pikeFish.x, pikeFish.y); 
        ctx.font = "45px serif";
        ctx.fillText("🐊", crocodile.x, crocodile.y); 

        // Mama Swan (Check direction)
        ctx.save();
        ctx.translate(mamaDuck.x, mamaDuck.y);
        // Flip sprite if moving left
        if (keys["ArrowLeft"] || keys["KeyA"]) ctx.scale(-1, 1);
        
        // Boost Glow
        if (isBoosting) { 
            ctx.shadowBlur = 15; 
            ctx.shadowColor = "white"; 
        }
        
        ctx.font = "40px serif";
        ctx.fillText("🦢", 0, 0); // Drawn at 0,0 relative to translation
        ctx.restore();

        // Ducklings
        ducklings.forEach((d, i) => {
            let idx = (i + 1) * 15;
            if (history[idx]) {
                let bob = Math.sin(Date.now() * 0.01 + i) * 3;
                ctx.font = "20px serif";
                ctx.fillText("🐥", history[idx].x, history[idx].y + bob);
            }
        });
        
        // Lost Baby
        ctx.font = "24px serif";
        ctx.fillText("🐣", lostDuckling.x, lostDuckling.y); 

        // Joystick Visual
        if (joystick.active) {
            ctx.beginPath(); 
            ctx.arc(joystick.baseX, joystick.baseY, joystick.radius, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255, 255, 255, 0.2)"; 
            ctx.fill();
            ctx.beginPath(); 
            ctx.arc(joystick.stickX, joystick.stickY, 20, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255, 255, 255, 0.5)"; 
            ctx.fill();
        }
    }

    function loop() {
        if (!isPaused && gameActive) {
            update();
            draw();
        }
        requestAnimationFrame(loop);
    }
});
