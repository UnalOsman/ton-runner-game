import { tonConnectUI, checkNftOwnership, purchasePlayReset } from './ton-service.js';

const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// --- AYARLAR VE SABİTLER ---
const MAX_LIVES = 5;
const RECHARGE_TIME_MS = 15 * 60 * 1000; 
const GLOBAL_SCALE = 0.01; // FBX modelleri çok büyükse bunu küçült (örn: 0.01), küçükse büyüt.

// --- SES YÖNETİMİ ---
const audioMenu = document.getElementById('bgm-menu');
const audioGame = document.getElementById('bgm-game');
const sfxPop = document.getElementById('sfx-pop');
let soundEnabled = false;

function switchMusic(type) {
    if (!soundEnabled) return;
    try {
        if (type === 'menu') {
            audioGame.pause(); audioGame.currentTime = 0;
            audioMenu.play().catch(()=>{});
        } else if (type === 'game') {
            audioMenu.pause(); audioMenu.currentTime = 0;
            audioGame.play().catch(()=>{});
        }
    } catch (e) { console.log("Ses hatası:", e); }
}

// --- VERİ VE CAN SİSTEMİ ---
let userData = {
    totalTurtles: 0,
    highScore: 0,
    lives: MAX_LIVES,
    lastLifeLostTime: null 
};

function loadUserData() {
    try {
        const saved = localStorage.getItem('bluppie_save_v2');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (!isNaN(parsed.lives)) userData = parsed;
        }
        calculateLives(); 
    } catch (e) {
        saveUserData();
    }
    updateMenuUI();
}

function saveUserData() {
    localStorage.setItem('bluppie_save_v2', JSON.stringify(userData));
    updateMenuUI();
}

function calculateLives() {
    if (userData.lives >= MAX_LIVES) {
        userData.lastLifeLostTime = null;
        return;
    }
    const now = Date.now();
    if (userData.lastLifeLostTime) {
        const diff = now - userData.lastLifeLostTime;
        const livesToRestore = Math.floor(diff / RECHARGE_TIME_MS);
        if (livesToRestore > 0) {
            userData.lives = Math.min(userData.lives + livesToRestore, MAX_LIVES);
            if (userData.lives < MAX_LIVES) {
                userData.lastLifeLostTime = now - (diff % RECHARGE_TIME_MS);
            } else {
                userData.lastLifeLostTime = null;
            }
            saveUserData();
        }
    } else {
        userData.lastLifeLostTime = now;
        saveUserData();
    }
}

function updateMenuUI() {
    const totalEl = document.getElementById('total-turtle-count');
    if (totalEl) totalEl.innerText = userData.totalTurtles;
    
    const lifeEl = document.getElementById('play-count');
    if (lifeEl) lifeEl.innerText = userData.lives;

    const btnStart = document.getElementById('btn-start');
    if (userData.lives <= 0) {
        btnStart.style.opacity = "0.6";
        if (userData.lastLifeLostTime) {
            const now = Date.now();
            const diff = now - userData.lastLifeLostTime;
            const remaining = Math.max(0, RECHARGE_TIME_MS - diff);
            const minutes = Math.ceil(remaining / 60000);
            btnStart.innerText = `⏳ ${minutes}dk`;
        } else {
            btnStart.innerText = "⏳ DOLUYOR...";
        }
    } else {
        btnStart.style.opacity = "1";
        btnStart.innerText = "PLAY";
    }
}

setInterval(() => {
    if (!state.isPlaying && userData.lives < MAX_LIVES) {
        calculateLives();
        updateMenuUI();
    } else if (!state.isPlaying && userData.lives <= 0) {
        updateMenuUI();
    }
}, 1000);

// Kullanıcı Adı
const user = tg.initDataUnsafe.user;
if (user) {
    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay) usernameDisplay.innerText = user.username ? "@" + user.username : user.first_name;
}

if (tg.isVerticalSwipingEnabled) tg.disableVerticalSwiping();
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });


// --- OYUN STATE ---
const state = {
    isPlaying: false,
    isPaused: false,
    score: 0,
    turtlesCollected: 0,
    lane: 0, 
    speed: 0.5,
    isJumping: false,
    isSliding: false,
    nextObstacleTimer: 0.0,
    nextTurtleTimer: 2.0
};

