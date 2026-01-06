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
    constructor(scene, houseFactory, sceneryObjects, collectibles, obstacles) {
        this.scene = scene;
        this.houseFactory = houseFactory;
        this.sceneryObjects = sceneryObjects;
        this.collectibles = collectibles;
        this.obstacles = obstacles;

        this.nextCityZ = -CITY_ROW_DISTANCE;
        this.nextObstacleZ = -20;
    }

    update(deltaTime) {
        //this.obstacles = this.obstacles.filter(o => !o.isDestroyed);
        //this.collectibles = this.collectibles.filter(c => !c.collected);

        // Fix cleanup to preserve array references (using splice instead of filter)
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

        this.nextCityZ += GameState.speed * deltaTime;
        this.nextObstacleZ += GameState.speed * deltaTime;

        if (this.nextCityZ >= 0) {
            this.spawnCityRow(CITY_SPAWN_Z);
            this.nextCityZ = -CITY_ROW_DISTANCE;
        }

        if (this.nextObstacleZ >= 0) {
            this.spawnObstacle(-30);
            this.nextObstacleZ = -25;
        }
    }

    spawnCityRow(z) {
        [-1, 1].forEach(side => {
            const house = this.houseFactory();
            house.position.set(side * STRUCTURE_OFFSET_X, 0, z);
            this.scene.add(house);
            this.sceneryObjects.push(house);
        });
    }

    spawnObstacle(z) {
        const lane = LANES[Math.floor(Math.random() * LANES.length)];
        const types = Object.values(OBSTACLE_TYPES);
        const type = types[Math.floor(Math.random() * types.length)];

        const obstacle = new Obstacle(this.scene, type, lane, z);
        this.obstacles.push(obstacle);

        // ✅ SADECE SLIDE ALTINDA
        if (type.allowCollectibleBelow) {
            this.spawnCollectibleChain(lane, z - 1.5);
        }
    }

    spawnCollectibleChain(laneX, startZ) {
        const count =
            COLLECTIBLE_PATTERN.MIN +
            Math.floor(Math.random() *
            (COLLECTIBLE_PATTERN.MAX - COLLECTIBLE_PATTERN.MIN + 1));

        for (let i = 0; i < count; i++) {
            const z = startZ - i * COLLECTIBLE_PATTERN.SPACING;
            const c = new Collectible(this.scene, laneX, z);
            this.collectibles.push(c);
        }
    }
}
