import { GameState } from './gameState.js';

export function startGameLoop({ renderer, scene, camera, update }) {
    let lastTime = performance.now();

    function loop(time) {
        requestAnimationFrame(loop);

        const deltaTime = (time - lastTime) / 1000;
        lastTime = time;

        if (GameState.isPlaying && !GameState.isPaused) {
            update(deltaTime);
        }

        renderer.render(scene, camera);
    }

    requestAnimationFrame(loop);
}
