const path = require('path');
const { Menu, Tray, nativeImage } = require('electron');
const { i18n } = require('./i18n');

/**
 * Tray იკონკა საათის გვერდით (main process).
 * ფერი სტატუსის მიხედვით: მწვანე — ონლაინ, წითელი — ოფლაინ, ნაცრისფერი — მოწმდება.
 * tooltip-ში — მიზეზი (დიაგნოსტიკიდან), მენიუში — ძირითადი მოქმედებები.
 * იკონკები: build/tray/tray-<state>.png (16px) + @2x (32px, მაღალი DPI-სთვის).
 */
class AppTray {
  /**
   * @param {{ onOpen, onCheck, onToggleAutostart, onQuit, autostart: { supported, isEnabled } }} opts
   */
  constructor(opts) {
    this.opts = opts;
    this.state = 'unknown';
    this.detail = null; // მიზეზის თარგმანის გასაღები (მაგ. diag.verdict.router.title) ან null
    this.icons = Object.fromEntries(
      ['online', 'offline', 'unknown'].map((s) => [
        s,
        nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'tray', `tray-${s}.png`)),
      ])
    );
    this.tray = new Tray(this.icons.unknown);
    // Windows/Linux: დაკლიკება ხსნის ფანჯარას (macOS-ზე დაკლიკება მენიუს აჩენს)
    this.tray.on('click', () => opts.onOpen());
    this._render();
    // ენის შეცვლისას — მენიუ და tooltip ახალ ენაზე
    i18n.on('change', () => this._render());
  }

  /** @param {boolean|null} online @param {string|null} detail — თარგმანის გასაღები; ითარგმნება ყოველ render-ზე */
  update(online, detail = null) {
    const state = online === null ? 'unknown' : online ? 'online' : 'offline';
    if (state === this.state && detail === this.detail) return;
    this.state = state;
    this.detail = detail;
    this._render();
  }

  /** მენიუს თავიდან აწყობა (მაგ. ავტომატური ჩართვის მონიშვნა შეიცვალა) */
  refresh() {
    this._render();
  }

  destroy() {
    this.tray.destroy();
  }

  _render() {
    const label = i18n.t(`status.${this.state === 'unknown' ? 'checking' : this.state}`);
    const status = this.detail ? `${label} — ${i18n.t(this.detail)}` : label;
    const { autostart } = this.opts;

    this.tray.setImage(this.icons[this.state]);
    this.tray.setToolTip(`NetWatch — ${status}`);
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: `● ${status}`, enabled: false },
        { type: 'separator' },
        { label: i18n.t('tray.open'), click: () => this.opts.onOpen() },
        { label: i18n.t('tray.check'), click: () => this.opts.onCheck() },
        { type: 'separator' },
        {
          label: i18n.t('tray.autostart'),
          type: 'checkbox',
          checked: autostart.isEnabled(),
          enabled: autostart.supported(),
          click: (item) => this.opts.onToggleAutostart(item.checked),
        },
        { type: 'separator' },
        { label: i18n.t('tray.quit'), click: () => this.opts.onQuit() },
      ])
    );
  }
}

module.exports = { AppTray };
