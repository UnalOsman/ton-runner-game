import { GameState } from '../core/gameState.js';
import {
    CITY_ROW_DISTANCE,
    CITY_SPAWN_Z,
    STRUCTURE_OFFSET_X
} from '../config/constants.js';
import { Collectible } from '../entities/collectible.js';
import { LANES } from '../config/constants.js';
import { Obstacle, OBSTACLE_TYPES } from '../entities/obstacle.js';


export class Spawner {
    constructor(scene, houseFactory, sceneryObjects, collectibles, obstacles) {
        this.scene = scene;
        this.houseFactory = houseFactory;
        this.sceneryObjects = sceneryObjects;
        this.collectibles = collectibles;
        this.obstacles = obstacles;

        this.nextCityZ = -CITY_ROW_DISTANCE;
        this.nextCollectibleZ= -15;
        this.nextObstacleZ= -25;
    }

    update(deltaTime) {
        this.obstacles = this.obstacles.filter(o => !o.isDestroyed);
        this.collectibles = this.collectibles.filter(c => !c.collected);

        this.nextCityZ += GameState.speed * deltaTime;
        this.nextCollectibleZ += GameState.speed * deltaTime;
        this.nextObstacleZ += GameState.speed * deltaTime;

        if (this.nextCityZ >= 0) {
            this.spawnCityRow(CITY_SPAWN_Z);
            this.nextCityZ = -CITY_ROW_DISTANCE;
        }

        if (this.nextCollectibleZ >= 0) {
            this.spawnCollectible(-20);
            this.nextCollectibleZ = -15;
        }

        if (this.nextObstacleZ >= 0) {
            this.spawnObstacle(-30);
            this.nextObstacleZ = -25;
        }

    }

    spawnCityRow(z) {
        console.log('CITY SPAWN');
        [-1, 1].forEach(side => {
            const house = this.houseFactory();

            house.position.set(
                side * STRUCTURE_OFFSET_X,
                0,
                z
            );

            this.scene.add(house);
            this.sceneryObjects.push(house);
        });
    }

    spawnCollectible(z) {
        const laneIndex = Math.floor(Math.random() * LANES.length);
        const x = LANES[laneIndex];

        const blocked = this.obstacles.some(o =>
            Math.abs(o.mesh.position.z - z) < 2 &&
            o.mesh.position.x === x
        );

        if (blocked) return;

        const c = new Collectible(this.scene, x, z);
        this.collectibles.push(c);
    }


    spawnObstacle(z) {
        const laneIndex = Math.floor(Math.random() * LANES.length);
        const x = LANES[laneIndex];

        const types = Object.values(OBSTACLE_TYPES);
        const type = types[Math.floor(Math.random() * types.length)];

        const o = new Obstacle(this.scene, type, x, z);
        this.obstacles.push(o);
    }

}
