import { OBSTACLE_TYPES } from '../entities/obstacle.js';

export function checkPlayerCollectibles(player, collectibles, scene, audio, onCollect) {
    const playerBox = new THREE.Box3().setFromObject(player.mesh);

    collectibles.forEach((item, index) => {
        if (item.collected) return;

        const itemBox = new THREE.Box3().setFromObject(item.mesh);

        if (playerBox.intersectsBox(itemBox)) {
            console.log('COLLISION!');
            item.collected = true;
            item.destroy(scene);
            audio.playPop();

            onCollect();
        }
    });
}

export function checkPlayerObstacles(player, obstacles, scene, onGameOver) {
    const playerBox = new THREE.Box3().setFromObject(player.mesh);

    obstacles.forEach((obs) => {
        const obsBox = new THREE.Box3().setFromObject(obs.mesh);

        if (!playerBox.intersectsBox(obsBox)) return;

        let survived = false;

        switch (obs.type) {
            case OBSTACLE_TYPES.CAR:
                // Car: aynı lane'deyse ölürsün
                survived = Math.abs(player.mesh.position.x - obs.mesh.position.x) > 0.5;
                break;

            case OBSTACLE_TYPES.LOG:
                // Log: zıplıyorsan yaşarsın
                survived = player.isJumping;
                break;

            case OBSTACLE_TYPES.BARRIER:
                // Barrier: kayıyorsan yaşarsın
                survived = player.isSliding;
                break;
        }

        obs.destroy(scene);

        if (!survived) {
            onGameOver(obs.type);
        }
    });
}