// --- THREE.JS & VARLIKLAR ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 10, 50); // Sisi biraz uzaklaştırdık

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 3, 7);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Gölgeleri açtık
document.getElementById('game-container').appendChild(renderer.domElement);

const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
scene.add(light);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);

// --- ASSET LOADER ---
const manager = new THREE.LoadingManager();
const fbxLoader = new THREE.FBXLoader(manager);
const gameAssets = {}; 
let mixer; // Animasyon oynatıcı
let runAction, jumpAction, rollAction;
const clock = new THREE.Clock();

manager.onProgress = function (url, itemsLoaded, itemsTotal) {
    // Fake loading bar ilerlemesi (Gerçek veriyle)
    const progress = (itemsLoaded / itemsTotal) * 100;
    const bar = document.getElementById('loading-bar');
    if(bar) bar.style.width = `${progress}%`;
};

manager.onLoad = function () {
    console.log('Tüm varlıklar yüklendi.');
    initGameWorld();
    
    // Yükleme bitti, Splash ekranındaki durumu güncelle
    const loadingContainer = document.getElementById('loading-container');
    const tapToStart = document.getElementById('tap-to-start');
    if(loadingContainer) loadingContainer.classList.add('hidden');
    if(tapToStart) tapToStart.classList.remove('hidden');
    
    // initApp fonksiyonundaki isLoaded bayrağını true yapmak için global event fırlatılabilir 
    // veya initApp içinde kontrol edilebilir. Biz burada initApp'in kontrol ettiği bir değişkeni set edelim.
    window.isGameAssetsLoaded = true;
};

function loadAllAssets() {
    // KARAKTER & ANIMASYONLAR
    fbxLoader.load('assets/karakterler/blup3run.fbx', (obj) => { gameAssets.player = obj; });
    fbxLoader.load('assets/karakterler/blup3jump.fbx', (obj) => { gameAssets.animJump = obj.animations[0]; });
    fbxLoader.load('assets/karakterler/blup3rolling.fbx', (obj) => { gameAssets.animRoll = obj.animations[0]; });

    // ENGELLER
    fbxLoader.load('assets/engeller/araba1.fbx', (obj) => { gameAssets.car1 = obj; });
    fbxLoader.load('assets/engeller/araba2.fbx', (obj) => { gameAssets.car2 = obj; });
    fbxLoader.load('assets/engeller/kütük.fbx', (obj) => { gameAssets.log = obj; });
    fbxLoader.load('assets/engeller/engel1.fbx', (obj) => { gameAssets.barrier = obj; });

    // TOPLANABİLİR
    fbxLoader.load('assets/karakterler/blupturta.fbx', (obj) => { gameAssets.turtle = obj; });

    // ZEMİN & YAPILAR
    fbxLoader.load('assets/zeminler/blupyol.fbx', (obj) => { gameAssets.road = obj; });
    gameAssets.houses = [];
    for(let i=1; i<=6; i++) {
        fbxLoader.load(`assets/yapilar/blupHouse${i}.fbx`, (obj) => { gameAssets.houses.push(obj); });
    }
    fbxLoader.load('assets/yapilar/blupTree1.fbx', (obj) => { gameAssets.tree1 = obj; });
    fbxLoader.load('assets/yapilar/blupTree2.fbx', (obj) => { gameAssets.tree2 = obj; });
}

// --- OYUN DÜNYASI KURULUMU ---
let roadParts = [];
let playerMesh; // Fiziksel değil, görsel model

function initGameWorld() {
    // 1. ZEMİN (Sonsuz Döngü İçin)
    // Eğer FBX yol varsa onu kullan, yoksa düz zemin
    if(gameAssets.road) {
        for(let i=0; i<5; i++) {
            const road = gameAssets.road.clone();
            road.scale.set(GLOBAL_SCALE, GLOBAL_SCALE, GLOBAL_SCALE);
            road.position.z = -i * 20; // Yol parça uzunluğuna göre ayarla
            road.rotation.y = -Math.PI / 2; // Yön ayarı gerekebilir
            scene.add(road);
            roadParts.push(road);
        }
    } else {
        // Fallback (Yedek) Zemin
        const floorGeo = new THREE.PlaneGeometry(8, 100);
        const floorMat = new THREE.MeshPhongMaterial({ color: 0x222222 }); 
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.z = -40;
        scene.add(floor);
    }

    // 2. KARAKTER
    if(gameAssets.player) {
        playerMesh = gameAssets.player;
        playerMesh.scale.set(GLOBAL_SCALE, GLOBAL_SCALE, GLOBAL_SCALE);
        playerMesh.rotation.y = Math.PI; // Kameraya arkasını dönsün
        playerMesh.position.y = 0;
        
        scene.add(playerMesh);

        // Animasyonlar
        mixer = new THREE.AnimationMixer(playerMesh);
        runAction = mixer.clipAction(playerMesh.animations[0]);
        jumpAction = mixer.clipAction(gameAssets.animJump);
        rollAction = mixer.clipAction(gameAssets.animRoll);
        
        runAction.play();
    }
}

