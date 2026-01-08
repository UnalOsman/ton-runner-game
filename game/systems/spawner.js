import { GameState } from '../core/gameState.js';
import {
    CITY_ROW_DISTANCE,
    CITY_SPAWN_Z,
    STRUCTURE_OFFSET_X,
    LANES,
    COLLECTIBLE_PATTERN
} from '../config/constants.js';

import { Collectible } from '../entities/collectible.js';
import { Obstacle, OBSTACLE_TYPES } from '../entities/obstacle.js';

export class Spawner {
    constructor(scene, assetManager, sceneryObjects, collectibles, obstacles) {
        this.scene = scene;
        this.assetManager = assetManager;
        this.sceneryObjects = sceneryObjects;
        this.collectibles = collectibles;
        this.obstacles = obstacles;
    }

    update(deltaTime) {
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            if (this.obstacles[i].isDestroyed) {
                this.obstacles.splice(i, 1);
            }
        }

        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            if (this.collectibles[i].collected) {
                this.collectibles.splice(i, 1);
            }
        }
    }

    spawnWorldSegment(z) {
        // Road segment is 20 units long. Center is roughly z + 10 (since z is start).
        // Let's spawn obstacles roughly in the middle or distribute them.

        // Chance to spawn obstacle
        if (Math.random() > 0.15) { // Increased frequency (was 0.3)
            // Spawn at random offset within the segment
            const offset = 5 + Math.random() * 10;

            // 40% chance of double obstacle (Harder)
            const spawnCount = Math.random() > 0.6 ? 2 : 1;

            this.spawnObstacle(z + offset, spawnCount);
        }

        // Chance to spawn collectibles
        if (Math.random() > 0.4) {
            const offset = 2 + Math.random() * 15;
            this.trySpawnCollectibles(z + offset);
        }
    }

    spawnCityBlock(z) {
        // Road segment is 20 units. Spawn two rows to fill it (gaps reported).
        this.spawnCityRow(z);
        this.spawnCityRow(z + 10);
    }

    spawnCityRow(z) {
        const buildings = [
            'blupHouse1', 'blupHouse2', 'blupHouse3',
            'blupHouse4', 'blupHouse5', 'blupHouse6',
            'blupotopark'
        ];

        // Shared Geometry/Material for ground (Created once effectively or cheap enough)
        // ideally these should be cached in constructor but for now local is fine or we stick to simple mesh
        if (!this.groundGeo) this.groundGeo = new THREE.PlaneGeometry(50, 10);
        if (!this.groundMat) this.groundMat = new THREE.MeshStandardMaterial({
            color: 0x2a3a2a, // Dark green/grey
            roughness: 1,
            metalness: 0
        });

        [-1, 1].forEach(side => {
            // 1. SPAWN GROUND
            const ground = new THREE.Mesh(this.groundGeo, this.groundMat);
            ground.rotation.x = -Math.PI / 2;
            // Position: side * 28 (Center of 50 width) -> Edge at 3. That meets road at ~2.5.
            ground.position.set(side * 28, 0, z);
            ground.receiveShadow = true;

            this.scene.add(ground);
            this.sceneryObjects.push(ground);

            // 2. SPAWN BUILDING
            const name = buildings[Math.floor(Math.random() * buildings.length)];
            const building = this.assetManager.clone(name);

            if (building) {
                building.scale.set(0.01, 0.01, 0.01);
                building.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
                building.position.set(side * STRUCTURE_OFFSET_X, 1.5, z); // Lifted up

                this.scene.add(building);
                this.sceneryObjects.push(building);
            }
        });
    }

    spawnObstacle(z, spawnCount = 1) {
        const shuffledLanes = [...LANES].sort(() => 0.5 - Math.random());
        let spawned = 0;

        for (let lane of shuffledLanes) {
            if (spawned >= spawnCount) break;

            if (!this.isLaneBlockedByCollectibles(lane, z)) {
                const types = Object.values(OBSTACLE_TYPES);
                const type = types[Math.floor(Math.random() * types.length)];

                const obstacle = new Obstacle(this.scene, type, lane, z, this.assetManager);
                this.obstacles.push(obstacle);
                spawned++;
            }
        }
    }

    isLaneBlockedByCollectibles(laneX, z) {
        const safety = 2.5;
        const obsMin = z - safety;
        const obsMax = z + safety;

        for (const c of this.collectibles) {
            if (Math.abs(c.mesh.position.x - laneX) < 0.5) {
                const cZ = c.mesh.position.z;
                const cMin = cZ - 0.5;
                const cMax = cZ + 0.5;

                if (cMin <= obsMax && cMax >= obsMin) {
                    return true;
                }
            }
        }
        return false;
    }

    trySpawnCollectibles(z) {
        const lane = LANES[Math.floor(Math.random() * LANES.length)];
        const count = COLLECTIBLE_PATTERN.MIN +
            Math.floor(Math.random() * (COLLECTIBLE_PATTERN.MAX - COLLECTIBLE_PATTERN.MIN + 1));

        const startZ = z;
        const endZ = z - (count * COLLECTIBLE_PATTERN.SPACING);

        if (this.isLaneSafe(lane, startZ, endZ)) {
            this.spawnCollectibleChain(lane, startZ, count);
        }
    }

    isLaneSafe(laneX, startZ, endZ) {
        for (const obs of this.obstacles) {
            if (Math.abs(obs.mesh.position.x - laneX) < 0.5) {
                const obsZ = obs.mesh.position.z;
                const safetyMargin = 2.0;
                const obsMin = obsZ - safetyMargin;
                const obsMax = obsZ + safetyMargin;

                if (endZ <= obsMax && startZ >= obsMin) {
                    if (obs.type && obs.type.allowCollectibleBelow) {
                        continue;
                    }
                    return false;
                }
            }
        }
        return true;
    }

    spawnCollectibleChain(laneX, startZ, count) {
        for (let i = 0; i < count; i++) {
            const z = startZ - i * COLLECTIBLE_PATTERN.SPACING;
            const c = new Collectible(this.scene, laneX, z, this.assetManager);
            this.collectibles.push(c);
        }
    }
}
