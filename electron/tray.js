const path = require('path');
const { Menu, Tray, nativeImage } = require('electron');

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
    this.detail = null; // "42 ms" ან დიაგნოსტიკის დასკვნა
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
  }

  /** @param {boolean|null} online @param {string|null} detail */
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
    const label = { online: 'ონლაინ', offline: 'ოფლაინ', unknown: 'მოწმდება…' }[this.state];
    const status = this.detail ? `${label} — ${this.detail}` : label;
    const { autostart } = this.opts;

    this.tray.setImage(this.icons[this.state]);
    this.tray.setToolTip(`NetWatch — ${status}`);
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: `● ${status}`, enabled: false },
        { type: 'separator' },
        { label: 'გახსნა', click: () => this.opts.onOpen() },
        { label: 'შეამოწმე ახლავე', click: () => this.opts.onCheck() },
        { type: 'separator' },
        {
          label: 'კომპიუტერთან ერთად ჩართვა',
          type: 'checkbox',
          checked: autostart.isEnabled(),
          enabled: autostart.supported(),
          click: (item) => this.opts.onToggleAutostart(item.checked),
        },
        { type: 'separator' },
        { label: 'გასვლა', click: () => this.opts.onQuit() },
      ])
    );
  }
}

module.exports = { AppTray };