const obstacles = [];
const turtles = [];
const OBSTACLE_Z_SPAWN = -60; 
const OBSTACLE_LANE_X = [-2, 0, 2]; 

function generateObstacle() {
    const obstacleCount = Math.random() > 0.7 ? 2 : 1;
    const availableLanes = [...OBSTACLE_LANE_X];
    
    // ÇEVRE BİNALARI (Scenery)
    spawnScenery();

    for (let i = 0; i < obstacleCount; i++) {
        const laneIdx = Math.floor(Math.random() * availableLanes.length);
        const xPos = availableLanes.splice(laneIdx, 1)[0];
        const obstacleType = Math.floor(Math.random() * 3); 
        
        let mesh, typeName, scaleCorrection = GLOBAL_SCALE;

        switch(obstacleType) {
            case 0: // ARABA (Wall - Zıplanmaz, Eğilinmez)
                mesh = (Math.random() > 0.5 && gameAssets.car2) ? gameAssets.car2.clone() : gameAssets.car1.clone();
                typeName = 'Wall';
                mesh.rotation.y = Math.PI; // Bize baksın
                break;
            case 1: // KÜTÜK (Jump - Üstünden Atla)
                mesh = gameAssets.log.clone();
                typeName = 'Jump';
                mesh.rotation.y = Math.PI / 2; // Yan dursun
                break;
            case 2: // ENGEL (Slide - Altından geç)
                mesh = gameAssets.barrier.clone();
                typeName = 'Slide';
                break;
        }

        if(mesh) {
            mesh.scale.set(scaleCorrection, scaleCorrection, scaleCorrection);
            mesh.position.set(xPos, 0, OBSTACLE_Z_SPAWN);
            mesh.name = typeName;
            
            // Box3 hesaplaması için ön hazırlık (Bounding Box)
            const box = new THREE.Box3().setFromObject(mesh);
            mesh.userData.box = box; // Performans için cache

            scene.add(mesh);
            obstacles.push(mesh);
        }
    }
    state.nextObstacleTimer = Math.random() * 0.6 + 0.5; 
}

function spawnScenery() {
    if(Math.random() > 0.4 || !gameAssets.houses) return;
    
    const sceneryList = [...gameAssets.houses, gameAssets.tree1, gameAssets.tree2];
    const item = sceneryList[Math.floor(Math.random() * sceneryList.length)];
    
    if(item) {
        const leftItem = item.clone();
        const rightItem = item.clone();
        
        leftItem.scale.set(GLOBAL_SCALE, GLOBAL_SCALE, GLOBAL_SCALE);
        rightItem.scale.set(GLOBAL_SCALE, GLOBAL_SCALE, GLOBAL_SCALE);
        
        leftItem.position.set(-9, 0, OBSTACLE_Z_SPAWN); // Yol dışı sol
        rightItem.position.set(9, 0, OBSTACLE_Z_SPAWN); // Yol dışı sağ
        
        leftItem.rotation.y = Math.PI / 2; // Yola baksın
        rightItem.rotation.y = -Math.PI / 2;

        leftItem.name = "Scenery";
        rightItem.name = "Scenery"; // Çarpışma kontrolünde yoksayılacak

        scene.add(leftItem); scene.add(rightItem);
        obstacles.push(leftItem); obstacles.push(rightItem);
    }
}

