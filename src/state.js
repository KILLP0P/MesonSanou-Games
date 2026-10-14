const STORAGE_KEY = 'casino-games-balance-cents';
const DAILY_BONUS_KEY = 'casino-games-daily-bonus';
const HISTORY_KEY = 'casino-games-session-history';

const INITIAL_BALANCE = 0;
const DAILY_BONUS_AMOUNT = 1000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_HISTORY = 200;

export const state = {
    balance: Number(localStorage.getItem(STORAGE_KEY) || INITIAL_BALANCE)
};

export function saveBalance() {
    localStorage.setItem(STORAGE_KEY, String(state.balance));
}

export function addBalance(cents) {
    state.balance += cents;
    saveBalance();
    return state.balance;
}

export function resetBalance() {
    state.balance = INITIAL_BALANCE;
    saveBalance();
    return state.balance;
}

export function canBet(cents) {
    return state.balance >= cents;
}

export function formatEuros(cents) {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
    }).format(cents / 100);
}

export function canClaimDailyBonus() {
    const lastClaim = Number(localStorage.getItem(DAILY_BONUS_KEY) || 0);
    return Date.now() - lastClaim >= DAY_IN_MS;
}

export function claimDailyBonus() {
    if (!canClaimDailyBonus()) return false;

    localStorage.setItem(DAILY_BONUS_KEY, String(Date.now()));
    addBalance(DAILY_BONUS_AMOUNT);
    return true;
}

export function getDailyBonusAmount() {
    return DAILY_BONUS_AMOUNT;
}

/* ---------- Sesiones ---------- */

let currentSession = null;

export function getSession() {
    return currentSession;
}

export function startSession(game) {
    endSession();

    currentSession = {
        game,
        startedAt: Date.now(),
        startBalance: state.balance,
        wagered: 0,
        won: 0,
        rounds: 0,
        biggestWin: 0,
        lastPrizes: []
    };

    return currentSession;
}

export function placeBet(amount) {
    addBalance(-amount);

    if (currentSession) {
        currentSession.wagered += amount;
        currentSession.rounds++;
    }
}

export function registerFreeRound() {
    if (currentSession) {
        currentSession.rounds++;
    }
}

export function payWin(amount) {
    if (amount <= 0) return;

    addBalance(amount);

    if (currentSession) {
        currentSession.won += amount;
        currentSession.biggestWin = Math.max(currentSession.biggestWin, amount);
        currentSession.lastPrizes.unshift(amount);

        if (currentSession.lastPrizes.length > 8) {
            currentSession.lastPrizes.pop();
        }
    }
}

export function endSession() {
    if (!currentSession) return;

    const session = currentSession;
    currentSession = null;

    if (session.rounds === 0) return;

    const history = getHistory();

    history.unshift({
        game: session.game,
        startedAt: session.startedAt,
        endedAt: Date.now(),
        rounds: session.rounds,
        wagered: session.wagered,
        won: session.won,
        net: session.won - session.wagered,
        startBalance: session.startBalance,
        endBalance: state.balance,
        biggestWin: session.biggestWin
    });

    localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(history.slice(0, MAX_HISTORY))
    );
}

export function getHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
        return [];
    }
}

export function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
}

window.addEventListener('beforeunload', endSession);