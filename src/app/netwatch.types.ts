export interface NetStatus {
  online: boolean | null;
  since: number;
  lastCheck: number | null;
  latencyMs: number | null;
  reason: 'starting' | 'reachable' | 'unreachable' | 'no-network' | 'browser-event' | string;
  trigger: string | null;
}

/** ქსელში აღმოჩენილი NetWatch-ის სხვა ასლი */
export interface LanPeer {
  ip: string;
  addresses: string[];
  id: string;
  host: string;
  user: string;
  version: string;
  platform: string;
  lastSeen: number;
}

export interface LanDevice {
  ip: string;
  mac: string | null;
  /** reverse DNS (როუტერისგან) */
  hostname?: string | null;
  /** Windows-ის კომპიუტერის სახელი (NetBIOS) */
  netbiosName?: string | null;
  workgroup?: string | null;
  self?: boolean;
  gateway?: boolean;
  /** შემთხვევითი (privacy) MAC — ჩვეულებრივ ტელეფონი */
  randomMac?: boolean;
  iface?: string;
  /** ამ მოწყობილობაზე NetWatch მუშაობს */
  peer: LanPeer | null;
}

export interface LanSubnet {
  iface: string;
  address: string;
  netmask: string;
  network: string;
  size: number;
}

export interface LanState {
  scanning: boolean;
  scannedAt: number | null;
  subnets: LanSubnet[];
  gateway: string | null;
  selfId: string;
  devices: LanDevice[];
}

export interface ProviderInfo {
  ip: string | null;
  isp: string | null;
  /** IP-ბლოკის სახელი (თუ პროვაიდერის სახელისგან განსხვავდება) */
  network: string | null;
  asn: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  /** რომელ სერვერთან ტარდება სიჩქარის ტესტი */
  server: string | null;
  at: number;
}

export type SpeedPhase = 'ping' | 'download' | 'upload';

export interface SpeedProgress {
  phase: SpeedPhase;
  /** ping-ზე — ms, download/upload-ზე — Mbps */
  value: number;
  /** ეტაპის პროგრესი 0..1 */
  progress: number;
}

export interface SpeedResult {
  at: number;
  ping: number;
  jitter: number;
  download: number;
  upload: number;
}

export type SpeedRunResponse = { ok: true; result: SpeedResult } | { ok: false; error: string };

export interface NetwatchApi {
  getStatus(): Promise<NetStatus>;
  checkNow(trigger?: string): Promise<NetStatus>;
  onStatus(cb: (s: NetStatus) => void): () => void;
  onChange(cb: (s: NetStatus) => void): () => void;
  getLan(): Promise<LanState>;
  scanLan(): Promise<LanState>;
  onLan(cb: (s: LanState) => void): () => void;
  getProvider(refresh?: boolean): Promise<ProviderInfo | null>;
  onProvider(cb: (p: ProviderInfo | null) => void): () => void;
  runSpeedTest(): Promise<SpeedRunResponse>;
  cancelSpeedTest(): void;
  onSpeedProgress(cb: (p: SpeedProgress) => void): () => void;
  toggleDevTools(): void;
  versions: { electron: string; chrome: string; node: string };
}

declare global {
  interface Window {
    netwatch?: NetwatchApi;
  }
}
