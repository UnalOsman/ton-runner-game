import { tonConnectUI, checkNftOwnership, purchasePlayReset } from './ton-service.js';

// --- Global State ve Ayarlar ---
const state = {
    isPlaying: false,
    score: 0,
    turtlesCollected: 0, // Yeni: Toplanan turtalar
    lane: 0, 
    speed: 0.5,
    isJumping: false,
    isSliding: false,
    nextObstacleTimer: 0.0,
    nextTurtleTimer: 2.0 // Yeni: Turta zamanlayıcısı
};

const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// --- UI Güncellemeleri ---
function updateUI() {
    const btnStart = document.getElementById('btn-start');
    btnStart.innerText = "OYNA";
    btnStart.disabled = false;
    btnStart.style.opacity = "1";
    
    // UI'da skor ve turta sayılarını güncelle (HTML'de varsa)
    document.getElementById('score').innerText = Math.floor(state.score);
}

// --- Three.js Kurulumu ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 10, 40);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 3, 6);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

const light = new THREE.HemisphereLight(0xffffff, 0x444444);
scene.add(light);
const dirLight = new THREE.DirectionalLight(0xffffff);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// Yol
const roadWidth = 6; 
const floorGeo = new THREE.PlaneGeometry(roadWidth, 100);
const floorMat = new THREE.MeshPhongMaterial({ color: 0x222222 }); 
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const markerGroup = new THREE.Group(); 
scene.add(markerGroup);

// Oyuncu
const playerGeo = new THREE.BoxGeometry(1, 1, 1);
const playerMat = new THREE.MeshPhongMaterial({ color: 0xff0000 });
const player = new THREE.Mesh(playerGeo, playerMat);
player.position.y = 0.5;
scene.add(player);

// --- Engel ve Turta Listeleri ---
const obstacles = [];
const turtles = [];
const OBSTACLE_Z_SPAWN = -40; 
const OBSTACLE_LANE_X = [-2, 0, 2]; 

// --- Gelişmiş Engel Üretimi (Çift Engel Olasılığı) ---
function generateObstacle() {
    // %30 ihtimalle 2 engel, %70 ihtimalle 1 engel
    const obstacleCount = Math.random() > 0.7 ? 2 : 1;
    const availableLanes = [...OBSTACLE_LANE_X];

    for (let i = 0; i < obstacleCount; i++) {
        const laneIdx = Math.floor(Math.random() * availableLanes.length);
        const xPos = availableLanes.splice(laneIdx, 1)[0];

        const obstacleType = Math.floor(Math.random() * 3); 
        let geometry, material, height, yPos, typeName;

        switch(obstacleType) {
            case 0: // Duvar
                height = 3; yPos = height / 2;
                geometry = new THREE.BoxGeometry(1.5, height, 1);
                material = new THREE.MeshPhongMaterial({ color: 0x880000 }); 
                typeName = 'Wall';
                break;
            case 1: // Zıplama
                height = 1.5; yPos = height / 2;
                geometry = new THREE.BoxGeometry(1.5, height, 1);
                material = new THREE.MeshPhongMaterial({ color: 0x008888 }); 
                typeName = 'Jump';
                break;
            case 2: // Kayma
                height = 1.8; yPos = 2.0; 
                geometry = new THREE.BoxGeometry(1.5, height, 1);
                material = new THREE.MeshPhongMaterial({ color: 0x888800 }); 
                typeName = 'Slide';
                break;
        }

        const obstacle = new THREE.Mesh(geometry, material);
        obstacle.position.set(xPos, yPos, OBSTACLE_Z_SPAWN);
        obstacle.name = typeName; 
        scene.add(obstacle);
        obstacles.push(obstacle);
    }

    // Engel sıklığı artırıldı: 0.4 - 1.0 saniye arası
    state.nextObstacleTimer = Math.random() * 0.6 + 0.4; 
}

// --- Turta Üretimi ---
function generateTurtle() {
    const xPos = OBSTACLE_LANE_X[Math.floor(Math.random() * 3)];
    
    // Geçici olarak yeşil bir küre (İleride modelle değiştirilebilir)
    const geometry = new THREE.SphereGeometry(0.4, 16, 16);
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00, emissive: 0x004400 });
    const turtle = new THREE.Mesh(geometry, material);
    
    turtle.position.set(xPos, 0.5, OBSTACLE_Z_SPAWN);
    scene.add(turtle);
    turtles.push(turtle);

    state.nextTurtleTimer = Math.random() * 2.0 + 1.5; 
}

function startGame() {
    state.isPlaying = true;
    state.score = 0;
    state.turtlesCollected = 0;
    state.lane = 0;
    player.position.x = 0;
    player.position.y = 0.5;
    
    obstacles.forEach(o => scene.remove(o));
    obstacles.length = 0;
    turtles.forEach(t => scene.remove(t));
    turtles.length = 0;

    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
}

function endGame() {
    state.isPlaying = false;
    if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    document.getElementById('final-score').innerText = Math.floor(state.score);
    document.getElementById('game-over-screen').classList.remove('hidden');
}

