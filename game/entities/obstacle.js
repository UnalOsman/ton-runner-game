export const OBSTACLE_TYPES = {
    JUMP: { name: 'jump', height: 1.5, allowCollectibleBelow: false },
    SLIDE: { name: 'slide', height: 2.5, allowCollectibleBelow: true },
    BLOCK: { name: 'block', height: 3.0, allowCollectibleBelow: false }
};

export class Obstacle {
    constructor(scene, type, x, z, assetManager) {
        this.type = type; // Keep type for collision logic

        let meshName = 'car1'; // default
        let scale = [0.015, 0.01, 0.008];
        let yOffset = 0;
        let rotY = Math.PI / 2;

        if (type === OBSTACLE_TYPES.BLOCK) {
            // Cars
            const r = Math.random();
            meshName = r > 0.5 ? 'car2' : 'car1';
            scale = [0.015, 0.01, 0.008];
            yOffset = 1.2;
        }
        else if (type === OBSTACLE_TYPES.JUMP) {
            // Log
            meshName = 'log';
            scale = [0.008, 0.02, 0.01];
            yOffset = 0.2;
        }
        else if (type === OBSTACLE_TYPES.SLIDE) {
            // Barrier
            meshName = 'barrier';
            scale = [0.012, 0.012, 0.012];
            yOffset = 1;
        }

        const asset = assetManager.clone(meshName);
        if (asset) {
            this.mesh = asset;
            this.mesh.scale.set(scale[0], scale[1], scale[2]);
            this.mesh.rotation.y = rotY;
            this.mesh.position.set(x, yOffset, z);
        } else {
            // Fallback
            const geo = new THREE.BoxGeometry(1, 1, 1);
            const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
            this.mesh = new THREE.Mesh(geo, mat);
            this.mesh.position.set(x, 1, z);
        }

        this.mesh.castShadow = true;
        scene.add(this.mesh);
    }

    update(deltaTime, speed) {
        this.mesh.position.z += speed * deltaTime;
    }

    destroy(scene) {
        scene.remove(this.mesh);
        this.isDestroyed = true;
    }
}
