import HorseRaceScene from './scenes/HorseRaceScene.js';

const p = HorseRaceScene.prototype;
const url = name => `${import.meta.env.BASE_URL}sfx/${name}`;
const AMBIENT_VOLUME = 0.10;

const originalCreate = p.create;
p.create = function () {
  originalCreate.call(this);
  this.audioAlive = true;
  this.startSequenceId = 0;
  this.sequenceCleanup = null;
  this.ambientUnlocked = false;
  this.horseAmbient = new Audio(url('horse_amb.mp3'));
  this.horseAmbient.preload = 'auto';
  this.horseAmbient.loop = true;
  this.horseAmbient.volume = AMBIENT_VOLUME;
  this.horseAmbient.muted = this.muted;

  const unlock = () => {
    this.ambientUnlocked = true;
    this.resumeHorseAmbient();
  };
  this.input.on('pointerdown', unlock);
  this.input.keyboard?.on('keydown', unlock);

  this.horseAmbient.addEventListener('error', () => {
    console.warn('No se pudo cargar public/sfx/horse_amb.mp3');
  });

  this.events.once('shutdown', () => {
    this.audioAlive = false;
    this.input.off('pointerdown', unlock);
    this.input.keyboard?.off('keydown', unlock);
    this.stopAudio();
    if (this.horseAmbient) {
      this.horseAmbient.pause();
      this.horseAmbient.removeAttribute('src');
      this.horseAmbient.load();
      this.horseAmbient = null;
    }
  });
};

p.resumeHorseAmbient = function () {
  if (!this.audioAlive || !this.horseAmbient || !this.ambientUnlocked) return;
  this.horseAmbient.muted = this.muted;
  this.horseAmbient.volume = AMBIENT_VOLUME;
  if (this.horseAmbient.paused) {
    this.horseAmbient.play().catch(() => {});
  }
};

p.toggleSound = function () {
  this.muted = !this.muted;
  this.soundButton.list[1].setText(this.muted ? 'SONIDO OFF' : 'SONIDO ON');
  if (this.audio) this.audio.muted = this.muted;
  if (this.startAudio) this.startAudio.muted = this.muted;
  if (this.horseAmbient) this.horseAmbient.muted = this.muted;
  this.resumeHorseAmbient();
};

// Detiene solo los sonidos de primer plano: el ambiente sigue.
p.stopAudio = function () {
  this.startSequenceId = (this.startSequenceId || 0) + 1;
  if (this.sequenceCleanup) {
    const cleanup = this.sequenceCleanup;
    this.sequenceCleanup = null;
    cleanup();
  }
  if (this.fallback) {
    this.fallback.remove(false);
    this.fallback = null;
  }
  if (this.startAudio) {
    this.startAudio.onended = null;
    this.startAudio.onerror = null;
    this.startAudio.pause();
    this.startAudio = null;
  }
  if (this.audio) {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio = null;
  }
};

p.playAudio = function (name, loop = false, volume = 0.6) {
  if (this.audio) this.audio.pause();
  const audio = new Audio(url(name));
  audio.loop = loop;
  audio.volume = volume;
  audio.muted = this.muted;
  this.audio = audio;
  this.resumeHorseAmbient();
  audio.play().catch(error => {
    console.warn(`No se pudo reproducir ${name}`, error);
  });
  return audio;
};

p.playStart = function () {
  this.stopAudio();
  this.ambientUnlocked = true;
  this.resumeHorseAmbient();
  const sequenceId = this.startSequenceId;
  const isCurrent = () =>
    this.audioAlive &&
    sequenceId === this.startSequenceId &&
    this.phase === 'starting';

  const launchRace = () => {
    if (!isCurrent()) return;
    this.countdown.setText('¡SALIDA!');
    this.time.delayedCall(450, () => {
      if (this.audioAlive) this.countdown.setText('');
    });
    this.elapsed = 0;
    this.phase = 'racing';
    this.playAudio('horse.mp3', true, 0.45);
    this.runners.forEach(runner => {
      this.tweens.add({ targets: runner.gate, alpha: 0, duration: 150 });
    });
    this.info.setText(this.test ? 'ADMIN · Carrera de prueba' : '¡Carrera en marcha!');
  };

  const playStage = (filename, label, next) => {
    if (!isCurrent()) return;
    this.countdown.setText(label);
    const audio = new Audio(url(filename));
    audio.preload = 'auto';
    audio.volume = filename === 'shoot.mp3' ? 0.65 : 0.7;
    audio.muted = this.muted;
    this.startAudio = audio;
    let finished = false;
    let fallbackTimer = null;
    const cleanup = () => {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      if (fallbackTimer) {
        fallbackTimer.remove(false);
        fallbackTimer = null;
      }
      if (this.startAudio === audio) this.startAudio = null;
      if (this.sequenceCleanup === cleanup) this.sequenceCleanup = null;
    };
    const complete = () => {
      if (finished) return;
      finished = true;
      cleanup();
      if (isCurrent()) next();
    };
    const fail = error => {
      if (finished || fallbackTimer || !isCurrent()) return;
      console.warn(`No se pudo reproducir ${filename}`, error);
      this.info.setText(`${filename} no disponible · se omite en 1 segundo`);
      fallbackTimer = this.time.delayedCall(1000, complete);
    };
    this.sequenceCleanup = cleanup;
    audio.onended = complete;
    audio.onerror = fail;
    audio.play().catch(fail);
  };

  playStage('start.mp3', 'PREPARADOS', () => {
    this.info.setText('Señal de salida · esperando a que termine shoot.mp3');
    playStage('shoot.mp3', '¡ATENCIÓN!', launchRace);
  });
};
