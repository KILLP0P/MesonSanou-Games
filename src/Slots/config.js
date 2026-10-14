import { formatEuros } from '../state.js';

export const ROWS = 3;
export const COLS = 5;

export const SYM = {
    DIAMOND: '💎',
    BELL: '🔔',
    SEVEN: '7️⃣',
    GRAPES: '🍇',
    MELON: '🍉',
    LEMON: '🍋',
    ORANGE: '🍊',
    CHERRY: '🍒',
    WILD: '🌟',
    SCATTER: '🎰',
    JOKER: '🃏'
};

export const PAYING_SYMBOLS = [
    SYM.DIAMOND, SYM.BELL, SYM.SEVEN, SYM.GRAPES,
    SYM.MELON, SYM.LEMON, SYM.ORANGE, SYM.CHERRY
];

export const BASE_WEIGHTS = {
    [SYM.DIAMOND]: 5,
    [SYM.BELL]: 7,
    [SYM.SEVEN]: 9,
    [SYM.GRAPES]: 12,
    [SYM.MELON]: 14,
    [SYM.LEMON]: 16,
    [SYM.ORANGE]: 18,
    [SYM.CHERRY]: 20
};

export const ANTE_WEIGHTS = {
    [SYM.DIAMOND]: 6,
    [SYM.BELL]: 8,
    [SYM.SEVEN]: 9,
    [SYM.GRAPES]: 12,
    [SYM.MELON]: 14,
    [SYM.LEMON]: 16,
    [SYM.ORANGE]: 18,
    [SYM.CHERRY]: 19
};

export const WILD_WEIGHT = 5;
export const WILD_COLUMNS = [1, 2, 3];
export const SCATTER_WEIGHT = 4;
export const JOKER_WEIGHT = 6;
export const JOKER_WEIGHT_ANTE = 7;

// Multiplicador de la apuesta total, POR CADA FORMA de ganar
export const PAYTABLE = {
    [SYM.CHERRY]: { 3: 0.045, 4: 0.225, 5: 1.35 },
    [SYM.ORANGE]: { 3: 0.06, 4: 0.27, 5: 1.8 },
    [SYM.LEMON]: { 3: 0.07, 4: 0.36, 5: 2.25 },
    [SYM.MELON]: { 3: 0.09, 4: 0.5, 5: 2.7 },
    [SYM.GRAPES]: { 3: 0.125, 4: 0.72, 5: 3.6 },
    [SYM.SEVEN]: { 3: 0.18, 4: 1.25, 5: 6.3 },
    [SYM.BELL]: { 3: 0.315, 4: 2.15, 5: 12.6 },
    [SYM.DIAMOND]: { 3: 0.63, 4: 3.6, 5: 25 }
};

export const SCATTER_PAYS = { 3: 2, 4: 10, 5: 50 };
export const FREE_SPINS = { 3: 8, 4: 12, 5: 20 };
export const FREE_MULT_CAP = 5;

export const BONUS_SPINS = { 3: 10, 4: 20, 5: 50 };
export const BONUS_BUY_PRICES = { 10: 25, 20: 80, 50: 350 };

export const WHEEL_MIN_BELLS = 4;

export const JACKPOTS = { MENOR: 25, MAYOR: 250, MEGA: 2500 };

export const WHEEL_SEGMENTS = [
    { short: '5×', kind: 'cash', value: 5, weight: 20 },
    { short: '×2⚡', kind: 'mult', value: 2, spins: 5, weight: 14 },
    { short: '10×', kind: 'cash', value: 10, weight: 14 },
    { short: '+5🎁', kind: 'free', spins: 5, weight: 10 },
    { short: '20×', kind: 'cash', value: 20, weight: 8 },
    { short: '×3⚡', kind: 'mult', value: 3, spins: 5, weight: 8 },
    { short: 'MENOR', kind: 'jackpot', name: 'MENOR', value: JACKPOTS.MENOR, weight: 5 },
    { short: '15×', kind: 'cash', value: 15, weight: 8 },
    { short: '×5⚡', kind: 'mult', value: 5, spins: 3, weight: 4 },
    { short: '+10🎁', kind: 'free', spins: 10, weight: 4 },
    { short: 'MAYOR', kind: 'jackpot', name: 'MAYOR', value: JACKPOTS.MAYOR, weight: 0.8 },
    { short: 'MEGA', kind: 'jackpot', name: 'MEGA', value: JACKPOTS.MEGA, weight: 0.1 }
];

