/**
 * Versioned local save. Never throws: private browsing, full storage or blocked
 * storage all fall back to in-memory data so the game still runs.
 * Week 3 adds a native (Capacitor Preferences) backend behind the same API.
 */
export interface SaveOptions<T> {
  key: string;
  version: number;
  defaults: () => T;
  /** Upgrade older saves. Receives the stored data and its version. */
  migrate?: (data: unknown, fromVersion: number) => T;
}

interface Envelope {
  v: number;
  data: unknown;
}

export class SaveStore<T extends object> {
  private data: T;
  private readonly opts: SaveOptions<T>;

  constructor(opts: SaveOptions<T>) {
    this.opts = opts;
    this.data = this.load();
  }

  get(): Readonly<T> {
    return this.data;
  }

  update(mutator: (draft: T) => void): void {
    mutator(this.data);
    this.persist();
  }

  reset(): void {
    this.data = this.opts.defaults();
    this.persist();
  }

  private load(): T {
    const defaults = this.opts.defaults();
    try {
      const raw = globalThis.localStorage?.getItem(this.opts.key);
      if (!raw) return defaults;
      const env = JSON.parse(raw) as Envelope;
      if (env.v === this.opts.version) return { ...defaults, ...(env.data as T) };
      if (this.opts.migrate) return this.opts.migrate(env.data, env.v);
      return defaults;
    } catch {
      return defaults;
    }
  }

  private persist(): void {
    try {
      const env: Envelope = { v: this.opts.version, data: this.data };
      globalThis.localStorage?.setItem(this.opts.key, JSON.stringify(env));
    } catch {
      /* storage unavailable: keep playing from memory */
    }
  }
}
