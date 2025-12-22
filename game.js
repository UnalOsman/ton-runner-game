import { tonConnectUI, checkNftOwnership, purchasePlayReset } from './ton-service.js';

const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// --- AYARLAR VE SABİTLER ---
const MAX_LIVES = 5;
const RECHARGE_TIME_MS = 0.1 * 60 * 1000; 
const GLOBAL_SCALE = 0.01; // FBX modelleri çok büyükse bunu küçült (örn: 0.01), küçükse büyüt.

// --- SES YÖNETİMİ ---
const audioMenu = document.getElementById('bgm-menu');
const audioGame = document.getElementById('bgm-game');
const sfxPop = document.getElementById('sfx-pop');
let soundEnabled = false;

// Bu fonksiyon bir 'koruma kalkanı' görevi görür
function safeHaptic(type = 'medium') {
    // 1. Sürüm kontrolü yap (6.1 ve altı desteklemez)
    // 2. Özelliğin var olup olmadığını kontrol et
    if (tg.isVersionAtLeast('6.1') && tg.HapticFeedback) {
        try {
            if (type === 'error') {
                tg.HapticFeedback.notificationOccurred('error');
            } else {
                tg.HapticFeedback.impactOccurred(type);
            }
        } catch (e) {
            console.warn("Haptic hatası yoksayıldı:", e);
        }
    } else {
        // Eğer sürüm eskiyse sadece konsola yaz, oyunu çökertme
        console.log("Haptic desteklenmiyor, titreşim atlandı.");
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

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPrerence : "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false; // Gölgeleri açtık
document.getElementById('game-container').appendChild(renderer.domElement);

const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
scene.add(light);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = false;
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
let lastSceneryZ = -60; // En son eklenen binanın Z pozisyonu

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
        const pScale = 0.006; 
        playerMesh.scale.set(pScale, pScale, pScale);
        playerMesh.position.y = 0;
        playerMesh.rotation.y = Math.PI; // Kameraya arkasını dönsün
        
        scene.add(playerMesh);

        // Animasyonlar
        mixer = new THREE.AnimationMixer(playerMesh);
        runAction = mixer.clipAction(playerMesh.animations[0]);
        jumpAction = mixer.clipAction(gameAssets.animJump);
        rollAction = mixer.clipAction(gameAssets.animRoll);
        
        runAction.play();
    }

    // YAN ZEMİNLER (Evlerin altına çimen/toprak görünümü)
    const sideFloorGeo = new THREE.PlaneGeometry(100, 500); // Çok uzun ve geniş
    const sideFloorMat = new THREE.MeshPhongMaterial({ color: 0x3d8c40 }); // Yeşil çimen rengi
    
    const leftFloor = new THREE.Mesh(sideFloorGeo, sideFloorMat);
    leftFloor.rotation.x = -Math.PI / 2;
    leftFloor.position.set(-55, -0.05, -100); // Yolun hemen soluna, çok hafif aşağıya
    scene.add(leftFloor);

    const rightFloor = new THREE.Mesh(sideFloorGeo, sideFloorMat);
    rightFloor.rotation.x = -Math.PI / 2;
    rightFloor.position.set(55, -0.05, -100); // Yolun hemen sağına
    scene.add(rightFloor);
}

const obstacles = [];
const turtles = [];
const OBSTACLE_Z_SPAWN = -60; 
const OBSTACLE_LANE_X = [-1.5, 0, 1.5]; 

