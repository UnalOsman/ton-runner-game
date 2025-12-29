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
