import prisma from '../lib/db';
import { BaseWorker } from './base-worker';

/**
 * Activity Log Cleanup Worker
 *
 * Deletes activity log entries older than the retention period (default 90 days)
 * to prevent unbounded table growth. Runs once daily.
 *
 * Runs every 24 hours.
 */
export class ActivityCleanupWorker extends BaseWorker {
  private readonly retentionDays: number;

  constructor(retentionDays = 90) {
    super({
      name: 'activity-cleanup',
      intervalMs: 24 * 60 * 60_000, // 24 hours
    });
    this.retentionDays = retentionDays;
  }

  async execute(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);

    const result = await prisma.activityLog.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    });

    if (result.count > 0) {
      this.log(`Cleaned up ${result.count} activity log entries older than ${this.retentionDays} days`);
    }
  }
}