function generateTurtle() {
    const xPos = OBSTACLE_LANE_X[Math.floor(Math.random() * 3)];
    
    // GÜVENLİK: Engel üstüne turta koyma
    const isObstacleNear = obstacles.some(obs => {
        return obs.name !== "Scenery" && obs.position.x === xPos && Math.abs(obs.position.z - OBSTACLE_Z_SPAWN) < 10;
    });
    if (isObstacleNear) return;

    // SIRALI TURTA OLUŞTURMA (3-5 Adet)
    const groupSize = Math.floor(Math.random() * 3) + 3;
    const spacing = 2.5;

    for (let i = 0; i < groupSize; i++) {
        let turtleMesh;
        if (gameAssets.turtle) {
            turtleMesh = gameAssets.turtle.clone();
            turtleMesh.scale.set(GLOBAL_SCALE, GLOBAL_SCALE, GLOBAL_SCALE);
        } else {
            // Asset yüklenmezse yedek yeşil top
            const geo = new THREE.SphereGeometry(0.4);
            const mat = new THREE.MeshBasicMaterial({color:0x00ff00});
            turtleMesh = new THREE.Mesh(geo, mat);
        }

        const zOffset = OBSTACLE_Z_SPAWN - (i * spacing);
        turtleMesh.position.set(xPos, 0.5, zOffset);
        
        // Animasyon için rastgele başlangıç açısı
        turtleMesh.rotation.y = Math.random() * Math.PI;
        
        scene.add(turtleMesh);
        turtles.push(turtleMesh);
    }
    state.nextTurtleTimer = Math.random() * 1.0 + 1.0; 
}

// --- OYUN AKIŞI ---

function startGame() {
    if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');

    if (userData.lives <= 0) {
        tg.showAlert("Canın kalmadı! Canının dolması için biraz beklemen gerekiyor.");
        return;
    }

    state.isPlaying = true;
    state.isPaused = false;
    state.score = 0;
    state.turtlesCollected = 0;
    state.lane = 0;
    state.speed = 0.5;
    
    // Player Reset
    if(playerMesh) {
        playerMesh.position.x = 0;
        playerMesh.position.z = 0;
    }
    
    switchMusic('game');

    // Temizlik
    obstacles.forEach(o => scene.remove(o));
    obstacles.length = 0;
    turtles.forEach(t => scene.remove(t));
    turtles.length = 0;

    // UI
    document.getElementById('menu-header').classList.add('hidden');
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');

    // Koşu animasyonunu başlat
    if(runAction) {
        jumpAction.stop(); rollAction.stop();
        runAction.reset().play();
    }
}

function pauseGame() {
    if (!state.isPlaying) return;
    state.isPaused = true;
    audioGame.pause();
    document.getElementById('pause-screen').classList.remove('hidden');
}

function resumeGame() {
    state.isPaused = false;
    if (soundEnabled) audioGame.play();
    document.getElementById('pause-screen').classList.add('hidden');
}

function endGame() {
    state.isPlaying = false;
    if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    switchMusic('menu');

    if (userData.lives > 0) {
        userData.lives--;
        if (userData.lives === MAX_LIVES - 1 || !userData.lastLifeLostTime) {
            userData.lastLifeLostTime = Date.now();
        }
    }
    
    userData.totalTurtles += state.turtlesCollected;
    if (state.score > userData.highScore) userData.highScore = Math.floor(state.score);
    saveUserData();

    document.getElementById('game-ui').classList.add('hidden');
    document.getElementById('menu-header').classList.remove('hidden');
    document.getElementById('final-score').innerText = Math.floor(state.score);
    document.getElementById('final-turtles').innerText = state.turtlesCollected;
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function goToMainMenu() {
    state.isPlaying = false;
    state.isPaused = false;
    switchMusic('menu');

    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
    document.getElementById('game-ui').classList.add('hidden');
    document.getElementById('menu-header').classList.remove('hidden');
    
    obstacles.forEach(o => scene.remove(o));
    obstacles.length = 0;
    turtles.forEach(t => scene.remove(t));
    turtles.length = 0;
    
    if(playerMesh) playerMesh.position.x = 0;
    updateMenuUI();
}

function updateGameUI() {
    document.getElementById('in-game-score').innerText = Math.floor(state.score).toString().padStart(5, '0');
    document.getElementById('in-game-turtles').innerText = state.turtlesCollected;
}

// --- FİZİK VE ÇARPIŞMA ---
function checkCollisions() {
    if(!playerMesh) return;

    // Player Box (Biraz küçültüyoruz ki adil olsun)
    const playerBox = new THREE.Box3().setFromObject(playerMesh);
    // Box'ı biraz daralt (Tolerans)
    playerBox.expandByScalar(-0.3); 

    // ENGELLER
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.position.z += state.speed;

        // Scenery (Evler) çarpışma dışı
        if (obstacle.name === "Scenery") {
             if (obstacle.position.z > camera.position.z + 5) { scene.remove(obstacle); obstacles.splice(i, 1); }
             continue;
        }

        // Çarpışma Kontrolü
        if (Math.abs(playerMesh.position.z - obstacle.position.z) < 2 && Math.abs(playerMesh.position.x - obstacle.position.x) < 1) {
            const obstacleBox = new THREE.Box3().setFromObject(obstacle);
            obstacleBox.expandByScalar(-0.2); // Engel toleransı

            if (playerBox.intersectsBox(obstacleBox)) {
                // Mantıksal kontroller
                if (obstacle.name === 'Wall') return endGame();
                if (obstacle.name === 'Jump' && playerMesh.position.y < 1.0) return endGame(); // Yeterince zıplamamış
                if (obstacle.name === 'Slide' && !state.isSliding) return endGame(); // Eğilmemiş
            }
        }
        
        if (obstacle.position.z > camera.position.z + 5) { scene.remove(obstacle); obstacles.splice(i, 1); }
    }

    // TURTALAR
    for (let i = turtles.length - 1; i >= 0; i--) {
        const turtle = turtles[i];
        turtle.position.z += state.speed;
        turtle.rotation.y += 0.05; // Dönme efekti
        
        const turtleBox = new THREE.Box3().setFromObject(turtle);
        if (playerBox.intersectsBox(turtleBox)) {
            state.turtlesCollected++;
            
            // Pop sesi
            if (soundEnabled) { sfxPop.currentTime = 0; sfxPop.play().catch(()=>{}); }
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
            
            scene.remove(turtle); turtles.splice(i, 1);
            continue;
        }
        if (turtle.position.z > camera.position.z + 5) { scene.remove(turtle); turtles.splice(i, 1); }
    }
}