function generateObstacle() {

    // 1. ZAMANLAYICIYI RESETLE (Üst üste binmeyi önleyen en kritik yer)
    // Engeller arası mesafeyi açmak için timer'ı artırıyoruz
    state.nextObstacleTimer = 1.2 + Math.random() * 1; // Daha seyrek engel

    const obstacleCount = Math.random() > 0.5 ? 2 : 1;
    const availableLanes = [...OBSTACLE_LANE_X];
    
    // ÇEVRE BİNALARI (Scenery)
    spawnScenery();

    for (let i = 0; i < obstacleCount; i++) {
        const laneIdx = Math.floor(Math.random() * availableLanes.length);
        const xPos = availableLanes.splice(laneIdx, 1)[0];
        const obstacleType = Math.floor(Math.random() * 3); 
        
        let mesh, typeName;

        switch(obstacleType) {
            case 0: // ARABA (Wall)
                mesh = (gameAssets.car2) ? gameAssets.car2.clone() : gameAssets.car1.clone();
                typeName = 'Wall';
                mesh.scale.set(0.008, 0.01, 0.01); // Karakterden küçük olması için küçülttük
                mesh.rotation.y = Math.PI/2; // Eğer yan duruyorsa Math.PI / 2 veya 0 deneyerek düzeltilir
                mesh.position.y = 1; // Yolun tam üstü
                break;
            case 1: // KÜTÜK (Jump)
                mesh = gameAssets.log.clone();
                typeName = 'Jump';
                mesh.scale.set(0.008, 0.02, 0.01); 
                mesh.rotation.y = Math.PI / 2; // Yolu enine kesecek şekilde
                mesh.position.y = 0.2; // Kütüğün yarısı gömülüyse burayı artır (örn: 0.8)
                break;
            case 2: // ENGEL1 (Slide - Altından kayılan barikat)
                mesh = gameAssets.barrier.clone();
                typeName = 'Slide';
                mesh.scale.set(0.012, 0.012, 0.012);
                mesh.rotation.y = Math.PI / 2; // "Dik bakıyor" dediğin için 90 derece döndürdük
                mesh.position.y = 1; 
                break;
        }

        if(mesh) {
            mesh.position.set(xPos, mesh.position.y, OBSTACLE_Z_SPAWN);
            mesh.name = typeName;
            scene.add(mesh);
            obstacles.push(mesh);
        }
    } 
}

function spawnScenery() {
    // if(Math.random() > 0.3) satırını sildik, artık her engel dalgasında bina gelecek
    if(!gameAssets.houses || gameAssets.houses.length === 0) return;
    
    const item = gameAssets.houses[Math.floor(Math.random() * gameAssets.houses.length)];
    if(item) {
        const leftItem = item.clone();
        const rightItem = item.clone();
        const houseScale = 0.008; 
        leftItem.scale.set(houseScale, houseScale, houseScale);
        rightItem.scale.set(houseScale, houseScale, houseScale);
        
        leftItem.position.set(-12, 0, OBSTACLE_Z_SPAWN); 
        rightItem.position.set(12, 0, OBSTACLE_Z_SPAWN);
        
        leftItem.rotation.y = Math.PI / 2; 
        rightItem.rotation.y = -Math.PI / 2;
        leftItem.name = "Scenery"; rightItem.name = "Scenery";
        scene.add(leftItem); scene.add(rightItem);
        obstacles.push(leftItem); obstacles.push(rightItem);
    }
}
// animate fonksiyonu içinde binalar silindikçe lastSceneryZ'yi de güncellemeliyiz 
// veya daha basitçe: checkCollisions içinde bina silindiğinde bu değeri resetlemeliyiz.
// En garantisi generateObstacle içinden spawnScenery'yi çağırmaya devam etmektir.


function generateTurtle() {
    const xPos = OBSTACLE_LANE_X[Math.floor(Math.random() * 3)];
    
    // GÜVENLİK: Engellerin olduğu Z koordinatının 10 birim önünü ve arkasını kontrol et
    const isObstacleNear = obstacles.some(obs => {
        if (obs.name === "Scenery") return false; // Evleri engel sayma
        // Aynı şeritte mi ve Z mesafesi 10 birimden az mı?
        return obs.position.x === xPos && Math.abs(obs.position.z - OBSTACLE_Z_SPAWN) < 15;
    });

    if (isObstacleNear) {
        // Eğer engel varsa bu seferlik turta oluşturma veya Z'yi ötele
        return; 
    }

    const groupSize = Math.floor(Math.random() * 3) + 3;
    const spacing = 2.5;

    for (let i = 0; i < groupSize; i++) {
        let turtleMesh = gameAssets.turtle ? gameAssets.turtle.clone() : null;
        if (!turtleMesh) return;

        const tScale = 0.005;
        turtleMesh.scale.set(tScale, tScale, tScale);
        
        // Z pozisyonunu engelden iyice uzağa set ediyoruz
        const zOffset = OBSTACLE_Z_SPAWN - (i * spacing);
        turtleMesh.position.set(xPos, 0.8, zOffset);
        
        scene.add(turtleMesh);
        turtles.push(turtleMesh);
    }
    state.nextTurtleTimer = 1.5 + Math.random() * 2; 
}

// --- OYUN AKIŞI ---

