// src/slots/upgrade.js

import SlotsScene from '../scenes/SlotsScene.js';
import BonusGame from './BonusGame.js';

import { makeButton } from '../ui.js';
import { payWin, formatEuros } from '../state.js';
import { sfx } from '../sfx.js';
import { SYM } from './config.js';

const mediaUrl = name => `${import.meta.env.BASE_URL}sfx/${name}`;

const AMBIENT_VOLUME = 0.18;
const PRIZE_VOLUME = 0.65;
const CROSSFADE_SECONDS = 2;
const ADMIN_CODE = '280816';
const MAXIMUM_PRIZE_MULTIPLIER = 2500;

class MusicController {
  constructor() {
    this.ambient = [
      new Audio(mediaUrl('ambient.mp3')),
      new Audio(mediaUrl('ambient.mp3'))
    ];

    this.active = 0;
    this.fade = null;
    this.foreground = null;
    this.inResult = false;
    this.started = false;
    this.timer = null;
    this.destroyed = false;

    this.ambient.forEach(audio => {
      audio.preload = 'auto';
      audio.volume = 0;
      audio.muted = sfx.isMuted();

      audio.addEventListener('ended', () => {
        if (
          this.destroyed ||
          !this.started ||
          this.inResult ||
          audio !== this.ambient[this.active] ||
          this.fade
        ) {
          return;
        }

        audio.currentTime = 0;
        this.playSafely(audio);
      });
    });
  }

  playSafely(audio) {
    if (this.destroyed) return;

    const playback = audio.play();

    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => { });
    }
  }

  start() {
    if (this.destroyed) return;

    this.started = true;

    if (!this.timer) {
      this.timer = window.setInterval(() => this.update(), 50);
    }

    this.resumeAmbient();
  }

  resumeAmbient() {
    if (
      this.destroyed ||
      !this.started ||
      this.inResult ||
      sfx.isMuted()
    ) {
      return;
    }

    const audio = this.ambient[this.active];

    audio.muted = false;
    audio.volume = AMBIENT_VOLUME;

    this.playSafely(audio);
  }

  pauseAmbient() {
    this.fade = null;

    this.ambient.forEach((audio, index) => {
      audio.pause();

      if (index !== this.active) {
        audio.currentTime = 0;
        audio.volume = 0;
      }
    });
  }

  startCrossfade() {
    if (this.destroyed || this.inResult || this.fade) return;

    const outgoing = this.ambient[this.active];
    const incomingIndex = 1 - this.active;
    const incoming = this.ambient[incomingIndex];
    const remaining = outgoing.duration - outgoing.currentTime;

    if (!Number.isFinite(remaining) || remaining <= 0) return;

    incoming.pause();
    incoming.currentTime = 0;
    incoming.volume = 0;
    incoming.muted = sfx.isMuted();

    const fade = {
      from: this.active,
      to: incomingIndex,
      duration: Math.max(
        0.1,
        Math.min(CROSSFADE_SECONDS, remaining)
      ),
      startedAt: null
    };

    this.fade = fade;

    const playback = incoming.play();

    if (playback && typeof playback.then === 'function') {
      playback.then(() => {
        if (
          this.destroyed ||
          this.inResult ||
          this.fade !== fade
        ) {
          incoming.pause();
          return;
        }

        fade.startedAt = performance.now();
      }).catch(() => {
        if (this.fade === fade) {
          this.fade = null;
          outgoing.volume = AMBIENT_VOLUME;
        }
      });
    } else {
      fade.startedAt = performance.now();
    }
  }

  update() {
    if (this.destroyed) return;

    const muted = sfx.isMuted();

    this.ambient.forEach(audio => {
      audio.muted = muted;
    });

    if (this.foreground) {
      this.foreground.muted = muted;
    }

    if (!this.started || this.inResult) return;

    if (muted) {
      this.pauseAmbient();
      return;
    }

    if (this.fade) {
      if (this.fade.startedAt === null) return;

      const progress = Math.min(
        1,
        (performance.now() - this.fade.startedAt) /
        (this.fade.duration * 1000)
      );

      const outgoing = this.ambient[this.fade.from];
      const incoming = this.ambient[this.fade.to];

      outgoing.volume =
        AMBIENT_VOLUME * Math.cos(progress * Math.PI / 2);

      incoming.volume =
        AMBIENT_VOLUME * Math.sin(progress * Math.PI / 2);

      if (progress >= 1) {
        outgoing.pause();
        outgoing.currentTime = 0;
        outgoing.volume = 0;

        this.active = this.fade.to;
        this.fade = null;

        this.ambient[this.active].volume = AMBIENT_VOLUME;
      }

      return;
    }

    const audio = this.ambient[this.active];

    if (audio.paused) {
      this.resumeAmbient();
      return;
    }

    if (
      !Number.isFinite(audio.duration) ||
      audio.duration <= 0
    ) {
      return;
    }

    const fadeLength = Math.min(
      CROSSFADE_SECONDS,
      audio.duration / 3
    );

    if (audio.duration - audio.currentTime <= fadeLength) {
      this.startCrossfade();
    }
  }

  startResult(filename = 'jackpot.mp3') {
    if (this.destroyed) return;

    this.inResult = true;
    this.pauseAmbient();
    this.stopForeground();

    const audio = new Audio(mediaUrl(filename));

    audio.preload = 'auto';
    audio.volume = PRIZE_VOLUME;
    audio.muted = sfx.isMuted();
    audio.loop = true;

    this.foreground = audio;
    this.playSafely(audio);
  }

  startVideo() {
    if (this.destroyed) return;

    this.inResult = true;
    this.pauseAmbient();
    this.stopForeground();
  }

  stopForeground() {
    if (!this.foreground) return;

    this.foreground.pause();
    this.foreground.currentTime = 0;
    this.foreground = null;
  }

  endResult() {
    this.stopForeground();
    this.inResult = false;
    this.resumeAmbient();
  }

  destroy() {
    this.destroyed = true;
    this.started = false;
    this.inResult = false;
    this.fade = null;

    this.stopForeground();

    this.ambient.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });

    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }
}

