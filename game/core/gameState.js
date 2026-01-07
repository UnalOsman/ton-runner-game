export const GameState = {
    isPlaying: false,
    isPaused: false,

    speed: 20,
    score: 0,
    turtlesCollected: 0,
    lane: 0,

    reset() {
        this.score = 0;
        this.turtlesCollected = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.lane = 0;
        this.speed = 20;
    }
};
