const dgram = require('dgram');
const dns = require('dns').promises;
const fs = require('fs').promises;
const os = require('os');
const { execFile } = require('child_process');

/**
 * ლოკალური ქსელის სკანერი (main process).
 *
 * როგორ მუშაობს:
 *  1. ვიღებთ ჩვენს IPv4 ინტერფეისებს და მათ subnet-ს (მაქს. /24 — 254 მისამართი).
 *  2. თითოეულ მისამართზე ვაგზავნით NetBIOS NBSTAT მოთხოვნას (UDP 137).
 *     - ამის გამო სისტემა ARP-ით არკვევს, ვინ არის ქსელში (ARP ცხრილი ივსება);
 *     - Windows-მოწყობილობები პასუხობენ თავიანთი სახელით და workgroup-ით.
 *  3. ვკითხულობთ `arp -a`-ს — ყველა მოწყობილობა, რომელმაც უპასუხა, აქ ჩანს.
 *  4. სახელს ვცდილობთ reverse DNS-ით (როუტერი ხშირად იცნობს DHCP-ს სახელებს).
 *
 * admin უფლებები არ სჭირდება. მოწყობილობა, რომელიც ARP-ზე არ პასუხობს
 * (ან Wi-Fi-ს "client isolation" რთავს), არ გამოჩნდება.
 */

const MAX_HOSTS = 254;

/** ჩვენი IPv4 ქსელები: [{ iface, address, netmask, mac, network, broadcast, hosts[] }] */
function localSubnets() {
  const result = [];
  for (const [iface, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (a.address.startsWith('169.254.')) continue; // APIPA — ქსელი რეალურად არ არის

      const ip = toInt(a.address);
      // /24-ზე დიდ ქსელში მხოლოდ ჩვენს /24-ს ვასკანერებთ
      let mask = toInt(a.netmask);
      if (~mask >>> 0 > MAX_HOSTS + 1) mask = toInt('255.255.255.0');
      const network = (ip & mask) >>> 0;
      const broadcast = (network | (~mask >>> 0)) >>> 0;

      const hosts = [];
      for (let h = network + 1; h < broadcast; h++) if (h !== ip) hosts.push(toIp(h));
      result.push({
        iface,
        address: a.address,
        netmask: toIp(mask),
        mac: normalizeMac(a.mac),
        network: toIp(network),
        broadcast: toIp(broadcast),
        hosts,
      });
    }
  }
  return result;
}

/** onProbe(ip) — იძახება თითოეულ მისამართზე (peer-discovery აქ უგზავნის unicast "hello"-ს) */
async function scan({ onProbe } = {}) {
  const subnets = localSubnets();
  const targets = subnets.flatMap((s) => s.hosts);

  // NBSTAT — ორჯერ ვაგზავნით, რომ ნელმა მოწყობილობებმაც მოასწრონ ARP-ზე პასუხი
  const netbios = await netbiosSweep(targets, onProbe);

  const [arp, gateway] = await Promise.all([readArp(), defaultGateway()]);

  const devices = new Map();
  const inSubnet = (ip) => subnets.some((s) => sameSubnet(ip, s));

  for (const s of subnets) {
    devices.set(s.address, { ip: s.address, mac: s.mac, self: true, iface: s.iface });
  }
  for (const { ip, mac } of arp) {
    if (!inSubnet(ip) || subnets.some((s) => s.broadcast === ip || s.network === ip)) continue;
    if (devices.has(ip)) continue;
    devices.set(ip, { ip, mac });
  }
  // NetBIOS-მა უპასუხა, მაგრამ ARP-ში ჯერ არ ჩანს
  for (const [ip, nb] of netbios) {
    if (!devices.has(ip)) devices.set(ip, { ip, mac: nb.mac });
  }

  const list = [...devices.values()];
  await Promise.all(
    list.map(async (d) => {
      const nb = netbios.get(d.ip);
      if (nb) {
        d.netbiosName = nb.name;
        d.workgroup = nb.workgroup;
        if (!d.mac && nb.mac) d.mac = nb.mac;
      }
      if (d.self) d.hostname = os.hostname();
      else d.hostname = await reverseDns(d.ip);
      d.gateway = d.ip === gateway;
      d.randomMac = isRandomMac(d.mac);
    })
  );

  return {
    scannedAt: Date.now(),
    subnets: subnets.map(({ hosts, ...s }) => ({ ...s, size: hosts.length + 1 })),
    gateway,
    devices: list,
  };
}

// ───────── NetBIOS (UDP 137) ─────────

// NBSTAT მოთხოვნა სახელზე "*" — "მითხარი შენი სახელები"
const NBSTAT_QUERY = Buffer.from([
  0x13, 0x37, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20,
  0x43, 0x4b, ...Array(30).fill(0x41), 0x00, 0x00, 0x21, 0x00, 0x01,
]);

function netbiosSweep(targets, onProbe, waitMs = 1500) {
  return new Promise((resolve) => {
    const found = new Map();
    const sock = dgram.createSocket('udp4');
    sock.on('error', () => {});
    sock.on('message', (msg, rinfo) => {
      const parsed = parseNbstat(msg);
      if (parsed) found.set(rinfo.address, parsed);
    });
    sock.bind(0, async () => {
      for (let round = 0; round < 2; round++) {
        for (const ip of targets) {
          sock.send(NBSTAT_QUERY, 137, ip, () => {});
          if (round === 0) onProbe?.(ip);
        }
        await delay(round === 0 ? 600 : waitMs);
      }
      sock.close();
      resolve(found);
    });
  });
}

