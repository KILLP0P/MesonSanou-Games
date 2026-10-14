import './upgrade.js';

import SlotsScene from '../scenes/SlotsScene.js';

import {
    placeBet,
    payWin,
    registerFreeRound,
    canBet,
    formatEuros
} from '../state.js';

import { makeButton } from '../ui.js';
import { sfx } from '../sfx.js';

import {
    SYM,
    randomSymbol,
    evaluateWays,
    SCATTER_PAYS,
    FREE_SPINS,
    BONUS_SPINS,
    BONUS_COINS,
    weightedPick
} from './config.js';

const p = SlotsScene.prototype;

const GRID_X = 260;
const GRID_Y = 145;
const CELL_W = 110;
const CELL_H = 90;

const MAX_CASCADES = 5;
const CASCADE_MULTIPLIERS = [1, 1.5, 2, 2.5, 3];

const TREASURE_ROWS = 5;
const TREASURE_COLS = 10;
const TREASURE_ROUNDS = 5;
const TREASURE_MAX_ROUNDS = 8;

const PURCHASES = [
    { label: 'PLACAS · 8 TIRADAS', type: 'plates', request: 10, price: 12 },
    { label: 'PLACAS · 12 TIRADAS', type: 'plates', request: 20, price: 20 },
    { label: 'PLACAS · 20 TIRADAS', type: 'plates', request: 50, price: 40 },
    { label: 'TESORO · TABLERO 5×10', type: 'treasure', price: 35 }
];

// Precios orientativos para saldo ficticio, no un RTP certificado.

function modalRoot(scene, depth = 160) {
    const root = scene.add.container(0, 0).setDepth(depth);

    const background = scene.add.rectangle(
        480, 310, 960, 540, 0x07101c, 0.99
    ).setInteractive();

    const frame = scene.add.rectangle(480, 310, 940, 520);
    frame.setStrokeStyle(3, 0xffd166);

    root.add([background, frame]);

    return root;
}

function addText(scene, root, x, y, text, size = 22, color = '#ffffff') {
    const object = scene.add.text(x, y, text, {
        fontFamily: 'Arial',
        fontSize: `${size}px`,
        color,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 880 }
    }).setOrigin(0.5);

    root.add(object);
    return object;
}

function addButton(scene, root, x, y, width, label, callback, color = '#2a9d8f') {
    const button = makeButton(
        scene, x, y, width, 44, label, color, callback, 18
    );

    root.add(button);
    return button;
}

function chooseCoin() {
    return weightedPick(BONUS_COINS, item => item.weight).value;
}

async function showFeatureResult(scene, title, amount, detail = '') {
    const previousModal = scene.modalOpen;
    scene.modalOpen = true;

    const root = modalRoot(scene, 180);

    addText(scene, root, 480, 185, title, 34, '#ffd166');
    addText(
        scene, root, 480, 285,
        `HAS GANADO ${formatEuros(amount)}`,
        40, '#7CFC00'
    );

    addText(scene, root, 480, 345, detail, 19, '#cccccc');

    scene.musicController?.startResult('jackpot.mp3');

    await new Promise(resolve => {
        let closed = false;
        let timer = null;

        const close = () => {
            if (closed) return;
            closed = true;

            if (timer) timer.remove(false);
            scene.events.off('shutdown', close);
            resolve();
        };

        addButton(scene, root, 480, 425, 260, 'CONTINUAR', close);

        scene.events.once('shutdown', close);

        if (scene.autoMode) {
            timer = scene.time.delayedCall(5000, close);
        }
    });

    scene.musicController?.endResult();

    if (root.scene) root.destroy(true);
    scene.modalOpen = previousModal;
}

/* ---------- Cofres: tres elecciones, sin duplicar pagos ---------- */

