export function initInput(player) {
    window.addEventListener('keydown', (e) => {
        if (e.code === 'ArrowLeft') {
            player.moveLeft();
        }
        if (e.code === 'ArrowRight') {
            player.moveRight();
        }
    });
}
