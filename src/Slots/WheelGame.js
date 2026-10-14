import Phaser from 'phaser';
import { sfx } from '../sfx.js';
import { makeButton } from '../ui.js';
import { WHEEL_SEGMENTS, weightedPick, describeSegment } from './config.js';

const CX = 480;
const CY = 320;
const RADIUS = 150;

const COLORS = [0xe63946, 0x2a9d8f, 0x457b9d, 0xf4a261, 0x6a4c93, 0x2b9348];

export default class WheelGame {
    constructor(scene, { bet }) {
        this.scene = scene;
        this.bet = bet;
    }

    async run() {
        this.build();
        await this.waitForClick();

        const result = await this.spinWheel();

        this.resultText.setText(describeSegment(result, this.bet));
        this.resultText.setColor(result.kind === 'jackpot' ? '#ff9f1c' : '#7CFC00');

        sfx.win(3);
        await this.scene.wait(2600);

        this.root.destroy(true);
        return result;
    }

    build() {
        const s = this.scene;

        this.root = s.add.container(0, 0).setDepth(150);

        const bg = s.add.rectangle(480, 310, 960, 540, 0x0b1220, 0.98);
        bg.setInteractive();

        const title = s.add.text(480, 68, 'RULETA DE LA SUERTE', {
            fontFamily: 'Arial',
            fontSize: '34px',
            color: '#ffd166',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.root.add([bg, title]);

        this.wheel = s.add.container(CX, CY);
        this.root.add(this.wheel);

        const count = WHEEL_SEGMENTS.length;
        const segRad = (Math.PI * 2) / count;
        this.segDeg = 360 / count;

        const graphics = s.add.graphics();
        this.wheel.add(graphics);

        WHEEL_SEGMENTS.forEach((segment, i) => {
            const start = -Math.PI / 2 + i * segRad;
            const end = start + segRad;

            const color = segment.kind === 'jackpot'
                ? 0xffd166
                : COLORS[i % COLORS.length];

            graphics.fillStyle(color, 1);
            graphics.slice(0, 0, RADIUS, start, end, false);
            graphics.fillPath();

            graphics.lineStyle(2, 0x000000, 1);
            graphics.slice(0, 0, RADIUS, start, end, false);
            graphics.strokePath();

            const mid = start + segRad / 2;

            const label = s.add.text(
                Math.cos(mid) * RADIUS * 0.68,
                Math.sin(mid) * RADIUS * 0.68,
                segment.short,
                {
                    fontFamily: 'Arial',
                    fontSize: '17px',
                    color: segment.kind === 'jackpot' ? '#3a2500' : '#ffffff',
                    fontStyle: 'bold'
                }
            ).setOrigin(0.5);

            label.setRotation(mid);
            this.wheel.add(label);
        });

        const ring = s.add.circle(CX, CY, RADIUS + 6);
        ring.setStrokeStyle(8, 0xffd166);

        const hub = s.add.circle(CX, CY, 22, 0xffd166);
        hub.setStrokeStyle(4, 0x8a5a00);

        const pointer = s.add.graphics();
        pointer.fillStyle(0xffffff, 1);
        pointer.fillTriangle(CX - 18, CY - RADIUS - 26, CX + 18, CY - RADIUS - 26, CX, CY - RADIUS + 10);
        pointer.lineStyle(3, 0x000000, 1);
        pointer.strokeTriangle(CX - 18, CY - RADIUS - 26, CX + 18, CY - RADIUS - 26, CX, CY - RADIUS + 10);

        this.resultText = s.add.text(480, 515, '', {
            fontFamily: 'Arial',
            fontSize: '26px',
            color: '#7CFC00',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        this.root.add([ring, hub, pointer, this.resultText]);
    }

    waitForClick() {
        const s = this.scene;

        return new Promise(resolve => {
            this.button = makeButton(s, 480, 515, 260, 50, 'GIRAR RULETA', '#e63946', () => {
                resolve();
            }, 22);

            this.root.add(this.button);

            if (s.autoMode) {
                s.time.delayedCall(1000, resolve);
            }
        }).then(() => {
            this.button.destroy();
        });
    }

    spinWheel() {
        const s = this.scene;

        const segment = weightedPick(WHEEL_SEGMENTS, seg => seg.weight);
        const index = WHEEL_SEGMENTS.indexOf(segment);

        const jitter = (Math.random() - 0.5) * this.segDeg * 0.6;
        const target = 360 * 6 + (360 - (index + 0.5) * this.segDeg) + jitter;

        let lastTick = 0;

        return new Promise(resolve => {
            s.tweens.add({
                targets: this.wheel,
                angle: target,
                duration: s.turbo ? 3000 : 5200,
                ease: 'Cubic.easeOut',
                onUpdate: () => {
                    const tick = Math.floor(this.wheel.angle / this.segDeg);

                    if (tick !== lastTick) {
                        lastTick = tick;
                        sfx.tick();
                    }
                },
                onComplete: () => resolve(segment)
            });
        });
    }
}