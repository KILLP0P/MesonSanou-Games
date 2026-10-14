import Phaser from 'phaser';
import {
    placeBet,
    payWin,
    registerFreeRound,
    canBet,
    formatEuros
} from '../state.js';
import { createHud, makeButton } from '../ui.js';
import { sfx } from '../sfx.js';
import BonusGame from '../slots/BonusGame.js';
import WheelGame from '../slots/WheelGame.js';
import {
    ROWS,
    COLS,
    SYM,
    PAYING_SYMBOLS,
    PAYTABLE,
    SCATTER_PAYS,
    FREE_SPINS,
    FREE_MULT_CAP,
    BONUS_SPINS,
    BONUS_BUY_PRICES,
    WHEEL_MIN_BELLS,
    JACKPOTS,
    BET_LEVELS,
    AUTO_SPIN_OPTIONS,
    ANTE_MULTIPLIER,
    randomSymbol,
    evaluateWays
} from '../slots/config.js';

const CELL_WIDTH = 110;
const CELL_HEIGHT = 90;
const GRID_START_X = 260;
const GRID_START_Y = 145;

export default class SlotsScene extends Phaser.Scene {
    constructor() {
        super('SlotsScene');
    }

    create() {
        this.alive = true;
        this.events.once('shutdown', () => {
            this.alive = false;
        });

        this.busy = false;
        this.modalOpen = false;

        this.freeSpins = 0;
        this.freeSpinMult = 1;
        this.inFreeMode = false;
        this.freeSpinTotal = 0;
        this.wheelMult = { value: 1, left: 0 };

        this.betIndex = 2;
        this.anteEnabled = false;
        this.turbo = false;

        this.autoMode = false;
        this.autoSpinsLeft = 0;

        createHud(this, 'Slots');

        this.add.text(480, 62, 'JUNGLE SLOTS · 243 FORMAS', {
            fontFamily: 'Arial',
            fontSize: '28px',
            color: '#ffd166',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.betText = this.add.text(480, 88, '', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.statusText = this.add.text(940, 62, '', {
            fontFamily: 'Arial',
            fontSize: '15px',
            color: '#ffd166',
            fontStyle: 'bold'
        }).setOrigin(1, 0.5);

        this.resultText = this.add.text(480, 392, '', {
            fontFamily: 'Arial',
            fontSize: '22px',
            color: '#7CFC00',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.createJackpotPanel();
        this.createWinList();
        this.createReels();

        this.hlGraphics = this.add.graphics().setDepth(49);

        this.createBetControls();
        this.createAutoControls();
        this.createMainButtons();

        if (this.input.keyboard) {
            this.input.keyboard.on('keydown-SPACE', () => {
                if (!this.modalOpen) this.spin();
            });
        }

        this.prepareFinalGrid();
        this.showStaticGrid();
        this.updateTexts();
    }

    /* ---------- Utilidades ---------- */

    t(ms) {
        return this.turbo ? Math.round(ms * 0.5) : ms;
    }

    wait(ms) {
        return new Promise(resolve => {
            this.time.delayedCall(this.t(ms), resolve);
        });
    }

    get baseBet() {
        return BET_LEVELS[this.betIndex];
    }

    get totalBet() {
        return this.anteEnabled
            ? Math.round(this.baseBet * ANTE_MULTIPLIER)
            : this.baseBet;
    }

    coinRain(count = 40, depth = 142) {
        for (let i = 0; i < count; i++) {
            const coin = this.add.text(
                Phaser.Math.Between(20, 940),
                -30,
                '🪙',
                { fontSize: `${Phaser.Math.Between(24, 44)}px` }
            ).setDepth(depth);

            this.tweens.add({
                targets: coin,
                y: 660,
                angle: Phaser.Math.Between(-180, 180),
                duration: Phaser.Math.Between(1100, 2200),
                delay: Phaser.Math.Between(0, 1200),
                onComplete: () => coin.destroy()
            });
        }
    }

    async showBanner(text, color = '#ffd166', duration = 1800, depth = 130) {
        const banner = this.add.text(480, 300, text, {
            fontFamily: 'Arial',
            fontSize: '46px',
            color,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(depth).setScale(0);

        sfx.bonus();

        this.tweens.add({
            targets: banner,
            scale: 1,
            duration: 350,
            ease: 'Back.easeOut'
        });

        await this.wait(duration);

        this.tweens.add({
            targets: banner,
            alpha: 0,
            duration: 250,
            onComplete: () => banner.destroy()
        });

        await this.wait(250);
    }

    /* ---------- Interfaz ---------- */

    createJackpotPanel() {
        this.jackpotTexts = {};

        const entries = [
            { key: 'MEGA', label: 'MEGA', color: '#ffd166', labelY: 112 },
            { key: 'MAYOR', label: 'MAYOR', color: '#ef476f', labelY: 185 },
            { key: 'MENOR', label: 'MENOR', color: '#4cc9f0', labelY: 258 }
        ];

        entries.forEach(entry => {
            this.add.text(102, entry.labelY, entry.label, {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: entry.color,
                fontStyle: 'bold'
            }).setOrigin(0.5);

            const box = this.add.rectangle(102, entry.labelY + 30, 164, 34, 0x000000, 0.8);
            box.setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(entry.color).color);

            this.jackpotTexts[entry.key] = this.add.text(102, entry.labelY + 30, '', {
                fontFamily: 'Arial',
                fontSize: '17px',
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);
        });
    }

    createWinList() {
        this.add.text(860, 112, 'COMBINACIONES', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#aaaaaa',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.winListText = this.add.text(772, 130, '', {
            fontFamily: 'Arial',
            fontSize: '13px',
            color: '#ffffff',
            lineSpacing: 3,
            wordWrap: { width: 175 }
        }).setOrigin(0, 0);
    }

    createReels() {
        this.reels = [];

        for (let col = 0; col < COLS; col++) {
            const x = GRID_START_X + col * CELL_WIDTH;

            for (let row = 0; row < ROWS; row++) {
                const background = this.add.rectangle(
                    x,
                    GRID_START_Y + row * CELL_HEIGHT,
                    CELL_WIDTH - 8,
                    CELL_HEIGHT - 8,
                    0x1d3557
                );

                background.setStrokeStyle(3, 0x457b9d);
                background.setDepth(-1);
            }

            const maskShape = this.make.graphics({ x: 0, y: 0 }, false);
            maskShape.fillStyle(0xffffff);
            maskShape.fillRect(
                x - CELL_WIDTH / 2 + 4,
                GRID_START_Y - CELL_HEIGHT / 2 + 4,
                CELL_WIDTH - 8,
                CELL_HEIGHT * ROWS - 8
            );

            const container = this.add.container(x, 0);
            container.setMask(maskShape.createGeometryMask());

            const pool = [];

            for (let k = 0; k < ROWS + 1; k++) {
                const text = this.add.text(0, 0, '', { fontSize: '42px' }).setOrigin(0.5);
                container.add(text);
                pool.push(text);
            }

            const reel = {
                container,
                pool,
                strip: [],
                scroll: 0,
                renderStrip: () => {
                    const base = Math.floor(reel.scroll);

                    for (let k = 0; k < pool.length; k++) {
                        const j = base + k;

                        pool[k].setText(reel.strip[j] ?? '');
                        pool[k].y = GRID_START_Y + (j - reel.scroll) * CELL_HEIGHT;
                    }
                }
            };

            this.reels.push(reel);
        }
    }

    createBetControls() {
        this.add.text(215, 425, 'Apuesta:', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff'
        }).setOrigin(1, 0.5);

        makeButton(this, 255, 425, 50, 38, '-', '#457b9d', () => this.changeBet(-1), 18);

        this.betValueText = this.add.text(335, 425, '', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#ffd166',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        makeButton(this, 415, 425, 50, 38, '+', '#457b9d', () => this.changeBet(1), 18);

        this.anteButton = makeButton(this, 510, 425, 100, 38, 'ANTE OFF', '#6c757d', () => {
            this.toggleAnte();
        }, 16);

        makeButton(this, 760, 425, 200, 38, 'COMPRAR BONUS', '#6a4c93', () => {
            this.openBuyMenu();
        }, 16);

        this.add.text(30, 425, 'Ante +25%:\nmás 🃏 y 💎', {
            fontFamily: 'Arial',
            fontSize: '13px',
            color: '#aaaaaa'
        }).setOrigin(0, 0.5);
    }

    createAutoControls() {
        this.add.text(30, 475, 'Autoplay:', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff'
        }).setOrigin(0, 0.5);

        ['∞', '5', '10', '20', '50', '100', '200'].forEach((label, index) => {
            makeButton(this, 160 + index * 66, 475, 58, 36, label, '#2a9d8f', () => {
                this.startAutoSpin(index);
            }, 17);
        });

        this.autoInfoText = this.add.text(630, 475, '', {
            fontFamily: 'Arial',
            fontSize: '17px',
            color: '#ffd166',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        makeButton(this, 890, 475, 90, 36, 'PARAR', '#e63946', () => this.stopAutoSpin(), 16);
    }

    createMainButtons() {
        makeButton(this, 90, 532, 150, 44, 'VOLVER', '#457b9d', () => {
            if (this.busy) return;
            this.scene.start('MenuScene');
        }, 18);

        makeButton(this, 255, 532, 150, 44, 'TABLA', '#6c757d', () => {
            this.showPaytable();
        }, 18);

        this.soundButton = makeButton(this, 420, 532, 150, 44, '', '#6c757d', () => {
            sfx.toggleMute();
            sfx.click();
            this.updateTexts();
        }, 17);

        this.turboButton = makeButton(this, 585, 532, 150, 44, '', '#6c757d', () => {
            this.turbo = !this.turbo;
            this.updateTexts();
        }, 17);

        makeButton(this, 810, 532, 260, 54, 'GIRAR', '#e63946', () => this.spin(), 26);
    }

    /* ---------- Apuestas y autoplay ---------- */

    changeBet(direction) {
        if (this.busy) return;

        this.betIndex = Phaser.Math.Clamp(
            this.betIndex + direction,
            0,
            BET_LEVELS.length - 1
        );

        sfx.click();
        this.updateTexts();
    }

    toggleAnte() {
        if (this.busy) return;

        this.anteEnabled = !this.anteEnabled;
        sfx.click();
        this.updateTexts();
    }

    startAutoSpin(optionIndex) {
        if (this.busy) return;

        const spins = AUTO_SPIN_OPTIONS[optionIndex];

        this.autoMode = true;
        this.autoSpinsLeft = spins === 0 ? Infinity : spins;

        this.autoInfoText.setText(
            spins === 0 ? 'AUTO: continuo' : `AUTO: ${spins} tiradas`
        );

        this.spin();
    }

    stopAutoSpin() {
        this.autoMode = false;
        this.autoSpinsLeft = 0;
        this.autoInfoText.setText('AUTO detenido');
    }

    /* ---------- Rodillos ---------- */

    prepareFinalGrid() {
        this.grid = [];

        for (let row = 0; row < ROWS; row++) {
            this.grid[row] = [];

            for (let col = 0; col < COLS; col++) {
                this.grid[row][col] = randomSymbol(col, this.anteEnabled);
            }
        }
    }

    showStaticGrid() {
        this.reels.forEach((reel, col) => {
            reel.strip = [];

            for (let row = 0; row < ROWS; row++) {
                reel.strip.push(this.grid[row][col]);
            }

            reel.scroll = 0;
            reel.renderStrip();
        });
    }

    resetEffects() {
        this.hlGraphics.clear();
        this.winListText.setText('');

        this.reels.forEach(reel => {
            reel.pool.forEach(text => {
                this.tweens.killTweensOf(text);
                text.setScale(1);
                text.setAngle(0);
                text.setAlpha(1);
            });
        });
    }

    computeReelDurations() {
        const speed = this.turbo ? 0.45 : 1;

        const jokerPresent = [];
        const bellPresent = [];

        for (let col = 0; col < COLS; col++) {
            const column = this.grid.map(row => row[col]);

            jokerPresent.push(column.includes(SYM.JOKER));
            bellPresent.push(column.includes(SYM.BELL) || column.includes(SYM.WILD));
        }

        const durations = [];
        let extra = 0;
        let anticipation = false;

        for (let col = 0; col < COLS; col++) {
            let anticipate = false;

            if (col >= 2 && jokerPresent.slice(0, col).every(Boolean)) anticipate = true;
            if (col >= 3 && bellPresent.slice(0, col).every(Boolean)) anticipate = true;

            if (anticipate && !this.turbo) {
                extra += 650;
                anticipation = true;
            }

            durations.push(900 * speed + col * 260 * speed + extra);
        }

        return { durations, anticipation };
    }

    animateReels(previousGrid) {
        return new Promise(resolve => {
            const { durations, anticipation } = this.computeReelDurations();

            if (anticipation) {
                this.resultText.setText('¡¡CASI!!');
                this.resultText.setColor('#ffd166');
            }

            sfx.spin();

            let stopped = 0;

            this.reels.forEach((reel, col) => {
                const extraCount = Math.round(8 + durations[col] / 90);
                const strip = [];

                for (let row = 0; row < ROWS; row++) {
                    strip.push(this.grid[row][col]);
                }

                for (let i = 0; i < extraCount; i++) {
                    strip.push(randomSymbol(col, this.anteEnabled));
                }

                for (let row = 0; row < ROWS; row++) {
                    strip.push(previousGrid[row][col]);
                }

                reel.strip = strip;
                reel.scroll = strip.length - ROWS;
                reel.renderStrip();

                this.tweens.add({
                    targets: reel,
                    scroll: 0,
                    duration: durations[col],
                    ease: 'Cubic.easeOut',
                    onUpdate: () => reel.renderStrip(),
                    onComplete: () => {
                        reel.scroll = 0;
                        reel.renderStrip();

                        sfx.stop();
                        this.cameras.main.shake(60, 0.0015);

                        stopped++;

                        if (stopped === COLS) {
                            this.resultText.setText('');
                            resolve();
                        }
                    }
                });
            });
        });
    }

    /* ---------- Tirada ---------- */

    async spin() {
        if (this.busy || this.modalOpen) return;

        const isFree = this.freeSpins > 0;

        if (!isFree && !canBet(this.totalBet)) {
            this.resultText.setText('No tienes saldo suficiente');
            this.resultText.setColor('#ff6b6b');
            this.stopAutoSpin();
            return;
        }

        this.busy = true;
        this.resultText.setText('');
        this.resultText.setColor('#7CFC00');
        this.resetEffects();

        if (isFree) {
            this.freeSpins--;
            registerFreeRound();
        } else {
            placeBet(this.totalBet);
        }

        if (this.autoMode && this.autoSpinsLeft !== Infinity) {
            this.autoSpinsLeft--;
        }

        this.updateTexts();

        const previousGrid = this.grid.map(row => [...row]);

        this.prepareFinalGrid();
        this.pendingResult = evaluateWays(this.grid);

        await this.animateReels(previousGrid);
        await this.resolveSpin(isFree);

        this.busy = false;
        this.updateTexts();
        this.scheduleNext();
    }

    scheduleNext() {
        if (this.freeSpins > 0) {
            this.time.delayedCall(this.t(900), () => this.spin());
            return;
        }

        if (!this.autoMode) return;

        if (this.autoSpinsLeft !== Infinity && this.autoSpinsLeft <= 0) {
            this.stopAutoSpin();
            this.autoInfoText.setText('AUTO completado');
            return;
        }

        this.time.delayedCall(this.t(700), () => this.spin());
    }

    async resolveSpin(isFree) {
        const ev = this.pendingResult;

        let mult = 1;

        if (isFree) mult *= this.freeSpinMult;

        if (this.wheelMult.left > 0) {
            mult *= this.wheelMult.value;
            this.wheelMult.left--;

            if (this.wheelMult.left === 0) this.wheelMult.value = 1;
        }

        const scatterMultiplier = ev.scatterCount >= 3
            ? SCATTER_PAYS[Math.min(ev.scatterCount, 5)]
            : 0;

        const rawMultiplier = ev.totalMultiplier + scatterMultiplier;

        const totalWin = rawMultiplier > 0
            ? Math.max(1, Math.round(rawMultiplier * this.totalBet * mult))
            : 0;

        // Lista de combinaciones
        const lines = ev.wins.slice(0, 7).map(win => {
            const amount = Math.max(1, Math.round(win.multiplier * this.totalBet * mult));
            const waysLabel = win.ways === 1 ? 'forma' : 'formas';

            return `${win.symbol} ×${win.length}  (${win.ways} ${waysLabel})\n    = ${formatEuros(amount)}`;
        });

        if (ev.wins.length > 7) {
            lines.push(`+${ev.wins.length - 7} más`);
        }

        if (scatterMultiplier > 0) {
            lines.push(`${SYM.SCATTER} ×${ev.scatterCount}\n    = ${formatEuros(Math.max(1, Math.round(scatterMultiplier * this.totalBet * mult)))}`);
        }

        this.winListText.setText(lines.join('\n'));

        console.table(this.grid);
        console.log('Combinaciones:', ev.wins, 'Scatters:', ev.scatterCount, 'Jokers seguidos:', ev.jokerChain);

        // Celdas a resaltar
        const cells = [];
        ev.wins.forEach(win => cells.push(...win.cells));

        if (ev.scatterCount >= 3) cells.push(...ev.scatterCells);
        if (!isFree && ev.jokerChain >= 3) cells.push(...ev.jokerCells);

        if (cells.length > 0) this.highlight(cells);

        if (totalWin > 0) {
            payWin(totalWin);

            const combos = ev.wins.length;
            const comboText = combos > 0
                ? `${combos} ${combos === 1 ? 'combinación' : 'combinaciones'}${mult > 1 ? ` · ×${mult}` : ''} | `
                : '';

            await this.celebrate(totalWin, `${comboText}Premio: `);
        } else {
            this.resultText.setText(isFree ? 'Tirada gratis sin premio' : 'Sin premio');
            this.resultText.setColor('#aaaaaa');
            await this.wait(250);
        }

        // Multiplicador progresivo de las tiradas gratis
        if (isFree) {
            this.freeSpinTotal += totalWin;

            if (totalWin > 0) {
                this.freeSpinMult = Math.min(FREE_MULT_CAP, this.freeSpinMult + 1);
            }
        }

        // Funciones especiales (no se activan jokers ni ruleta durante tiradas gratis)
        if (!isFree) {
            for (let i = 0; i < ev.wheelSpins; i++) {
                await this.showBanner(
                    ev.wheelSpins === 2 && i === 0
                        ? '¡RULETA DE LA SUERTE!\n¡2 GIROS!'
                        : '¡RULETA DE LA SUERTE!',
                    '#ff9f1c',
                    1500
                );
                await this.runWheel();
            }

            if (ev.jokerChain >= 3) {
                const spins = BONUS_SPINS[Math.min(ev.jokerChain, 5)];
                await this.runBonus(spins);
            }
        }

        if (ev.scatterCount >= 3) {
            const count = FREE_SPINS[Math.min(ev.scatterCount, 5)];
            await this.awardFreeSpins(count, `${ev.scatterCount} SCATTERS`);
        }

        // Fin de las tiradas gratis
        if (this.inFreeMode && this.freeSpins === 0) {
            const total = this.freeSpinTotal;

            this.inFreeMode = false;
            this.freeSpinTotal = 0;
            this.freeSpinMult = 1;

            await this.showBanner(
                `TIRADAS GRATIS TERMINADAS\n${formatEuros(total)}`,
                '#7CFC00',
                2200
            );
        }
    }

    async awardFreeSpins(count, label) {
        if (!this.inFreeMode) {
            this.inFreeMode = true;
            this.freeSpinTotal = 0;
            this.freeSpinMult = 1;
        }

        this.freeSpins += count;
        this.updateTexts();

        await this.showBanner(`${label}\n+${count} TIRADAS GRATIS`, '#ffd166', 1800);
    }

    /* ---------- Minijuegos ---------- */

    async runBonus(spins) {
        const bonus = new BonusGame(this, { spins, bet: this.totalBet });
        await bonus.run();
        this.updateTexts();
    }

    async runWheel() {
        const wheel = new WheelGame(this, { bet: this.totalBet });
        const result = await wheel.run();

        if (result.kind === 'cash' || result.kind === 'jackpot') {
            const amount = Math.max(1, Math.round(result.value * this.totalBet));
            payWin(amount);

            await this.celebrate(
                amount,
                result.kind === 'jackpot' ? `JACKPOT ${result.name}: ` : 'Ruleta: ',
                result.kind === 'jackpot' ? 3 : null
            );
        }

        if (result.kind === 'mult') {
            this.wheelMult = { value: result.value, left: result.spins };
            this.updateTexts();

            await this.showBanner(
                `MULTIPLICADOR ×${result.value}\nen tus próximas ${result.spins} tiradas`,
                '#ff9f1c',
                2000
            );
        }

        if (result.kind === 'free') {
            await this.awardFreeSpins(result.spins, 'RULETA');
        }
    }

    async openBuyMenu() {
        if (this.busy || this.modalOpen) return;

        this.modalOpen = true;
        const objects = [];

        const close = () => {
            objects.forEach(object => object.destroy());
            this.modalOpen = false;
        };

        const dim = this.add.rectangle(480, 310, 960, 620, 0x000000, 0.75).setDepth(170);
        dim.setInteractive();

        const panel = this.add.rectangle(480, 310, 560, 400, 0x0b1220, 0.98).setDepth(171);
        panel.setStrokeStyle(4, 0xffd166);

        const title = this.add.text(480, 150, 'COMPRAR BONUS', {
            fontFamily: 'Arial',
            fontSize: '34px',
            color: '#ffd166',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(172);

        const subtitle = this.add.text(480, 190, 'Entras directamente en el minijuego de placas', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#aaaaaa'
        }).setOrigin(0.5).setDepth(172);

        objects.push(dim, panel, title, subtitle);

        [10, 20, 50].forEach((spins, index) => {
            const cost = Math.round(BONUS_BUY_PRICES[spins] * this.totalBet);

            const button = makeButton(
                this,
                480,
                245 + index * 62,
                440,
                50,
                `${spins} TIRADAS · ${formatEuros(cost)}`,
                '#6a4c93',
                async () => {
                    close();

                    if (!canBet(cost)) {
                        this.resultText.setText('No tienes saldo suficiente');
                        this.resultText.setColor('#ff6b6b');
                        return;
                    }

                    this.busy = true;
                    this.resetEffects();
                    placeBet(cost);
                    this.updateTexts();

                    await this.runBonus(spins);

                    this.busy = false;
                    this.updateTexts();
                },
                20
            );

            button.setDepth(172);
            objects.push(button);
        });

        const cancel = makeButton(this, 480, 450, 220, 44, 'CANCELAR', '#e63946', close, 18);
        cancel.setDepth(172);
        objects.push(cancel);
    }

    showPaytable() {
        if (this.modalOpen) return;

        this.modalOpen = true;
        const objects = [];

        const close = () => {
            objects.forEach(object => object.destroy());
            this.modalOpen = false;
        };

        const dim = this.add.rectangle(480, 310, 960, 620, 0x000000, 0.8).setDepth(170);
        dim.setInteractive();

        const panel = this.add.rectangle(480, 310, 760, 500, 0x0b1220, 0.98).setDepth(171);
        panel.setStrokeStyle(4, 0xffd166);

        const lines = [
            'PREMIO = multiplicador × apuesta total, por cada forma',
            ''
        ];

        PAYING_SYMBOLS.forEach(symbol => {
            const pay = PAYTABLE[symbol];
            lines.push(`${symbol}    3 → ×${pay[3]}      4 → ×${pay[4]}      5 → ×${pay[5]}`);
        });

        lines.push(
            '',
            `${SYM.WILD} Comodín (columnas 2, 3 y 4): sustituye a las figuras`,
            `${SYM.SCATTER} 3/4/5 scatters: ×${SCATTER_PAYS[3]}/×${SCATTER_PAYS[4]}/×${SCATTER_PAYS[5]} y ${FREE_SPINS[3]}/${FREE_SPINS[4]}/${FREE_SPINS[5]} tiradas gratis`,
            `${SYM.JOKER} 3/4/5 jokers seguidos desde la izquierda: bonus de ${BONUS_SPINS[3]}/${BONUS_SPINS[4]}/${BONUS_SPINS[5]} tiradas`,
            `${SYM.BELL} ${WHEEL_MIN_BELLS}+ campanas seguidas: ruleta (5 campanas = 2 giros)`,
            `Jackpots de la ruleta: MENOR ×${JACKPOTS.MENOR} · MAYOR ×${JACKPOTS.MAYOR} · MEGA ×${JACKPOTS.MEGA}`,
            '',
            'Se gana con 3 o más símbolos seguidos desde la izquierda.',
            'Cada símbolo extra en una columna multiplica las formas.'
        );

        const text = this.add.text(480, 300, lines.join('\n'), {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ffffff',
            lineSpacing: 6,
            align: 'left'
        }).setOrigin(0.5).setDepth(172);

        const button = makeButton(this, 480, 535, 200, 40, 'CERRAR', '#e63946', close, 18);
        button.setDepth(172);

        objects.push(dim, panel, text, button);
    }

    /* ---------- Efectos de premio ---------- */

    highlight(cells) {
        this.hlGraphics.clear();
        this.hlGraphics.lineStyle(3, 0xffd166, 1);

        cells.forEach(({ row, col }) => {
            const x = GRID_START_X + col * CELL_WIDTH;
            const y = GRID_START_Y + row * CELL_HEIGHT;

            this.hlGraphics.strokeRoundedRect(
                x - CELL_WIDTH / 2 + 5,
                y - CELL_HEIGHT / 2 + 5,
                CELL_WIDTH - 10,
                CELL_HEIGHT - 10,
                8
            );

            this.tweens.add({
                targets: this.reels[col].pool[row],
                scale: { from: 1, to: 1.25 },
                angle: { from: -5, to: 5 },
                duration: 160,
                yoyo: true,
                repeat: 4,
                ease: 'Sine.easeInOut'
            });
        });
    }

    countUp(amount, prefix, duration = 700) {
        return new Promise(resolve => {
            const counter = { v: 0 };

            this.tweens.add({
                targets: counter,
                v: amount,
                duration: this.t(duration),
                ease: 'Cubic.easeOut',
                onUpdate: () => {
                    this.resultText.setText(`${prefix}${formatEuros(Math.round(counter.v))}`);
                },
                onComplete: () => {
                    this.resultText.setText(`${prefix}${formatEuros(amount)}`);
                    resolve();
                }
            });
        });
    }

    async celebrate(amount, prefix, forcedLevel = null) {
        const ratio = amount / this.totalBet;

        let level = ratio >= 50 ? 3 : ratio >= 25 ? 2 : ratio >= 10 ? 1 : 0;

        if (forcedLevel !== null) level = forcedLevel;

        this.resultText.setColor('#7CFC00');

        if (level === 0) {
            sfx.win(ratio >= 3 ? 2 : 1);
            await this.countUp(amount, prefix, 600);
            await this.wait(450);
            return;
        }

        const titles = ['', 'BIG WIN', 'MEGA WIN', 'SUPER WIN'];
        const colors = ['', '#ffd166', '#ff9f1c', '#ef476f'];

        const dim = this.add.rectangle(480, 310, 960, 540, 0x000000, 0.65).setDepth(140);

        const title = this.add.text(480, 230, titles[level], {
            fontFamily: 'Arial',
            fontSize: '72px',
            color: colors[level],
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 10
        }).setOrigin(0.5).setDepth(141).setScale(0);

        const amountText = this.add.text(480, 330, formatEuros(0), {
            fontFamily: 'Arial',
            fontSize: '58px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5).setDepth(141);

        this.tweens.add({
            targets: title,
            scale: 1,
            duration: 450,
            ease: 'Back.easeOut'
        });

        this.coinRain(30 + level * 20);
        sfx.bigWin();

        await new Promise(resolve => {
            const counter = { v: 0 };

            this.tweens.add({
                targets: counter,
                v: amount,
                duration: this.t(1800 + level * 700),
                ease: 'Cubic.easeOut',
                onUpdate: () => amountText.setText(formatEuros(Math.round(counter.v))),
                onComplete: () => {
                    amountText.setText(formatEuros(amount));
                    resolve();
                }
            });
        });

        this.resultText.setText(`${prefix}${formatEuros(amount)}`);

        await this.wait(1200);

        dim.destroy();
        title.destroy();
        amountText.destroy();
    }

    /* ---------- Textos ---------- */

    updateTexts() {
        this.betValueText.setText(formatEuros(this.baseBet));

        this.betText.setText(
            this.anteEnabled
                ? `Apuesta total: ${formatEuros(this.totalBet)} (Ante activado)`
                : `Apuesta total: ${formatEuros(this.totalBet)}`
        );

        this.anteButton.list[0].fillColor = this.anteEnabled ? 0x2a9d8f : 0x6c757d;
        this.anteButton.list[1].setText(this.anteEnabled ? 'ANTE ON' : 'ANTE OFF');

        this.soundButton.list[1].setText(sfx.isMuted() ? 'SONIDO OFF' : 'SONIDO ON');
        this.turboButton.list[1].setText(this.turbo ? 'TURBO ON' : 'TURBO OFF');
        this.turboButton.list[0].fillColor = this.turbo ? 0x2a9d8f : 0x6c757d;

        this.jackpotTexts.MEGA.setText(formatEuros(Math.round(JACKPOTS.MEGA * this.totalBet)));
        this.jackpotTexts.MAYOR.setText(formatEuros(Math.round(JACKPOTS.MAYOR * this.totalBet)));
        this.jackpotTexts.MENOR.setText(formatEuros(Math.round(JACKPOTS.MENOR * this.totalBet)));

        const parts = [];

        if (this.freeSpins > 0 || this.inFreeMode) {
            parts.push(`GRATIS ${this.freeSpins} · ×${this.freeSpinMult}`);
        }

        if (this.wheelMult.left > 0) {
            parts.push(`RULETA ×${this.wheelMult.value} (${this.wheelMult.left})`);
        }

        this.statusText.setText(parts.join('   '));

        if (this.autoMode && this.autoSpinsLeft !== Infinity) {
            this.autoInfoText.setText(`AUTO: ${this.autoSpinsLeft} restantes`);
        }
    }
}