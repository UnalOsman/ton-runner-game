import { LANES } from '../config/constants.js';
import { GameState } from '../core/gameState.js';

export class Player {
    constructor(scene) {
        this.scene = scene;

        const geo = new THREE.BoxGeometry(1, 1.8, 1);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff66cc });
        this.mesh = new THREE.Mesh(geo, mat);

        this.mesh.position.set(0, 0.9, 2);
        this.mesh.castShadow = true;

        this.currentLane = 1; // orta
        this.targetX = LANES[this.currentLane];

        scene.add(this.mesh);
    }

    moveLeft() {
        if (this.currentLane > 0) {
            this.currentLane--;
            this.targetX = LANES[this.currentLane];
        }
    }

    moveRight() {
        if (this.currentLane < LANES.length - 1) {
            this.currentLane++;
            this.targetX = LANES[this.currentLane];
        }
    }

    update(deltaTime) {
        // Smooth lane change
        this.mesh.position.x +=
            (this.targetX - this.mesh.position.x) * 10 * deltaTime;
    }
}
