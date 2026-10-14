import Phaser from 'phaser';

import MenuScene from './scenes/MenuScene.js';
import SlotsScene from './scenes/SlotsScene.js';
import HorseRaceScene from './scenes/HorseRaceScene.js';
import HistoryScene from './scenes/HistoryScene.js';

import './slots/polish.js';
import './horseAudio.js';
import './demoBranding.js';

// PokerScene no se importa ni se registra en esta demo.
// Conserva PokerScene.js para poder reactivarlo en otra actualización.
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 620,
  backgroundColor: '#07101d',
  scene: [MenuScene, SlotsScene, HorseRaceScene, HistoryScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});
