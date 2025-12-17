import { tonConnectUI, checkNftOwnership, purchasePlayReset } from './ton-service.js';

// --- Global State ve Ayarlar ---
const state = {
    isPlaying: false,
    score: 0,
    lane: 0, 
    speed: 0.5, // Hız hissini artırdık
    dailyPlays: 9999,
    isJumping: false,
    isSliding: false,
    nextObstacleTimer: 0.0 // İlk engel hemen çıksın diye sıfırla
};

const tg = window.Telegram.WebApp;
tg.expand();

tg.ready();

// ... (Limit Sistemi ve UI Fonksiyonları önceki gibi) ...
function initDailyLimits() {
    updateUI(); 
    document.getElementById('play-count').innerText = "SINIRSIZ"; 
}
function saveLimits() {}
function updateUI() {
    const btnStart = document.getElementById('btn-start');
    btnStart.innerText = "OYNA";
    btnStart.disabled = false;
    btnStart.style.opacity = "1";
}
// --------------------------------------------------------

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

// --- Şerit Ayırıcılar (KESİKLİ ÇİZGİ SİSTEMİ) ---
// Yola 50 adet kısa çizgi ekleyeceğiz

const LINE_COUNT = 50;
const LINE_LENGTH = 1.0;
const LINE_GAP = 1.0; // Çizgi ve boşluk uzunlukları

const laneMarkerGeo = new THREE.BoxGeometry(0.1, 0.01, LINE_LENGTH); 
const laneMarkerMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });

// Çizgileri tutan grup
const markerGroup = new THREE.Group(); 
scene.add(markerGroup);

// Sol ve Sağ şeritler için kesikli çizgileri oluştur
/*
for (let i = 0; i < LINE_COUNT; i++) {
    const zOffset = i * (LINE_LENGTH + LINE_GAP) - 20; // Z koordinatlarını dağıt

    // Sol Çizgi
    const markerL = new THREE.Mesh(laneMarkerGeo, laneMarkerMat);
    markerL.position.set(-2, 0.01, zOffset); 
    markerL.rotation.x = -Math.PI / 2;
    markerGroup.add(markerL);

    // Sağ Çizgi
    const markerR = new THREE.Mesh(laneMarkerGeo, laneMarkerMat);
    markerR.position.set(2, 0.01, zOffset); 
    markerR.rotation.x = -Math.PI / 2;
    markerGroup.add(markerR);
}
*/

// Oyuncu
const playerGeo = new THREE.BoxGeometry(1, 1, 1);
const playerMat = new THREE.MeshPhongMaterial({ color: 0xff0000 });
const player = new THREE.Mesh(playerGeo, playerMat);
player.position.y = 0.5;
scene.add(player);


// --- Engel Üretimi ve Ayarlar (TUNING) ---
const obstacles = [];
const OBSTACLE_Z_SPAWN = -40; 
const OBSTACLE_LANE_X = [-2, 0, 2]; 

function generateObstacle() {
    const obstacleType = Math.floor(Math.random() * 3); 
    const laneIndex = Math.floor(Math.random() * 3); 
    const xPos = OBSTACLE_LANE_X[laneIndex];

    let geometry, material, height, yPos, typeName;

    switch(obstacleType) {
        case 0: // Duvar Engeli (Kırmızı)
            height = 3; 
            yPos = height / 2;
            geometry = new THREE.BoxGeometry(1.5, height, 1);
            material = new THREE.MeshPhongMaterial({ color: 0x880000 }); 
            typeName = 'Wall';
            break;
        case 1: // Zıplama Engeli (Mavi)
            height = 1.5; // Zıplama yüksekliği ile geçebileceği seviye
            yPos = height / 2;
            geometry = new THREE.BoxGeometry(1.5, height, 1);
            material = new THREE.MeshPhongMaterial({ color: 0x008888 }); 
            typeName = 'Jump';
            break;
        case 2: // Kayma Engeli (Sarı)
            height = 1.8; // Zıplama engelinden daha yüksek ama kayarak geçilebilecek bir boşluk bırakacak
            // Yüksekliği 3'ten 1.5'e indirdik ve Y pozisyonunu daha mantıklı ayarladık.
            yPos = 1.5; // 0.5 (normal boy) + 2 (kayma boşluğu)
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

    // Engel sıklığını artırdık: 0.5 ile 1.5 saniye arası yeni engel
    state.nextObstacleTimer = Math.random() * 1.0 + 0.5; 
}


// ... (startGame ve endGame aynı kaldı) ...
function startGame() {
    state.isPlaying = true;
    state.score = 0;
    state.lane = 0;
    player.position.x = 0;
    player.position.y = 0.5;
    
    obstacles.forEach(o => scene.remove(o));
    obstacles.length = 0;

    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
}

function endGame() {
    state.isPlaying = false;
    if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    document.getElementById('final-score').innerText = Math.floor(state.score);
    document.getElementById('game-over-screen').classList.remove('hidden');
}


// --- Çarpışma Kontrolü (DÜZELTİLDİ) ---
const COLLISION_RANGE_Z = 1.5; // Z ekseninde çarpışma mesafesi

function checkCollisions() {
    // Oyuncunun güncel bounding box'ını (sınır kutusunu) alıyoruz
    const playerBox = new THREE.Box3().setFromObject(player);

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        
        // Z Ekseninde Çarpışma Kontrolü (Engel, oyuncu hizasına geldi mi?)
        if (Math.abs(player.position.z - obstacle.position.z) < COLLISION_RANGE_Z) {
            
            // X Ekseninde Şerit Kontrolü (Aynı şeritte mi?)
            if (Math.abs(player.position.x - obstacle.position.x) < 1) {
                
                // Kutu Kutu Çarpışma Kontrolü (intersectsBox)
                const obstacleBox = new THREE.Box3().setFromObject(obstacle);
                
                if (playerBox.intersectsBox(obstacleBox)) {
                    
                    if (obstacle.name === 'Jump') {
                        // Zıplama Engeli (Mavi): Eğer Zıplıyorsa kurtulur. Zıplamıyorsa çarpışma var.
                        // Zıplarken y pozisyonu 1.5'tan büyük olmalı. 
                        if (player.position.y < 1.5) return endGame(); 
                        
                    } else if (obstacle.name === 'Slide') {
                        // Kayma Engeli (Sarı): Eğer Kayıyorsa kurtulur.
                        // Kayma anında karakterin Y pozisyonu düşük olmalı.
                        // Yüksek engelin altından geçmek için kaymıyorsak çarpışma var.
                        if (!state.isSliding) return endGame(); 

                    } else if (obstacle.name === 'Wall') {
                        // Duvar Engeli (Kırmızı): Her türlü çarpışma.
                        return endGame(); 
                    }
                }
            }
        }
        
        // Engel çok geride kaldıysa sahneden kaldır
        if (obstacle.position.z > camera.position.z + 2) {
            scene.remove(obstacle);
            obstacles.splice(i, 1);
        }
    }
}


