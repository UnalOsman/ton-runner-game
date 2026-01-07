export class AudioSystem {
    constructor() {
        this.unlocked = false;

        // 10'lu Round-Robin Havuzu
        this.strSrc = 'pop.mp3';
        this.poolSize = 10;
        this.pool = [];
        this.poolIdx = 0;

        for (let i = 0; i < this.poolSize; i++) {
            const audio = new Audio(this.strSrc);
            audio.volume = 0.6;
            this.pool.push(audio);
        }
    }

    unlock() {
        if (this.unlocked) return;

        // Mobil için tüm havuzu uyandır
        this.pool.forEach(audio => {
            audio.play().then(() => {
                audio.pause();
                audio.currentTime = 0;
            }).catch(() => { });
        });

        this.unlocked = true;
        console.log('Audio pool unlocked');
    }

    playPop() {
        if (!this.unlocked) return;

        const sound = this.pool[this.poolIdx];

        // Restart/Play
        sound.currentTime = 0;
        sound.play().catch(() => { });

        // İndeksi ilerlet
        this.poolIdx = (this.poolIdx + 1) % this.poolSize;
    }
}
