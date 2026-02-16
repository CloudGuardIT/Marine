import { BaseWorker, WorkerStatus } from './base-worker';
import { QueueAssignmentWorker } from './queue-assignment-worker';
import { ReservationExpirationWorker } from './reservation-expiration-worker';
import { StaleRequestWorker } from './stale-request-worker';
import { SpotSyncWorker } from './spot-sync-worker';
import { ActivityCleanupWorker } from './activity-cleanup-worker';

class WorkerManager {
  private workers: BaseWorker[] = [];

  init(): void {
    this.workers = [
      new QueueAssignmentWorker(),
      new ReservationExpirationWorker(),
      new StaleRequestWorker(),
      new SpotSyncWorker(),
      new ActivityCleanupWorker(),
    ];
  }

  startAll(): void {
    console.log(`[WorkerManager] Starting ${this.workers.length} workers...`);
    for (const worker of this.workers) {
      worker.start();
    }
  }

  stopAll(): void {
    console.log('[WorkerManager] Stopping all workers...');
    for (const worker of this.workers) {
      worker.stop();
    }
  }

  getStatuses(): WorkerStatus[] {
    return this.workers.map((w) => w.status);
  }
}

export const workerManager = new WorkerManager();
