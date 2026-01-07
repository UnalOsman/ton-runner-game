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

        this.nextCityZ = -CITY_ROW_DISTANCE;
        this.nextObstacleZ = -20;
        this.nextCollectibleZ = -15;
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

        const moveAmount = GameState.speed * deltaTime;
        this.nextCityZ += moveAmount;
        this.nextObstacleZ += moveAmount;
        this.nextCollectibleZ += moveAmount;

        // City spawning is now handled in main.js synced with road segments
        /*
        if (this.nextCityZ >= 0) {
            this.spawnCityRow(CITY_SPAWN_Z);
            this.nextCityZ = -CITY_ROW_DISTANCE;
        }
        */

        if (this.nextObstacleZ >= 0) {
            this.spawnObstacle(-30);
            this.nextObstacleZ = -25;
        }

        if (this.nextCollectibleZ >= 0) {
            this.trySpawnCollectibles(-30);
            this.nextCollectibleZ = -(15 + Math.random() * 20);
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

        [-1, 1].forEach(side => {
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

    spawnObstacle(z) {
        const shuffledLanes = [...LANES].sort(() => 0.5 - Math.random());
        let selectedLane = null;

        for (let lane of shuffledLanes) {
            if (!this.isLaneBlockedByCollectibles(lane, z)) {
                selectedLane = lane;
                break;
            }
        }

        if (selectedLane === null) return;

        const types = Object.values(OBSTACLE_TYPES);
        const type = types[Math.floor(Math.random() * types.length)];

        const obstacle = new Obstacle(this.scene, type, selectedLane, z, this.assetManager);
        this.obstacles.push(obstacle);
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
