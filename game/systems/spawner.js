import { GameState } from '../core/gameState.js';
import {
    CITY_ROW_DISTANCE,
    CITY_SPAWN_Z,
    STRUCTURE_OFFSET_X
} from '../config/constants.js';
import { Collectible } from '../entities/collectible.js';
import { LANES } from '../config/constants.js';

export class Spawner {
    constructor(scene, houseFactory, sceneryObjects, collectibles) {
        this.scene = scene;
        this.houseFactory = houseFactory;
        this.sceneryObjects = sceneryObjects;
        this.collectibles = collectibles;

        this.nextCityZ = -CITY_ROW_DISTANCE;
        this.nextCollectibleZ= -15;
    }

    update(deltaTime) {
        this.nextCityZ += GameState.speed * deltaTime;
        this.nextCollectibleZ += GameState.speed * deltaTime;

        if (this.nextCityZ >= 0) {
            this.spawnCityRow(CITY_SPAWN_Z);
            this.nextCityZ = -CITY_ROW_DISTANCE;
        }

        if (this.nextCollectibleZ >= 0) {
            this.spawnCollectible(-20);
            this.nextCollectibleZ = -15;
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

    const c = new Collectible(this.scene, x, z);
    this.collectibles.push(c);
}

}
