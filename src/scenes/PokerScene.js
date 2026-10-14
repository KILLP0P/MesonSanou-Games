import Phaser from 'phaser';
import { placeBet, payWin, canBet, formatEuros } from '../state.js';
import { createHud, makeButton } from '../ui.js';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const BET_LEVELS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 50000];

// Jacks or Better 9/6 (el pago incluye la apuesta devuelta)
const PAYTABLE = {
    'Escalera real': 800,
    'Escalera de color': 50,
    'Póker': 25,
    'Full House': 9,
    'Color': 6,
    'Escalera': 4,
    'Trío': 3,
    'Doble pareja': 2,
    'Pareja de J o mejor': 1
};

export default class PokerScene extends Phaser.Scene {
    constructor() {
        super('PokerScene');
    }

    create() {
        this.deck = [];
        this.hand = [];
        this.held = [false, false, false, false, false];
        this.phase = 'draw';
        this.betIndex = 1;
        this.currentBet = 0;

        createHud(this, 'Video Poker');

        this.add.text(480, 62, 'VIDEO POKER', {
            fontFamily: 'Arial',
            fontSize: '28px',
            color: '#ffd166',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.resultText = this.add.text(480, 95, '', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.createCards();
        this.createBetControls();

        makeButton(this, 360, 440, 240, 48, 'REPARTIR', '#e63946', () => this.deal());
        makeButton(this, 680, 440, 240, 48, 'CAMBIAR', '#2a9d8f', () => this.draw());
        makeButton(this, 160, 520, 220, 44, 'VOLVER', '#457b9d', () => {
            this.scene.start('MenuScene');
        }, 18);

        this.updateTexts();
    }

    createCards() {
        this.cardTexts = [];

        for (let i = 0; i < 5; i++) {
            const x = 240 + i * 120;

            const card = this.add.rectangle(x, 240, 90, 130, 0xffffff);
            card.setStrokeStyle(4, 0x1d3557);
            card.setInteractive({ useHandCursor: true });

            const text = this.add.text(x, 240, '', {
                fontFamily: 'Arial',
                fontSize: '30px',
                color: '#111111',
                align: 'center'
            }).setOrigin(0.5);

            const heldText = this.add.text(x, 155, '', {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#ffd166',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            card.on('pointerdown', () => {
                if (this.phase !== 'hold') return;

                this.held[i] = !this.held[i];
                heldText.setText(this.held[i] ? 'MANTENER' : '');
            });

            this.cardTexts.push({ card, text, heldText });
        }
    }

    createBetControls() {
        this.add.text(30, 365, 'Apuesta:', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff'
        }).setOrigin(0, 0.5);

        makeButton(this, 160, 365, 55, 38, '-', '#457b9d', () => this.changeBet(-1), 18);

        this.betValueText = this.add.text(240, 365, '', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#ffd166',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        makeButton(this, 320, 365, 55, 38, '+', '#457b9d', () => this.changeBet(1), 18);
    }

    get bet() {
        return BET_LEVELS[this.betIndex];
    }

    changeBet(direction) {
        if (this.phase !== 'draw') return;

        this.betIndex = Phaser.Math.Clamp(
            this.betIndex + direction,
            0,
            BET_LEVELS.length - 1
        );

        this.updateTexts();
    }

    createDeck() {
        const deck = [];

        for (const suit of SUITS) {
            for (const rank of RANKS) {
                deck.push({ suit, rank });
            }
        }

        return Phaser.Utils.Array.Shuffle(deck);
    }

    deal() {
        if (this.phase !== 'draw') return;

        if (!canBet(this.bet)) {
            this.resultText.setText('No tienes saldo suficiente');
            return;
        }

        this.currentBet = this.bet;
        placeBet(this.currentBet);

        this.deck = this.createDeck();
        this.hand = this.deck.splice(0, 5);
        this.held = [false, false, false, false, false];
        this.phase = 'hold';

        this.resultText.setText('Elige las cartas que quieres mantener y pulsa CAMBIAR');
        this.renderHand();
    }

    draw() {
        if (this.phase !== 'hold') return;

        for (let i = 0; i < 5; i++) {
            if (!this.held[i]) {
                this.hand[i] = this.deck.pop();
            }
        }

        this.phase = 'draw';
        this.held = [false, false, false, false, false];
        this.renderHand();

        const handName = this.evaluateHand();
        const multiplier = PAYTABLE[handName] || 0;
        const prize = Math.round(multiplier * this.currentBet);

        if (prize > 0) {
            payWin(prize);
            this.resultText.setText(`${handName}: premio ${formatEuros(prize)}`);
            this.cameras.main.flash(250, 255, 255, 255);
        } else {
            this.resultText.setText('Sin premio');
        }
    }

    renderHand() {
        this.hand.forEach((card, index) => {
            const isRed = card.suit === '♥' || card.suit === '♦';

            this.cardTexts[index].text.setText(`${card.rank}\n${card.suit}`);
            this.cardTexts[index].text.setColor(isRed ? '#d62828' : '#111111');
            this.cardTexts[index].heldText.setText(this.held[index] ? 'MANTENER' : '');
        });
    }

    evaluateHand() {
        const rankCount = {};
        const suitCount = {};

        this.hand.forEach(card => {
            rankCount[card.rank] = (rankCount[card.rank] || 0) + 1;
            suitCount[card.suit] = (suitCount[card.suit] || 0) + 1;
        });

        const counts = Object.values(rankCount).sort((a, b) => b - a);
        const isFlush = Object.values(suitCount).some(count => count === 5);

        const rankIndexes = this.hand
            .map(card => RANKS.indexOf(card.rank))
            .sort((a, b) => a - b);

        const isNormalStraight = rankIndexes.every((value, index) =>
            index === 0 || value === rankIndexes[index - 1] + 1
        );

        const isWheel = rankIndexes.join(',') === '0,1,2,3,12';
        const isStraight = isNormalStraight || isWheel;
        const isRoyal = rankIndexes.join(',') === '8,9,10,11,12';

        if (isFlush && isRoyal) return 'Escalera real';
        if (isFlush && isStraight) return 'Escalera de color';
        if (counts[0] === 4) return 'Póker';
        if (counts[0] === 3 && counts[1] === 2) return 'Full House';
        if (isFlush) return 'Color';
        if (isStraight) return 'Escalera';
        if (counts[0] === 3) return 'Trío';
        if (counts[0] === 2 && counts[1] === 2) return 'Doble pareja';

        const hasHighPair = Object.entries(rankCount).some(([rank, count]) =>
            count === 2 && ['J', 'Q', 'K', 'A'].includes(rank)
        );

        if (hasHighPair) return 'Pareja de J o mejor';

        return 'Sin premio';
    }

    updateTexts() {
        this.betValueText.setText(formatEuros(this.bet));

        if (this.phase === 'draw' && this.hand.length === 0) {
            this.resultText.setText(`Apuesta: ${formatEuros(this.bet)}`);
        }
    }
}