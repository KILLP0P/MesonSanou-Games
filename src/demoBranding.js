import SlotsScene from './scenes/SlotsScene.js';
import HorseRaceScene from './scenes/HorseRaceScene.js';
import { getSession } from './state.js';

function renameTexts(scene,kind) {
  for (const object of scene.children.list) {
    if (object.type !== 'Text' || typeof object.text !== 'string') continue;
    if (kind === 'slots' && (
      object.text.startsWith('JUNGLE SLOTS') ||
      object.text.startsWith('SLOTS 3x5')
    )) {
      object.setText('AL-SANOWI SLOTS · 243 FORMAS');
      object.setFontSize(25);
    }
    if (kind === 'derby' && (
      object.text.startsWith('ROCKSTAR DERBY') ||
      object.text.startsWith('HIPÓDROMO') ||
      object.text === 'CARRERA DE CABALLOS'
    )) {
      object.setText('XELIQUITA DERBY · 8 CABALLOS');
      object.setFontSize(26);
    }
  }
}

function patch(Scene,name,kind) {
  const original=Scene.prototype.create;
  Scene.prototype.create=function (...args) {
    original.apply(this,args);
    renameTexts(this,kind);
    const session=getSession();
    if(session)session.game=name;
  };
}

patch(SlotsScene,'AL-SANOWI SLOTS','slots');
patch(HorseRaceScene,'XELIQUITA DERBY','derby');