// Minijuego bonus: valores de las placas (múltiplos de la apuesta)
export const BONUS_COINS = [
    { value: 0.5, weight: 30 },
    { value: 1, weight: 28 },
    { value: 2, weight: 20 },
    { value: 3, weight: 10 },
    { value: 5, weight: 7 },
    { value: 10, weight: 3 },
    { value: 25, weight: 1.5 },
    { value: 50, weight: 0.5 }
];

export const BONUS_COIN_CHANCE = 0.2;
export const BONUS_JOKER_CHANCE = 0.02;
export const BONUS_MAX_MULT = 10;

export const BET_LEVELS = [5, 10, 20, 50, 100, 200, 500, 1000, 5000, 10000];
export const AUTO_SPIN_OPTIONS = [0, 5, 10, 20, 50, 100, 200];
export const ANTE_MULTIPLIER = 1.25;

export function weightedPick(items, getWeight) {
    const total = items.reduce((sum, item) => sum + getWeight(item), 0);
    let roll = Math.random() * total;

    for (const item of items) {
        roll -= getWeight(item);
        if (roll <= 0) return item;
    }

    return items[items.length - 1];
}

export function randomSymbol(col, ante = false) {
    const weights = ante ? ANTE_WEIGHTS : BASE_WEIGHTS;
    const entries = Object.entries(weights);

    if (WILD_COLUMNS.includes(col)) {
        entries.push([SYM.WILD, WILD_WEIGHT]);
    }

    entries.push([SYM.SCATTER, SCATTER_WEIGHT]);
    entries.push([SYM.JOKER, ante ? JOKER_WEIGHT_ANTE : JOKER_WEIGHT]);

    return weightedPick(entries, entry => entry[1])[0];
}

// Evalúa la cuadrícula completa con el sistema de 243 formas
export function evaluateWays(grid) {
    const wins = [];
    let totalMultiplier = 0;

    for (const symbol of PAYING_SYMBOLS) {
        const reels = [];

        for (let col = 0; col < COLS; col++) {
            const rows = [];

            for (let row = 0; row < ROWS; row++) {
                const cell = grid[row][col];
                if (cell === symbol || cell === SYM.WILD) rows.push(row);
            }

            if (rows.length === 0) break;
            reels.push(rows);
        }

        const length = reels.length;

        if (length >= 3) {
            const ways = reels.reduce((product, rows) => product * rows.length, 1);
            const multiplier = PAYTABLE[symbol][length] * ways;
            const cells = [];

            reels.forEach((rows, col) => {
                rows.forEach(row => cells.push({ row, col }));
            });

            wins.push({ symbol, length, ways, multiplier, cells });
            totalMultiplier += multiplier;
        }
    }

    const scatterCells = [];

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (grid[row][col] === SYM.SCATTER) scatterCells.push({ row, col });
        }
    }

    let jokerChain = 0;
    const jokerCells = [];

    for (let col = 0; col < COLS; col++) {
        const rowsWithJoker = [];

        for (let row = 0; row < ROWS; row++) {
            if (grid[row][col] === SYM.JOKER) rowsWithJoker.push(row);
        }

        if (rowsWithJoker.length === 0) break;

        jokerChain++;
        rowsWithJoker.forEach(row => jokerCells.push({ row, col }));
    }

    const bellWin = wins.find(w => w.symbol === SYM.BELL);
    let wheelSpins = 0;

    if (bellWin && bellWin.length >= WHEEL_MIN_BELLS) {
        wheelSpins = bellWin.length >= 5 ? 2 : 1;
    }

    return {
        wins,
        totalMultiplier,
        scatterCount: scatterCells.length,
        scatterCells,
        jokerChain,
        jokerCells,
        wheelSpins
    };
}

export function describeSegment(segment, bet) {
    switch (segment.kind) {
        case 'cash':
            return `${segment.value}× la apuesta = ${formatEuros(Math.round(segment.value * bet))}`;
        case 'jackpot':
            return `¡JACKPOT ${segment.name}! ${formatEuros(Math.round(segment.value * bet))}`;
        case 'mult':
            return `Multiplicador ×${segment.value} en tus próximas ${segment.spins} tiradas`;
        case 'free':
            return `+${segment.spins} tiradas gratis`;
        default:
            return '';
    }
}