function showResult(scene, {
  title = 'RESULTADO',
  text,
  music = 'jackpot.mp3',
  autoClose = 5000
}) {
  return new Promise(resolve => {
    const objects = [];
    const previousModalState = scene.modalOpen;

    let closed = false;
    let autoTimer = null;

    scene.modalOpen = true;

    const close = () => {
      if (closed) return;
      closed = true;

      if (autoTimer) {
        autoTimer.remove(false);
        autoTimer = null;
      }

      scene.events.off('shutdown', close);

      objects.forEach(object => {
        if (object.scene) object.destroy();
      });

      scene.modalOpen = previousModalState;
      scene.musicController?.endResult();

      resolve();
    };

    const background = scene.add.rectangle(
      480,
      310,
      960,
      540,
      0x000000,
      0.92
    ).setDepth(180);

    background.setInteractive();

    const panel = scene.add.rectangle(
      480,
      310,
      740,
      330,
      0x101820
    ).setDepth(181);

    panel.setStrokeStyle(4, 0xffd166);

    const heading = scene.add.text(480, 205, title, {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#ffd166',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 660 }
    }).setOrigin(0.5).setDepth(182);

    const result = scene.add.text(480, 300, text, {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#7CFC00',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 650 }
    }).setOrigin(0.5).setDepth(182);

    const button = makeButton(
      scene,
      480,
      420,
      260,
      48,
      'CONTINUAR',
      '#2a9d8f',
      close,
      22
    ).setDepth(182);

    objects.push(
      background,
      panel,
      heading,
      result,
      button
    );

    scene.events.once('shutdown', close);
    scene.musicController?.startResult(music);

    if (scene.autoMode) {
      autoTimer = scene.time.delayedCall(autoClose, close);
    }
  });
}

function showMaximumPrizeVideo(scene, amount) {
  return new Promise(resolve => {
    const previousModalState = scene.modalOpen;

    scene.modalOpen = true;

    const layer = document.createElement('div');

    Object.assign(layer.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0, 0, 0, 0.97)',
      zIndex: '9999',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '20px',
      padding: '20px',
      boxSizing: 'border-box'
    });

    const title = document.createElement('div');

    title.textContent =
      `¡PREMIO MÁXIMO! HAS GANADO ${formatEuros(amount)}`;

    Object.assign(title.style, {
      color: '#ffd166',
      fontFamily: 'Arial, sans-serif',
      fontSize: 'clamp(22px, 4vw, 48px)',
      fontWeight: 'bold',
      textAlign: 'center'
    });

    const video = document.createElement('video');

    video.src = mediaUrl('max.mp4');
    video.controls = true;
    video.playsInline = true;
    video.muted = sfx.isMuted();
    video.preload = 'auto';

    Object.assign(video.style, {
      maxWidth: '90vw',
      maxHeight: '65vh',
      borderRadius: '12px',
      background: '#000'
    });

    const message = document.createElement('div');

    Object.assign(message.style, {
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      textAlign: 'center'
    });

    const button = document.createElement('button');

    button.textContent = 'CONTINUAR';

    Object.assign(button.style, {
      padding: '14px 32px',
      background: '#2a9d8f',
      color: '#ffffff',
      border: 'none',
      borderRadius: '8px',
      fontSize: '22px',
      fontWeight: 'bold',
      cursor: 'pointer'
    });

    let finished = false;
    let muteTimer = null;

    const finish = () => {
      if (finished) return;
      finished = true;

      if (muteTimer) {
        window.clearInterval(muteTimer);
        muteTimer = null;
      }

      scene.events.off('shutdown', finish);

      video.onended = null;
      video.onerror = null;

      video.pause();
      video.removeAttribute('src');
      video.load();

      layer.remove();

      scene.modalOpen = previousModalState;
      scene.musicController?.endResult();

      resolve();
    };

    button.onclick = finish;
    video.onended = finish;

    video.onerror = () => {
      message.textContent =
        'No se pudo cargar public/sfx/max.mp4. Puedes pulsar CONTINUAR.';
    };

    layer.append(title, video, message, button);
    document.body.appendChild(layer);

    scene.musicController?.startVideo();
    scene.events.once('shutdown', finish);

    muteTimer = window.setInterval(() => {
      video.muted = sfx.isMuted();
    }, 100);

    const playback = video.play();

    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => {
        if (finished) return;

        message.textContent =
          'Pulsa reproducir en el vídeo para iniciarlo.';
      });
    }
  });
}

