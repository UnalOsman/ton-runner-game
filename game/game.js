/*  import { tonConnectUI, checkNftOwnership, purchasePlayReset } from '../ton-service.js';

const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// --- AYARLAR VE SABİTLER ---
const MAX_LIVES = 5;
const RECHARGE_TIME_MS = 0.1 * 60 * 1000; 
const GLOBAL_SCALE = 0.01; 

// --- SES YÖNETİMİ ---
const audioMenu = document.getElementById('bgm-menu');
const audioGame = document.getElementById('bgm-game');
// sfxPop elementini artık kod içinde dinamik üreteceğiz (Audio Pool)
let soundEnabled = false;

// Ses Havuzu: Patlama sesleri için önbellek
const popSounds = [];
const POP_POOL_SIZE = 5;

// Oyuna başlamadan havuzu dolduralım
function initAudioPool() {
    for(let i=0; i<POP_POOL_SIZE; i++) {
        const audio = new Audio('assets/sesler/pop.mp3'); // Dosya yolunun doğruluğundan emin olun
        audio.volume = 0.6;
        popSounds.push(audio);
    }
}
initAudioPool();

function playPopSound() {
    if(!soundEnabled) return;
    // Müsait olan (çalmıyan) bir ses bul
    const sound = popSounds.find(s => s.paused);
    if(sound) {
        sound.play().catch(()=>{});
    } else {
        // Hepsi doluysa ilkini zorla başa sar
        popSounds[0].currentTime = 0;
        popSounds[0].play().catch(()=>{});
    }
}

// Haptic Feedback
function safeHaptic(type = 'medium') {
    if (tg.isVersionAtLeast('6.1') && tg.HapticFeedback) {
        try {
            if (type === 'error') tg.HapticFeedback.notificationOccurred('error');
            else tg.HapticFeedback.impactOccurred(type);
        } catch (e) { console.warn("Haptic error", e); }
    }
}

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
    } catch (e) { console.log("Music error", e); }
}

// --- VERİ VE CAN SİSTEMİ ---
let userData = { totalTurtles: 0, highScore: 0, lives: MAX_LIVES, lastLifeLostTime: null };

function loadUserData() {
    try {
        const saved = localStorage.getItem('bluppie_save_v2');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (!isNaN(parsed.lives)) userData = parsed;
        }
        calculateLives(); 
    } catch (e) { saveUserData(); }
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
    isPlaying: false, isPaused: false, score: 0, turtlesCollected: 0,
    lane: 0, speed: 12, isJumping: false, isSliding: false,
    nextObstacleTimer: 1.2, nextTurtleTimer: 2.0
};

// --- THREE.JS GÖRSEL İYİLEŞTİRME (EN ÖNEMLİ KISIM) ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 20, 90); // Sis daha yumuşak

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 3, 7);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);

// *** GÖRSEL KALİTE AYARLARI ***
renderer.shadowMap.enabled = true; // Gölgeleri aç
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Yumuşak gölgeler
// Blender renklerine yaklaşmak için bu iki ayar şart:
renderer.outputColorSpace = THREE.SRGBColorSpace; 
renderer.toneMapping = THREE.ACESFilmicToneMapping; 
renderer.toneMappingExposure = 1.0;

document.getElementById('game-container').appendChild(renderer.domElement);

// IŞIKLANDIRMA (Daha doğal olması için)
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6); // Gökyüzü ışığı
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2); // Güneş ışığı
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true; // Güneş gölge düşürsün
// Gölge kalitesi ayarları
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50;
scene.add(dirLight);

// --- ASSET LOADER ---
const manager = new THREE.LoadingManager();
const fbxLoader = new THREE.FBXLoader(manager);
const gameAssets = {}; 
let mixer; 
let runAction, jumpAction, rollAction;
const clock = new THREE.Clock();

manager.onLoad = function () {
    console.log('Tüm varlıklar yüklendi.');
    initGameWorld();
    
    // Yüklenen modellere gölge özelliği ekle (Traverse)
    scene.traverse((object) => {
        if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });

    const loadingContainer = document.getElementById('loading-container');
    const tapToStart = document.getElementById('tap-to-start');
    if(loadingContainer) loadingContainer.classList.add('hidden');
    if(tapToStart) tapToStart.classList.remove('hidden');
    window.isGameAssetsLoaded = true;
};

function loadAllAssets() {

    // KARAKTER
    fbxLoader.load('assets/karakterler/blup3run.fbx', obj => gameAssets.player = obj);
    fbxLoader.load('assets/karakterler/blup3jump.fbx', obj => gameAssets.animJump = obj.animations[0]);
    fbxLoader.load('assets/karakterler/blup3rolling.fbx', obj => gameAssets.animRoll = obj.animations[0]);

    // ENGELLER
    fbxLoader.load('assets/engeller/araba1.fbx', obj => gameAssets.car1 = obj);
    fbxLoader.load('assets/engeller/araba2.fbx', obj => gameAssets.car2 = obj);
    fbxLoader.load('assets/engeller/kütük.fbx', obj => gameAssets.log = obj);
    fbxLoader.load('assets/engeller/engel1.fbx', obj => gameAssets.barrier = obj);

    // TOPLANABİLİR
    fbxLoader.load('assets/karakterler/blupturta.fbx', obj => gameAssets.turtle = obj);

    // YOL
    fbxLoader.load('assets/zeminler/blupyol.fbx', obj => gameAssets.road = obj);

    // BÜYÜK YAPILAR
    [
        'blupHouse1','blupHouse2','blupHouse3',
        'blupHouse4','blupHouse5','blupHouse6',
        'blupotopark'
    ].forEach(name => {
        fbxLoader.load(`assets/yapilar/${name}.fbx`, obj => {
            structures.buildings.push(obj);
        });
    });

    // DOLDURUCU OBJELER
    ['bluplamba','blupTree1','blupTree2'].forEach(name => {
        fbxLoader.load(`assets/yapilar/${name}.fbx`, obj => {
            structures.fillers.push(obj);
        });
    });

    // ÜST GEÇİT
    fbxLoader.load('assets/yapilar/blupgecit.fbx', obj => {
        structures.overpass = obj;
    });
}


function placeOnGround(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    const offset = box.min.y;
    mesh.position.y -= offset;
}


// --- OYUN DÜNYASI KURULUMU ---
let roadParts = [];
let playerMesh;
// İKİ AYRI DİZİ KULLANACAĞIZ
const obstacles = []; // Çarpılacak şeyler
const sceneryObjects = []; // Sadece görüntü (Evler)
const turtles = [];

const OBSTACLE_Z_SPAWN = -60; 
const OBSTACLE_LANE_X = [-1.5, 0, 1.5]; 

// --- YAPI SİSTEMİ ---
const STRUCTURE_OFFSET_X = 9;
const STRUCTURE_SCALE = 0.01;

const structures = {
    buildings: [],   // ev, otopark
    fillers: [],     // ağaç, lamba
    overpass: null   // üst geçit
};

function getObjectWidthX(object) {
    const box = new THREE.Box3().setFromObject(object);
    return box.max.x - box.min.x;
}



function initGameWorld() {
    // 1. ZEMİN
    if(gameAssets.road) {
        for(let i=0; i<6; i++) { // Yol parçası sayısını artırdım
            const road = gameAssets.road.clone();
            road.scale.set(GLOBAL_SCALE, GLOBAL_SCALE, GLOBAL_SCALE);
            road.position.z = -i * 20; 
            road.rotation.y = -Math.PI / 2;
            road.receiveShadow = true; // Yol gölge kabul etsin
            scene.add(road);
            roadParts.push(road);
        }
    }

    // 2. KARAKTER
    if(gameAssets.player) {
        playerMesh = gameAssets.player;
        const pScale = 0.005; 
        playerMesh.scale.set(pScale, pScale, pScale);
        playerMesh.position.y = 0;
        playerMesh.rotation.y = Math.PI; 
        playerMesh.castShadow = true; // Karakter gölge düşürsün
        
        scene.add(playerMesh);

        mixer = new THREE.AnimationMixer(playerMesh);
        runAction = mixer.clipAction(playerMesh.animations[0]);
        jumpAction = mixer.clipAction(gameAssets.animJump);
        rollAction = mixer.clipAction(gameAssets.animRoll);
        runAction.play();
    }

    // ÇİMEN (Yanlar)
    const sideFloorGeo = new THREE.PlaneGeometry(200, 500); 
    const sideFloorMat = new THREE.MeshPhongMaterial({ color: 0x3d8c40 }); 
    const leftFloor = new THREE.Mesh(sideFloorGeo, sideFloorMat);
    leftFloor.rotation.x = -Math.PI / 2;
    leftFloor.position.set(-90, -0.1, -100); 
    leftFloor.receiveShadow = true;
    scene.add(leftFloor);

    const rightFloor = new THREE.Mesh(sideFloorGeo, sideFloorMat);
    rightFloor.rotation.x = -Math.PI / 2;
    rightFloor.position.set(90, -0.1, -100); 
    rightFloor.receiveShadow = true;
    scene.add(rightFloor);
}


// --- ÜRETİM FONKSİYONLARI ---

function spawnCityRow(zPos) {

    [-1, 1].forEach(side => {

        // ===== EV =====
        const building = structures.buildings[
            Math.floor(Math.random() * structures.buildings.length)
        ].clone();

        building.scale.set(STRUCTURE_SCALE, STRUCTURE_SCALE, STRUCTURE_SCALE);
        building.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
        building.position.set(side * STRUCTURE_OFFSET_X, 0, zPos);
        placeOnGround(building);

        scene.add(building);
        sceneryObjects.push(building);

        // ===== EV GENİŞLİĞİ (GERÇEK DEĞER) =====
        const buildingWidth = getObjectWidthX(building);

        // ===== AĞAÇ / LAMBA (EVLER ARASI, ÖN TARAF) =====
        if (structures.fillers.length && Math.random() > 0.3) {

            const filler = structures.fillers[
                Math.floor(Math.random() * structures.fillers.length)
            ].clone();

            filler.scale.set(STRUCTURE_SCALE, STRUCTURE_SCALE, STRUCTURE_SCALE);
            filler.rotation.y = building.rotation.y;

            /*
              Mantık:
              - Ev merkezinden
              - Ev genişliğinin YARISI kadar dışarı
              - Üstüne güvenli boşluk ekle
            
            const safeGap = 0.6;

            filler.position.set(
                side * (STRUCTURE_OFFSET_X + buildingWidth / 2 + safeGap),
                0,
                zPos + (Math.random() * 1.5 - 0.75) // evle aynı hizada, arkaya düşmez
            );

            placeOnGround(filler);

            scene.add(filler);
            sceneryObjects.push(filler);
        }
    });
}




function spawnOverpass(zPos) {
    if (!structures.overpass) return;

    const bridge = structures.overpass.clone();
    bridge.scale.set(STRUCTURE_SCALE, STRUCTURE_SCALE, STRUCTURE_SCALE);
    bridge.position.set(0, 0, zPos);
    bridge.rotation.y = -Math.PI/2;

    placeOnGround(bridge);

    scene.add(bridge);
    sceneryObjects.push(bridge);
}


function generateObstacle() {
    // Zamanlayıcıyı resetle
    state.nextObstacleTimer = 0.6 + Math.random() * 1;

    const obstacleCount = Math.random() > 0.5 ? 2 : 1;
    const availableLanes = [...OBSTACLE_LANE_X];
    
    for (let i = 0; i < obstacleCount; i++) {
        const laneIdx = Math.floor(Math.random() * availableLanes.length);
        const xPos = availableLanes.splice(laneIdx, 1)[0];
        const obstacleType = Math.floor(Math.random() * 3); 
        
        let mesh, typeName;

        switch(obstacleType) {
            case 0: // ARABA 
                mesh = (gameAssets.car2) ? gameAssets.car2.clone() : gameAssets.car1.clone();
                typeName = 'Wall';
                mesh.scale.set(0.015, 0.01, 0.008); 
                mesh.rotation.y = Math.PI/2; 
                mesh.position.y = 1.2; 
                break;
            case 1: // KÜTÜK (Jump)
                mesh = gameAssets.log.clone();
                typeName = 'Jump';
                mesh.scale.set(0.008, 0.02, 0.01); 
                mesh.rotation.y = Math.PI / 2; 
                mesh.position.y = 0.2; 
                break;
            case 2: // ENGEL1 (Slide)
                mesh = gameAssets.barrier.clone();
                typeName = 'Slide';
                mesh.scale.set(0.012, 0.012, 0.012);
                mesh.rotation.y = Math.PI / 2; 
                mesh.position.y = 1; 
                break;
        }

        if(mesh) {
            mesh.position.set(xPos, mesh.position.y, OBSTACLE_Z_SPAWN);
            mesh.name = typeName;
            mesh.castShadow = true; // Engel gölge düşürsün
            scene.add(mesh);
            obstacles.push(mesh);
        }
    } 
}

function generateTurtle() {
    const xPos = OBSTACLE_LANE_X[Math.floor(Math.random() * 3)];
    
    // Güvenlik kontrolü: Aynı şeritte yakın engel var mı?
    const isObstacleNear = obstacles.some(obs => {
        return obs.position.x === xPos || Math.abs(obs.position.z - OBSTACLE_Z_SPAWN) < 15;
    });

    if (isObstacleNear) return; 

    const groupSize = Math.floor(Math.random() * 3) + 3;
    const spacing = 2.5;

    for (let i = 0; i < groupSize; i++) {
        let turtleMesh = gameAssets.turtle ? gameAssets.turtle.clone() : null;
        if (!turtleMesh) return;

        const tScale = 0.005;
        turtleMesh.scale.set(tScale, tScale, tScale);
        
        const zOffset = OBSTACLE_Z_SPAWN - (i * spacing);
        turtleMesh.position.set(xPos, 0.8, zOffset);
        
        // Turtaya basit bir animasyon için referans verilebilir veya render loop'ta döndürülür
        scene.add(turtleMesh);
        turtles.push(turtleMesh);
    }
    state.nextTurtleTimer = 1.5 + Math.random() * 2; 
}

// --- OYUN AKIŞI ---

function startGame() {
    if(tg.HapticFeedback) safeHaptic('medium');

    if (userData.lives <= 0) {
        if (tg.isVersionAtLeast('6.2')) tg.showAlert("Canın kalmadı!");
        else alert("Canın kalmadı!");
        return;
    }

    state.isPlaying = true;
    state.isPaused = false;
    state.score = 0;
    state.turtlesCollected = 0;
    state.lane = 0;
    state.speed = 20;
    
    if(playerMesh) {
        playerMesh.position.x = 0;
        playerMesh.position.z = 0;
    }
    switchMusic('game');

    // Temizlik
    obstacles.forEach(o => scene.remove(o));
    obstacles.length = 0;
    sceneryObjects.forEach(s => scene.remove(s));
    sceneryObjects.length = 0;
    turtles.forEach(t => scene.remove(t));
    turtles.length = 0;

    // UI
    document.getElementById('menu-header').classList.add('hidden');
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');

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
    if(tg.HapticFeedback) safeHaptic('error');
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
    sceneryObjects.forEach(s => scene.remove(s));
    sceneryObjects.length = 0;
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
function checkCollisions(deltaTime) {
    if(!playerMesh) return;

    // 1. ENGELLER (Obstacles)
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.position.z += state.speed * deltaTime;

        if (obstacle.position.z > camera.position.z + 5) { 
            scene.remove(obstacle); 
            obstacles.splice(i, 1);
            continue; 
        }

        const zDiff = Math.abs(playerMesh.position.z - obstacle.position.z);
        const xDiff = Math.abs(playerMesh.position.x - obstacle.position.x);

        // Çarpışma Toleransları
        if (zDiff < 1.0 && xDiff < 0.6) {
            if (obstacle.name === 'Wall') return endGame();
            if (obstacle.name === 'Jump') {
                if (playerMesh.position.y < 0.5) return endGame();
            }
            if (obstacle.name === 'Slide') {
                if (!state.isSliding) return endGame();
            }
        }
    }

    // 2. EVLER (Scenery) - Sadece hareket ettir ve sil, çarpışma yok
    for (let i = sceneryObjects.length - 1; i >= 0; i--) {
        const obj = sceneryObjects[i];
        obj.position.z += state.speed * deltaTime;
        if (obj.position.z > camera.position.z + 10) {
            scene.remove(obj);
            sceneryObjects.splice(i, 1);
        }
    }

    // 3. TURTALAR
    for (let i = turtles.length - 1; i >= 0; i--) {
        const turtle = turtles[i];
        turtle.position.z += state.speed * deltaTime;
        turtle.rotation.y += 0.05;

        const distZ = Math.abs(playerMesh.position.z - turtle.position.z);
        const distX = Math.abs(playerMesh.position.x - turtle.position.x);

        if (distZ < 0.8 && distX < 0.8) {
            state.turtlesCollected++;
            playPopSound(); // Audio Pool kullan
            if (tg.HapticFeedback) safeHaptic('light');
            scene.remove(turtle); turtles.splice(i, 1);
            continue;
        }

        if (turtle.position.z > camera.position.z + 5) { scene.remove(turtle); turtles.splice(i, 1); }
    }
}

const JUMP_VELOCITY_START = 8; 
const GRAVITY = -25; 
let jumpVelocity = 0;
const LANE_WIDTH = 1.5;
const LANE_CHANGE_SPEED = 12; // ← kritik değer


function applyMovement(deltaTime) {
    if(!playerMesh) return;

    if (state.isJumping) {
        playerMesh.position.y += jumpVelocity * deltaTime;
        jumpVelocity += GRAVITY * deltaTime;
        
        if (playerMesh.position.y <= 0) { 
            playerMesh.position.y = 0; 
            state.isJumping = false; 
            jumpVelocity = 0; 
            if(jumpAction && runAction) {
                jumpAction.stop();
                runAction.reset().play();
            }
        }
    } else {
        playerMesh.position.y = 0;
    }

    const targetX = state.lane * LANE_WIDTH;
    const diff = targetX - playerMesh.position.x;

    playerMesh.position.x += diff * Math.min(1, LANE_CHANGE_SPEED * deltaTime);
    
}

let lastTime = 0;
function animate(time) {
    requestAnimationFrame(animate);

    if (!state.isPlaying || state.isPaused || !window.isGameAssetsLoaded) {
        renderer.render(scene, camera);
        return; 
    }

    const deltaTime = (time - lastTime) / 1000 ; 
    lastTime = time;

    if (mixer) mixer.update(deltaTime);

    state.score += 5 * deltaTime; 
    updateGameUI(); 
    
    state.nextObstacleTimer -=  deltaTime;
    if (state.nextObstacleTimer <= 0) generateObstacle();
    
    state.nextTurtleTimer -= deltaTime;
    if (state.nextTurtleTimer <= 0) generateTurtle();
    
    checkCollisions(deltaTime);
    applyMovement(deltaTime);
    
    // YOL DÖNGÜSÜ (EVLER BURADA OLUŞUYOR)
    roadParts.forEach(part => {
    part.position.z += state.speed * deltaTime;

    if (part.position.z > 20) {
        part.position.z -= 120;

        if (Math.random() < 0.15) {
            spawnOverpass(part.position.z);
        } else {
            spawnCityRow(part.position.z);
        }
    }
});


    renderer.render(scene, camera);
}

// --- GİRİŞ VE INPUT ---
function initApp() {
    const splash = document.getElementById('splash-screen');
    window.isGameAssetsLoaded = false;

    splash.addEventListener('click', () => {
        if(!window.isGameAssetsLoaded) return;
        soundEnabled = true;
        audioMenu.play().catch(()=>{});
        
        // Audio pool'u uyandır (Mobil tarayıcılar için hack)
        popSounds.forEach(s => { s.play().then(()=>s.pause()).catch(()=>{}); });
        
        splash.style.opacity = '0';
        setTimeout(() => splash.style.display = 'none', 800);
        if(tg.HapticFeedback) safeHaptic('medium');
    });

    loadAllAssets();
}

// KONTROLLER (Aynen korundu)
window.addEventListener('keydown', (e) => {
    if (!state.isPlaying || state.isPaused) return;
    if ((e.key === 'ArrowLeft' || e.key === 'a') && state.lane > -1) state.lane--;
    if ((e.key === 'ArrowRight' || e.key === 'd') && state.lane < 1) state.lane++;
    if ((e.key === 'ArrowUp' || e.key === 'w')) {
        if(state.isSliding) { state.isSliding = false; rollAction.stop(); }
        if(!state.isJumping) {
            state.isJumping = true; jumpVelocity = JUMP_VELOCITY_START;
            runAction.stop(); jumpAction.reset().play();
        }
    }
    if ((e.key === 'ArrowDown' || e.key ==='s')) {
        if(state.isJumping) { jumpVelocity = -0.5; } 
        else if (!state.isSliding) {
            state.isSliding = true;
            runAction.stop(); rollAction.reset().play();
            setTimeout(() => { 
                if(state.isPlaying && !state.isJumping) {
                    state.isSliding = false; rollAction.stop(); runAction.reset().play();
                }
            }, 800);
        }
    }
});

let touchStartX = 0; let touchStartY = 0;
window.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; touchStartY = e.changedTouches[0].screenY; }, {passive : true });
window.addEventListener('touchend', e => {
    if (!state.isPlaying || state.isPaused) return;
    const dx = e.changedTouches[0].screenX - touchStartX;
    const dy = e.changedTouches[0].screenY - touchStartY;
    if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx < -30 && state.lane > -1) state.lane--; 
            if (dx > 30 && state.lane < 1) state.lane++; 
        } else {
            if (dy < -30) { 
                if(state.isSliding) { state.isSliding = false; rollAction.stop(); }
                if (!state.isJumping) { state.isJumping = true; jumpVelocity = JUMP_VELOCITY_START; runAction.stop(); jumpAction.reset().play(); }
            } else if (dy > 30) { 
                if (state.isJumping) { jumpVelocity = -0.5; } 
                else if (!state.isSliding) {
                    state.isSliding = true; runAction.stop(); rollAction.reset().play();
                    setTimeout(() => { if(state.isPlaying && !state.isJumping) { state.isSliding = false; rollAction.stop(); runAction.reset().play(); } }, 800); 
                }
            }
        }
    }
}, { passive: true });

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

loadUserData();
initApp();
animate();
*/