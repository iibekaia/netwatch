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

/** შენახული გათიშვა (electron/history-store.js) */
export interface Outage {
  start: number;
  end: number;
  durationMs: number;
  /** ჯერ გრძელდება */
  ongoing: boolean;
  reason: string;
  /** დიაგნოსტიკის დასკვნა, მაგ. "პრობლემა პროვაიდერის მხარესაა" */
  cause: string | null;
  failedAt: DiagStepId | null;
  /** აპი დაიხურა გათიშვის დროს — დასასრული მიახლოებითია */
  unknownEnd: boolean;
}

export interface HistoryReport {
  summary: {
    from: number;
    to: number;
    /** როცა NetWatch მუშაობდა */
    monitoredMs: number;
    downtimeMs: number;
    uptimePct: number | null;
    count: number;
    longestMs: number;
    longestAt: number | null;
    avgMs: number;
    /** გათიშვები პროვაიდერის მხარეს (როუტერი მუშაობდა) */
    providerCount: number;
    ongoing: boolean;
  };
  days: { date: number; downtimeMs: number; count: number; monitoredMs: number }[];
  outages: Outage[];
}

export interface HistoryRange {
  from: number;
  to: number;
}

export type ExportResult = { ok: true; path: string } | { ok: false; canceled?: boolean; error?: string };

/** კავშირის ჯაჭვის რგოლი: კომპიუტერი → როუტერი → ინტერნეტი → DNS → ვები */
export type DiagStepId = 'adapter' | 'router' | 'internet' | 'dns' | 'web';

export interface DiagStep {
  id: DiagStepId;
  status: 'ok' | 'warn' | 'fail' | 'skip';
  detail: string;
  /** პასუხის დრო */
  ms: number | null;
}

export interface DiagResult {
  at: number;
  durationMs: number;
  steps: DiagStep[];
  verdict: {
    level: 'ok' | 'warn' | 'bad';
    /** პირველი ჩავარდნილი რგოლი */
    failedAt: DiagStepId | null;
    title: string;
    advice: string;
  };
}

export interface DiagState {
  running: boolean;
  /** რამ გაუშვა: offline (ავტომატურად) | online | manual */
  trigger: string | null;
  result: DiagResult | null;
}

export type UpdateStatus =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateState {
  status: UpdateStatus;
  /** auto — ფონზე იწერება და თვითონ დგება; manual — ღილაკი „გადმოწერა“ (macOS, Portable) */
  mode: 'auto' | 'manual' | null;
  currentVersion: string;
  /** ახალი ვერსია */
  version: string | null;
  /** გადმოწერის პროგრესი 0..100 */
  progress: number | null;
  error: string | null;
  checkedAt: number | null;
}

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
  queryHistory(range: HistoryRange): Promise<HistoryReport>;
  exportHistory(opts: HistoryRange & { format: 'csv' | 'pdf'; periodLabel: string }): Promise<ExportResult>;
  clearHistory(): Promise<void>;
  onHistory(cb: () => void): () => void;
  getDiagnostics(): Promise<DiagState>;
  runDiagnostics(): Promise<DiagState>;
  onDiagnostics(cb: (s: DiagState) => void): () => void;
  getUpdate(): Promise<UpdateState>;
  checkUpdate(): Promise<UpdateState>;
  installUpdate(): void;
  onUpdate(cb: (s: UpdateState) => void): () => void;
  toggleDevTools(): void;
  versions: { electron: string; chrome: string; node: string };
}

declare global {
  interface Window {
    netwatch?: NetwatchApi;
  }
}
