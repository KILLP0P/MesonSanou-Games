import './features.js';

import SlotsScene from '../scenes/SlotsScene.js';

import {
    state,
    getSession,
    addBalance,
    formatEuros
} from '../state.js';

import { makeButton } from '../ui.js';
import { sfx } from '../sfx.js';
import { SYM, evaluateWays } from './config.js';

const p = SlotsScene.prototype;
const STORAGE_KEY = 'casino-games-last-slot-rounds-v1';
const MAX_ROUNDS = 20;

function readRounds() {
    try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(value) ? value.slice(0, MAX_ROUNDS) : [];
    } catch {
        return [];
    }
}

function saveRounds(rounds) {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(rounds.slice(0, MAX_ROUNDS))
    );
}

function signedEuros(amount) {
    return `${amount > 0 ? '+' : ''}${formatEuros(amount)}`;
}

function snapshotSession() {
    const session = getSession();

    if (!session) return null;

    return {
        reference: session,
        wagered: session.wagered,
        won: session.won,
        rounds: session.rounds,
        biggestWin: session.biggestWin,
        lastPrizes: [...session.lastPrizes]
    };
}

function restoreSession(snapshot) {
    if (!snapshot || getSession() !== snapshot.reference) return;

    Object.assign(snapshot.reference, {
        wagered: snapshot.wagered,
        won: snapshot.won,
        rounds: snapshot.rounds,
        biggestWin: snapshot.biggestWin,
        lastPrizes: [...snapshot.lastPrizes]
    });
}

