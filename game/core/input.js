export function initInput(player) {
    // Keyboard Controls
    window.addEventListener('keydown', (e) => {
        if (e.code === 'ArrowLeft') player.moveLeft();
        if (e.code === 'ArrowRight') player.moveRight();
        if (e.code === 'ArrowUp') player.jump();
        if (e.code === 'ArrowDown') player.slide();
    });

    // Touch Controls (Swipe)
    let touchStartX = 0;
    let touchStartY = 0;

    window.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        // e.preventDefault(); // Optional: prevent scroll if game is full screen
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;

        handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY, player);
    }, { passive: false });
}

function handleSwipe(startX, startY, endX, endY, player) {
    const diffX = endX - startX;
    const diffY = endY - startY;

    // Threshold for swipe detection
    const minSwipeDistance = 30;

    if (Math.abs(diffX) > Math.abs(diffY)) {
        // Horizontal Swipe
        if (Math.abs(diffX) > minSwipeDistance) {
            if (diffX > 0) {
                player.moveRight();
            } else {
                player.moveLeft();
            }
        }
    } else {
        // Vertical Swipe
        if (Math.abs(diffY) > minSwipeDistance) {
            if (diffY > 0) {
                player.slide(); // Down
            } else {
                player.jump(); // Up
            }
        }
    }
}
