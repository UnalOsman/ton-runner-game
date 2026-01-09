export class Collectible {
    constructor(scene, x, z, assetManager) {
        const asset = assetManager.clone('turtle');

        if (asset) {
            this.mesh = asset;
            const s = 0.005;
            this.mesh.scale.set(s, s, s);
            this.mesh.position.set(x, 0.1, z);
        } else {
            const geo = new THREE.SphereGeometry(0.4, 16, 16);
            const mat = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
            this.mesh = new THREE.Mesh(geo, mat);
            this.mesh.position.set(x, 0.8, z);
        }

        this.mesh.castShadow = true;
        this.collected = false;

        scene.add(this.mesh);
    }

    update(deltaTime, speed) {
        this.mesh.position.z += speed * deltaTime;
        this.mesh.rotation.y += 2 * deltaTime; // Spin effect
    }

    destroy(scene) {
        scene.remove(this.mesh);
    }
}
