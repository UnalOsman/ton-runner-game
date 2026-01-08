import { GameState } from './core/gameState.js';
import { startGameLoop } from './core/gameLoop.js';

import { Spawner } from './systems/spawner.js';
import { Player } from './entities/player.js';
import { initInput } from './core/input.js';

import { AudioSystem } from './systems/audioSystem.js';
import { checkPlayerCollectibles } from './systems/collisionSystem.js';

import { checkPlayerObstacles } from './systems/collisionSystem.js';
import { AssetManager } from './managers/assetManager.js';

import { SkySystem } from './systems/skySystem.js';

const obstacles = [];
const collectibles = [];
const audioSystem = new AudioSystem();
const assetManager = new AssetManager();

window.unlockAudio = () => {
    audioSystem.unlock();
};

// SCENE
const scene = new THREE.Scene();
// scene.background = new THREE.Color(0x87CEEB); // REMOVED FOR SKY
// scene.fog = new THREE.Fog(0xFFFFFF, 20, 150); // REMOVED AS REQUESTED (White horizon)

// CAMERA
const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    50000 // Increased Far clip for Sky
);
camera.position.set(0, 3, 7);
camera.lookAt(0, 1, -20); // Look ahead

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.65; // Slightly toned down

document.getElementById('game-container').appendChild(renderer.domElement);

// LIGHT
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.7); // Balanced
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0); // Brighter sun
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 100;
scene.add(dirLight);

// SKY SYSTEM
const skySystem = new SkySystem(scene, dirLight);

// SCENERY STORAGE
const sceneryObjects = [];

// GLOBAL VARIABLES
let spawner;
let player;
let roadParts = [];

// WAITING FOR ASSETS
// WAITING FOR ASSETS
// VISUAL LOADING STATE
let realProgress = 0;
let visualProgress = 0;
let isGameInitialized = false;

// WAITING FOR ASSETS
assetManager.loadAll(
    // ON LOAD COMPLETE (Assets are technically downloaded)
    () => {
        realProgress = 100;
        console.log("Downloads complete. waiting for visual sync...");
    },
    // ON PROGRESS (Downloads happening)
    (itemsLoaded, itemsTotal) => {
        realProgress = Math.floor((itemsLoaded / itemsTotal) * 100);
    }
);

// SMOOTH LOADING LOOP
const loadingInterval = setInterval(() => {
    // 1. Visually catch up to real progress, but slowly
    if (visualProgress < realProgress) {
        visualProgress += 1; // Controls speed (approx 60fps * 1 = 60% per sec, let's slow it down)
    }

    // Limits
    if (visualProgress > 100) visualProgress = 100;

    // 2. Update UI
    const bar = document.getElementById('loading-bar');
    const txt = document.getElementById('loading-text');

    if (bar) bar.style.width = visualProgress + '%';
    if (txt) txt.innerText = `Yükleniyor... %${visualProgress}`;

    // 3. Check for completion
    if (visualProgress >= 100) {
        clearInterval(loadingInterval);

        // HEAVY TASK: Initialize Game while screen is covered
        if (txt) txt.innerText = "Oyun Hazırlanıyor...";

        // Timeout to let the UI update 'Oyun Hazırlanıyor...' before freeze happens
        setTimeout(() => {
            initGame(); // <--- CAUSES FREEZE
            isGameInitialized = true;

            // Artificial delay to show 'Ready' state
            setTimeout(() => {
                // Yükleme ekranı güncellemeleri
                const loadingContainer = document.getElementById('loading-container');
                const tapToStart = document.getElementById('tap-to-start');

                if (loadingContainer) loadingContainer.style.display = 'none';
                if (tapToStart) tapToStart.classList.remove('hidden');
            }, 1000); // 1 extra second delay
        }, 100);
    }

}, 30); // 30ms interval ~ 33fps update for bar

// Splash ekranına tıklama listener'ı
const splash = document.getElementById('splash-screen');
splash.addEventListener('click', () => {
    // Sadece oyun initialize edildiyse ve görsel yükleme bittiyse tıkla
    if (!isGameInitialized) return;

    splash.style.transition = 'opacity 0.5s';
    splash.style.opacity = '0';
    setTimeout(() => splash.style.display = 'none', 500);

    // Audio Unlock
    audioSystem.unlock();

    // Game Loop is already running? Check startGameLoop call in initGame.
    // Actually initGame starts the loop. But we might want to ensure 'isPlaying' is managed or just scene rendering.
    // The current initGame starts the loop immediately but GameState.isPlaying is false, so it just renders background.
}, { once: true });

