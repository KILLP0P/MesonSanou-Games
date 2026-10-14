import Phaser from 'phaser';
import {
    state,
    formatEuros,
    getSession,
    startSession,
    endSession
} from './state.js';

const WIDTH = 960;
const HEIGHT = 620;

function toColor(color) {
    return typeof color === 'string'
        ? Phaser.Display.Color.HexStringToColor(color).color
        : color;
}

export function makeButton(scene, x, y, width, height, label, color, onClick, fontSize = 20) {
    const container = scene.add.container(x, y);

    const background = scene.add.rectangle(0, 0, width, height, toColor(color));
    background.setInteractive({ useHandCursor: true });

    const text = scene.add.text(0, 0, label, {
        fontFamily: 'Arial',
        fontSize: `${fontSize}px`,
        color: '#ffffff',
        fontStyle: 'bold'
    }).setOrigin(0.5);

    container.add([background, text]);

    background.on('pointerover', () => container.setScale(1.04));
    background.on('pointerout', () => container.setScale(1));
    background.on('pointerdown', onClick);

    return container;
}

export function createHud(scene, gameName) {
    startSession(gameName);
    scene.events.once('shutdown', endSession);

    scene.add.rectangle(WIDTH / 2, 20, WIDTH, 40, 0x000000, 0.95).setDepth(100);
    scene.add.rectangle(WIDTH / 2, HEIGHT - 20, WIDTH, 40, 0x000000, 0.95).setDepth(100);

    const style = color => ({
        fontFamily: 'Arial',
        fontSize: '15px',
        color,
        fontStyle: 'bold'
    });

    const credit = scene.add.text(20, 20, '', style('#ffffff')).setOrigin(0, 0.5).setDepth(101);
    const wagered = scene.add.text(270, 20, '', style('#cccccc')).setOrigin(0, 0.5).setDepth(101);
    const won = scene.add.text(500, 20, '', style('#ffd166')).setOrigin(0, 0.5).setDepth(101);
    const net = scene.add.text(720, 20, '', style('#ffffff')).setOrigin(0, 0.5).setDepth(101);

    scene.add.text(20, HEIGHT - 20, 'ÚLTIMOS PREMIOS:', style('#aaaaaa'))
        .setOrigin(0, 0.5)
        .setDepth(101);

    const prizes = scene.add.text(190, HEIGHT - 20, '—', style('#ffd166'))
        .setOrigin(0, 0.5)
        .setDepth(101);

    const update = () => {
        const session = getSession();

        const wageredValue = session ? session.wagered : 0;
        const wonValue = session ? session.won : 0;
        const netValue = wonValue - wageredValue;

        credit.setText(`CRÉDITO: ${formatEuros(state.balance)}`);
        wagered.setText(`APOSTADO: ${formatEuros(wageredValue)}`);
        won.setText(`GANADO: ${formatEuros(wonValue)}`);

        net.setText(
            `RESULTADO: ${netValue > 0 ? '+' : ''}${formatEuros(netValue)}`
        );

        net.setColor(
            netValue > 0 ? '#7CFC00' : netValue < 0 ? '#ff6b6b' : '#ffffff'
        );

        if (session && session.lastPrizes.length > 0) {
            prizes.setText(
                session.lastPrizes.map(p => `+${formatEuros(p)}`).join('   ')
            );
        } else {
            prizes.setText('—');
        }
    };

    scene.events.on('update', update);
    scene.events.once('shutdown', () => scene.events.off('update', update));

    update();
}