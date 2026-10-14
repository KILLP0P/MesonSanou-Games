import { payWin, formatEuros } from '../state.js';
import { makeButton } from '../ui.js';
import { sfx } from '../sfx.js';

import {
    ROWS,
    COLS,
    SYM,
    BONUS_COINS,
    weightedPick
} from './config.js';

const CELL_WIDTH = 110;
const CELL_HEIGHT = 88;

const START_X = 260;
const START_Y = 180;

// Compatibilidad con las llamadas actuales del slot.
const SPIN_MAPPING = {
    10: 8,
    20: 12,
    50: 20
};

const MAX_SPINS = 20;
const MAX_MULTIPLIER = 5;

const COIN_CHANCE = 0.20;
const JOKER_CHANCE = 0.01;

export default class BonusGame {
    constructor(scene, { spins, bet }) {
        this.scene = scene;

        const requestedSpins = Math.floor(Number(spins));

        this.spins = SPIN_MAPPING[requestedSpins] ??
            Math.max(
                1,
                Math.min(MAX_SPINS, requestedSpins || 8)
            );

        this.bet = bet;

        this.mult = 1;
        this.maxMult = 1;

        this.total = 0;
        this.spinNumber = 0;

        this.cellObjects = [];
    }

    async run() {
        this.build();

        try {
            await this.intro();

            // El total de tiradas se fija al comenzar.
            // Ningún resultado modifica este límite.
            const totalSpins = this.spins;

            for (let index = 1; index <= totalSpins; index++) {
                this.spinNumber = index;
                this.updateHud();

                await this.playSpin();
            }

            await this.outro();

            return this.total;
        } finally {
            if (this.root && this.root.scene) {
                this.root.destroy(true);
            }
        }
    }

    build() {
        const scene = this.scene;

        this.root = scene.add.container(0, 0).setDepth(150);

        const background = scene.add.rectangle(
            480,
            310,
            960,
            540,
            0x0b1220,
            0.98
        );

        background.setInteractive();

        const frame = scene.add.rectangle(
            480,
            310,
            940,
            520
        );

        frame.setStrokeStyle(4, 0xffd166);

        const title = scene.add.text(
            480,
            62,
            'BONUS JUNGLA · TIRADAS GRATIS',
            {
                fontFamily: 'Arial',
                fontSize: '26px',
                color: '#ffd166',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        this.spinsText = scene.add.text(40, 100, '', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        this.multText = scene.add.text(480, 100, '', {
            fontFamily: 'Arial',
            fontSize: '22px',
            color: '#ff9f1c',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.totalText = scene.add.text(920, 100, '', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#7CFC00',
            fontStyle: 'bold'
        }).setOrigin(1, 0.5);

        this.msgText = scene.add.text(480, 440, '', {
            fontFamily: 'Arial',
            fontSize: '21px',
            color: '#ffffff',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: 850 }
        }).setOrigin(0.5);

        const info = scene.add.text(
            480,
            510,
            '2 o más placas consecutivas desde la izquierda en una fila suman su valor.\n' +
            'Los jokers pagan y suben un nivel por tirada, hasta ×5.\n' +
            'No añaden tiradas ni reinician el bonus.',
            {
                fontFamily: 'Arial',
                fontSize: '15px',
                color: '#aaaaaa',
                align: 'center'
            }
        ).setOrigin(0.5);

        this.root.add([
            background,
            frame,
            title,
            this.spinsText,
            this.multText,
            this.totalText,
            this.msgText,
            info
        ]);

        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const cell = scene.add.rectangle(
                    START_X + col * CELL_WIDTH,
                    START_Y + row * CELL_HEIGHT,
                    CELL_WIDTH - 8,
                    CELL_HEIGHT - 8,
                    0x16233b
                );

                cell.setStrokeStyle(2, 0x2b4066);

                this.root.add(cell);
            }
        }

        this.cellLayer = scene.add.container(0, 0);
        this.root.add(this.cellLayer);

        this.updateHud();
    }

    updateHud() {
        this.spinsText.setText(
            `TIRADA ${this.spinNumber}/${this.spins}`
        );

        this.multText.setText(
            `MULTIPLICADOR ×${this.mult}`
        );

        this.totalText.setText(
            `PREMIO BONUS: ${formatEuros(this.total)}`
        );
    }

    async intro() {
        await this.scene.showBanner(
            `¡BONUS!\n${this.spins} TIRADAS GRATIS`,
            '#ffd166',
            1800,
            160
        );
    }

    generateBoard() {
        const board = [];

        for (let row = 0; row < ROWS; row++) {
            board[row] = [];

            for (let col = 0; col < COLS; col++) {
                const roll = Math.random();

                if (roll < JOKER_CHANCE) {
                    board[row][col] = {
                        type: 'joker'
                    };
                } else if (roll < JOKER_CHANCE + COIN_CHANCE) {
                    const coin = weightedPick(
                        BONUS_COINS,
                        item => item.weight
                    );

                    board[row][col] = {
                        type: 'coin',
                        value: coin.value
                    };
                } else {
                    board[row][col] = null;
                }
            }
        }

        return board;
    }

    clearCells() {
        this.cellLayer.removeAll(true);
        this.cellObjects = [];
    }

    createCellObject(row, col, item) {
        const scene = this.scene;

        const container = scene.add.container(
            START_X + col * CELL_WIDTH,
            START_Y + row * CELL_HEIGHT
        );

        if (item.type === 'coin') {
            const plate = scene.add.rectangle(
                0,
                0,
                96,
                40,
                0xf4c542
            );

            plate.setStrokeStyle(3, 0x8a5a00);

            const text = scene.add.text(
                0,
                0,
                formatEuros(Math.round(item.value * this.bet)),
                {
                    fontFamily: 'Arial',
                    fontSize: '15px',
                    color: '#3a2500',
                    fontStyle: 'bold'
                }
            ).setOrigin(0.5);

            container.add([plate, text]);
        } else {
            const joker = scene.add.text(
                0,
                0,
                SYM.JOKER,
                { fontSize: '46px' }
            ).setOrigin(0.5);

            container.add(joker);
        }

        this.cellLayer.add(container);

        return container;
    }

    async playSpin() {
        const scene = this.scene;
        const board = this.generateBoard();

        this.clearCells();

        this.msgText.setText('');
        this.msgText.setColor('#ffffff');

        sfx.spin();

        for (let row = 0; row < ROWS; row++) {
            this.cellObjects[row] = [];

            for (let col = 0; col < COLS; col++) {
                const item = board[row][col];

                if (!item) {
                    this.cellObjects[row][col] = null;
                    continue;
                }

                const object = this.createCellObject(row, col, item);

                object.setScale(0);
                this.cellObjects[row][col] = object;

                scene.tweens.add({
                    targets: object,
                    scale: 1,
                    duration: scene.t(260),
                    delay: scene.t(col * 110 + row * 30),
                    ease: 'Back.easeOut'
                });
            }
        }

        for (let col = 0; col < COLS; col++) {
            scene.time.delayedCall(
                scene.t(col * 110),
                () => sfx.tick()
            );
        }

        await scene.wait(COLS * 110 + 450);

        // Se utiliza el multiplicador que había al comenzar la tirada.
        const currentMultiplier = this.mult;

        let coinMultiples = 0;
        let jokerCount = 0;

        const winningObjects = [];

        for (let row = 0; row < ROWS; row++) {
            const run = [];

            // Solo placas consecutivas desde la primera columna.
            for (let col = 0; col < COLS; col++) {
                const item = board[row][col];

                if (!item || item.type !== 'coin') {
                    break;
                }

                run.push({
                    col,
                    value: item.value
                });
            }

            if (run.length >= 2) {
                const rowSum = run.reduce(
                    (sum, item) => sum + item.value,
                    0
                );

                coinMultiples += rowSum;

                run.forEach(item => {
                    winningObjects.push(
                        this.cellObjects[row][item.col]
                    );
                });
            }
        }

        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const item = board[row][col];

                if (item && item.type === 'joker') {
                    jokerCount++;

                    winningObjects.push(
                        this.cellObjects[row][col]
                    );
                }
            }
        }