const p = SlotsScene.prototype;

/* ---------- Inicialización ---------- */

const originalCreate = p.create;

p.create = function () {
  originalCreate.call(this);

  this.musicController = new MusicController();
  this.debugEnabled = false;

  const unlockAudio = () => {
    this.musicController.start();
  };

  this.input.once('pointerdown', unlockAudio);
  this.input.keyboard?.once('keydown', unlockAudio);

  makeButton(
    this,
    890,
    565,
    100,
    26,
    'ADMIN',
    '#713c65',
    () => this.openDebug(),
    14
  ).setDepth(102);

  this.events.once('shutdown', () => {
    this.input.off('pointerdown', unlockAudio);
    this.input.keyboard?.off('keydown', unlockAudio);
    this.musicController.destroy();
  });
};

/* ---------- Resultado del bonus ---------- */

BonusGame.prototype.outro = async function () {
  await showResult(this.scene, {
    title: 'BONUS COMPLETADO',
    text:
      `HAS GANADO ${formatEuros(this.total)}\n` +
      `${this.spins} tiradas · multiplicador máximo ×${this.maxMult}`,
    music: 'jackpot.mp3'
  });
};

/* ---------- Resultado de la ruleta ---------- */

const originalRunWheel = p.runWheel;

p.runWheel = async function () {
  const previousFreeSpins = this.freeSpins;
  const previousCelebrate = this.celebrate;

  let cashPrize = null;

  this.celebrate = async (
    amount,
    prefix,
    forcedLevel = null
  ) => {
    cashPrize = {
      amount,
      prefix,
      forcedLevel
    };

    this.resultText.setText(
      `${prefix}${formatEuros(amount)}`
    );
  };

  try {
    await originalRunWheel.call(this);
  } finally {
    this.celebrate = previousCelebrate;
  }

  if (
    cashPrize &&
    cashPrize.amount / this.totalBet >= MAXIMUM_PRIZE_MULTIPLIER
  ) {
    await showMaximumPrizeVideo(this, cashPrize.amount);
    return;
  }

  let text;

  if (cashPrize) {
    text = `HAS GANADO ${formatEuros(cashPrize.amount)}`;
  } else if (this.freeSpins > previousFreeSpins) {
    text =
      `HAS GANADO\n` +
      `${this.freeSpins - previousFreeSpins} TIRADAS GRATIS`;
  } else {
    text =
      `HAS GANADO UN MULTIPLICADOR ×${this.wheelMult.value}\n` +
      `Para tus próximas ${this.wheelMult.left} tiradas`;
  }

  await showResult(this, {
    title: 'PREMIO DE LA RULETA',
    text,
    music: 'jackpot.mp3'
  });
};

/* ---------- Celebraciones del slot ---------- */

const originalCelebrate = p.celebrate;

p.celebrate = async function (
  amount,
  prefix,
  forcedLevel = null
) {
  const ratio = amount / this.totalBet;

  if (ratio >= MAXIMUM_PRIZE_MULTIPLIER) {
    this.resultText.setText(
      `${prefix}${formatEuros(amount)}`
    );

    await showMaximumPrizeVideo(this, amount);
    return;
  }

  if (forcedLevel === 3 || ratio >= 50) {
    this.resultText.setText(
      `${prefix}${formatEuros(amount)}`
    );

    await showResult(this, {
      title: 'SUPER PREMIO',
      text: `HAS GANADO ${formatEuros(amount)}`,
      music: 'jackpot.mp3'
    });

    return;
  }

  if (ratio >= 25) {
    this.resultText.setText(
      `${prefix}${formatEuros(amount)}`
    );

    await showResult(this, {
      title: 'GRAN PREMIO',
      text: `HAS GANADO ${formatEuros(amount)}`,
      music: '777.mp3'
    });

    return;
  }

  await originalCelebrate.call(
    this,
    amount,
    prefix,
    forcedLevel
  );
};

