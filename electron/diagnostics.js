const net = require('net');
const dns = require('dns').promises;
const { execFile } = require('child_process');
const { localSubnets, defaultGateway } = require('./lan-scanner');

/**
 * „სად არის პრობლემა?“ — კავშირის ჯაჭვის შემოწმება (main process).
 *
 *   კომპიუტერი → როუტერი → ინტერნეტი → DNS → ვები
 *
 * ყველა რგოლი პარალელურად მოწმდება (მაქს. ~3 წამი), მერე პირველი ჩავარდნილი რგოლის
 * მიხედვით ვადგენთ დასკვნას. admin უფლებები არ სჭირდება:
 *  - როუტერი: სისტემის `ping` + TCP კავშირი 80/443/53 პორტებზე. "connection refused"-იც
 *    ნიშნავს, რომ მოწყობილობა ცოცხალია — მან უარი გვითხრა.
 *  - ინტერნეტი: TCP 443 საჯარო IP-ებზე (DNS-ის გარეშე — რომ DNS-ის პრობლემა არ აგვერიოს).
 *  - DNS: სისტემის resolver და, შედარებისთვის, Cloudflare (1.1.1.1).
 *  - ვები: HTTP 204 გვერდი — სხვა პასუხი ნიშნავს Wi-Fi-ის ავტორიზაციის გვერდს (captive portal).
 *
 * სტატუსები: ok | warn | fail | skip
 */

const TIMEOUT_MS = 2500;
const INTERNET_HOSTS = ['1.1.1.1', '8.8.8.8', '9.9.9.9'];
const DNS_TEST_NAME = 'www.google.com';
const WEB_TEST_URL = 'http://connectivitycheck.gstatic.com/generate_204';

async function runDiagnostics() {
  const started = Date.now();
  const iface = adapterStep();
  const gatewayIp = iface.status === 'ok' ? await defaultGateway().catch(() => null) : null;

  const [router, internet, dnsStep, web] = await Promise.all([
    iface.status === 'ok' ? routerStep(gatewayIp) : skip('router'),
    iface.status === 'ok' ? internetStep() : skip('internet'),
    iface.status === 'ok' ? dnsCheck() : skip('dns'),
    iface.status === 'ok' ? webStep() : skip('web'),
  ]);

  // როუტერი შემოწმებას არ პასუხობს, მაგრამ ინტერნეტი მუშაობს → უბრალოდ ბლოკავს ping-ს
  if (router.status === 'fail' && internet.status === 'ok') {
    router.status = 'warn';
    router.detail = 'შემოწმებას არ პასუხობს, მაგრამ კავშირი მუშაობს';
  }

  const steps = [iface, router, internet, dnsStep, web];
  return { at: Date.now(), durationMs: Date.now() - started, steps, verdict: verdict(steps) };
}

// ───────── რგოლები ─────────

function adapterStep() {
  const all = localSubnets();
  if (all.length) {
    const s = all[0];
    return step('adapter', 'ok', `${s.iface} · ${s.address}`);
  }
  // ინტერფეისი არის, მაგრამ მხოლოდ 169.254.x.x — როუტერმა (DHCP) IP არ მისცა
  const os = require('os');
  const apipa = Object.values(os.networkInterfaces())
    .flat()
    .some((a) => a?.family === 'IPv4' && !a.internal && a.address.startsWith('169.254.'));
  return step('adapter', 'fail', apipa ? 'როუტერმა IP მისამართი არ მისცა' : 'ქსელთან მიერთებული არ არის');
}

async function routerStep(ip) {
  if (!ip) return step('router', 'fail', 'როუტერის მისამართი ვერ მოიძებნა');
  const t0 = Date.now();
  const alive = await firstTrue([pingHost(ip), ...[80, 443, 53].map((p) => tcpProbe(ip, p, true))]);
  return alive
    ? step('router', 'ok', ip, Date.now() - t0)
    : step('router', 'fail', `${ip} არ პასუხობს`);
}

async function internetStep() {
  const t0 = Date.now();
  const ok = await firstTrue(INTERNET_HOSTS.map((h) => tcpProbe(h, 443)));
  return ok
    ? step('internet', 'ok', 'საჯარო სერვერები ხელმისაწვდომია', Date.now() - t0)
    : step('internet', 'fail', 'საჯარო სერვერები მიუწვდომელია');
}

async function dnsCheck() {
  const t0 = Date.now();
  const system = await withTimeout(dns.lookup(DNS_TEST_NAME, { family: 4 }));
  if (system) return step('dns', 'ok', 'სახელები იხსნება', Date.now() - t0);

  // სისტემის DNS არ მუშაობს — ვამოწმებთ Cloudflare-ს, რომ რჩევა სწორი იყოს
  const resolver = new dns.Resolver({ timeout: TIMEOUT_MS, tries: 1 });
  resolver.setServers(['1.1.1.1']);
  const alt = await withTimeout(resolver.resolve4(DNS_TEST_NAME));
  const s = step('dns', 'fail', alt ? 'სისტემის DNS სერვერი არ პასუხობს' : 'DNS მიუწვდომელია');
  s.altWorks = !!alt;
  return s;
}

