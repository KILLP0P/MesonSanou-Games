import Phaser from 'phaser';
import { getHistory, clearHistory, formatEuros } from '../state.js';
import { makeButton } from '../ui.js';

const PAGE_SIZE = 9;

const COLUMNS = [
    { title: 'FECHA', x: 25 },
    { title: 'JUEGO', x: 190 },
    { title: 'RONDAS', x: 320 },
    { title: 'APOSTADO', x: 400 },
    { title: 'GANADO', x: 515 },
    { title: 'NETO', x: 625 },
    { title: 'SALDO FINAL', x: 735 },
    { title: 'MAYOR PREMIO', x: 850 }
];

export default class HistoryScene extends Phaser.Scene {
    constructor() {
        super('HistoryScene');
    }

    create() {
        this.page = 0;
        this.rowTexts = [];

        this.add.text(480, 35, 'HISTORIAL DE SESIONES', {
            fontFamily: 'Arial',
            fontSize: '34px',
            color: '#ffd166',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.summaryText = this.add.text(480, 78, '', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        COLUMNS.forEach(column => {
            this.add.text(column.x, 120, column.title, {
                fontFamily: 'Arial',
                fontSize: '13px',
                color: '#aaaaaa',
                fontStyle: 'bold'
            }).setOrigin(0, 0.5);
        });

        this.add.rectangle(480, 138, 920, 2, 0x444444);

        this.pageText = this.add.text(480, 505, '', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff'
        }).setOrigin(0.5);

        makeButton(this, 300, 505, 140, 40, 'ANTERIOR', '#457b9d', () => this.changePage(-1), 16);
        makeButton(this, 660, 505, 140, 40, 'SIGUIENTE', '#457b9d', () => this.changePage(1), 16);

        makeButton(this, 160, 570, 220, 44, 'VOLVER', '#457b9d', () => {
            this.scene.start('MenuScene');
        }, 18);

        makeButton(this, 800, 570, 260, 44, 'BORRAR HISTORIAL', '#e63946', () => {
            clearHistory();
            this.page = 0;
            this.render();
        }, 18);

        this.render();
    }

    changePage(direction) {
        const history = getHistory();
        const totalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));

        this.page = Phaser.Math.Clamp(this.page + direction, 0, totalPages - 1);
        this.render();
    }

    render() {
        this.rowTexts.forEach(text => text.destroy());
        this.rowTexts = [];

        const history = getHistory();
        const totalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
        const totalNet = history.reduce((sum, s) => sum + s.net, 0);

        this.summaryText.setText(
            `${history.length} sesiones | Resultado total: ${totalNet > 0 ? '+' : ''}${formatEuros(totalNet)}`
        );
        this.summaryText.setColor(
            totalNet > 0 ? '#7CFC00' : totalNet < 0 ? '#ff6b6b' : '#ffffff'
        );

        this.pageText.setText(`Página ${this.page + 1} / ${totalPages}`);

        if (history.length === 0) {
            const empty = this.add.text(480, 280, 'Todavía no hay sesiones guardadas', {
                fontFamily: 'Arial',
                fontSize: '22px',
                color: '#aaaaaa'
            }).setOrigin(0.5);

            this.rowTexts.push(empty);
            return;
        }

        const pageItems = history.slice(
            this.page * PAGE_SIZE,
            this.page * PAGE_SIZE + PAGE_SIZE
        );

        pageItems.forEach((session, index) => {
            const y = 165 + index * 36;

            const date = new Date(session.startedAt).toLocaleString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            const values = [
                date,
                session.game,
                String(session.rounds),
                formatEuros(session.wagered),
                formatEuros(session.won),
                `${session.net > 0 ? '+' : ''}${formatEuros(session.net)}`,
                formatEuros(session.endBalance),
                formatEuros(session.biggestWin)
            ];

            values.forEach((value, col) => {
                let color = '#ffffff';

                if (col === 4) color = '#ffd166';
                if (col === 5) {
                    color = session.net > 0 ? '#7CFC00' : session.net < 0 ? '#ff6b6b' : '#ffffff';
                }

                const text = this.add.text(COLUMNS[col].x, y, value, {
                    fontFamily: 'Arial',
                    fontSize: '14px',
                    color
                }).setOrigin(0, 0.5);

                this.rowTexts.push(text);
            });
        });
    }
}