// --- Çarpışma ve Toplama Kontrolleri ---
function checkCollisions() {
    const playerBox = new THREE.Box3().setFromObject(player);

    // Engellerle Çarpışma
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.position.z += state.speed;

        if (Math.abs(player.position.z - obstacle.position.z) < 1.5) {
            if (Math.abs(player.position.x - obstacle.position.x) < 1) {
                const obstacleBox = new THREE.Box3().setFromObject(obstacle);
                if (playerBox.intersectsBox(obstacleBox)) {
                    if (obstacle.name === 'Jump' && player.position.y < 1.5) return endGame();
                    if (obstacle.name === 'Slide' && !state.isSliding) return endGame();
                    if (obstacle.name === 'Wall') return endGame();
                }
            }
        }
        if (obstacle.position.z > camera.position.z + 2) {
            scene.remove(obstacle);
            obstacles.splice(i, 1);
        }
    }

    // Turtaları Toplama
    for (let i = turtles.length - 1; i >= 0; i--) {
        const turtle = turtles[i];
        turtle.position.z += state.speed;
        turtle.rotation.y += 0.05; // Döndürme efekti

        const turtleBox = new THREE.Box3().setFromObject(turtle);
        if (playerBox.intersectsBox(turtleBox)) {
            state.turtlesCollected++;
            if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
            scene.remove(turtle);
            turtles.splice(i, 1);
            continue;
        }

        if (turtle.position.z > camera.position.z + 2) {
            scene.remove(turtle);
            turtles.splice(i, 1);
        }
    }
}

// --- Hareket Mantığı ---
const JUMP_VELOCITY_START = 0.4; 
const GRAVITY = -0.05; 
let jumpVelocity = 0;

function applyMovement(deltaTime) {
    if (state.isJumping) {
        player.position.y += jumpVelocity * deltaTime;
        jumpVelocity += GRAVITY * deltaTime;
        if (player.position.y <= 0.5) {
            player.position.y = 0.5;
            state.isJumping = false;
            jumpVelocity = 0;
        }
    }
    if (state.isSliding) {
        player.scale.set(1, 0.5, 1); 
        player.position.y = 0.25; 
    } else if (!state.isJumping) {
        player.scale.set(1, 1, 1); 
        player.position.y = 0.5;
    }
}

// --- Animasyon Döngüsü ---
let lastTime = 0;
function animate(time) {
    requestAnimationFrame(animate);
    const deltaTime = (time - lastTime) / 1000 * 60; 
    lastTime = time;

    if (state.isPlaying) {
        state.score += 0.1 * deltaTime; 
        document.getElementById('score').innerText = Math.floor(state.score);

        // Engel ve Turta Üretimi
        state.nextObstacleTimer -= (0.01 * deltaTime);
        if (state.nextObstacleTimer <= 0) generateObstacle();

        state.nextTurtleTimer -= (0.01 * deltaTime);
        if (state.nextTurtleTimer <= 0) generateTurtle();

        checkCollisions();
        applyMovement(deltaTime);

        const targetX = state.lane * 2; 
        player.position.x += (targetX - player.position.x) * 0.15 * deltaTime;
    }
    renderer.render(scene, camera);
}

// --- Kontroller ---
window.addEventListener('keydown', (e) => {
    if (!state.isPlaying) return;
    if ((e.key === 'ArrowLeft' || e.key === 'a') && state.lane > -1) state.lane--;
    if ((e.key === 'ArrowRight' || e.key === 'd') && state.lane < 1) state.lane++;
    if ((e.key === 'ArrowUp' || e.key === ' ') && !state.isJumping) {
        state.isJumping = true;
        jumpVelocity = JUMP_VELOCITY_START; 
    }
    if (e.key === 'ArrowDown' && !state.isJumping && !state.isSliding) {
        state.isSliding = true;
        setTimeout(() => state.isSliding = false, 800);
    }
});

let touchStartX = 0;
let touchStartY = 0;
window.addEventListener('touchstart', e => {
    if (e.touches.length === 1) { 
        e.preventDefault(); 
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }
}, {passive : false });

window.addEventListener('touchend', e => {
    if (!state.isPlaying) return;
    const dx = e.changedTouches[0].screenX - touchStartX;
    const dy = e.changedTouches[0].screenY - touchStartY;

    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx < -30 && state.lane > -1) state.lane--; 
        if (dx > 30 && state.lane < 1) state.lane++; 
    } else {
        if (dy < -30 && !state.isJumping) { 
            state.isJumping = true;
            jumpVelocity = JUMP_VELOCITY_START; 
        } else if (dy > 30 && !state.isJumping && !state.isSliding) { 
            state.isSliding = true;
            setTimeout(() => state.isSliding = false, 800); 
        }
    }
});

// --- TON Olayları ---
tonConnectUI.onStatusChange(async (wallet) => {
    if (wallet) {
        document.getElementById('btn-buy-reset').disabled = false;
        const hasNFT = await checkNftOwnership(wallet.account.address);
        player.material.color.setHex(hasNFT ? 0xd4af37 : 0xff0000);
        document.getElementById('nft-status').innerText = hasNFT ? "✅ Özel Skin Aktif!" : "Standart Skin";
    }
});

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', startGame);
document.getElementById('btn-buy-reset').addEventListener('click', purchasePlayReset);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();