const JUMP_VELOCITY_START = 0.4; 
const GRAVITY = -0.05; 
let jumpVelocity = 0;

function applyMovement(deltaTime) {
    if(!playerMesh) return;

    // ZIPLAMA FİZİĞİ
    if (state.isJumping) {
        playerMesh.position.y += jumpVelocity * deltaTime;
        jumpVelocity += GRAVITY * deltaTime;
        
        // Yere inme
        if (playerMesh.position.y <= 0) { 
            playerMesh.position.y = 0; 
            state.isJumping = false; 
            jumpVelocity = 0; 
            
            // Animasyon: Zıplamadan Koşmaya dön
            if(jumpAction && runAction) {
                jumpAction.stop();
                runAction.reset().play();
            }
        }
    } else {
        playerMesh.position.y = 0;
    }

    // Şerit hareketi (Lerp - Yumuşak geçiş)
    const targetX = state.lane * 2; 
    playerMesh.position.x += (targetX - playerMesh.position.x) * 0.2 * deltaTime;
}

let lastTime = 0;
function animate(time) {
    requestAnimationFrame(animate);

    // GÜVENLİK: Eğer oyun başlamadıysa veya assetler henüz gelmediyse hiçbir şeyi güncelleme
    if (!state.isPlaying || state.isPaused || !window.isGameAssetsLoaded) {
        // Sadece render al ki arka plan (yol/ışık) görünsün ama karakter/engel oluşmasın
        renderer.render(scene, camera);
        return; 
    }
    
    const deltaTime = (time - lastTime) / 1000 * 60; 
    lastTime = time;

    // Animasyon Mikseri Güncelleme (Animation Mixer)
    if(mixer && clock) {
        const delta = clock.getDelta();
        mixer.update(delta);
    }

    if (state.isPlaying && !state.isPaused) {
        state.score += 0.1 * deltaTime; 
        updateGameUI(); 
        
        state.nextObstacleTimer -= (0.01 * deltaTime);
        if (state.nextObstacleTimer <= 0) generateObstacle();
        
        // Daha sık turta gelmesi için katsayı arttırıldı
        state.nextTurtleTimer -= (0.015 * deltaTime);
        if (state.nextTurtleTimer <= 0) generateTurtle();
        
        checkCollisions();
        applyMovement(deltaTime);
        
        // Yol döngüsü (FBX parçaları)
        if(roadParts.length > 0) {
            roadParts.forEach(part => {
                part.position.z += state.speed;
                if(part.position.z > 20) { // Kamera arkasına geçtiyse
                    part.position.z -= 100; // En arkaya at (5 parça * 20br)
                }
            });
        }
    }
    renderer.render(scene, camera);
}