async function playChests(scene, bet) {
    const root = modalRoot(scene, 165);

    addText(scene, root, 480, 75, 'LOS COFRES DEL EXPLORADOR', 30, '#ffd166');

    const status = addText(
        scene, root, 480, 120,
        'Elige 3 cofres. Los premios están asignados antes de elegir.',
        18, '#cccccc'
    );

    const options = [
        { value: 0.25, weight: 35 },
        { value: 0.5, weight: 30 },
        { value: 1, weight: 20 },
        { value: 2, weight: 10 },
        { value: 5, weight: 4 },
        { value: 10, weight: 1 }
    ];

    const values = Array.from(
        { length: 6 },
        () => weightedPick(options, item => item.weight).value
    );

    const buttons = [];
    const selected = new Set();

    let totalMultiples = 0;

    await new Promise(resolve => {
        let finished = false;

        const pick = index => {
            if (finished || selected.has(index)) return;

            selected.add(index);
            totalMultiples += values[index];

            buttons[index].list[1].setText(
                formatEuros(Math.round(values[index] * bet))
            );

            buttons[index].list[0].fillColor = 0x2a9d8f;
            sfx.coin();

            status.setText(
                `${selected.size}/3 cofres abiertos · ` +
                `Acumulado: ${formatEuros(Math.round(totalMultiples * bet))}`
            );

            if (selected.size === 3) {
                finished = true;

                buttons.forEach((button, i) => {
                    if (!selected.has(i)) {
                        button.list[1].setText(
                            formatEuros(Math.round(values[i] * bet))
                        );
                        button.list[0].fillColor = 0x434343;
                        button.setAlpha(0.55);
                    }
                });

                scene.time.delayedCall(scene.t(1200), resolve);
            }
        };

        for (let i = 0; i < 6; i++) {
            const x = 240 + (i % 3) * 240;
            const y = 225 + Math.floor(i / 3) * 115;

            buttons.push(
                addButton(
                    scene, root, x, y, 190,
                    `COFRE ${i + 1}`,
                    () => pick(i),
                    '#79502c'
                )
            );
        }

        if (scene.autoMode) {
            const order = [0, 1, 2, 3, 4, 5]
                .sort(() => Math.random() - 0.5)
                .slice(0, 3);

            order.forEach((index, i) => {
                scene.time.delayedCall(
                    700 + i * 700,
                    () => pick(index)
                );
            });
        }
    });

    const amount = Math.round(totalMultiples * bet);

    if (amount > 0) payWin(amount);

    root.destroy(true);
    return amount;
}

/* ---------- Cámara del tesoro 5×10 ---------- */

async function playTreasure(scene, bet) {
    const root = modalRoot(scene, 155);

    addText(scene, root, 480, 65, 'CÁMARA DEL TESORO · 5×10', 27, '#ffd166');

    const status = addText(scene, root, 480, 98, '', 17);
    const message = addText(scene, root, 480, 510, '', 18, '#ffd166');

    addText(
        scene, root, 480, 550,
        'Las monedas quedan bloqueadas. Una llave abre un cofre.\n' +
        'Los jokers mejoran monedas: nunca reinician las rondas.',
        14, '#aaaaaa'
    );

    const cells = [];
    const board = Array(50).fill(null);

    let rounds = TREASURE_ROUNDS;
    let roundNumber = 0;

    const x0 = 102;
    const y0 = 155;
    const width = 84;
    const height = 65;

    for (let row = 0; row < TREASURE_ROWS; row++) {
        for (let col = 0; col < TREASURE_COLS; col++) {
            const x = x0 + col * width;
            const y = y0 + row * height;

            const rectangle = scene.add.rectangle(
                x, y, width - 5, height - 5, 0x16233b
            );
            rectangle.setStrokeStyle(2, 0x2b4066);

            const text = scene.add.text(x, y, '·', {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#aaaaaa',
                fontStyle: 'bold',
                align: 'center'
            }).setOrigin(0.5);

            root.add([rectangle, text]);
            cells.push({ rectangle, text });
        }
    }

    const render = () => {
        let totalMultiples = 0;

        board.forEach((item, index) => {
            const cell = cells[index];

            if (!item) {
                cell.text.setText('·');
                cell.text.setColor('#aaaaaa');
                cell.rectangle.fillColor = 0x16233b;
            } else if (item.type === 'coin') {
                totalMultiples += item.value;
                cell.text.setText(formatEuros(Math.round(item.value * bet)));
                cell.text.setColor('#382600');
                cell.rectangle.fillColor = 0xf4c542;
            } else {
                cell.text.setText('🔒');
                cell.text.setColor('#ffffff');
                cell.rectangle.fillColor = 0x79502c;
            }
        });

        status.setText(
            `RONDA ${roundNumber}/${rounds} · ` +
            `TESORO ${formatEuros(Math.round(totalMultiples * bet))}`
        );

        return totalMultiples;
    };

    render();

    while (roundNumber < rounds) {
        roundNumber++;

        let keys = 0;
        let jokers = 0;
        let extraRound = false;
        let landed = 0;

        for (let index = 0; index < board.length; index++) {
            if (board[index]) continue;

            const roll = Math.random();

            if (roll < 0.06) {
                board[index] = {
                    type: 'coin',
                    value: chooseCoin()
                };
                landed++;
            } else if (roll < 0.07) {
                board[index] = { type: 'chest' };
                landed++;
            } else if (roll < 0.078) {
                keys++;
            } else if (roll < 0.082) {
                jokers++;
            } else if (roll < 0.084) {
                extraRound = true;
            }
        }

        for (let k = 0; k < keys; k++) {
            const chestIndex = board.findIndex(
                item => item?.type === 'chest'
            );

            if (chestIndex !== -1) {
                board[chestIndex] = {
                    type: 'coin',
                    value: Math.min(25, chooseCoin() * 2)
                };
            }
        }

        // Como máximo una mejora por ronda, no una por cada joker.
        if (jokers > 0) {
            const coinIndices = board
                .map((item, i) => item?.type === 'coin' ? i : -1)
                .filter(i => i !== -1);

            if (coinIndices.length > 0) {
                const index = coinIndices[
                    Math.floor(Math.random() * coinIndices.length)
                ];

                board[index].value = Math.min(50, board[index].value * 2);
            }
        }

        if (extraRound && rounds < TREASURE_MAX_ROUNDS) {
            rounds++;
        }

        render();

        message.setText(
            [
                `${landed} casillas nuevas`,
                keys > 0 ? `🔑 ${keys}` : '',
                jokers > 0 ? '🃏 Una moneda mejorada' : '',
                extraRound && rounds <= TREASURE_MAX_ROUNDS
                    ? `Máximo ${TREASURE_MAX_ROUNDS} rondas`
                    : ''
            ].filter(Boolean).join(' · ')
        );

        sfx.tick();
        await scene.wait(1100);

        if (board.every(Boolean)) break;
    }

    const multiples = render();
    const amount = Math.round(multiples * bet);

    if (amount > 0) payWin(amount);

    await scene.wait(900);
    root.destroy(true);

    const chestPrize = await playChests(scene, bet);
    const total = amount + chestPrize;

    await showFeatureResult(
        scene,
        'TESORO COMPLETADO',
        total,
        `${roundNumber} rondas · tablero y cofres incluidos`
    );

    return total;
}

