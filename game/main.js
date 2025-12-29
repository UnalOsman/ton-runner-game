import { GameState } from './core/gameState.js';
import { startGameLoop } from './core/gameLoop.js';

import { Spawner } from './systems/spawner.js';
import { createHouse } from './entities/house.js';

import { Player } from './entities/player.js';
import { initInput } from './core/input.js';

import { AudioSystem } from './systems/audioSystem.js';
import { checkPlayerCollectibles } from './systems/collisionSystem.js';

const collectibles = [];
const audioSystem = new AudioSystem();

window.unlockAudio = () => {
    audioSystem.unlock();
};

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

// CAMERA
const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);
camera.position.set(0, 3, 7);

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

// LIGHT
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 20, 10);
scene.add(light);

// SCENERY STORAGE
const sceneryObjects = [];

// SPAWNER
const spawner = new Spawner(
    scene,
    createHouse,
    sceneryObjects,
    collectibles
);

// PLAYER
const player = new Player(scene);
initInput(player);


// GROUND (DEBUG)
const groundGeo = new THREE.PlaneGeometry(50, 200);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x55aa55 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.z = -50;
scene.add(ground);


// GAME START
//GameState.isPlaying = true;

// LOOP
startGameLoop({
    renderer,
    scene,
    camera,
    update(deltaTime) {
        spawner.update(deltaTime);

        sceneryObjects.forEach(obj => {
            obj.position.z += GameState.speed * deltaTime;
        });

        collectibles.forEach(c => {
            c.update(deltaTime, GameState.speed);
        });

        checkPlayerCollectibles(
            player,
            collectibles,
            scene,
            audioSystem,
            () => {
                GameState.score += 1;
                console.log('TURTA TOPLANDI:', GameState.score);
            }
        );

        player.update(deltaTime);
}

});

window.unlockAudio = () => audioSystem.unlock();

