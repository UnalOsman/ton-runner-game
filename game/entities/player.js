import { LANES } from '../config/constants.js';

export class Player {
    constructor(scene, assetManager) {
        this.scene = scene;
        this.assetManager = assetManager;

        // Clone Model
        const asset = assetManager.clone('player');
        if (asset) {
            this.mesh = asset;
            const s = 0.005; // Slightly larger safe scale
            this.mesh.scale.set(s, s, s);
            this.mesh.rotation.y = Math.PI;

            // Re-enable original materials
            this.mesh.traverse(c => {
                if (c.isMesh) {
                    c.castShadow = true;
                    // c.frustumCulled = false; // Usually safe to keep false if bounding box issues persist, but try default first

                    // If the material is somehow missing map or basic, we trust the loader now.
                    // But we ensure it's double sided just in case.
                    if (c.material) {
                        c.material.side = THREE.DoubleSide;
                        // c.material.wireframe = false;
                    }
                }
            });

            // Recover animations if lost during clone
            if (!this.mesh.animations || this.mesh.animations.length === 0) {
                const originalAsset = assetManager.get('player');
                if (originalAsset && originalAsset.animations) {
                    this.mesh.animations = originalAsset.animations;
                }
            }

            console.log("Player Animations:", this.mesh.animations);

            // DEBUG: Visual Helper (Keep for now until verified)
            // const boxHelper = new THREE.BoxHelper(this.mesh, 0xffff00);
            // scene.add(boxHelper);

        } else {
            // Fallback
            console.warn("Player asset not found, using box");
            const geo = new THREE.BoxGeometry(1, 1.8, 1);
            const mat = new THREE.MeshStandardMaterial({ color: 0xff66cc });
            this.mesh = new THREE.Mesh(geo, mat);
        }

        this.mesh.position.set(0, 0, 2); // Reset to 0 to verify ground contact
        this.mesh.castShadow = true;

        this.currentLane = 1;
        this.targetX = LANES[this.currentLane];

        this.isJumping = false;
        this.isSliding = false;
        this.yVelocity = 0;

        // Animations
        this.mixer = new THREE.AnimationMixer(this.mesh);

        // Setup Actions
        // Default Run
        if (this.mesh.animations && this.mesh.animations.length > 0) {
            this.actions = {};
            this.actions.run = this.mixer.clipAction(this.mesh.animations[0]);
            this.actions.run.play();
        }

        // Jump & Roll from other assets
        const jumpClip = assetManager.clone('animJump');
        const rollClip = assetManager.clone('animRoll');

        if (jumpClip) {
            this.actions = this.actions || {};
            this.actions.jump = this.mixer.clipAction(jumpClip);
            this.actions.jump.loop = THREE.LoopOnce;
            this.actions.jump.clampWhenFinished = true;
        }

        if (rollClip) {
            this.actions = this.actions || {};
            this.actions.roll = this.mixer.clipAction(rollClip);
            this.actions.roll.loop = THREE.LoopOnce;
            this.actions.roll.clampWhenFinished = true;
        }

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
        if (this.mixer) this.mixer.update(deltaTime);

        // Movement
        this.mesh.position.x +=
            (this.targetX - this.mesh.position.x) * 10 * deltaTime;

        // Jump Physics
        if (this.isJumping) {
            this.mesh.position.y += this.yVelocity * deltaTime;
            this.yVelocity -= 25 * deltaTime; // Gravity

            if (this.mesh.position.y <= 0) {
                this.mesh.position.y = 0;
                this.isJumping = false;

                if (this.queuedSlide) {
                    this.queuedSlide = false;
                    // Stop Jump anim explicitly before sliding
                    if (this.actions.jump) this.actions.jump.stop();
                    this.slide();
                } else {
                    // Regular Landing
                    if (this.actions.run) {
                        this.actions.run.reset().play();
                        if (this.actions.jump) this.actions.jump.stop();
                    }
                }
            }
        }
    }

    jump() {
        if (this.isJumping) return;

        // Interrupt Slide if active
        if (this.isSliding) {
            this.isSliding = false;
            this.queuedSlide = false;
            if (this.slideTimer) clearTimeout(this.slideTimer);
            if (this.actions.roll) this.actions.roll.stop();
        }

        this.isJumping = true;
        this.yVelocity = 8;

        if (this.actions.jump) {
            if (this.actions.run) this.actions.run.stop();
            this.actions.jump.reset().play();
        }
    }

    slide() {
        if (this.isSliding) return;

        // Prevent sliding while in air, but Queue it and Fast Drop
        if (this.isJumping) {
            this.yVelocity = -100; // Fast drop mechanic
            this.queuedSlide = true;
            return;
        }

        this.isSliding = true;

        if (this.actions.roll) {
            if (this.actions.run) this.actions.run.stop();
            this.actions.roll.reset().play();
        }

        this.slideTimer = setTimeout(() => {
            if (this.isSliding) {
                this.isSliding = false;
                if (this.actions.run && !this.isJumping) {
                    if (this.actions.roll) this.actions.roll.stop();
                    this.actions.run.reset().play();
                }
            }
        }, 800);
    }

    isOnGround() {
        return !this.isJumping && this.mesh.position.y <= 0.1;
    }

    reset() {
        this.currentLane = 1;
        this.targetX = LANES[this.currentLane];

        this.mesh.position.set(0, 0, 2);
        this.mesh.rotation.y = Math.PI;

        this.isJumping = false;
        this.isSliding = false;
        this.yVelocity = 0;

        if (this.actions && this.actions.run) {
            this.actions.run.reset().play();
            if (this.actions.jump) this.actions.jump.stop();
            if (this.actions.roll) this.actions.roll.stop();
        }
    }
}
