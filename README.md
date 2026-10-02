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

**ახალი ვერსიის გამოშვება:** `package.json`-ში ცვლი `"version"`-ს (მაგ. `1.0.2` → `1.0.3`), აკეთებ commit-ს და master-ზე push-ს. თეგს ხელით არ ქმნი.

GitHub Actions (`.github/workflows/release.yml`) ნახავს, რომ Release `v1.0.3` ჯერ არ არსებობს. თვითონ შექმნის თეგს და Release-ს, Windows-ზე ააწყობს exe-ს და დაამაგრებს. თუ `package.json` შეიცვალა, მაგრამ ვერსია იგივე დარჩა (მაგ. დაემატა dependency), აწყობა გამოტოვდება.

ვერსიის გაზრდა ბრძანებითაც შეიძლება. `--no-git-tag-version` ნიშნავს, რომ თეგს workflow შექმნის:

```bash
npm version patch --no-git-tag-version
```

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

**Angular** (`src/app/core/connection.service.ts`):

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
  lan-scanner.js          ლოკალური ქსელის სკანირება (NetBIOS + ARP + DNS)
  peer-discovery.js       NetWatch-ის სხვა ასლების პოვნა (UDP 47821)
  speed-test.js           სიჩქარის ტესტი + პროვაიდერის ინფო

src/
  styles.css              Tailwind + თემა (ფერები light/dark) + საერთო კლასები
                          (btn-primary, btn-ghost, card, caption, stat, tag, badge …)
  app/
    app.ts / app.html     ჩარჩო: header, ტაბები, footer + online/offline ჰენდლერები
    core/                 სერვისები და ტიპები
      connection.service.ts   კავშირის მდგომარეობა: signals + ჰენდლერები
      lan.service.ts          ქსელის მოწყობილობები
      speed.service.ts        სიჩქარის ტესტი, პროვაიდერი, ისტორია
      toast.service.ts        ამომხტარი შეტყობინებები
      netwatch.types.ts       window.netwatch API-ის ტიპები
    shared/format.ts      ფორმატირება (ხანგრძლივობა, რიცხვები, netmask)
    layout/
      tab-nav/            ტაბების გადამრთველი
      toasts/             შეტყობინებების ჩვენება
    features/
      status/   status-tab, event-log
      lan/      lan-tab, device-card
      speed/    speed-tab, provider-card, speed-meter, speed-history
```

სტილები Tailwind-ის utility კლასებით template-შივე წერია, კომპონენტებს ცალკე `.css` არ აქვთ. ფერები (`bg-card`, `text-muted`, `text-ok`, `bg-bad/15` …) `styles.css`-ის `@theme`-დან მოდის და dark რეჟიმში ავტომატურად იცვლება.
