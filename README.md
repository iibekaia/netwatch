# NetWatch — Electron + Angular

ინტერნეტ-კავშირის ლაივ მონიტორი. გათიშვას და ჩართვას მყისიერად აფიქსირებს, თითოეულ მოვლენაზე ჰენდლერს უშვებს და ინახავს ისტორიას.

## გაშვება

```bash
npm install
npm start      # Angular-ის build + Electron
npm run dev    # ng serve + Electron, ცვლილებები ცოცხლად ჩანს, DevTools ავტომატურად იხსნება
```

## Windows-ის exe (ინსტალერი)

**გადმოწერა:** GitHub → [Releases](https://github.com/iibekaia/netwatch/releases) → ბოლო ვერსია:

- `NetWatch-Setup-x.y.z.exe` — ინსტალერი (Start მენიუ + Desktop shortcut, Uninstall)
- `NetWatch-Portable-x.y.z.exe` — ინსტალაციის გარეშე, პირდაპირ ეშვება

exe ხელმოწერილი არ არის, ამიტომ Windows SmartScreen გააფრთხილებს: **More info → Run anyway**.

**ახალი ვერსიის გამოშვება:** `package.json`-ში ვერსიას ცვლი და თეგს აგზავნი:

```bash
npm version patch
git push --follow-tags
```

GitHub Actions (`.github/workflows/release.yml`) Windows-ზე ააწყობს exe-ს და Release-ზე დაამაგრებს.

**ლოკალურად აწყობა:** `npm run dist` → ფაილები `release/` საქაღალდეში.

## Inspect / DevTools

- **F12** ან **Ctrl+Shift+I** (macOS: Cmd+Opt+I)
- მარჯვენა ღილაკი → **Inspect Element**
- ღილაკი **Inspect** აპლიკაციის ზედა მარჯვენა კუთხეში
- მენიუ **View → Toggle Developer Tools**

## როგორ ამოწმებს კავშირს

| წყარო | რას იჭერს | სისწრაფე |
|---|---|---|
| ბრაუზერის `online`/`offline` მოვლენა | Wi-Fi/კაბელის გათიშვა-ჩართვა | მყისიერად |
| `net.isOnline()` (main) | აქვს თუ არა სისტემას ქსელი | ყოველ შემოწმებაზე |
| HTTP ping 3 სერვერზე (main) | ქსელი არის, მაგრამ ინტერნეტი არ მუშაობს | ონლაინ: 2წმ, ოფლაინ: 1წმ |
| `powerMonitor` resume/unlock | ძილიდან გაღვიძება | მყისიერად |

## ჰენდლერები

**Main process** (`electron/main.js`): `handleOffline`, `handleOnline`, `handleChange`. სისტემურ შეტყობინებას აჩვენებს, ფანჯრის სათაურს ცვლის და taskbar-ზე ანათებს.

**Angular** (`src/app/connection.service.ts`):

```ts
const conn = inject(ConnectionService);

const off = conn.onOffline((status, prev) => { /* გაითიშა */ });
conn.onOnline((status, prev) => { /* ჩაირთო */ });
conn.onChange((status, prev) => { /* ნებისმიერი ცვლილება */ });

off(); // გამოწერის გაუქმება
```

სიგნალები: `conn.status()`, `conn.online()`, `conn.events()`.

## სტრუქტურა

```
electron/
  main.js                 ფანჯარა, DevTools, main-ის ჰენდლერები, IPC
  connection-monitor.js   კავშირის შემოწმების ლოგიკა (EventEmitter)
  preload.js              window.netwatch API (contextBridge)
src/app/
  connection.service.ts   Angular სერვისი: signals + ჰენდლერები
  app.ts / app.html       ინტერფეისი, toast-შეტყობინებები, ისტორია
```
