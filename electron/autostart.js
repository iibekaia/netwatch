const fs = require('fs');
const os = require('os');
const path = require('path');
const { app } = require('electron');

/**
 * კომპიუტერთან ერთად ჩართვა (main process).
 *  - Windows / macOS: app.setLoginItemSettings — სისტემის "startup" სიაში.
 *    Windows Portable: რეალური exe-ის გზა (PORTABLE_EXECUTABLE_FILE) — არა დროებითი საქაღალდე,
 *    საიდანაც portable ყოველ გაშვებაზე იხსნება.
 *  - Linux (AppImage): ~/.config/autostart/netwatch.desktop
 * ავტომატურად ჩართვისას აპი იხსნება ARG-ით — ფანჯრის გარეშე, პირდაპირ tray-ში.
 * Dev რეჟიმში (npm start) არ მუშაობს — თორემ electron.exe ჩაიწერებოდა startup-ში.
 */

const ARG = '--hidden';

/** შეიძლება თუ არა ამ ინსტალაციაზე */
function supported() {
  if (!app.isPackaged) return false;
  if (process.platform === 'linux') return !!process.env.APPIMAGE;
  return process.platform === 'win32' || process.platform === 'darwin';
}

function isEnabled() {
  if (!supported()) return false;
  if (process.platform === 'linux') return fs.existsSync(desktopFile());
  return app.getLoginItemSettings(loginOptions()).openAtLogin;
}

function setEnabled(enabled) {
  if (!supported()) return false;
  if (process.platform === 'linux') {
    if (enabled) {
      fs.mkdirSync(path.dirname(desktopFile()), { recursive: true });
      fs.writeFileSync(
        desktopFile(),
        [
          '[Desktop Entry]',
          'Type=Application',
          'Name=NetWatch',
          `Exec="${process.env.APPIMAGE}" ${ARG}`,
          'X-GNOME-Autostart-enabled=true',
          '',
        ].join('\n')
      );
    } else {
      fs.rmSync(desktopFile(), { force: true });
    }
  } else {
    app.setLoginItemSettings({ ...loginOptions(), openAtLogin: enabled, args: [ARG] });
  }
  return isEnabled();
}

/** ეს გაშვება კომპიუტრის ჩართვისას მოხდა — ფანჯარა არ ვაჩვენოთ */
function launchedHidden() {
  if (process.argv.includes(ARG)) return true;
  // macOS: "openAsHidden" / login item
  if (process.platform === 'darwin') return app.getLoginItemSettings().wasOpenedAtLogin;
  return false;
}

function loginOptions() {
  // Portable: ჩავწეროთ თვითონ .exe ფაილი (არა დროებითი ამოხსნილი ასლი)
  const exe = process.env.PORTABLE_EXECUTABLE_FILE;
  return exe ? { path: exe, args: [ARG] } : { args: [ARG] };
}

function desktopFile() {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'autostart', 'netwatch.desktop');
}

module.exports = { supported, isEnabled, setEnabled, launchedHidden };
