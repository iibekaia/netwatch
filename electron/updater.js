const { EventEmitter } = require('events');
const { app, shell } = require('electron');

/**
 * ავტომატური განახლება GitHub Release-ებიდან (main process).
 *
 * ორი რეჟიმი:
 *  - 'auto'   — Windows-ის ინსტალერი და Linux AppImage: electron-updater ფონზე იწერს ახალ ვერსიას,
 *               მერე მომხმარებელი აჭერს „გადატვირთვა და განახლება“-ს (ან დაყენდება აპის დახურვისას).
 *  - 'manual' — macOS (ხელმოუწერელ აპს Apple ავტომატურად ვერ აახლებს) და Windows Portable
 *               (ჩასანაცვლებელი ინსტალაცია არ აქვს): GitHub API-თი ვამოწმებთ ბოლო ვერსიას და
 *               ვაჩვენებთ ღილაკს „გადმოწერა“.
 * Dev რეჟიმში (npm start / npm run dev) განახლება გამორთულია.
 *
 * მდგომარეობა (state.status):
 *   disabled | idle | checking | up-to-date | available | downloading | downloaded | error
 *
 * მოვლენები: 'state' (state)
 */

const OWNER = 'iibekaia';
const REPO = 'netwatch';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // ყოველ 6 საათში
const FIRST_CHECK_DELAY_MS = 10 * 1000; // გაშვებიდან 10 წამში — სტარტს რომ არ შეანელოს

class Updater extends EventEmitter {
  constructor() {
    super();
    this.mode = detectMode();
    this.state = {
      status: this.mode ? 'idle' : 'disabled',
      mode: this.mode,
      currentVersion: app.getVersion(),
      version: null, // ახალი ვერსია
      progress: null, // 0..100 (მხოლოდ auto)
      error: null,
      checkedAt: null,
    };
    this._timer = null;
    this._auto = null; // electron-updater-ის autoUpdater (მხოლოდ auto რეჟიმში)
  }

  start() {
    if (!this.mode) return;
    if (this.mode === 'auto') this._setupAuto();
    setTimeout(() => this.check(), FIRST_CHECK_DELAY_MS);
    this._timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
  }

  stop() {
    clearInterval(this._timer);
  }

  async check() {
    if (!this.mode) return this.state;
    // უკვე იწერება ან მზადაა — თავიდან შემოწმება არ გვჭირდება
    if (['checking', 'downloading', 'downloaded'].includes(this.state.status)) return this.state;

    this._set({ status: 'checking', error: null });
    try {
      if (this.mode === 'auto') {
        await this._auto.checkForUpdates(); // შედეგი მოვლენებით მოდის (იხ. _setupAuto)
      } else {
        const latest = await latestRelease();
        const newer = compareVersions(latest, app.getVersion()) > 0;
        this._set({
          status: newer ? 'available' : 'up-to-date',
          version: newer ? latest : null,
          checkedAt: Date.now(),
        });
      }
    } catch (err) {
      this._fail(err);
    }
    return this.state;
  }

  /** auto: გადატვირთვა და ახალი ვერსიის დაყენება; manual: გადმოწერის ბმულის გახსნა ბრაუზერში */
  install() {
    if (this.mode === 'auto' && this.state.status === 'downloaded') {
      // isSilent: ინსტალერის ფანჯრების გარეშე; isForceRunAfter: დაყენების მერე აპი თავიდან ეშვება
      setImmediate(() => this._auto.quitAndInstall(true, true));
    } else if (this.mode === 'manual' && this.state.status === 'available') {
      shell.openExternal(downloadUrl());
    }
  }

  _setupAuto() {
    const { autoUpdater } = require('electron-updater');
    this._auto = autoUpdater;
    autoUpdater.autoDownload = true;
    // თუ მომხმარებელმა „გადატვირთვა“ არ დააჭირა — დაყენდება შემდეგ დახურვაზე
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = null;

    autoUpdater.on('update-available', (info) =>
      this._set({ status: 'downloading', version: info.version, progress: 0, checkedAt: Date.now() })
    );
    autoUpdater.on('update-not-available', () =>
      this._set({ status: 'up-to-date', version: null, progress: null, checkedAt: Date.now() })
    );
    autoUpdater.on('download-progress', (p) =>
      this._set({ status: 'downloading', progress: Math.round(p.percent) })
    );
    autoUpdater.on('update-downloaded', (info) =>
      this._set({ status: 'downloaded', version: info.version, progress: 100 })
    );
    autoUpdater.on('error', (err) => this._fail(err));
  }

  _fail(err) {
    console.warn('[updater]', err?.message ?? err);
    this._set({ status: 'error', error: 'განახლების შემოწმება ვერ მოხერხდა', checkedAt: Date.now() });
  }

  _set(patch) {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.state);
  }
}

/** რომელი რეჟიმი შეესაბამება ამ ინსტალაციას (null — განახლება გამორთულია) */
function detectMode() {
  if (!app.isPackaged) return null;
  if (process.platform === 'win32') return process.env.PORTABLE_EXECUTABLE_DIR ? 'manual' : 'auto';
  if (process.platform === 'linux') return process.env.APPIMAGE ? 'auto' : 'manual';
  return 'manual'; // macOS
}

/** ფაილი, რომელიც manual რეჟიმში უნდა გადმოიწეროს — ბმული ყოველთვის ბოლო ვერსიაზეა */
function downloadUrl() {
  const file =
    process.platform === 'darwin'
      ? 'NetWatch-mac.dmg'
      : process.platform === 'linux'
        ? 'NetWatch-linux.AppImage'
        : 'NetWatch-Portable.exe';
  return `https://github.com/${OWNER}/${REPO}/releases/latest/download/${file}`;
}

/** ბოლო Release-ის ვერსია ("v1.2.3" → "1.2.3") */
async function latestRelease() {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'NetWatch' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const { tag_name } = await res.json();
  return String(tag_name).replace(/^v/, '');
}

/** "1.10.0" vs "1.9.2" → 1 (a ახალია), -1, ან 0 */
function compareVersions(a, b) {
  const pa = a.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const pb = b.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

module.exports = { Updater, compareVersions };
