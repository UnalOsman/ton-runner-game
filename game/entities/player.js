import { LANES } from '../config/constants.js';

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

        this.isJumping = false;
        this.isSliding = false;
        this.yVelocity = 0;

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

            if (this.isJumping) {
                this.mesh.position.y += this.yVelocity * deltaTime;
                this.yVelocity -= 18 * deltaTime;

                if (this.mesh.position.y <= 0.9) {
                    this.mesh.position.y = 0.9;
                    this.isJumping = false;
                }
            }
    }

    jump() {
        if (this.isJumping) return;
        this.isJumping = true;
        this.yVelocity = 6;
    }

    slide() {
        if (this.isSliding) return;
        this.isSliding = true;
        this.mesh.scale.y = 0.6;

        setTimeout(() => {
            this.mesh.scale.y = 1;
            this.isSliding = false;
        }, 500);
    }

    isOnGround() {
        return !this.isJumping && this.mesh.position.y <= 0.91;
    }


}