async function webStep() {
  const t0 = Date.now();
  try {
    const res = await fetch(WEB_TEST_URL, {
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS + 500),
    });
    if (res.status === 204) return step('web', 'ok', 'ვებგვერდები იხსნება', Date.now() - t0);
    // 200 HTML / 30x გადამისამართება — Wi-Fi-ის ავტორიზაციის გვერდი
    const s = step('web', 'fail', 'Wi-Fi ავტორიზაციას ითხოვს');
    s.captive = true;
    return s;
  } catch {
    return step('web', 'fail', 'HTTP მოთხოვნა ვერ გავიდა');
  }
}

// ───────── დასკვნა ─────────

function verdict(steps) {
  const by = Object.fromEntries(steps.map((s) => [s.id, s]));
  const failed = (id) => by[id].status === 'fail';

  if (failed('adapter')) {
    return {
      level: 'bad',
      failedAt: 'adapter',
      title: 'კომპიუტერი ქსელთან არ არის მიერთებული',
      advice:
        by.adapter.detail === 'როუტერმა IP მისამართი არ მისცა'
          ? 'Wi-Fi/კაბელი მიერთებულია, მაგრამ როუტერმა მისამართი არ მისცა. გადატვირთე როუტერი ან გამორთე-ჩართე Wi-Fi.'
          : 'შეამოწმე, ჩართულია თუ არა Wi-Fi ან მიერთებულია თუ არა კაბელი.',
    };
  }
  if (failed('router') && failed('internet')) {
    return {
      level: 'bad',
      failedAt: 'router',
      title: 'როუტერი არ პასუხობს',
      advice: 'გადატვირთე როუტერი (გამორთე 10 წამით). Wi-Fi-ზე თუ ხარ — მიუახლოვდი როუტერს.',
    };
  }
  if (failed('internet')) {
    return {
      level: 'bad',
      failedAt: 'internet',
      title: 'პრობლემა პროვაიდერის მხარესაა',
      advice:
        'როუტერი მუშაობს, მაგრამ ინტერნეტი მასამდე არ მოდის. გადატვირთე როუტერი; თუ არ გამოსწორდა — დაუკავშირდი პროვაიდერს.',
    };
  }
  if (failed('dns')) {
    return {
      level: 'bad',
      failedAt: 'dns',
      title: 'DNS არ მუშაობს',
      advice: by.dns.altWorks
        ? 'ინტერნეტი არის, მაგრამ შენი DNS სერვერი არ პასუხობს. ქსელის პარამეტრებში DNS შეცვალე 1.1.1.1-ით ან 8.8.8.8-ით.'
        : 'ინტერნეტი არის, მაგრამ სახელები არ იხსნება. გადატვირთე როუტერი; შესაძლოა DNS ბლოკავს firewall ან VPN.',
    };
  }
  if (failed('web')) {
    return by.web.captive
      ? {
          level: 'warn',
          failedAt: 'web',
          title: 'Wi-Fi ავტორიზაციას ითხოვს',
          advice: 'გახსენი ბრაუზერი — გამოჩნდება შესვლის გვერდი (სასტუმრო, კაფე, ოფისი).',
        }
      : {
          level: 'bad',
          failedAt: 'web',
          title: 'ვებგვერდები არ იხსნება',
          advice: 'კავშირი არის, მაგრამ HTTP იბლოკება. შეამოწმე VPN, proxy ან firewall.',
        };
  }
  return {
    level: 'ok',
    failedAt: null,
    title: 'ყველაფერი რიგზეა',
    advice: 'კავშირის ყველა რგოლი მუშაობს.',
  };
}

// ───────── helpers ─────────

function step(id, status, detail, ms = null) {
  return { id, status, detail, ms };
}

function skip(id) {
  return step(id, 'skip', 'არ შემოწმდა');
}

/** TCP კავშირი; acceptRefused — "connection refused"-იც ცოცხლად ითვლება (მოწყობილობამ უპასუხა) */
function tcpProbe(host, port, acceptRefused = false) {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    const done = (ok) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(TIMEOUT_MS, () => done(false));
    sock.once('connect', () => done(true));
    sock.once('error', (err) => done(acceptRefused && err.code === 'ECONNREFUSED'));
  });
}

/** სისტემის ping (ICMP admin-ის გარეშე). TTL= პასუხში — მოწყობილობამ რეალურად უპასუხა */
function pingHost(ip) {
  const args =
    process.platform === 'win32'
      ? ['-n', '1', '-w', String(TIMEOUT_MS), ip]
      : ['-c', '1', '-W', String(Math.ceil(TIMEOUT_MS / 1000)), ip];
  return new Promise((resolve) => {
    execFile('ping', args, { windowsHide: true, timeout: TIMEOUT_MS + 1000 }, (_err, stdout) =>
      resolve(/ttl[=:]/i.test(stdout ?? ''))
    );
  });
}

/** პირველი true — მაშინვე; ყველა false — false */
function firstTrue(promises) {
  return new Promise((resolve) => {
    let left = promises.length;
    for (const p of promises) {
      p.then((v) => {
        if (v) resolve(true);
        else if (--left === 0) resolve(false);
      });
    }
  });
}

async function withTimeout(promise) {
  try {
    return await Promise.race([promise, new Promise((r) => setTimeout(() => r(null), TIMEOUT_MS))]);
  } catch {
    return null;
  }
}

module.exports = { runDiagnostics };
