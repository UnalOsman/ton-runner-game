export function initInput(player) {
    window.addEventListener('keydown', (e) => {
        if (e.code === 'ArrowLeft') player.moveLeft();
        if (e.code === 'ArrowRight') player.moveRight();
        if (e.code === 'ArrowUp') player.jump();
        if (e.code === 'ArrowDown') player.slide();
    });
}