/* ---------- Integración ---------- */

const previousCreate = p.create;

p.create = function () {
    previousCreate.call(this);

    this.nextSpinTimer = null;
    this.featureReturn = 0;
    this.sessionEntryCredit = null;

    makeButton(
        this, 760, 565, 140, 26,
        'PRUEBA 5×10',
        '#79502c',
        async () => {
            if (this.busy || this.modalOpen) return;

            if (!this.debugEnabled) {
                const code = window.prompt('Código de desarrollo');

                if (code !== '280816') return;
                this.debugEnabled = true;
            }

            this.stopAutoSpin();
            this.busy = true;
            this.modalOpen = true;

            try {
                await playTreasure(this, this.totalBet);
            } finally {
                this.modalOpen = false;
                this.busy = false;
                this.updateTexts();
            }
        },
        13
    ).setDepth(102);

    this.events.once('shutdown', () => {
        if (this.nextSpinTimer) {
            this.nextSpinTimer.remove(false);
            this.nextSpinTimer = null;
        }
    });
};

// Los bonus de 3 y 4 jokers conservan las placas.
// Cinco columnas consecutivas con jokers activan el tablero 5×10.
const previousRunBonus = p.runBonus;

p.runBonus = async function (spins) {
    if (spins === 50) {
        const previousModal = this.modalOpen;
        this.modalOpen = true;

        try {
            return await playTreasure(this, this.totalBet);
        } finally {
            this.modalOpen = previousModal;
        }
    }

    return previousRunBonus.call(this, spins);
};

/* ---------- Cascadas ---------- */

function winningCells(result) {
    const unique = new Map();

    result.wins.forEach(win => {
        win.cells.forEach(cell => {
            unique.set(`${cell.row}:${cell.col}`, cell);
        });
    });

    return [...unique.values()];
}