function makeModal(scene, title) {
    const previousModal = scene.modalOpen;

    scene.modalOpen = true;

    const root = scene.add.container(0, 0).setDepth(200);

    root.add(
        scene.add.rectangle(480, 310, 960, 620, 0x000000, 0.94)
            .setInteractive()
    );

    const panel = scene.add.rectangle(480, 310, 930, 580, 0x101820);
    panel.setStrokeStyle(3, 0xffd166);
    root.add(panel);

    root.add(
        scene.add.text(480, 55, title, {
            fontFamily: 'Arial',
            fontSize: '28px',
            color: '#ffd166',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5)
    );

    let closed = false;

    return {
        root,

        close() {
            if (closed) return;
            closed = true;

            root.destroy(true);
            scene.modalOpen = previousModal;
        }
    };
}

function modalText(scene, root, x, y, text, size = 18, color = '#ffffff') {
    const object = scene.add.text(x, y, text, {
        fontFamily: 'Arial',
        fontSize: `${size}px`,
        color,
        align: 'center',
        wordWrap: { width: 860 }
    }).setOrigin(0.5);

    root.add(object);
    return object;
}

function modalButton(scene, root, x, y, width, label, callback, color = '#457b9d') {
    const button = makeButton(
        scene, x, y, width, 38, label, color, callback, 16
    );

    root.add(button);
    return button;
}

/* ---------- Inicialización ---------- */

const previousCreate = p.create;

p.create = function () {
    previousCreate.call(this);

    this.roundHistory = readRounds();
    this.roundBreakdown = [];
    this.recordingRound = false;

    this.debugRunning = false;
    this.startedSlotAt = Date.now();
    this.slotEntryBalance = state.balance;

    this.activeRoundRecord = null;
    this.lastRoundNet = null;
    this.sessionExtras = [];

    // Los botones de features y ADMIN se reconstruyen sin duplicados.
    for (const object of [...this.children.list]) {
        if (
            object.type === 'Container' &&
            object.y === 565 &&
            (object.x === 760 || object.x === 890)
        ) {
            object.destroy(true);
        }
    }

    this.add.rectangle(480, 564, 960, 30, 0x000000, 0.9)
        .setDepth(103);

    this.netRoundText = this.add.text(
        15, 564, 'ÚLTIMA TIRADA: —',
        {
            fontFamily: 'Arial',
            fontSize: '13px',
            color: '#cccccc',
            fontStyle: 'bold'
        }
    ).setOrigin(0, 0.5).setDepth(104);

    this.debugBadge = this.add.text(
        480, 45, 'ADMIN · SALDO Y ESTADÍSTICAS DE PRUEBA',
        {
            fontFamily: 'Arial',
            fontSize: '13px',
            color: '#ff9f1c',
            backgroundColor: '#27172e',
            padding: { x: 12, y: 3 }
        }
    ).setOrigin(0.5).setDepth(190).setVisible(false);

    makeButton(
        this, 590, 564, 170, 24,
        'ÚLTIMAS 20',
        '#457b9d',
        () => this.showRoundHistory(),
        12
    ).setDepth(104);

    makeButton(
        this, 770, 564, 160, 24,
        'PRUEBA 5×10',
        '#79502c',
        async () => {
            if (!this.authorizeDebug()) return;

            await this.runDebugSafely(
                'TESORO 5×10',
                () => this.runBonus(50)
            );
        },
        12
    ).setDepth(104);

    makeButton(
        this, 910, 564, 90, 24,
        'ADMIN',
        '#713c65',
        () => this.openDebug(),
        12
    ).setDepth(104);

    // Intercepta VOLVER para mostrar primero el resumen.
    const originalStart = this.scene.start.bind(this.scene);

    this.scene.start = (key, data) => {
        if (
            key === 'MenuScene' &&
            this.alive &&
            !this.allowMenuExit
        ) {
            if (this.busy || this.modalOpen) return this.scene;

            this.showExitSummary(() => {
                this.allowMenuExit = true;
                originalStart(key, data);
            });

            return this.scene;
        }

        return originalStart(key, data);
    };

    this.events.once('shutdown', () => {
        this.scene.start = originalStart;
    });
};

/* ---------- Registro de evaluaciones y cascadas ---------- */

const previousHighlight = p.highlight;

p.highlight = function (cells) {
    previousHighlight.call(this, cells);

    if (!this.recordingRound || this.debugRunning) return;

    const result = evaluateWays(this.grid);

    if (result.wins.length === 0) return;

    const cascade = this.roundBreakdown.length + 1;

    this.roundBreakdown.push({
        cascade,
        wins: result.wins.map(win => ({
            symbol: win.symbol,
            columns: win.length,
            ways: win.ways
        }))
    });

    this.winListText.setText(
        this.roundBreakdown.flatMap(step => [
            `CASCADA ${step.cascade}`,
            ...step.wins.map(win =>
                `${win.symbol} ${win.columns} columnas\n` +
                `${win.ways} ${win.ways === 1 ? 'forma' : 'formas'}`
            )
        ]).slice(-18).join('\n')
    );
};

/* ---------- Registro de tiradas ---------- */

const previousSpin = p.spin;

p.spin = async function () {
    if (
        this.busy ||
        this.modalOpen ||
        !this.alive
    ) {
        return;
    }

    const before = snapshotSession();
    const startBalance = state.balance;
    const free = this.freeSpins > 0;

    this.roundBreakdown = [];
    this.recordingRound = !this.debugRunning;

    const startedAt = Date.now();

    try {
        await previousSpin.call(this);
    } finally {
        this.recordingRound = false;
    }

    if (this.debugRunning || !before) return;

    const session = getSession();

    if (!session || session !== before.reference) return;

    const roundsAdded = session.rounds - before.rounds;

    if (roundsAdded <= 0) return;

    const cost = session.wagered - before.wagered;
    const prizes = session.won - before.won;
    const net = prizes - cost;

    const record = {
        id: `${startedAt}-${Math.random().toString(36).slice(2, 8)}`,
        startedAt,
        endedAt: Date.now(),
        type: free ? 'GRATIS' : 'NORMAL',
        cost,
        prizes,
        net,
        startBalance,
        endBalance: state.balance,
        cascades: this.roundBreakdown.map(step => ({
            cascade: step.cascade,
            wins: step.wins.map(win => ({ ...win }))
        })),
        includesFeatures: true
    };

    this.roundHistory.unshift(record);
    this.roundHistory = this.roundHistory.slice(0, MAX_ROUNDS);
    saveRounds(this.roundHistory);

    this.lastRoundNet = net;
    this.activeRoundRecord = record;

    this.netRoundText.setText(
        `COBRADO ${formatEuros(prizes)} · NETO ${signedEuros(net)}`
    );

    this.netRoundText.setColor(
        net > 0 ? '#7CFC00' :
            net < 0 ? '#ff6b6b' :
                '#cccccc'
    );
};

/* ---------- Historial de últimas 20 tiradas ---------- */

p.showRoundHistory = function () {
    if (this.busy || this.modalOpen) return;

    this.stopAutoSpin();

    const modal = makeModal(this, 'ÚLTIMAS 20 TIRADAS · SLOT');

    let page = 0;
    const pageSize = 6;
    let content = null;

    const render = () => {
        if (content) content.destroy(true);

        content = this.add.container(0, 0);
        modal.root.add(content);

        const records = readRounds();
        const pages = Math.max(1, Math.ceil(records.length / pageSize));

        page = Math.max(0, Math.min(page, pages - 1));

        modalText(
            this, content, 480, 93,
            'Premios = importe cobrado. Neto = premios menos apuesta.\n' +
            'Incluye bonus y ruleta activados dentro de cada tirada.',
            14, '#aaaaaa'
        );

        if (records.length === 0) {
            modalText(
                this, content, 480, 265,
                'Todavía no hay tiradas registradas.', 21
            );
        }

        records.slice(
            page * pageSize,
            page * pageSize + pageSize
        ).forEach((record, index) => {
            const y = 145 + index * 53;

            const date = new Date(record.startedAt).toLocaleTimeString(
                'es-ES',
                { hour: '2-digit', minute: '2-digit', second: '2-digit' }
            );

            const label =
                `${date} · ${record.type} · ` +
                `Apuesta ${formatEuros(record.cost)} · ` +
                `Cobrado ${formatEuros(record.prizes)} · ` +
                `Neto ${signedEuros(record.net)}`;

            modalText(
                this, content, 425, y,
                label, 15,
                record.net > 0 ? '#7CFC00' :
                    record.net < 0 ? '#ff6b6b' :
                        '#ffffff'
            );

            modalButton(
                this, content, 855, y, 110,
                'DETALLE',
                () => {
                    modal.close();
                    this.showRoundDetail(record);
                }
            );
        });

        modalText(
            this, content, 480, 490,
            `Página ${page + 1}/${pages}`, 17
        );

        modalButton(
            this, content, 280, 490, 140,
            'ANTERIOR',
            () => {
                page--;
                render();
            }
        );

        modalButton(
            this, content, 680, 490, 140,
            'SIGUIENTE',
            () => {
                page++;
                render();
            }
        );
    };

    render();

    modalButton(
        this, modal.root, 480, 550, 240,
        'CERRAR',
        () => modal.close(),
        '#e63946'
    );
};

p.showRoundDetail = function (record) {
    const modal = makeModal(this, 'DETALLE DE LA TIRADA');

    const details = record.cascades.flatMap(step => [
        `Cascada ${step.cascade}:`,
        ...step.wins.map(win =>
            `${win.symbol} en ${win.columns} columnas consecutivas · ` +
            `${win.ways} ${win.ways === 1 ? 'forma' : 'formas'}`
        )
    ]);

    const text = [
        `Tipo: ${record.type}`,
        `Apuesta: ${formatEuros(record.cost)}`,
        `Premios cobrados: ${formatEuros(record.prizes)}`,
        `Resultado neto: ${signedEuros(record.net)}`,
        `Crédito inicial: ${formatEuros(record.startBalance)}`,
        `Crédito final: ${formatEuros(record.endBalance)}`,
        '',
        ...details.slice(0, 12),
        details.length > 12 ? 'Hay más combinaciones en esta tirada.' : '',
        '',
        'Los premios de bonus y ruleta están incluidos en el total.'
    ].filter(Boolean).join('\n');

    modalText(this, modal.root, 480, 290, text, 17);

    modalButton(
        this, modal.root, 480, 550, 240,
        'VOLVER AL HISTORIAL',
        () => {
            modal.close();
            this.showRoundHistory();
        }
    );
};

/* ---------- Resumen antes de salir ---------- */

p.showExitSummary = function (onExit) {
    if (this.busy || this.modalOpen) return;

    this.stopAutoSpin();

    const session = getSession();
    const elapsedSeconds = Math.floor(
        (Date.now() - this.startedSlotAt) / 1000
    );

    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;

    const wagered = session?.wagered || 0;
    const won = session?.won || 0;
    const net = won - wagered;

    const modal = makeModal(this, 'RESUMEN DE LA SESIÓN');

    modalText(
        this, modal.root, 480, 135,
        `Duración: ${minutes} min ${seconds} s\n` +
        `Rondas contabilizadas: ${session?.rounds || 0}`,
        21
    );

    modalText(
        this, modal.root, 480, 245,
        `TOTAL APOSTADO: ${formatEuros(wagered)}\n` +
        `PREMIOS COBRADOS: ${formatEuros(won)}`,
        25, '#ffd166'
    );

    modalText(
        this, modal.root, 480, 340,
        `RESULTADO NETO: ${signedEuros(net)}`,
        31,
        net > 0 ? '#7CFC00' :
            net < 0 ? '#ff6b6b' :
                '#ffffff'
    );

    modalText(
        this, modal.root, 480, 405,
        `CRÉDITO ACTUAL: ${formatEuros(state.balance)}\n` +
        'Las pruebas ADMIN no se incluyen en estos resultados.',
        18, '#cccccc'
    );

    modalButton(
        this, modal.root, 300, 515, 280,
        'SEGUIR EN EL SLOT',
        () => {
            modal.close();
            this.scheduleNext();
        },
        '#2a9d8f'
    );

    modalButton(
        this, modal.root, 660, 515, 280,
        'SALIR Y GUARDAR SESIÓN',
        () => {
            modal.close();
            onExit();
        },
        '#457b9d'
    );
};

/* ---------- ADMIN aislado de las estadísticas normales ---------- */

p.authorizeDebug = function () {
    if (this.busy || this.modalOpen) return false;

    if (this.debugEnabled) return true;

    const code = window.prompt('ADMIN · Código de desarrollo');

    if (code !== '280816') {
        if (code !== null) window.alert('Código incorrecto.');
        return false;
    }

    this.debugEnabled = true;
    return true;
};

p.runDebugSafely = async function (label, callback, usesSpin = false) {
    if (this.busy || this.modalOpen) return;

    this.stopAutoSpin();

    const balanceBefore = state.balance;
    const sessionBefore = snapshotSession();

    const featureState = {
        freeSpins: this.freeSpins,
        freeSpinMult: this.freeSpinMult,
        inFreeMode: this.inFreeMode,
        freeSpinTotal: this.freeSpinTotal,
        wheelMult: { ...this.wheelMult }
    };

    this.debugRunning = true;
    this.debugBadge.setVisible(true);

    if (!usesSpin) {
        this.busy = true;
        this.modalOpen = true;
    }

    try {
        await callback();
    } catch (error) {
        console.error(error);
        this.resultText.setText('Error de prueba. Revisa la consola.');
    } finally {
        if (this.nextSpinTimer) {
            this.nextSpinTimer.remove(false);
            this.nextSpinTimer = null;
        }

        this.stopAutoSpin();

        const virtualPrize = state.balance - balanceBefore;

        // Devuelve el crédito real al valor anterior a la prueba.
        addBalance(balanceBefore - state.balance);
        restoreSession(sessionBefore);

        Object.assign(this, featureState);

        this.debugRunning = false;
        this.busy = false;
        this.modalOpen = false;

        this.musicController?.endResult();
        this.debugBadge.setVisible(false);

        this.updateTexts();

        this.resultText.setColor('#ff9f1c');
        this.resultText.setText(
            `PRUEBA ${label}: ${signedEuros(virtualPrize)} · NO CONTABILIZADA`
        );

        if (this.freeSpins > 0) {
            this.scheduleNext();
        }
    }
};

p.openDebug = function () {
    if (!this.authorizeDebug()) return;

    this.stopAutoSpin();

    const modal = makeModal(this, 'ADMIN · PRUEBAS AISLADAS');

    modalText(
        this, modal.root, 480, 95,
        'Al terminar cada prueba se restauran crédito y estadísticas.\n' +
        'Estas pruebas no se guardan en el historial normal.',
        15, '#ff9f1c'
    );

    const launch = (label, callback, usesSpin = false) => {
        modal.close();
        this.runDebugSafely(label, callback, usesSpin);
    };

    const force = symbol => {
        this.debugGrid = [
            [SYM.LEMON, SYM.ORANGE, SYM.GRAPES, SYM.MELON, SYM.CHERRY],
            [symbol, symbol, symbol, symbol, symbol],
            [SYM.ORANGE, SYM.GRAPES, SYM.MELON, SYM.CHERRY, SYM.LEMON]
        ];

        return this.spin();
    };

    const actions = [
        ['RULETA', () => this.runWheel(), false],
        ['PLACAS 8', () => this.runBonus(10), false],
        ['PLACAS 12', () => this.runBonus(20), false],
        ['TESORO 5×10', () => this.runBonus(50), false],
        ['5 DIAMANTES', () => force(SYM.DIAMOND), true],
        ['5 CAMPANAS', () => force(SYM.BELL), true],
        ['5 JOKERS', () => force(SYM.JOKER), true],
        ['PREMIO MÁXIMO + VÍDEO', async () => {
            const amount = Math.round(2500 * this.totalBet);

            // La celebración de prueba no necesita pagar dinero real.
            await this.celebrate(amount, 'PRUEBA: ', 3);
        }, false],
        ['PREMIO CON 777', () => this.celebrate(
            Math.round(25 * this.totalBet),
            'PRUEBA: '
        ), false],
        ['PROBAR SONIDO', async () => {
            sfx.win(3);
            await this.wait(900);
        }, false]
    ];

    actions.forEach(([label, callback, usesSpin], index) => {
        modalButton(
            this,
            modal.root,
            index % 2 ? 700 : 260,
            170 + Math.floor(index / 2) * 66,
            400,
            label,
            () => launch(label, callback, usesSpin),
            '#465b78'
        );
    });

    modalButton(
        this, modal.root, 480, 550, 240,
        'CERRAR',
        () => modal.close(),
        '#e63946'
    );
};