function startGame() {
    if(tg.HapticFeedback) safeHaptic('medium');

    if (userData.lives <= 0) {
        // Eğer Telegram showAlert desteklemiyorsa normal tarayıcı alert'i kullan
        if (tg.isVersionAtLeast('6.2')) {
            tg.showAlert("Canın kalmadı! Canının dolması için biraz beklemen gerekiyor.");
        } else {
            alert("Canın kalmadı! Canının dolması için biraz beklemen gerekiyor.");
        }
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
    lastSceneryZ = -60;
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
// Performans için değişkenleri dışarıda tanımlıyoruz (Garbage Collection dostu)
const playerBox = new THREE.Box3();
const obstacleBox = new THREE.Box3();
const turtleBox = new THREE.Box3();

function checkCollisions() {
    if(!playerMesh) return;

    // Oyuncu kutusunu güncelle
    playerBox.setFromObject(playerMesh);
    playerBox.expandByScalar(-0.3); // Tolerans

    // ENGELLER İÇİN DÖNGÜ
    // Döngüyü tersten kuruyoruz ki silme işlemi sorun çıkarmasın
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        
        // 1. Hareket Ettir
        obstacle.position.z += state.speed;

        // 2. Çok uzaktaysa sil (Performans temizliği)
        if (obstacle.position.z > camera.position.z + 10) { 
            scene.remove(obstacle); 
            obstacles.splice(i, 1);
            continue; 
        }

        // 3. Scenery (Evler) için çarpışma hesaplama (BOŞUNA İŞLEMCİ YORMA)
        if (obstacle.name === "Scenery") continue;

        // 4. Mesafe Kontrolü (Sadece yakınsa detaylı çarpışma bak)
        // Eğer Z mesafesi 2 birimden azsa ve X şeridi aynıysa çarpışma var mı diye bak
        const zDiff = Math.abs(playerMesh.position.z - obstacle.position.z);
        const xDiff = Math.abs(playerMesh.position.x - obstacle.position.x);

        if (zDiff < 1.5 && xDiff < 0.8) {
            // Basit kutu kontrolü yerine direkt mesafeden vurduk sayabiliriz
            // Ama tip kontrolü için detaylara bakalım:
            
            if (obstacle.name === 'Wall') {
                 return endGame();
            }
            if (obstacle.name === 'Jump') {
                // Eğer karakter havada değilse (y < 0.5) çarptı
                if (playerMesh.position.y < 0.8) return endGame();
            }
            if (obstacle.name === 'Slide') {
                // Eğer karakter kaymıyorsa çarptı
                if (!state.isSliding) return endGame();
            }
        }
    }

    // TURTALAR İÇİN DÖNGÜ
    for (let i = turtles.length - 1; i >= 0; i--) {
        const turtle = turtles[i];
        turtle.position.z += state.speed;
        turtle.rotation.y += 0.05;

        // Basit Mesafe Kontrolü (Box3 yerine matematiksel mesafe daha hızlıdır)
        const distZ = Math.abs(playerMesh.position.z - turtle.position.z);
        const distX = Math.abs(playerMesh.position.x - turtle.position.x);

        // Eğer yeterince yakınsa topla (0.8 birim mesafe)
        if (distZ < 0.8 && distX < 0.8) {
            state.turtlesCollected++;

            if(soundEnabled){
            // KRİTİK DÜZELTME: Sesi durdur ve başa sar
            sfxPop.pause(); 
            sfxPop.currentTime = 0; 
            
            // Kısa bir gecikme olmadan (0ms) tekrar oynat
            sfxPop.play().catch(e => console.log("Ses çalma hatası:", e));
            }
            if (tg.HapticFeedback) safeHaptic('light');
            
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
    const targetX = state.lane * 1.5; 
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

    if (mixer && clock) {
        mixer.update(clock.getDelta());
    }

    // Oyun mantığı sadece her şey hazırsa çalışır
    state.score += 0.1 * deltaTime; 
    updateGameUI(); 
    
    state.nextObstacleTimer -= (0.01 * deltaTime);
    if (state.nextObstacleTimer <= 0) generateObstacle();
    
    state.nextTurtleTimer -= (0.015 * deltaTime);
    if (state.nextTurtleTimer <= 0) generateTurtle();
    
    checkCollisions();
    applyMovement(deltaTime);
    
    // Yol döngüsü
    roadParts.forEach(part => {
        part.position.z += state.speed;
        if(part.position.z > 20) part.position.z -= 100;
    });

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
        if(tg.HapticFeedback) safeHaptic('medium');
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