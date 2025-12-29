export class Collectible {
    constructor(scene, x, z) {
        const geo = new THREE.SphereGeometry(0.4, 16, 16);
        const mat = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
        this.mesh = new THREE.Mesh(geo, mat);

        this.mesh.position.set(x, 0.8, z);
        this.mesh.castShadow = true;

        this.collected = false;

        scene.add(this.mesh);
    }

    update(deltaTime, speed) {
        this.mesh.position.z += speed * deltaTime;
    }

    destroy(scene) {
        scene.remove(this.mesh);
    }
}
