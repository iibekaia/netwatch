const dgram = require('dgram');
const os = require('os');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { localSubnets } = require('./lan-scanner');

/**
 * NetWatch-ის სხვა ასლების პოვნა ლოკალურ ქსელში (main process).
 *
 * ყოველი გაშვებული NetWatch უსმენს UDP პორტს PORT და:
 *  - გაშვებისას და ყოველ ANNOUNCE_MS-ში broadcast-ით აგზავნის "hello"-ს;
 *  - "hello"-ს რომ მიიღებს, პირდაპირ (unicast) პასუხობს "here"-თი;
 *  - დახურვისას აგზავნის "bye"-ს.
 * თუ ასლისგან PEER_TTL_MS-ის განმავლობაში არაფერი მოვიდა — სიიდან იშლება.
 *
 * Windows Firewall პირველ გაშვებაზე იკითხავს, მისცე თუ არა ქსელთან წვდომა —
 * სხვები ამ კომპიუტერს მხოლოდ "Allow"-ის შემდეგ დაინახავენ.
 *
 * ასლს id-ით ვცნობთ, არა IP-ით: broadcast შეიძლება რამდენიმე ინტერფეისით გავიდეს
 * და სხვადასხვა წყარო-მისამართით მოვიდეს. ამიტომ შეტყობინებაში ასლი თავის IP-ებსაც აგზავნის.
 *
 * მოვლენები: 'change' (peers[])
 */

const PORT = 47821;
const ANNOUNCE_MS = 15000;
const PEER_TTL_MS = 45000;

class PeerDiscovery extends EventEmitter {
  constructor({ version }) {
    super();
    this.id = crypto.randomUUID();
    this.info = {
      app: 'netwatch',
      v: 1,
      id: this.id,
      host: os.hostname(),
      user: os.userInfo().username,
      version,
      platform: process.platform,
    };
    this.peers = new Map(); // id → peer
    this.sock = null;
    this._ready = false; // bind-მდე send() სოკეტს შემთხვევით პორტზე მიაბამდა
    this._timer = null;
  }

  start() {
    if (this.sock) return;
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.sock = sock;
    sock.on('error', (err) => {
      console.warn('[peers] socket error', err.message);
      sock.close();
      if (this.sock === sock) {
        this.sock = null;
        this._ready = false;
      }
    });
    sock.on('message', (msg, rinfo) => this._onMessage(msg, rinfo));
    sock.bind(PORT, () => {
      this._ready = true;
      sock.setBroadcast(true);
      this.announce();
    });
    this._timer = setInterval(() => {
      this.announce();
      this._expire();
    }, ANNOUNCE_MS);
  }

  stop() {
    clearInterval(this._timer);
    if (!this.sock) return;
    this._broadcast('bye');
    const sock = this.sock;
    this.sock = null;
    this._ready = false;
    setTimeout(() => sock.close(), 100);
  }

  /** broadcast "hello" ყველა ქსელში */
  announce() {
    this._broadcast('hello');
  }

  /** unicast "hello" — სკანირებისას, თუ როუტერი broadcast-ს ბლოკავს */
  probe(ip) {
    this._send('hello', ip);
  }

  list() {
    return [...this.peers.values()];
  }

  _broadcast(type) {
    const targets = new Set(localSubnets().map((s) => s.broadcast));
    targets.add('255.255.255.255');
    for (const ip of targets) this._send(type, ip);
  }

  _send(type, ip) {
    if (!this.sock || !this._ready) return;
    const addresses = localSubnets().map((s) => s.address);
    const msg = Buffer.from(JSON.stringify({ ...this.info, addresses, type }));
    this.sock.send(msg, PORT, ip, () => {});
  }

  _onMessage(msg, rinfo) {
    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch {
      return;
    }
    if (data?.app !== 'netwatch' || data.id === this.id) return;

    const id = String(data.id);
    if (data.type === 'bye') {
      if (this.peers.delete(id)) this._emit();
      return;
    }
    if (data.type === 'hello') this._send('here', rinfo.address);

    const ipRe = /^\d{1,3}(\.\d{1,3}){3}$/;
    const own = Array.isArray(data.addresses) ? data.addresses.filter((a) => ipRe.test(a)) : [];
    const prev = this.peers.get(id);
    const addresses = [
      ...new Set([...own.slice(0, 8), ...(prev?.addresses ?? []), rinfo.address]),
    ].slice(0, 12);
    const changed = !prev || prev.addresses.length !== addresses.length;
    this.peers.set(id, {
      ip: own[0] ?? rinfo.address,
      addresses,
      id,
      host: String(data.host ?? '').slice(0, 64),
      user: String(data.user ?? '').slice(0, 64),
      version: String(data.version ?? '').slice(0, 16),
      platform: String(data.platform ?? '').slice(0, 16),
      lastSeen: Date.now(),
    });
    if (changed) this._emit();
  }

  _expire() {
    const now = Date.now();
    let changed = false;
    for (const [id, p] of this.peers) {
      if (now - p.lastSeen > PEER_TTL_MS) {
        this.peers.delete(id);
        changed = true;
      }
    }
    if (changed) this._emit();
  }

  _emit() {
    this.emit('change', this.list());
  }
}

module.exports = { PeerDiscovery };
