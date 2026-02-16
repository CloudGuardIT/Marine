import prisma from '../lib/db';
import { BaseWorker } from './base-worker';

/**
 * Queue Auto-Assignment Worker
 *
 * Automatically assigns pending tractor requests to available operators.
 * Uses round-robin assignment based on which operator has the fewest
 * active requests. Emits socket events when assignments are made.
 *
 * Runs every 30 seconds.
 */
export class QueueAssignmentWorker extends BaseWorker {
  constructor() {
    super({
      name: 'queue-assignment',
      intervalMs: 30_000, // 30 seconds
    });
  }

  async execute(): Promise<void> {
    // Find pending requests with no operator assigned
    const pendingRequests = await prisma.tractorRequest.findMany({
      where: {
        status: 'pending',
        operatorId: null,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: {
        vessel: { include: { owner: { select: { id: true, name: true, phone: true, role: true } }, spot: true } },
        requester: { select: { id: true, name: true, phone: true, role: true } },
      },
    });

    if (pendingRequests.length === 0) return;

    // Find available operators (those not currently handling an active request)
    const busyOperatorIds = await prisma.tractorRequest.findMany({
      where: {
        status: { in: ['accepted', 'in_progress'] },
        operatorId: { not: null },
      },
      select: { operatorId: true },
    });

    const busyIds = new Set(busyOperatorIds.map((r) => r.operatorId!));

    const operators = await prisma.user.findMany({
      where: {
        role: { in: ['operator', 'admin'] },
        id: { notIn: [...busyIds] },
      },
      select: { id: true, name: true },
    });

    if (operators.length === 0) return;

    // Count completed requests per operator for load balancing
    const completedCounts = await prisma.tractorRequest.groupBy({
      by: ['operatorId'],
      where: {
        operatorId: { in: operators.map((o) => o.id) },
        status: 'completed',
      },
      _count: { id: true },
    });

    const countMap = new Map(completedCounts.map((c) => [c.operatorId!, c._count.id]));

    // Sort operators by fewest completed (least loaded first)
    operators.sort((a, b) => (countMap.get(a.id) || 0) - (countMap.get(b.id) || 0));

    let assignedCount = 0;
    for (let i = 0; i < pendingRequests.length && i < operators.length; i++) {
      const request = pendingRequests[i];
      const operator = operators[i % operators.length];

      const updated = await prisma.tractorRequest.update({
        where: { id: request.id },
        data: {
          operatorId: operator.id,
          status: 'accepted',
          acceptedAt: new Date(),
        },
        include: {
          vessel: { include: { owner: { select: { id: true, name: true, phone: true, role: true } }, spot: true } },
          requester: { select: { id: true, name: true, phone: true, role: true } },
          operator: { select: { id: true, name: true, phone: true, role: true } },
        },
      });

      // Update vessel to transit
      await prisma.vessel.update({
        where: { id: request.vesselId },
        data: { status: 'transit' },
      });

      await prisma.activityLog.create({
        data: {
          userId: operator.id,
          vesselId: request.vesselId,
          action: 'tractor_auto_assigned',
          details: `בקשה הוקצתה אוטומטית ל"${operator.name}"`,
        },
      });

      this.emit('tractor:updated', updated);
      assignedCount++;
    }

    if (assignedCount > 0) {
      this.log(`Auto-assigned ${assignedCount} request(s) to operators`);
    }
  }
}
