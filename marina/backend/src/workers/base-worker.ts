import { getIO } from '../socket';

export interface WorkerConfig {
  name: string;
  intervalMs: number;
  enabled?: boolean;
}

export interface WorkerStatus {
  name: string;
  running: boolean;
  lastRun: Date | null;
  lastError: string | null;
  runCount: number;
  errorCount: number;
}

export abstract class BaseWorker {
  protected config: WorkerConfig;
  private timer: NodeJS.Timeout | null = null;
  private _status: WorkerStatus;

  constructor(config: WorkerConfig) {
    this.config = config;
    this._status = {
      name: config.name,
      running: false,
      lastRun: null,
      lastError: null,
      runCount: 0,
      errorCount: 0,
    };
  }

  abstract execute(): Promise<void>;

  start(): void {
    if (this.config.enabled === false) {
      console.log(`[Worker:${this.config.name}] Disabled, skipping start`);
      return;
    }
    if (this.timer) return;

    console.log(`[Worker:${this.config.name}] Started (interval: ${this.config.intervalMs}ms)`);
    this._status.running = true;

    // Run immediately on start, then on interval
    this.tick();
    this.timer = setInterval(() => this.tick(), this.config.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this._status.running = false;
      console.log(`[Worker:${this.config.name}] Stopped`);
    }
  }

  get status(): WorkerStatus {
    return { ...this._status };
  }

  protected emit(event: string, data: any): void {
    getIO().emit(event, data);
  }

  protected log(message: string): void {
    console.log(`[Worker:${this.config.name}] ${message}`);
  }

  private async tick(): Promise<void> {
    try {
      await this.execute();
      this._status.lastRun = new Date();
      this._status.runCount++;
      this._status.lastError = null;
    } catch (err) {
      this._status.errorCount++;
      this._status.lastError = err instanceof Error ? err.message : String(err);
      console.error(`[Worker:${this.config.name}] Error:`, err);
    }
  }
}
