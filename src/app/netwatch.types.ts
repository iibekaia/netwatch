export interface NetStatus {
  online: boolean | null;
  since: number;
  lastCheck: number | null;
  latencyMs: number | null;
  reason: 'starting' | 'reachable' | 'unreachable' | 'no-network' | 'browser-event' | string;
  trigger: string | null;
}

export interface NetwatchApi {
  getStatus(): Promise<NetStatus>;
  checkNow(trigger?: string): Promise<NetStatus>;
  onStatus(cb: (s: NetStatus) => void): () => void;
  onChange(cb: (s: NetStatus) => void): () => void;
  toggleDevTools(): void;
  versions: { electron: string; chrome: string; node: string };
}

declare global {
  interface Window {
    netwatch?: NetwatchApi;
  }
}
