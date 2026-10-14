let ctx = null;
let muted = localStorage.getItem('casino-games-muted') === '1';

function getCtx() {
    if (!ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        ctx = new AudioCtx();
    }

    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

function tone(freq, duration = 0.12, type = 'sine', volume = 0.07, delay = 0, slideTo = null) {
    if (muted) return;

    const c = getCtx();
    if (!c) return;

    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    }

    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain);
    gain.connect(c.destination);

    osc.start(t);
    osc.stop(t + duration + 0.02);
}

export const sfx = {
    isMuted: () => muted,

    toggleMute() {
        muted = !muted;
        localStorage.setItem('casino-games-muted', muted ? '1' : '0');
        return muted;
    },

    spin() {
        tone(300, 0.25, 'sawtooth', 0.03, 0, 120);
    },

    tick() {
        tone(900, 0.03, 'square', 0.03);
    },

    stop() {
        tone(160, 0.14, 'triangle', 0.1, 0, 70);
    },

    coin() {
        tone(988, 0.08, 'square', 0.05);
        tone(1319, 0.14, 'square', 0.05, 0.07);
    },

    win(level = 1) {
        const notes = [523, 659, 784, 1047];
        const count = Math.min(2 + level, notes.length);

        for (let i = 0; i < count; i++) {
            tone(notes[i], 0.16, 'triangle', 0.08, i * 0.09);
        }
    },

    bigWin() {
        [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => {
            tone(f, 0.22, 'triangle', 0.09, i * 0.11);
        });
    },

    bonus() {
        [392, 523, 659, 784, 1047].forEach((f, i) => {
            tone(f, 0.25, 'square', 0.05, i * 0.13);
        });
    },

    click() {
        tone(500, 0.05, 'square', 0.04);
    }
};