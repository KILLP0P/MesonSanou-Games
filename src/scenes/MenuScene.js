import Phaser from 'phaser';
import {
  state, addBalance, formatEuros,
  canClaimDailyBonus, claimDailyBonus, getDailyBonusAmount
} from '../state.js';

export default class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    this.modal = null;
    this.buildBackground();
    this.buildHeader();
    this.buildCards();
    this.buildControls();
    this.refresh();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refresh() });
  }

  text(x, y, value, size = 20, color = '#ffffff') {
    return this.add.text(x, y, value, {
      fontFamily: 'Arial', fontSize: `${size}px`, color,
      fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5);
  }

  buildBackground() {
    this.add.rectangle(480, 310, 960, 620, 0x07101d);
    const g = this.add.graphics();
    for (let i = 0; i < 32; i++) {
      g.fillStyle(i % 2 ? 0x0b1829 : 0x0d1c2e, 0.7);
      g.fillRect(i * 30, 0, 30, 620);
    }
    g.lineStyle(1, 0xd7b56d, 0.08);
    for (let x = -620; x < 960; x += 80) {
      g.lineBetween(x, 0, x + 620, 620);
      g.lineBetween(x + 620, 0, x, 620);
    }
    this.add.ellipse(480, 160, 820, 260, 0x193851, 0.16);
    for (let i = 0; i < 28; i++) {
      const particle = this.add.circle(
        Phaser.Math.Between(0, 960), Phaser.Math.Between(0, 620),
        Phaser.Math.Between(1, 3), 0xffd166, Phaser.Math.FloatBetween(0.12, 0.4)
      );
      this.tweens.add({
        targets: particle, y: particle.y - 90, alpha: 0,
        duration: Phaser.Math.Between(4000, 8500),
        delay: Phaser.Math.Between(0, 3500), repeat: -1,
        yoyo: true, ease: 'Sine.easeInOut'
      });
    }
    this.add.rectangle(480, 8, 960, 3, 0xd7b56d, 0.7);
    this.add.rectangle(480, 612, 960, 3, 0xd7b56d, 0.7);
  }

  buildHeader() {
    this.text(480, 43, 'MESON SANOU & GAMES', 39, '#f7dfa0');
    this.text(480, 79, 'DEMO · SALDO FICTICIO · SIN APUESTAS REALES', 13, '#aabbd0');
    this.add.rectangle(480, 122, 420, 49, 0x101f32, 0.95)
      .setStrokeStyle(1, 0xd7b56d, 0.65);
    this.creditText = this.text(480, 122, '', 24);
  }

  buildCards() {
    this.card(250, 'AL-SANOWI SLOTS', '7 7 7',
      'Cascadas · bonus · ruleta · cámara del tesoro', 0x9c315c, 'SlotsScene');
    this.card(710, 'XELIQUITA DERBY', 'DERBY 8',
      '8 caballos · nombres rotativos · carreras animadas', 0x257566, 'HorseRaceScene');
    this.add.rectangle(480, 348, 884, 76, 0x17202c, 0.95)
      .setStrokeStyle(1, 0x465569);
    this.text(165, 341, 'Poker', 25, '#8e9caf');
    this.text(548, 337, 'DESACTIVADO TEMPORALMENTE', 17, '#8e9caf');
    this.text(548, 365, 'No disponible en esta demo', 13, '#68788d');
  }

  card(x, name, icon, subtitle, color, scene) {
    const root = this.add.container(x, 225);
    const panel = this.add.rectangle(0, 0, 424, 140, 0x122238, 0.96)
      .setStrokeStyle(2, color);
    root.add([
      panel, this.add.rectangle(0, -54, 420, 29, color, 0.65),
      this.text(0, -40, icon, 19), this.text(0, 1, name, 25, '#f7dfa0'),
      this.text(0, 34, subtitle, 12, '#aabbd0'), this.text(0, 57, 'ENTRAR', 13)
    ]);
    panel.setInteractive({ useHandCursor: true });
    panel.on('pointerover', () => {
      if (!this.modal) { root.setScale(1.025); panel.setStrokeStyle(2, 0xffd166); }
    });
    panel.on('pointerout', () => { root.setScale(1); panel.setStrokeStyle(2, color); });
    panel.on('pointerdown', () => { if (!this.modal) this.scene.start(scene); });
  }

  button(x, y, width, label, callback, color = 0x29445e) {
    const root = this.add.container(x, y);
    const background = this.add.rectangle(0, 0, width, 42, color)
      .setStrokeStyle(1, 0xa7b9cc, 0.3);
    const text = this.text(0, 0, label, 16);
    root.add([background, text]);
    background.setInteractive({ useHandCursor: true });
    background.on('pointerover', () => root.setScale(1.02));
    background.on('pointerout', () => root.setScale(1));
    background.on('pointerdown', () => { if (!this.modal) callback(); });
    return { root, background, text };
  }

  buildControls() {
    this.button(250, 426, 420, 'HISTORIAL DE SESIONES',
      () => this.scene.start('HistoryScene'), 0x49355f);
    this.button(710, 426, 420, 'RECARGAR 100 € DE DEMO',
      () => { addBalance(10000); this.refresh(); }, 0x257566);
    this.daily = this.button(250, 483, 420, '', () => {
      if (claimDailyBonus()) {
        this.refresh(); this.cameras.main.flash(150, 215, 181, 109);
      }
    });
    this.button(710, 483, 420, 'REINICIAR CRÉDITO A 0 €',
      () => this.confirmReset(), 0x633547);
    this.button(250, 540, 420, 'INFORMACIÓN DE LA DEMO', () => this.showAbout());

    const announcement = this.add.container(710, 540);
    announcement.add([
      this.add.rectangle(0, 0, 420, 42, 0x192740)
        .setStrokeStyle(1, 0xd7b56d, 0.8),
      this.text(0, 0, 'Multijugador Proximamente', 19, '#f7dfa0')
    ]);
    this.tweens.add({
      targets: announcement, alpha: 0.7, duration: 1800,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
    this.text(480, 587,
      'Importes simulados. Sin depósitos ni retiradas reales. Multijugador todavía no disponible.',
      12, '#8496ad');
  }

  refresh() {
    this.creditText.setText(`CRÉDITO DEMO: ${formatEuros(state.balance)}`);
    const available = canClaimDailyBonus();
    this.daily.text.setText(available
      ? `BONUS DIARIO: ${formatEuros(getDailyBonusAmount())} DE DEMO`
      : 'BONUS DIARIO YA RECLAMADO');
    this.daily.background.fillColor = available ? 0x257566 : 0x263448;
  }

  openModal(title, message) {
    const root = this.add.container(0, 0).setDepth(200);
    root.add(this.add.rectangle(480, 310, 960, 620, 0x000000, 0.88).setInteractive());
    root.add(this.add.rectangle(480, 310, 780, 390, 0x101f32).setStrokeStyle(2, 0xd7b56d));
    root.add(this.text(480, 180, title, 28, '#f7dfa0'));
    root.add(this.add.text(480, 300, message, {
      fontFamily: 'Arial', fontSize: '18px', color: '#cbd6e4',
      align: 'center', lineSpacing: 8, wordWrap: { width: 690 }
    }).setOrigin(0.5));
    this.modal = root;
    return root;
  }

  modalButton(root, x, y, label, callback, color = 0x29445e) {
    const background = this.add.rectangle(x, y, 270, 44, color)
      .setInteractive({ useHandCursor: true });
    root.add([background, this.text(x, y, label, 17)]);
    background.on('pointerdown', callback);
  }

  closeModal() {
    if (this.modal) { this.modal.destroy(true); this.modal = null; }
  }

  confirmReset() {
    const root = this.openModal('REINICIAR CRÉDITO A 0 €',
      'El crédito compartido de la demo quedará en 0 €.\n\n' +
      'No se borrarán el historial ni el registro del bonus diario.\n' +
      'Después podrás recargar saldo desde este menú.\n¿Quieres continuar?');
    this.modalButton(root, 315, 445, 'CANCELAR', () => this.closeModal());
    this.modalButton(root, 645, 445, 'DEJAR SALDO EN 0 €', () => {
      // Usa la función compartida que también guarda el saldo en localStorage.
      // No llama a resetBalance(), que puede tener otro importe configurado.
      addBalance(-state.balance);
      this.closeModal();
      this.refresh();
    }, 0x633547);
  }

  showAbout() {
    const root = this.openModal('MESON SANOU & GAMES · DEMO',
      'AL-SANOWI SLOTS y XELIQUITA DERBY disponibles.\n' +
      'Poker está desactivado temporalmente.\n' +
      'Multijugador Proximamente.\n\n' +
      'Crédito e historial guardados en este navegador.\n' +
      'Sin apuestas ni premios de dinero real.\n' +
      'Reiniciar crédito deja el saldo en 0 €.\n' +
      'Versión experimental: equilibrio no certificado.');
    this.modalButton(root, 480, 465, 'CERRAR', () => this.closeModal());
  }
}