function initGame() {
    // SPAWNER
    spawner = new Spawner(
        scene,
        assetManager,
        sceneryObjects,
        collectibles,
        obstacles
    );

    // PLAYER
    player = new Player(scene, assetManager);
    initInput(player);

    // GROUND (Rolling Road)
    // Create initial road segments
    for (let i = -1; i < 8; i++) { // Start from -1 to cover behind player
        const road = assetManager.clone('road');
        if (road) {
            road.scale.set(0.01, 0.01, 0.01);
            road.position.z = -i * 20;
            road.rotation.y = -Math.PI / 2;
            scene.add(road);
            roadParts.push(road);

            // Spawn for every segment
            spawner.spawnCityBlock(-i * 20);

            // Spawn obstacles (Skip first two segments for safety)
            if (i > 1) {
                spawner.spawnWorldSegment(-i * 20);
            }
        }
    }

    // GAME LOOP START
    startGameLoop({
        renderer,
        scene,
        camera,
        update(deltaTime) {

            if (roadParts.length > 0) {
                roadParts.forEach(part => {
                    part.position.z += GameState.speed * deltaTime;
                    if (part.position.z > 25) { // Increased limit
                        part.position.z -= 180; // Adjusted for 9 segments (9 * 20)
                        spawner.spawnCityBlock(part.position.z);
                        spawner.spawnWorldSegment(part.position.z);
                    }
                });
            }

            spawner.update(deltaTime);

            // SCENERY CLEANUP
            for (let i = sceneryObjects.length - 1; i >= 0; i--) {
                const obj = sceneryObjects[i];
                obj.position.z += GameState.speed * deltaTime;
                if (obj.position.z > 25) { // Increased limit
                    scene.remove(obj);
                    sceneryObjects.splice(i, 1);
                }
            }

            // COLLECTIBLES UPDATE & CLEANUP
            for (let i = collectibles.length - 1; i >= 0; i--) {
                const c = collectibles[i];
                c.update(deltaTime, GameState.speed);
                if (c.mesh.position.z > 25) { // Increased limit
                    scene.remove(c.mesh);
                    collectibles.splice(i, 1);
                }
            }

            // OBSTACLES UPDATE & CLEANUP
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const o = obstacles[i];
                o.update(deltaTime, GameState.speed);
                if (o.mesh.position.z > 25) { // Increased limit
                    // Manually destroy mesh if not already done
                    scene.remove(o.mesh);
                    obstacles.splice(i, 1);
                }
            }

            checkPlayerObstacles(player, obstacles, scene, (type) => {
                console.log('GAME OVER - HIT:', type);

                GameState.isPlaying = false;

                const gameOverScreen = document.getElementById('game-over-screen');
                if (gameOverScreen) {
                    gameOverScreen.classList.remove('hidden');
                    document.getElementById('final-score').innerText = Math.floor(GameState.score);
                    document.getElementById('final-turtles').innerText = GameState.turtlesCollected;

                    const btnRestart = document.getElementById('btn-restart');
                    if (btnRestart) {
                        btnRestart.onclick = () => {
                            if (window.resetGame) window.resetGame();
                            GameState.isPlaying = true;
                            gameOverScreen.classList.add('hidden');

                            obstacles.forEach(o => scene.remove(o.mesh));
                            obstacles.length = 0;
                            collectibles.forEach(c => scene.remove(c.mesh));
                            collectibles.length = 0;
                            sceneryObjects.forEach(s => scene.remove(s));
                            sceneryObjects.length = 0;

                            // CLEANUP OLD ROAD
                            roadParts.forEach(r => scene.remove(r));
                            roadParts.length = 0;

                            // Create initial road segments
                            for (let i = -1; i < 8; i++) { // Start from -1
                                const road = assetManager.clone('road');
                                if (road) {
                                    road.scale.set(0.01, 0.01, 0.01);
                                    road.position.z = -i * 20;
                                    road.rotation.y = -Math.PI / 2;
                                    scene.add(road);
                                    roadParts.push(road);

                                    spawner.spawnCityBlock(-i * 20);

                                    if (i > 1) {
                                        spawner.spawnWorldSegment(-i * 20);
                                    }
                                }
                            }
                        };
                    }
                }
            });

            checkPlayerCollectibles(
                player,
                collectibles,
                scene,
                audioSystem,
                () => {
                    GameState.turtlesCollected += 1;
                    const turtleCounter = document.getElementById('in-game-turtles');
                    if (turtleCounter) turtleCounter.innerText = GameState.turtlesCollected;
                }
            );

            player.update(deltaTime);

            GameState.score += 5 * deltaTime;
            const scoreUi = document.getElementById('in-game-score');
            if (scoreUi) scoreUi.innerText = Math.floor(GameState.score).toString().padStart(5, '0');
        }
    });
}

window.unlockAudio = () => audioSystem.unlock();

window.resetGame = () => {
    GameState.reset();
    const turtleCounter = document.getElementById('in-game-turtles');
    const scoreCounter = document.getElementById('in-game-score');
    if (turtleCounter) turtleCounter.innerText = '0';
    if (scoreCounter) scoreCounter.innerText = '00000';

    if (player && player.reset) player.reset();
};