function parseNbstat(buf) {
  try {
    let o = 12;
    // სახელის გამოტოვება (ჩვეულებრივ 34 ბაიტი, ან კომპრესირებული pointer)
    if ((buf[o] & 0xc0) === 0xc0) o += 2;
    else {
      while (buf[o] !== 0) o += buf[o] + 1;
      o += 1;
    }
    if (buf.readUInt16BE(o) !== 0x21) return null; // NBSTAT
    o += 10; // type, class, ttl, rdlength
    const count = buf[o++];
    let name = null;
    let workgroup = null;
    for (let i = 0; i < count; i++, o += 18) {
      const n = buf.toString('latin1', o, o + 15).trim();
      const suffix = buf[o + 15];
      const group = (buf.readUInt16BE(o + 16) & 0x8000) !== 0;
      if (suffix === 0x00 && !group && !name) name = n;
      if (suffix === 0x00 && group && !workgroup) workgroup = n;
    }
    const mac = normalizeMac([...buf.subarray(o, o + 6)].map((b) => b.toString(16)).join(':'));
    return { name, workgroup, mac: mac === '00:00:00:00:00:00' ? null : mac };
  } catch {
    return null;
  }
}

// ───────── ARP / gateway / DNS ─────────

function readArp() {
  // Linux: ბირთვის ცხრილი პირდაპირ (arp/net-tools ახალ დისტრიბუტივებზე ხშირად არ არის დაყენებული)
  if (process.platform === 'linux') return readProcArp();

  return run('arp', ['-a']).then((out) => {
    const entries = [];
    // Windows: "192.168.1.1   48-55-41-73-87-78   dynamic"
    // macOS/Linux: "? (192.168.1.1) at 48:55:41:73:87:78 on en0"
    const re = /(\d{1,3}(?:\.\d{1,3}){3})\)?\s+(?:at\s+)?((?:[0-9a-f]{1,2}[:-]){5}[0-9a-f]{1,2})/gi;
    for (const m of out.matchAll(re)) {
      const mac = normalizeMac(m[2]);
      // multicast/broadcast MAC (პირველი ბაიტის ბოლო ბიტი = 1) — მოწყობილობა არ არის
      if (parseInt(mac.slice(0, 2), 16) & 1) continue;
      entries.push({ ip: m[1], mac });
    }
    return entries;
  });
}

/**
 * /proc/net/arp:
 *   IP address    HW type  Flags  HW address          Mask  Device
 *   192.168.1.1   0x1      0x2    48:55:41:73:87:78   *     wlan0
 * Flags 0x0 — მისამართი ჯერ არ გაირკვა (მოწყობილობამ არ უპასუხა).
 */
async function readProcArp() {
  let text = '';
  try {
    text = await fs.readFile('/proc/net/arp', 'utf8');
  } catch {
    return [];
  }
  const entries = [];
  for (const line of text.split('\n').slice(1)) {
    const [ip, , flags, hw] = line.trim().split(/\s+/);
    if (!ip || !hw || flags === '0x0') continue;
    const mac = normalizeMac(hw);
    if (mac === '00:00:00:00:00:00' || parseInt(mac.slice(0, 2), 16) & 1) continue;
    entries.push({ ip, mac });
  }
  return entries;
}

async function defaultGateway() {
  if (process.platform === 'win32') {
    const out = await run('route', ['print', '-4', '0.0.0.0']);
    return out.match(/^\s*0\.0\.0\.0\s+0\.0\.0\.0\s+(\d{1,3}(?:\.\d{1,3}){3})/m)?.[1] ?? null;
  }
  if (process.platform === 'linux') {
    // /proc/net/route: Destination 00000000 = default; Gateway — hex, little-endian ("0101A8C0" → 192.168.1.1)
    try {
      const text = await fs.readFile('/proc/net/route', 'utf8');
      for (const line of text.split('\n').slice(1)) {
        const [, dest, gw] = line.trim().split(/\s+/);
        if (dest === '00000000' && gw && gw !== '00000000') {
          return toIp(parseInt(gw.match(/../g).reverse().join(''), 16));
        }
      }
    } catch {
      // ქვემოთ — netstat
    }
  }
  // macOS: "default   192.168.1.1   UGScg   en0"
  const out = await run('netstat', ['-rn']);
  return out.match(/^(?:default|0\.0\.0\.0)\s+(\d{1,3}(?:\.\d{1,3}){3})/m)?.[1] ?? null;
}

async function reverseDns(ip, timeoutMs = 1500) {
  try {
    const names = await Promise.race([dns.reverse(ip), delay(timeoutMs).then(() => [])]);
    // "iPhone.lan." → "iPhone" (როუტერის ლოკალური დომენი არაფერს ამბობს)
    return names[0]?.replace(/\.$/, '').replace(/\.(lan|home|local|localdomain|router)$/i, '') ?? null;
  } catch {
    return null;
  }
}

// ───────── helpers ─────────

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout: 5000 }, (_err, stdout) => resolve(stdout ?? ''));
  });
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function toInt(ip) {
  return ip.split('.').reduce((acc, p) => ((acc << 8) | Number(p)) >>> 0, 0);
}

function toIp(n) {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

function sameSubnet(ip, s) {
  const mask = toInt(s.netmask);
  return ((toInt(ip) & mask) >>> 0) === toInt(s.network);
}

function normalizeMac(mac) {
  if (!mac) return null;
  return mac
    .toLowerCase()
    .split(/[:-]/)
    .map((p) => p.padStart(2, '0'))
    .join(':');
}

/** ტელეფონები "კონფიდენციალურობის" რეჟიმში შემთხვევით MAC-ს იყენებენ (locally administered ბიტი) */
function isRandomMac(mac) {
  return !!mac && (parseInt(mac.slice(0, 2), 16) & 0x02) !== 0;
}

module.exports = { scan, localSubnets };