        const totalMultiples =
            (coinMultiples + jokerCount) * currentMultiplier;

        const amount = totalMultiples > 0
            ? Math.max(1, Math.round(totalMultiples * this.bet))
            : 0;

        if (amount > 0) {
            payWin(amount);
            this.total += amount;

            sfx.coin();

            winningObjects.forEach(object => {
                scene.tweens.add({
                    targets: object,
                    scale: 1.2,
                    duration: 150,
                    yoyo: true,
                    repeat: 3
                });
            });

            this.msgText.setText(
                `HAS GANADO ${formatEuros(amount)} · ×${currentMultiplier}`
            );

            this.msgText.setColor('#7CFC00');
        } else {
            this.msgText.setText('Sin premio en esta tirada');
            this.msgText.setColor('#aaaaaa');
        }

        if (jokerCount > 0) {
            const previousMultiplier = this.mult;

            // Como máximo un incremento por tirada.
            this.mult = Math.min(MAX_MULTIPLIER, this.mult + 1);
            this.maxMult = Math.max(this.maxMult, this.mult);

            this.msgText.setText(
                `HAS GANADO ${formatEuros(amount)} · ${jokerCount} joker(s)\n` +
                (
                    this.mult > previousMultiplier
                        ? `Próxima tirada: multiplicador ×${this.mult}`
                        : `Multiplicador máximo ×${MAX_MULTIPLIER}`
                )
            );

            sfx.win(2);
        }

        this.updateHud();

        await scene.wait(amount > 0 ? 1300 : 650);
    }

    async outro() {
        const scene = this.scene;

        const objects = [];
        let button;
        let finished = false;
        let timer = null;

        const panel = scene.add.rectangle(
            480,
            310,
            620,
            300,
            0x000000,
            0.95
        ).setDepth(161);

        panel.setStrokeStyle(4, 0xffd166);
        panel.setInteractive();

        const title = scene.add.text(
            480,
            210,
            'BONUS COMPLETADO',
            {
                fontFamily: 'Arial',
                fontSize: '32px',
                color: '#ffd166',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(162);

        const amount = scene.add.text(
            480,
            280,
            `HAS GANADO ${formatEuros(this.total)}`,
            {
                fontFamily: 'Arial',
                fontSize: '36px',
                color: '#7CFC00',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(162);

        const detail = scene.add.text(
            480,
            345,
            `${this.spins} tiradas · multiplicador máximo ×${this.maxMult}`,
            {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: '#ffffff'
            }
        ).setOrigin(0.5).setDepth(162);

        objects.push(panel, title, amount, detail);

        await new Promise(resolve => {
            const finish = () => {
                if (finished) return;
                finished = true;

                if (timer) {
                    timer.remove(false);
                }

                resolve();
            };

            button = makeButton(
                scene,
                480,
                405,
                240,
                44,
                'CONTINUAR',
                '#2a9d8f',
                finish,
                20
            ).setDepth(162);

            objects.push(button);

            if (scene.autoMode) {
                timer = scene.time.delayedCall(5000, finish);
            }
        });

        objects.forEach(object => object.destroy());
    }
}