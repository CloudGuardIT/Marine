import prisma from '../lib/db';
import { BaseWorker } from './base-worker';

/**
 * Spot Status Sync Worker
 *
 * Validates parking spot statuses are consistent with vessel data:
 * - Spots marked "occupied" with no vessel → mark as "available"
 * - Spots with a vessel but marked "available" → mark as "occupied"
 * - Detects and logs any data inconsistencies
 *
 * Runs every 3 minutes.
 */
export class SpotSyncWorker extends BaseWorker {
  constructor() {
    super({
      name: 'spot-sync',
      intervalMs: 3 * 60_000, // 3 minutes
    });
  }

  async execute(): Promise<void> {
    let fixes = 0;

    // Get all spots with their vessels
    const spots = await prisma.parkingSpot.findMany({
      include: { vessel: true },
    });

    for (const spot of spots) {
      const hasVessel = spot.vessel !== null;

      // Fix: spot says occupied but no vessel is assigned
      if (spot.status === 'occupied' && !hasVessel) {
        // Check if there's an active reservation
        const activeReservation = await prisma.reservation.findFirst({
          where: {
            spotId: spot.id,
            status: 'active',
            endDate: { gt: new Date() },
          },
        });

        const newStatus = activeReservation ? 'reserved' : 'available';
        await prisma.parkingSpot.update({
          where: { id: spot.id },
          data: { status: newStatus },
        });

        await prisma.activityLog.create({
          data: {
            action: 'spot_sync_fix',
            details: `מקום ${spot.number}: תוקן מ"תפוס" ל"${newStatus === 'available' ? 'פנוי' : 'שמור'}" (אין כלי שייט)`,
          },
        });
        fixes++;
      }

      // Fix: spot has a vessel but isn't marked occupied
      if (hasVessel && spot.status === 'available') {
        await prisma.parkingSpot.update({
          where: { id: spot.id },
          data: { status: 'occupied' },
        });

        await prisma.activityLog.create({
          data: {
            vesselId: spot.vessel!.id,
            action: 'spot_sync_fix',
            details: `מקום ${spot.number}: תוקן מ"פנוי" ל"תפוס" (כלי שייט "${spot.vessel!.name}" נמצא)`,
          },
        });
        fixes++;
      }

      // Fix: vessel is in the spot but vessel status says in_water
      if (hasVessel && spot.vessel!.status === 'in_water') {
        await prisma.vessel.update({
          where: { id: spot.vessel!.id },
          data: { spotId: null },
        });
        await prisma.parkingSpot.update({
          where: { id: spot.id },
          data: { status: 'available' },
        });

        await prisma.activityLog.create({
          data: {
            vesselId: spot.vessel!.id,
            action: 'spot_sync_fix',
            details: `מקום ${spot.number}: כלי שייט "${spot.vessel!.name}" סומן כ"במים" אך היה משויך למקום - הוסר`,
          },
        });
        fixes++;
      }
    }

    if (fixes > 0) {
      this.log(`Fixed ${fixes} spot inconsistency(ies)`);
      // Emit refreshed spots
      const updatedSpots = await prisma.parkingSpot.findMany({ include: { vessel: true } });
      this.emit('spot:updated', updatedSpots);
    }
  }
}