// --- GİRİŞ VE INPUT (CONTROLS) ---

function initApp() {
    const splash = document.getElementById('splash-screen');
    const splashContent = document.querySelector('.splash-content'); // Dokunulabilir alan
    
    // Global variable kontrolü (Assets loaded?)
    window.isGameAssetsLoaded = false;

    // Splash ekranına tıklama
    splash.addEventListener('click', () => {
        if(!window.isGameAssetsLoaded) return; // Yükleme bitmediyse açma

        // Sesleri aç
        soundEnabled = true;
        audioMenu.play().catch(()=>{});
        audioGame.play().then(()=>audioGame.pause());

        splash.style.opacity = '0';
        setTimeout(() => splash.style.display = 'none', 800);
        if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    });

    // Assetleri yüklemeye başla
    loadAllAssets();
}

// KLAVYE KONTROLLERİ
window.addEventListener('keydown', (e) => {
    if (!state.isPlaying || state.isPaused) return;
    
    // Sol / Sağ
    if ((e.key === 'ArrowLeft' || e.key === 'a') && state.lane > -1) state.lane--;
    if ((e.key === 'ArrowRight' || e.key === 'd') && state.lane < 1) state.lane++;
    
    // Zıplama (Up)
    if ((e.key === 'ArrowUp' || e.key === 'w')) {
        if(state.isSliding) { // Eğilmeyi iptal et
             state.isSliding = false; 
             rollAction.stop(); 
        }
        if(!state.isJumping) {
            state.isJumping = true; 
            jumpVelocity = JUMP_VELOCITY_START;
            runAction.stop(); jumpAction.reset().play();
        }
    }
    
    // Eğilme (Down) / Hızlı İniş
    if ((e.key === 'ArrowDown' || e.key ==='s')) {
        if(state.isJumping) { // Hızlı İniş (Dive)
            jumpVelocity = -0.5; // Aşağı kuvvet uygula
        } else if (!state.isSliding) {
            state.isSliding = true;
            runAction.stop(); rollAction.reset().play();
            setTimeout(() => { 
                if(state.isPlaying && !state.isJumping) {
                    state.isSliding = false;
                    rollAction.stop(); runAction.reset().play();
                }
            }, 800);
        }
    }
});

// DOKUNMATİK KONTROLLER
let touchStartX = 0;
let touchStartY = 0;
window.addEventListener('touchstart', e => { 
    touchStartX = e.changedTouches[0].screenX; 
    touchStartY = e.changedTouches[0].screenY; 
}, {passive : true });

window.addEventListener('touchend', e => {
    if (!state.isPlaying || state.isPaused) return;
    const dx = e.changedTouches[0].screenX - touchStartX;
    const dy = e.changedTouches[0].screenY - touchStartY;
    
    if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
        if (Math.abs(dx) > Math.abs(dy)) {
            // YATAY
            if (dx < -30 && state.lane > -1) state.lane--; 
            if (dx > 30 && state.lane < 1) state.lane++; 
        } else {
            // DİKEY
            if (dy < -30) { // YUKARI (ZIPLA)
                if(state.isSliding) { state.isSliding = false; rollAction.stop(); }
                if (!state.isJumping) { 
                    state.isJumping = true; 
                    jumpVelocity = JUMP_VELOCITY_START;
                    runAction.stop(); jumpAction.reset().play();
                }
            } 
            else if (dy > 30) { // AŞAĞI (EĞİL / DIVE)
                if (state.isJumping) {
                    jumpVelocity = -0.5; // Hızlı iniş
                } else if (!state.isSliding) {
                    state.isSliding = true; 
                    runAction.stop(); rollAction.reset().play();
                    setTimeout(() => { 
                        if(state.isPlaying && !state.isJumping) {
                            state.isSliding = false;
                            rollAction.stop(); runAction.reset().play();
                        }
                    }, 800); 
                }
            }
        }
    }
}, { passive: true });

// Buton Listener'ları
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', startGame);
document.getElementById('btn-home').addEventListener('click', goToMainMenu);
document.getElementById('btn-buy-reset').addEventListener('click', purchasePlayReset);
document.getElementById('btn-pause').addEventListener('click', pauseGame);
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-quit').addEventListener('click', goToMainMenu);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Uygulamayı Başlat
loadUserData();
initApp();
animate();