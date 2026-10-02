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

## ქსელის მოწყობილობები (ტაბი „ქსელი“)

აჩვენებს, ვინ არის შენს ლოკალურ ქსელში: სახელი, IP, MAC, როუტერი, ტელეფონები. ავტომატურად სკანირდება გაშვებისას და ყოველ წუთში (`electron/lan-scanner.js`):

1. subnet-ის ყველა მისამართზე (მაქს. /24) იგზავნება NetBIOS მოთხოვნა (UDP 137). Windows-კომპიუტერები სახელით პასუხობენ, ხოლო სისტემა ARP ცხრილს ავსებს.
2. იკითხება `arp -a`, სახელები კი reverse DNS-ით მოდის (როუტერიდან).

admin უფლებები საჭირო არ არის. თუ Wi-Fi-ზე „client isolation“ ჩართულია (ხშირად სტუმრების ქსელში), სხვა მოწყობილობები არ გამოჩნდება.

**NetWatch-ის მომხმარებლები მწვანედ არის მონიშნული** (`electron/peer-discovery.js`). ყოველი NetWatch UDP **47821** პორტზე broadcast-ით აცხადებს თავს (კომპიუტერის სახელს, მომხმარებელს, ვერსიას) და პასუხობს სხვებს. პირველ გაშვებაზე Windows Firewall იკითხავს წვდომას. სხვები ამ კომპიუტერს მხოლოდ **Allow**-ის შემდეგ დაინახავენ (Private ქსელისთვის).

## სიჩქარე და პროვაიდერი (ტაბი „სიჩქარე“)

`electron/speed-test.js`, სერვერი არის Cloudflare-ის საჯარო speed test (`speed.cloudflare.com`), ანგარიში არ სჭირდება:

- **Ping / Jitter**: 12 მსუბუქი მოთხოვნა (`/cdn-cgi/trace`). ping არის მედიანა, jitter კი მეზობელ გაზომვებს შორის საშუალო სხვაობა.
- **ჩამოტვირთვა / ატვირთვა**: 4 პარალელური ნაკადი 8 წამის განმავლობაში. ბარი ცოცხლად აჩვენებს ბოლო წამის სიჩქარეს (ლოგარითმული სკალა 0–1000 Mbps). საბოლოო შედეგში პირველი 1.5 წამი არ ითვლება (TCP-ის „გაჩქარება“).
- **პროვაიდერი**: სახელი, ASN, საჯარო IP და ქალაქი მოდის `ipinfo.io`-დან, ტესტის სერვერის მდებარეობა კი Cloudflare-ის `/meta`-დან. ახლდება გაშვებისას, ტესტისას და ინტერნეტის აღდგენისას.

ბოლო 10 შედეგი ინახება (`localStorage`).

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