async function collapseGrid(scene, result, ante) {
    const removed = winningCells(result);

    if (removed.length === 0) return;

    const removedKeys = new Set(
        removed.map(cell => `${cell.row}:${cell.col}`)
    );

    scene.hlGraphics.clear();

    await new Promise(resolve => {
        let finished = 0;

        removed.forEach(({ row, col }) => {
            const object = scene.reels[col].pool[row];

            scene.tweens.killTweensOf(object);

            scene.tweens.add({
                targets: object,
                scale: 0.2,
                alpha: 0,
                duration: scene.t(250),
                onComplete: () => {
                    finished++;
                    if (finished === removed.length) resolve();
                }
            });
        });
    });

    const nextGrid = Array.from({ length: 3 }, () => Array(5));

    for (let col = 0; col < 5; col++) {
        const survivingRows = [];

        for (let row = 0; row < 3; row++) {
            if (!removedKeys.has(`${row}:${col}`)) {
                survivingRows.push(row);
            }
        }

        const newCount = 3 - survivingRows.length;

        for (let row = 0; row < newCount; row++) {
            nextGrid[row][col] = randomSymbol(col, ante);
        }

        survivingRows.forEach((oldRow, index) => {
            nextGrid[newCount + index][col] = scene.grid[oldRow][col];
        });

        const reel = scene.reels[col];

        reel.pool.forEach(object => {
            scene.tweens.killTweensOf(object);
            object.setScale(1).setAngle(0).setAlpha(1);
        });

        reel.strip = nextGrid.map(row => row[col]);
        reel.scroll = 0;

        reel.pool.forEach((object, row) => {
            if (row >= 3) {
                object.setText('');
                return;
            }

            object.setText(nextGrid[row][col]);

            const originalRow = row < newCount
                ? row - newCount
                : survivingRows[row - newCount];

            object.y = GRID_Y + originalRow * CELL_H;

            scene.tweens.add({
                targets: object,
                y: GRID_Y + row * CELL_H,
                duration: scene.t(380),
                ease: 'Bounce.easeOut'
            });
        });
    }

    scene.grid = nextGrid;
    sfx.stop();

    await scene.wait(450);
}

p.resolveSpin = async function (isFree) {
    const bet = this.roundBet;
    const ante = this.roundAnte;

    const freeMultiplier = isFree ? this.freeSpinMult : 1;
    const wheelMultiplier = this.wheelMult.left > 0
        ? this.wheelMult.value
        : 1;

    if (this.wheelMult.left > 0) {
        this.wheelMult.left--;

        if (this.wheelMult.left === 0) {
            this.wheelMult.value = 1;
        }
    }

    let total = 0;
    let result = evaluateWays(this.grid);

    let bestJokerChain = 0;
    let maximumWheelSpins = 0;
    let maximumScatterCount = 0;

    const historyLines = [];

    for (let cascade = 0; cascade < MAX_CASCADES; cascade++) {
        const cascadeMultiplier = CASCADE_MULTIPLIERS[cascade];
        const multiplier =
            cascadeMultiplier * freeMultiplier * wheelMultiplier;

        bestJokerChain = Math.max(bestJokerChain, result.jokerChain);
        maximumWheelSpins = Math.max(maximumWheelSpins, result.wheelSpins);
        maximumScatterCount = Math.max(
            maximumScatterCount,
            result.scatterCount
        );

        const amount = result.totalMultiplier > 0
            ? Math.max(1, Math.round(result.totalMultiplier * bet * multiplier))
            : 0;

        if (amount > 0) {
            payWin(amount);
            total += amount;

            this.highlight(winningCells(result));

            result.wins.forEach(win => {
                historyLines.push(
                    `${win.symbol} ${win.length} columnas · ${win.ways} formas`
                );
            });

            this.winListText.setText(historyLines.slice(-10).join('\n'));

            this.resultText.setColor('#7CFC00');
            this.resultText.setText(
                `CASCADA ${cascade + 1} · ×${cascadeMultiplier} · ` +
                `+${formatEuros(amount)}`
            );

            sfx.coin();
            await this.wait(800);
        }

        if (
            result.wins.length === 0 ||
            cascade === MAX_CASCADES - 1
        ) {
            break;
        }

        await collapseGrid(this, result, ante);
        result = evaluateWays(this.grid);
    }

    // Un solo pago de scatters por tirada, usando el mayor número
    // observado durante la secuencia. No se duplica en cada cascada.
    if (maximumScatterCount >= 3) {
        const key = Math.min(maximumScatterCount, 5);

        const scatterPrize = Math.max(
            1,
            Math.round(
                SCATTER_PAYS[key] * bet *
                freeMultiplier * wheelMultiplier
            )
        );

        payWin(scatterPrize);
        total += scatterPrize;
    }

    if (isFree) {
        this.freeSpinTotal += total;

        if (total > 0) {
            this.freeSpinMult = Math.min(5, this.freeSpinMult + 1);
        }
    }

    if (total > 0) {
        await this.celebrate(total, 'TOTAL DE LA TIRADA: ');
    } else {
        this.resultText.setColor('#aaaaaa');
        this.resultText.setText(
            isFree ? 'Tirada gratis sin premio' : 'Sin premio'
        );
        await this.wait(250);
    }

    // Máximo una activación de cada función por tirada principal.
    if (!isFree) {
        for (let i = 0; i < maximumWheelSpins; i++) {
            await this.runWheel();
        }

        if (bestJokerChain >= 3) {
            await this.runBonus(
                BONUS_SPINS[Math.min(bestJokerChain, 5)]
            );
        }
    }

    if (maximumScatterCount >= 3) {
        await this.awardFreeSpins(
            FREE_SPINS[Math.min(maximumScatterCount, 5)],
            `${maximumScatterCount} SCATTERS`
        );
    }

    if (this.inFreeMode && this.freeSpins === 0) {
        const freeTotal = this.freeSpinTotal;

        this.inFreeMode = false;
        this.freeSpinTotal = 0;
        this.freeSpinMult = 1;

        await showFeatureResult(
            this,
            'TIRADAS GRATIS TERMINADAS',
            freeTotal,
            'Premios de la secuencia de tiradas gratis'
        );
    }

    this.updateTexts();
};