/* ---------- Cuadrículas de prueba ---------- */

const originalPrepare = p.prepareFinalGrid;

p.prepareFinalGrid = function () {
  if (this.debugGrid) {
    this.grid = this.debugGrid.map(row => [...row]);
    this.debugGrid = null;
    return;
  }

  originalPrepare.call(this);
};

/* ---------- Menú ADMIN ---------- */

p.openDebug = function () {
  if (this.busy || this.modalOpen) return;

  if (!this.debugEnabled) {
    const code = window.prompt(
      'ADMIN · Código de desarrollo'
    );

    if (code !== ADMIN_CODE) {
      if (code !== null) {
        window.alert('Código incorrecto');
      }

      return;
    }

    this.debugEnabled = true;
  }

  this.stopAutoSpin();
  this.modalOpen = true;

  const root = this.add.container(0, 0).setDepth(180);

  root.add(
    this.add.rectangle(
      480,
      310,
      960,
      620,
      0x000000,
      0.94
    ).setInteractive()
  );

  root.add(
    this.add.text(
      480,
      65,
      'DEBUG · PRUEBAS CON SALDO FICTICIO',
      {
        fontFamily: 'Arial',
        fontSize: '26px',
        color: '#ffd166'
      }
    ).setOrigin(0.5)
  );

  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;

    root.destroy(true);
    this.modalOpen = false;
  };

  const launch = async callback => {
    close();
    this.busy = true;

    try {
      await callback();
    } catch (error) {
      console.error(error);
      this.resultText.setText(
        'Error DEBUG: revisa la consola'
      );
    } finally {
      this.musicController?.endResult();
      this.busy = false;
      this.updateTexts();
    }
  };

  const normal = [
    [
      SYM.CHERRY,
      SYM.LEMON,
      SYM.ORANGE,
      SYM.GRAPES,
      SYM.MELON
    ],
    [
      SYM.LEMON,
      SYM.ORANGE,
      SYM.GRAPES,
      SYM.MELON,
      SYM.CHERRY
    ],
    [
      SYM.ORANGE,
      SYM.GRAPES,
      SYM.MELON,
      SYM.CHERRY,
      SYM.LEMON
    ]
  ];

  const force = (symbol, all = false) => {
    const grid = normal.map(row => [...row]);

    if (all) {
      grid.forEach(row => row.fill(symbol));
    } else {
      grid[1].fill(symbol);
    }

    this.debugGrid = grid;
    this.spin();
  };

  const actions = [
    [
      'RULETA',
      () => launch(() => this.runWheel())
    ],
    [
      'BONUS 8 TIRADAS',
      () => launch(() => this.runBonus(10))
    ],
    [
      'BONUS 12 TIRADAS',
      () => launch(() => this.runBonus(20))
    ],
    [
      'BONUS 20 TIRADAS',
      () => launch(() => this.runBonus(50))
    ],
    [
      '5 DIAMANTES',
      () => {
        close();
        force(SYM.DIAMOND);
      }
    ],
    [
      '5 CAMPANAS',
      () => {
        close();
        force(SYM.BELL);
      }
    ],
    [
      '5 JOKERS',
      () => {
        close();
        force(SYM.JOKER);
      }
    ],
    [
      '15 DIAMANTES',
      () => {
        close();
        force(SYM.DIAMOND, true);
      }
    ],
    [
      'PREMIO MÁXIMO + VÍDEO',
      () => launch(async () => {
        const amount = Math.round(
          MAXIMUM_PRIZE_MULTIPLIER * this.totalBet
        );

        payWin(amount);

        await this.celebrate(
          amount,
          'DEBUG MÁXIMO: ',
          3
        );
      })
    ],
    [
      'PREMIO · 777',
      () => launch(async () => {
        const amount = Math.round(
          25 * this.totalBet
        );

        payWin(amount);

        await this.celebrate(
          amount,
          'DEBUG 777: '
        );
      })
    ],
    [
      'PROBAR MÚSICA',
      () => launch(() => showResult(this, {
        title: 'PRUEBA DE SINCRONIZACIÓN',
        text: 'Resultado y música juntos',
        music: 'jackpot.mp3'
      }))
    ],
    [
      'CERRAR',
      close
    ]
  ];

  actions.forEach(([label, callback], index) => {
    const x = index % 2 ? 700 : 260;
    const y = 130 + Math.floor(index / 2) * 70;

    root.add(
      makeButton(
        this,
        x,
        y,
        400,
        48,
        label,
        '#465b78',
        callback,
        17
      )
    );
  });
};