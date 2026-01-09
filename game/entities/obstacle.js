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
            // Cars
            const r = Math.random();
            if (r > 0.5) {
                meshName = 'car2';
                yOffset = 0.9; // car2 height
            } else {
                meshName = 'car1';
                yOffset = 1.2; // car1 height
            }
            scale = [0.015, 0.01, 0.008];
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

            // Car specific coloring
            if (type === OBSTACLE_TYPES.BLOCK) {
                // Pre-defined darker/muted colors
                const colors = [
                    0x8B0000, // Dark Red
                    0x006400, // Dark Green
                    0x00008B, // Dark Blue
                    0xB8860B, // Dark Goldenrod
                    0x4B0082, // Indigo
                    0x2F4F4F, // Dark Slate Gray
                    0x800000, // Maroon
                    0x191970  // Midnight Blue
                ];
                const cleanColor = colors[Math.floor(Math.random() * colors.length)];

                this.mesh.traverse((child) => {
                    if (child.isMesh) {
                        const name = child.name.toLowerCase();
                        // Skip parts that shouldn't be painted
                        if (name.includes('wheel') ||
                            name.includes('tire') ||
                            name.includes('window') ||
                            name.includes('glass') ||
                            name.includes('light') ||
                            name.includes('lamp') ||
                            name.includes('interior') ||
                            name.includes('bumper')) {
                            return;
                        }

                        try {
                            const shouldSkipMaterial = (m) => {
                                if (!m) return true;
                                // 1. Check Texture
                                if (m.map) return true; // Don't colorize textured parts

                                // 2. Check Material Name
                                const matName = m.name ? m.name.toLowerCase() : '';
                                if (matName.includes('window') ||
                                    matName.includes('glass') ||
                                    matName.includes('rim') ||
                                    matName.includes('tire') ||
                                    matName.includes('black') ||
                                    matName.includes('grill') ||
                                    matName.includes('light')) {
                                    return true;
                                }

                                // 3. Check Color (Darkness / Grayscale)
                                // Windows might be gray (0.5), Tires black (0.1)
                                const col = m.color;
                                if (col.r < 0.25 && col.g < 0.25 && col.b < 0.25) return true; // Keep dark parts

                                // Optional: Keep very light/white parts if they are lights? 
                                // But usually car body is white in assets to be tintable.

                                // If it's blue-ish (often windows), keep it?
                                if (col.b > col.r + 0.2 && col.b > col.g + 0.2) return true; // Simple blue detector for windows

                                return false;
                            };

                            // Check if material is array or single
                            if (Array.isArray(child.material)) {
                                child.material = child.material.map(m => {
                                    if (shouldSkipMaterial(m)) return m;
                                    const mc = m.clone();
                                    mc.color.setHex(cleanColor);
                                    return mc;
                                });
                            } else if (child.material) {
                                if (shouldSkipMaterial(child.material)) return;

                                child.material = child.material.clone();
                                child.material.color.setHex(cleanColor);
                            }
                        } catch (err) {
                            console.warn("Could not colorize car:", err);
                        }
                    }
                });
            }
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