/* ---------- Tiradas y temporizadores seguros ---------- */

p.spin = async function () {
    if (this.busy || this.modalOpen || !this.alive) return;

    if (this.nextSpinTimer) {
        this.nextSpinTimer.remove(false);
        this.nextSpinTimer = null;
    }

    const isFree = this.freeSpins > 0;

    this.roundBet = this.totalBet;
    this.roundAnte = this.anteEnabled;

    if (!isFree && !canBet(this.roundBet)) {
        this.stopAutoSpin();
        this.resultText.setColor('#ff6b6b');
        this.resultText.setText('Saldo insuficiente. Puedes recargar en el menú.');
        return;
    }

    this.busy = true;
    this.resetEffects();
    this.resultText.setText('');

    if (isFree) {
        this.freeSpins--;
        registerFreeRound();
    } else {
        placeBet(this.roundBet);

        // Las rondas gratuitas no consumen el contador de autoplay.
        if (this.autoMode && Number.isFinite(this.autoSpinsLeft)) {
            this.autoSpinsLeft--;
        }
    }

    this.updateTexts();

    try {
        const previousGrid = this.grid.map(row => [...row]);

        this.prepareFinalGrid();
        this.pendingResult = evaluateWays(this.grid);

        await this.animateReels(previousGrid);

        if (!this.alive) return;

        await this.resolveSpin(isFree);
    } catch (error) {
        console.error(error);
        this.stopAutoSpin();
        this.resultText.setColor('#ff6b6b');
        this.resultText.setText('Error en la ronda. Revisa la consola.');
    } finally {
        this.busy = false;

        if (this.alive) {
            this.updateTexts();
            this.scheduleNext();
        }
    }
};

p.scheduleNext = function () {
    if (this.nextSpinTimer) {
        this.nextSpinTimer.remove(false);
        this.nextSpinTimer = null;
    }

    if (!this.alive || this.busy || this.modalOpen) return;

    const hasFreeSpins = this.freeSpins > 0;

    if (!hasFreeSpins) {
        if (!this.autoMode) return;

        if (
            Number.isFinite(this.autoSpinsLeft) &&
            this.autoSpinsLeft <= 0
        ) {
            this.stopAutoSpin();
            this.autoInfoText.setText('AUTO completado');
            return;
        }
    }

    this.nextSpinTimer = this.time.delayedCall(
        this.t(hasFreeSpins ? 900 : 700),
        () => {
            this.nextSpinTimer = null;

            if (!this.alive || this.modalOpen || this.busy) return;
            if (this.freeSpins <= 0 && !this.autoMode) return;

            this.spin();
        }
    );
};

const previousStopAuto = p.stopAutoSpin;

p.stopAutoSpin = function () {
    previousStopAuto.call(this);

    if (this.nextSpinTimer) {
        this.nextSpinTimer.remove(false);
        this.nextSpinTimer = null;
    }
};

