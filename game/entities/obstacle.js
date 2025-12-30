export const OBSTACLE_TYPES = {
    JUMP: { name: 'jump', height: 1.5, allowCollectibleBelow: false },
    SLIDE: { name: 'slide', height: 2.5, allowCollectibleBelow: true },
    BLOCK: { name: 'block', height: 3.0, allowCollectibleBelow: false }
};

export class Obstacle {
    constructor(scene, type, x, z) {
        this.type = type;

        let geo;
        let y = 0.5;

        if (type === OBSTACLE_TYPES.BLOCK) {
            geo = new THREE.BoxGeometry(1.6, 1, 3);
            y = 0.5;
        }

        if (type === OBSTACLE_TYPES.JUMP) {
            geo = new THREE.BoxGeometry(1.2, 0.6, 1.2);
            y = 0.3;
        }

        if (type === OBSTACLE_TYPES.SLIDE) {
            geo = new THREE.BoxGeometry(1.4, 1.5, 0.4);
            y = 2.5;
        }

        const mat = new THREE.MeshStandardMaterial({ color: 0xaa3333 });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.set(x, y, z);
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
