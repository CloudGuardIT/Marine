import prisma from '../lib/db';
import { BaseWorker } from './base-worker';

/**
 * Reservation Expiration Worker
 *
 * Checks for reservations that have passed their end date and marks
 * them as completed. Also updates parking spot statuses for spots
 * whose reservations have expired (marks them available if unoccupied).
 *
 * Runs every 5 minutes.
 */
export class ReservationExpirationWorker extends BaseWorker {
  constructor() {
    super({
      name: 'reservation-expiration',
      intervalMs: 5 * 60_000, // 5 minutes
    });
  }

  async execute(): Promise<void> {
    const now = new Date();

    // Find active reservations past their end date
    const expired = await prisma.reservation.findMany({
      where: {
        status: 'active',
        endDate: { lt: now },
      },
      include: { vessel: true, spot: true },
    });

    if (expired.length === 0) return;

    for (const reservation of expired) {
      // Mark reservation as completed
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: 'completed' },
      });

      // If the spot was reserved and no vessel is currently parked in it,
      // mark it as available
      if (reservation.spot.status === 'reserved') {
        const vesselInSpot = await prisma.vessel.findFirst({
          where: { spotId: reservation.spotId },
        });

        if (!vesselInSpot) {
          await prisma.parkingSpot.update({
            where: { id: reservation.spotId },
            data: { status: 'available' },
          });
        }
      }

      await prisma.activityLog.create({
        data: {
          vesselId: reservation.vesselId,
          action: 'reservation_expired',
          details: `הזמנה למקום ${reservation.spot.number} פגה תוקף`,
        },
      });
    }

    this.log(`Expired ${expired.length} reservation(s)`);

    // Emit updated spots
    const spots = await prisma.parkingSpot.findMany({ include: { vessel: true } });
    this.emit('spot:updated', spots);
  }
}