p.changeBet = function (direction) {
    if (
        this.busy ||
        this.modalOpen ||
        this.autoMode ||
        this.inFreeMode ||
        this.freeSpins > 0 ||
        this.wheelMult.left > 0
    ) {
        return;
    }

    this.betIndex = Math.max(0, Math.min(9, this.betIndex + direction));
    this.updateTexts();
};

p.toggleAnte = function () {
    if (
        this.busy ||
        this.modalOpen ||
        this.autoMode ||
        this.inFreeMode ||
        this.freeSpins > 0 ||
        this.wheelMult.left > 0
    ) {
        return;
    }

    this.anteEnabled = !this.anteEnabled;
    this.updateTexts();
};

/* ---------- Compra con confirmación ---------- */

p.openBuyMenu = function () {
    if (
        this.busy ||
        this.modalOpen ||
        this.inFreeMode ||
        this.freeSpins > 0 ||
        this.wheelMult.left > 0
    ) {
        return;
    }

    this.stopAutoSpin();
    this.modalOpen = true;

    const root = modalRoot(this, 175);

    addText(this, root, 480, 95, 'COMPRAR BONUS · SALDO FICTICIO', 28, '#ffd166');

    addText(
        this, root, 480, 130,
        'Precios de prueba. Las ganancias no están garantizadas.',
        16, '#aaaaaa'
    );

    let closed = false;

    const close = () => {
        if (closed) return;
        closed = true;
        root.destroy(true);
        this.modalOpen = false;
    };

    PURCHASES.forEach((option, index) => {
        const cost = Math.round(option.price * this.totalBet);

        addButton(
            this, root, 480, 205 + index * 65, 650,
            `${option.label} · ${formatEuros(cost)}`,
            async () => {
                if (closed) return;

                const approved = window.confirm(
                    `${option.label}\n` +
                    `Coste: ${formatEuros(cost)} de saldo ficticio.\n` +
                    `¿Confirmas la compra?`
                );

                if (!approved) return;

                if (!canBet(cost)) {
                    window.alert('Saldo insuficiente.');
                    return;
                }

                close();
                this.busy = true;
                this.modalOpen = true;

                placeBet(cost);

                try {
                    if (option.type === 'treasure') {
                        await playTreasure(this, this.totalBet);
                    } else {
                        // Acceso directo a placas incluso para la opción de 20.
                        await previousRunBonus.call(this, option.request);
                    }
                } catch (error) {
                    console.error(error);
                    this.resultText.setText('Error de bonus. Revisa la consola.');
                } finally {
                    this.busy = false;
                    this.modalOpen = false;
                    this.updateTexts();
                }
            },
            '#6a4c93'
        );
    });

    addButton(this, root, 480, 495, 240, 'CANCELAR', close, '#e63946');
};

/* ---------- Reglas actualizadas ---------- */

p.showPaytable = function () {
    if (this.busy || this.modalOpen) return;

    this.stopAutoSpin();
    this.modalOpen = true;

    const root = modalRoot(this, 175);

    addText(this, root, 480, 75, 'REGLAS DE ESTA VERSIÓN', 30, '#ffd166');

    addText(
        this,
        root,
        480,
        295,
        '243 FORMAS: mínimo 3 columnas consecutivas desde la izquierda.\n' +
        'No hay premio por una columna vertical aislada.\n\n' +
        'CASCADAS: máximo 5 evaluaciones, sin cobrar otra apuesta.\n' +
        'Multiplicadores: ×1, ×1,5, ×2, ×2,5 y ×3.\n\n' +
        '3 JOKERS: placas con 8 tiradas.\n' +
        '4 JOKERS: placas con 12 tiradas.\n' +
        '5 JOKERS: cámara del tesoro 5×10 y selección de cofres.\n\n' +
        'PLACAS: 2 o más importes seguidos desde la izquierda en una fila.\n' +
        'Jokers: premio y un incremento por tirada, máximo ×5.\n\n' +
        'TESORO: 5 rondas iniciales, máximo 8; monedas bloqueadas.\n' +
        'Llaves abren cofres; jokers mejoran una moneda, sin reiniciar.\n\n' +
        'CAMPANAS: conservan la ruleta de premios.\n' +
        'SCATTERS: conservan las tiradas gratis y su multiplicador.\n\n' +
        'Modelo experimental para saldo ficticio: RTP no certificado.',
        17
    );

    addButton(this, root, 480, 530, 240, 'CERRAR', () => {
        root.destroy(true);
        this.modalOpen = false;
    }, '#e63946');
};