# NetWatch — Electron + Angular

ინტერნეტ-კავშირის ლაივ მონიტორი. გათიშვას და ჩართვას მყისიერად აფიქსირებს, თითოეულ მოვლენაზე ჰენდლერს უშვებს და ინახავს ისტორიას.

## გაშვება

```bash
npm install
npm start      # Angular-ის build + Electron
npm run dev    # ng serve + Electron, ცვლილებები ცოცხლად ჩანს, DevTools ავტომატურად იხსნება
```

## გადმოწერა და ინსტალაცია (Windows / macOS / Linux)

GitHub → [Releases](https://github.com/iibekaia/netwatch/releases) → ბოლო ვერსია. ბმული ყოველთვის ბოლო ვერსიას გადმოწერს:

| სისტემა | ფაილი | პირდაპირი ბმული |
|---|---|---|
| Windows | `NetWatch-Setup.exe`: ინსტალერი (Start მენიუ, Desktop shortcut, Uninstall) | [გადმოწერა](https://github.com/iibekaia/netwatch/releases/latest/download/NetWatch-Setup.exe) |
| Windows | `NetWatch-Portable.exe`: ინსტალაციის გარეშე | [გადმოწერა](https://github.com/iibekaia/netwatch/releases/latest/download/NetWatch-Portable.exe) |
| macOS (Intel + Apple Silicon) | `NetWatch-mac.dmg` | [გადმოწერა](https://github.com/iibekaia/netwatch/releases/latest/download/NetWatch-mac.dmg) |
| Linux (x64) | `NetWatch-linux.AppImage` | [გადმოწერა](https://github.com/iibekaia/netwatch/releases/latest/download/NetWatch-linux.AppImage) |

აპი ხელმოწერილი არ არის, ამიტომ პირველ გაშვებაზე სისტემა გააფრთხილებს:

- **Windows**: SmartScreen → **More info → Run anyway**.
- **macOS**: გახსენი `.dmg` და NetWatch გადაიტანე **Applications**-ში. პირველ გაშვებაზე გამოჩნდება „NetWatch can't be opened“ → **System Settings → Privacy & Security → Open Anyway**. ან Terminal-ში:
  ```bash
  xattr -cr /Applications/NetWatch.app
  ```
  ქსელის სკანირებისას macOS **ლოკალური ქსელის ნებართვას** ითხოვს. დააჭირე **Allow**.
- **Linux**: ფაილს გაშვების უფლება მიეცი და გაუშვი:
  ```bash
  chmod +x NetWatch-linux.AppImage && ./NetWatch-linux.AppImage
  ```
  ზოგ დისტრიბუტივს (Ubuntu 22.04+) AppImage-ისთვის `libfuse2` სჭირდება: `sudo apt install libfuse2`.

**ახალი ვერსიის გამოშვება:** `package.json`-ში ცვლი `"version"`-ს (მაგ. `1.0.2` → `1.0.3`), აკეთებ commit-ს და master-ზე push-ს. თეგს ხელით არ ქმნი.

GitHub Actions (`.github/workflows/release.yml`) ნახავს, რომ Release `v1.0.3` ჯერ არ არსებობს. Windows-ზე, macOS-ზე და Linux-ზე **პარალელურად** ააწყობს, თვითონ შექმნის თეგს და Release-ს და ყველა ფაილს დაამაგრებს. ერთი სისტემის აწყობა თუ ჩავარდა, დანარჩენები მაინც გამოქვეყნდება. თუ `package.json` შეიცვალა, მაგრამ ვერსია იგივე დარჩა (მაგ. დაემატა dependency), აწყობა გამოტოვდება.

ვერსიის გაზრდა ბრძანებითაც შეიძლება. `--no-git-tag-version` ნიშნავს, რომ თეგს workflow შექმნის:

```bash
npm version patch --no-git-tag-version
```

### ავტომატური განახლება

აპი გაშვებიდან 10 წამში და შემდეგ ყოველ 6 საათში ამოწმებს GitHub-ის ბოლო Release-ს (`electron/updater.js`). ახალი ვერსია header-ის ქვეშ ბანერად ჩნდება:

| ინსტალაცია | როგორ ახლდება |
|---|---|
| Windows: `NetWatch-Setup.exe` | ფონზე იწერება → **გადატვირთვა** (ან დაყენდება აპის შემდეგ დახურვაზე) |
| Linux: AppImage | ასევე, ავტომატურად |
| macOS და Windows Portable | ბანერი ღილაკით **გადმოწერა**. Apple ხელმოუწერელ აპს ავტომატურად ვერ აახლებს, portable ფაილს კი ინსტალაცია არ აქვს |

footer-ში ჩანს მიმდინარე ვერსია და ღილაკი „შემოწმება“. dev რეჟიმში (`npm start`) განახლება გამორთულია.

ამისთვის Release-ში `latest.yml` (Windows) და `latest-linux.yml` (Linux) უნდა იყოს. workflow მათ ავტომატურად ტვირთავს. რეპოზიტორია **public** უნდა იყოს, რომ აპმა Release ანგარიშის გარეშე ნახოს.

**ლოკალურად აწყობა** (ფაილები `release/` საქაღალდეში):

```bash
npm run dist          # მიმდინარე სისტემისთვის
npm run dist:win      # Windows
npm run dist:mac      # macOS (მხოლოდ Mac-ზე)
npm run dist:linux    # Linux (Linux-ზე ან macOS-ზე)
```

## Inspect / DevTools

- **F12** ან **Ctrl+Shift+I** (macOS: Cmd+Opt+I)
- მარჯვენა ღილაკი → **Inspect Element**
- ღილაკი **Inspect** აპლიკაციის ზედა მარჯვენა კუთხეში
- მენიუ **View → Toggle Developer Tools**

## ფონზე მუშაობა (tray) და კომპიუტერთან ერთად ჩართვა

- **✕ აპს არ თიშავს.** ფანჯარა იმალება და NetWatch საათის გვერდით (tray) აგრძელებს მუშაობას: ამოწმებს ინტერნეტს, წერს ისტორიას, აჩვენებს შეტყობინებებს. პირველ ჯერზე შეტყობინება ამას აგიხსნის.
- **Tray იკონკის ფერი:** მწვანე = ონლაინ, წითელი = ოფლაინ, ნაცრისფერი = მოწმდება. ზედ მიტანისას მიზეზს აჩვენებს, მაგ. „ოფლაინ — როუტერი არ პასუხობს“.
- **Tray მენიუ:** გახსნა · შეამოწმე ახლავე · ☑ კომპიუტერთან ერთად ჩართვა · **გასვლა** (აპის რეალურად დახურვა მხოლოდ აქედან შეიძლება).
- **კომპიუტერთან ერთად ჩართვა** დაყენებისას ავტომატურად ირთვება (`--hidden`, ფანჯრის გარეშე, პირდაპირ tray-ში). გამორთვა: tray-ის მენიუდან ან footer-ის გადამრთველით. ორივე ერთმანეთთან სინქრონშია.
  - Windows / macOS: სისტემის startup სია. Portable-ზე რეალური `.exe`-ის გზა იწერება.
  - Linux (AppImage): `~/.config/autostart/netwatch.desktop`
  - dev რეჟიმში (`npm start`) გამორთულია.
- **ერთი ასლი:** NetWatch-ს თუ ხელახლა გაუშვებ, მეორე ასლი არ იხსნება და უკვე გაშვებულის ფანჯარა ჩნდება.

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

## „სად არის პრობლემა?“ (დიაგნოსტიკა)

`electron/diagnostics.js` კავშირს ჯაჭვად ამოწმებს. პირველი წითელი რგოლი აჩვენებს, სად წყდება კავშირი:

| რგოლი | როგორ მოწმდება | შეცდომისას |
|---|---|---|
| კომპიუტერი | აქვს თუ არა ადაპტერს IP (169.254.x.x ნიშნავს, რომ როუტერმა არ მისცა) | Wi-Fi/კაბელი, DHCP |
| როუტერი | `ping` + TCP 80/443/53 (უარის პასუხიც = „ცოცხალია“) | როუტერის გადატვირთვა |
| ინტერნეტი | TCP 443 → 1.1.1.1 / 8.8.8.8 / 9.9.9.9 (DNS-ის გარეშე) | პროვაიდერის მხარე |
| DNS | სისტემის DNS, შედარებისთვის 1.1.1.1 | DNS-ის შეცვლა |
| ვები | HTTP 204 გვერდი (სხვა პასუხი ნიშნავს Wi-Fi-ის ავტორიზაციის გვერდს) | captive portal / firewall |

ყველა რგოლი პარალელურად მოწმდება (ჩვეულებრივ < 1 წამი, მაქს. ~3 წამი), admin უფლებების გარეშე. **ინტერნეტის გათიშვისას ავტომატურად ეშვება** და Windows-ის შეტყობინება მიზეზს წერს. აღდგენისას თავიდან მოწმდება. ხელით გაშვება: ტაბი „კავშირი“ → **შემოწმება**.

## ისტორია და სტატისტიკა (ტაბი „ისტორია“)

ყველა გათიშვა დისკზე ინახება (`%APPDATA%\NetWatch\history.json`, ერთი წლის განმავლობაში) და აპის დახურვისას არ იკარგება. თითოეულ გათიშვას დიაგნოსტიკის მიზეზი მიეწერება.

- **პერიოდი:** დღეს / 7 დღე / 30 დღე / ეს თვე
- **Uptime %**, გათიშვების რაოდენობა (მათ შორის რამდენი იყო პროვაიდერის მხარეს), ჯამური ოფლაინ დრო, ყველაზე ხანგრძლივი გათიშვა
- **დღიური გრაფიკი**: ოფლაინ დრო დღეების მიხედვით (hover-ზე დეტალები)
- **ექსპორტი:**
  - **PDF ანგარიში** პროვაიდერთან საჩივრისთვის: შეჯამება („ამ თვეში 14-ჯერ გაითიშა, ჯამში 3 სთ“), გრაფიკი, სია მიზეზებით
  - **CSV** (Excel-ი ქართულს სწორად კითხულობს)

**როგორ ითვლება uptime:** მხოლოდ იმ დროზე, როცა NetWatch მუშაობდა. კომპიუტრის გამორთვის და ძილის დრო არც ონლაინად ითვლება, არც ოფლაინად. აპი ყოველ 30 წამში ინიშნავს, რომ მუშაობს. დიდი შუალედი ნიშნავს, რომ კომპიუტერს ეძინა. აპი თუ გათიშვის დროს დაიხურა ან ავარიულად გაითიშა, გათიშვა ბოლო ნიშნულით იხურება და „დასასრული მიახლოებითია“ ეწერება.

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
  updater.js              ავტომატური განახლება (electron-updater / GitHub API)
  diagnostics.js          „სად არის პრობლემა?“ — კავშირის ჯაჭვის შემოწმება
  history-store.js        გათიშვების ისტორია დისკზე (history.json)
  history-stats.js        uptime %, გათიშვები, დღიური სტატისტიკა
  history-export.js       CSV და PDF ანგარიში
  tray.js                 tray იკონკა (სტატუსის ფერით) და მენიუ
  autostart.js            კომპიუტერთან ერთად ჩართვა (Windows / macOS / Linux)
  settings.js             აპის პარამეტრები (settings.json)

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
      update.service.ts       აპის განახლების მდგომარეობა
      diagnostics.service.ts  დიაგნოსტიკის მდგომარეობა
      history.service.ts      ისტორია: პერიოდი, სტატისტიკა, ექსპორტი
      autostart.service.ts    კომპიუტერთან ერთად ჩართვის გადამრთველი
      netwatch.types.ts       window.netwatch API-ის ტიპები
    shared/format.ts      ფორმატირება (ხანგრძლივობა, რიცხვები, netmask)
    layout/
      tab-nav/            ტაბების გადამრთველი
      toasts/             შეტყობინებების ჩვენება
      update-banner/      ახალი ვერსიის ბანერი
    features/
      status/   status-tab, event-log, diagnostics-card
      lan/      lan-tab, device-card
      speed/    speed-tab, provider-card, speed-meter, speed-history
      history/  history-tab, downtime-chart, outage-list
```

სტილები Tailwind-ის utility კლასებით template-შივე წერია, კომპონენტებს ცალკე `.css` არ აქვთ. ფერები (`bg-card`, `text-muted`, `text-ok`, `bg-bad/15` …) `styles.css`-ის `@theme`-დან მოდის და dark რეჟიმში ავტომატურად იცვლება.
