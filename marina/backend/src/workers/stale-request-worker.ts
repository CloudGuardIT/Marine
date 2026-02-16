import prisma from '../lib/db';
import { BaseWorker } from './base-worker';

/**
 * Stale Request Timeout Worker
 *
 * Detects tractor requests that have been stuck in various states too long:
 * - Pending for > 2 hours → escalate priority
 * - Accepted for > 1 hour without progress → revert to pending for reassignment
 * - In-progress for > 2 hours → flag for admin attention
 *
 * Runs every 2 minutes.
 */
export class StaleRequestWorker extends BaseWorker {
  private readonly PENDING_ESCALATION_MS = 2 * 60 * 60_000;   // 2 hours
  private readonly ACCEPTED_TIMEOUT_MS = 60 * 60_000;          // 1 hour
  private readonly IN_PROGRESS_ALERT_MS = 2 * 60 * 60_000;     // 2 hours

  constructor() {
    super({
      name: 'stale-request',
      intervalMs: 2 * 60_000, // 2 minutes
    });
  }

  async execute(): Promise<void> {
    const now = Date.now();
    let actions = 0;

    // 1. Escalate priority for long-pending requests
    const pendingRequests = await prisma.tractorRequest.findMany({
      where: { status: 'pending' },
      include: { vessel: true },
    });

    for (const req of pendingRequests) {
      const age = now - req.createdAt.getTime();
      if (age > this.PENDING_ESCALATION_MS && req.priority < 10) {
        const newPriority = Math.min(req.priority + 2, 10);
        const updated = await prisma.tractorRequest.update({
          where: { id: req.id },
          data: { priority: newPriority },
          include: {
            vessel: { include: { owner: { select: { id: true, name: true, phone: true, role: true } }, spot: true } },
            requester: { select: { id: true, name: true, phone: true, role: true } },
            operator: { select: { id: true, name: true, phone: true, role: true } },
          },
        });

        await prisma.activityLog.create({
          data: {
            vesselId: req.vesselId,
            action: 'tractor_escalated',
            details: `עדיפות בקשה עלתה ל-${newPriority} (המתנה ממושכת)`,
          },
        });

        this.emit('tractor:updated', updated);
        actions++;
      }
    }

    // 2. Reset accepted requests that operators haven't started
    const staleAccepted = await prisma.tractorRequest.findMany({
      where: { status: 'accepted' },
      include: { vessel: true, operator: { select: { id: true, name: true } } },
    });

    for (const req of staleAccepted) {
      const acceptedAge = req.acceptedAt ? now - req.acceptedAt.getTime() : now - req.createdAt.getTime();
      if (acceptedAge > this.ACCEPTED_TIMEOUT_MS) {
        // Revert to pending for reassignment
        const updated = await prisma.tractorRequest.update({
          where: { id: req.id },
          data: {
            status: 'pending',
            operatorId: null,
            acceptedAt: null,
            priority: Math.min(req.priority + 1, 10),
          },
          include: {
            vessel: { include: { owner: { select: { id: true, name: true, phone: true, role: true } }, spot: true } },
            requester: { select: { id: true, name: true, phone: true, role: true } },
            operator: { select: { id: true, name: true, phone: true, role: true } },
          },
        });

        // Revert vessel from transit
        await prisma.vessel.update({
          where: { id: req.vesselId },
          data: { status: req.type === 'launch' ? 'parked' : 'in_water' },
        });

        await prisma.activityLog.create({
          data: {
            vesselId: req.vesselId,
            action: 'tractor_timeout',
            details: `בקשה חזרה לתור - מפעיל ${req.operator?.name || 'לא ידוע'} לא ביצע בזמן`,
          },
        });

        this.emit('tractor:updated', updated);
        actions++;
      }
    }

    // 3. Flag in-progress requests that are taking too long
    const staleInProgress = await prisma.tractorRequest.findMany({
      where: { status: 'in_progress' },
      include: { vessel: true },
    });

    for (const req of staleInProgress) {
      const age = req.acceptedAt ? now - req.acceptedAt.getTime() : now - req.createdAt.getTime();
      if (age > this.IN_PROGRESS_ALERT_MS) {
        await prisma.activityLog.create({
          data: {
            vesselId: req.vesselId,
            action: 'tractor_stale_alert',
            details: `התראה: בקשה בביצוע מעל ${Math.round(age / 60_000)} דקות`,
          },
        });
        actions++;
      }
    }

    if (actions > 0) {
      this.log(`Processed ${actions} stale request action(s)`);
    }
  }
}