// --- Zıplama/Kayma Mantığı (AYARLANDI) ---
// Zıplama gücünü artırdık
const JUMP_VELOCITY_START = 0.4; 
const GRAVITY = -0.05; 
let jumpVelocity = 0;

function applyMovement(deltaTime) {
    // Zıplama
    if (state.isJumping) {
        player.position.y += jumpVelocity * deltaTime;
        jumpVelocity += GRAVITY * deltaTime;

        // Yere indi
        if (player.position.y <= 0.5) {
            player.position.y = 0.5;
            state.isJumping = false;
            jumpVelocity = 0;
            player.scale.set(1, 1, 1); // Kayma sırasında zıplama biterse normal boya dön
        }
    }

    // Kayma (Karakterin boyunu küçült ve pozisyonunu alçalt)
    if (state.isSliding) {
        player.scale.set(1, 0.5, 1); 
        player.position.y = 0.25; 
    } else if (!state.isJumping) {
        // Kayma veya zıplama yoksa normale döndür
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

        // Zemin ve İşaretleyicilerin Hareketi (Yol çizgilerinin kayma illüzyonu)
        markerGroup.position.z += state.speed * deltaTime;
        // Çizgileri belirli bir mesafede geriye at
        if (markerGroup.position.z > (LINE_LENGTH + LINE_GAP)) { 
            markerGroup.position.z = 0;
        }

        // Engel Hareketi
        obstacles.forEach(obstacle => {
            obstacle.position.z += state.speed * deltaTime;
        });
        
        // Yeni Engel Zamanlayıcısı
        state.nextObstacleTimer -= (0.01 * deltaTime);
        if (state.nextObstacleTimer <= 0) {
            generateObstacle();
        }

        // Oyuncu Hareketi ve Çarpışma
        applyMovement(deltaTime);
        checkCollisions();

        // Oyuncu Şerit Hareketi
        const targetX = state.lane * 2; 
        player.position.x += (targetX - player.position.x) * 0.15 * deltaTime;
    }

    renderer.render(scene, camera);
}


// --- Kontroller ---
window.addEventListener('keydown', (e) => {
    if (!state.isPlaying) return;

    if (e.key === 'ArrowLeft' || e.key === 'a') {
        if (state.lane > -1) state.lane--;
    } 
    else if (e.key === 'ArrowRight' || e.key === 'd') {
        if (state.lane < 1) state.lane++;
    }
    // Zıplama Kontrolü
    else if ((e.key === 'ArrowUp' || e.key === ' ') && !state.isJumping) {
        state.isJumping = true;
        jumpVelocity = JUMP_VELOCITY_START; 
        state.isSliding = false; 
    }
    // Kayma Kontrolü
    else if (e.key === 'ArrowDown' && !state.isJumping && !state.isSliding) {
        state.isSliding = true;
        setTimeout(() => state.isSliding = false, 800); // Kayma süresini 0.8 saniyeye düşürdük
    }
});

// Mobil Kontroller
let touchStartX = 0;
let touchStartY = 0;
window.addEventListener('touchstart', e => {
    if (e.touches.length === 1) { 
        // Sistemin (Telegram penceresi) aşağı çekmesini ENGELLE
        e.preventDefault(); 
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }
}, {passive : false });
window.addEventListener('touchend', e => {
    if (!state.isPlaying) return;
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;

    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) {
        // Çok kısa dokunuşlar, işlem yapma
        return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx < -30 && state.lane > -1) state.lane--; 
        if (dx > 30 && state.lane < 1) state.lane++; 
    } else {
        if (dy < -30 && !state.isJumping) { 
            state.isJumping = true;
            jumpVelocity = JUMP_VELOCITY_START; 
            state.isSliding = false;
        } else if (dy > 30 && !state.isJumping && !state.isSliding) { 
            state.isSliding = true;
            setTimeout(() => state.isSliding = false, 800); 
        }
    }
});


// ... (Diğer TON Olayları ve Butonlar aynı kaldı) ...
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

document.getElementById('btn-buy-reset').addEventListener('click', async () => {
    if(await purchasePlayReset()) {
        alert("TON İşlemi Başarılı! (Test amaçlı harcama yapıldı)");
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

initDailyLimits();
animate();