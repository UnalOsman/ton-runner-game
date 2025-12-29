export class AudioSystem {
    constructor() {
        this.unlocked = false;
        this.pop = document.getElementById('sfx-pop');
    }

    unlock() {
        if (this.unlocked) return;

        this.pop.volume = 0.8;
        this.pop.play().then(() => {
            this.pop.pause();
            this.pop.currentTime = 0;
            this.unlocked = true;
            console.log('Audio unlocked');
        }).catch(() => {});
    }

    playPop() {
        if (!this.unlocked) return;

        this.pop.currentTime = 0;
        this.pop.play().catch(() => {});
    }
}
