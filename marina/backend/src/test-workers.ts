import prisma from './lib/db';
import { QueueAssignmentWorker } from './workers/queue-assignment-worker';
import { ReservationExpirationWorker } from './workers/reservation-expiration-worker';
import { StaleRequestWorker } from './workers/stale-request-worker';
import { SpotSyncWorker } from './workers/spot-sync-worker';
import { ActivityCleanupWorker } from './workers/activity-cleanup-worker';

async function testWorkers() {
  console.log('========================================');
  console.log('  Marina Workers Integration Test');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  function assert(label: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`  ✓ ${label}`);
      passed++;
    } else {
      console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
      failed++;
    }
  }

  // ──────────────────────────────────────────────
  // TEST 1: Queue Assignment Worker
  // ──────────────────────────────────────────────
  console.log('\n── Test 1: Queue Assignment Worker ──');

  // Reset: put back the 2 requests to pending with no operator
  await prisma.tractorRequest.updateMany({
    where: { status: { in: ['accepted', 'in_progress'] } },
    data: { status: 'pending', operatorId: null, acceptedAt: null },
  });

  // Reset vessels back from transit
  await prisma.vessel.updateMany({
    where: { status: 'transit' },
    data: { status: 'parked' },
  });

  const pendingBefore = await prisma.tractorRequest.count({ where: { status: 'pending', operatorId: null } });
  console.log(`  Pending unassigned requests: ${pendingBefore}`);
  assert('Has pending unassigned requests', pendingBefore >= 2);

  const worker1 = new QueueAssignmentWorker();
  await worker1.execute();

  const pendingAfter = await prisma.tractorRequest.count({ where: { status: 'pending', operatorId: null } });
  const assigned = await prisma.tractorRequest.findMany({
    where: { status: 'accepted', operatorId: { not: null } },
    include: { operator: { select: { name: true } }, vessel: { select: { name: true } } },
  });

  assert('No more unassigned pending requests', pendingAfter === 0);
  assert('Requests were assigned to operators', assigned.length >= 2);
  for (const a of assigned) {
    console.log(`    → "${a.vessel.name}" assigned to ${a.operator?.name}`);
  }

  const autoAssignLogs = await prisma.activityLog.count({ where: { action: 'tractor_auto_assigned' } });
  assert('Activity logs created for auto-assignment', autoAssignLogs >= 2);

  // ──────────────────────────────────────────────
  // TEST 2: Reservation Expiration Worker
  // ──────────────────────────────────────────────
  console.log('\n── Test 2: Reservation Expiration Worker ──');

  // Create an expired reservation
  const parkedVessel = await prisma.vessel.findFirst({ where: { status: 'parked' } });
  const availSpot = await prisma.parkingSpot.findFirst({ where: { status: 'available' } });

  if (parkedVessel && availSpot) {
    // Mark spot as reserved
    await prisma.parkingSpot.update({ where: { id: availSpot.id }, data: { status: 'reserved' } });

    const expiredRes = await prisma.reservation.create({
      data: {
        vesselId: parkedVessel.id,
        spotId: availSpot.id,
        startDate: new Date(Date.now() - 48 * 3600_000), // 2 days ago
        endDate: new Date(Date.now() - 24 * 3600_000),   // 1 day ago (expired)
        status: 'active',
      },
    });

    const worker2 = new ReservationExpirationWorker();
    await worker2.execute();

    const updatedRes = await prisma.reservation.findUnique({ where: { id: expiredRes.id } });
    assert('Expired reservation marked as completed', updatedRes?.status === 'completed');

    const updatedSpot = await prisma.parkingSpot.findUnique({ where: { id: availSpot.id } });
    assert('Freed spot marked as available', updatedSpot?.status === 'available');

    const expLogs = await prisma.activityLog.count({ where: { action: 'reservation_expired' } });
    assert('Expiration logged in activity', expLogs >= 1);
  } else {
    console.log('  (skipped — no available test data)');
  }

  // ──────────────────────────────────────────────
  // TEST 3: Stale Request Worker
  // ──────────────────────────────────────────────
  console.log('\n── Test 3: Stale Request Worker ──');

  // Create a long-pending request with old timestamp
  const stalePendingVessel = await prisma.vessel.findFirst({
    where: {
      status: 'parked',
      tractorRequests: { none: { status: { in: ['pending', 'accepted', 'in_progress'] } } },
    },
  });

  if (stalePendingVessel) {
    const staleReq = await prisma.tractorRequest.create({
      data: {
        vesselId: stalePendingVessel.id,
        requesterId: (await prisma.user.findFirst({ where: { role: 'customer' } }))!.id,
        type: 'launch',
        priority: 1,
        createdAt: new Date(Date.now() - 3 * 3600_000), // 3 hours ago
      },
    });

    const priorityBefore = staleReq.priority;

    const worker3 = new StaleRequestWorker();
    await worker3.execute();

    const updatedStale = await prisma.tractorRequest.findUnique({ where: { id: staleReq.id } });
    assert('Stale pending request priority escalated', (updatedStale?.priority || 0) > priorityBefore,
      `was ${priorityBefore}, now ${updatedStale?.priority}`);

    const escLogs = await prisma.activityLog.count({ where: { action: 'tractor_escalated' } });
    assert('Escalation logged in activity', escLogs >= 1);

    // Clean up
    await prisma.tractorRequest.delete({ where: { id: staleReq.id } });
  } else {
    console.log('  (skipped — no available vessel for stale test)');
  }

  // Test stale accepted request → revert to pending
  const acceptedReq = await prisma.tractorRequest.findFirst({ where: { status: 'accepted' } });
  if (acceptedReq) {
    // Make it look like it was accepted 2 hours ago
    await prisma.tractorRequest.update({
      where: { id: acceptedReq.id },
      data: { acceptedAt: new Date(Date.now() - 2 * 3600_000) },
    });

    const worker3b = new StaleRequestWorker();
    await worker3b.execute();

    const reverted = await prisma.tractorRequest.findUnique({ where: { id: acceptedReq.id } });
    assert('Stale accepted request reverted to pending', reverted?.status === 'pending');
    assert('Operator removed from reverted request', reverted?.operatorId === null);

    const timeoutLogs = await prisma.activityLog.count({ where: { action: 'tractor_timeout' } });
    assert('Timeout logged in activity', timeoutLogs >= 1);
  }

  // ──────────────────────────────────────────────
  // TEST 4: Spot Sync Worker
  // ──────────────────────────────────────────────
  console.log('\n── Test 4: Spot Sync Worker ──');

  // Corrupt a spot: mark an empty spot as occupied
  const emptySpot = await prisma.parkingSpot.findFirst({
    where: { status: 'available', vessel: null },
  });

  if (emptySpot) {
    await prisma.parkingSpot.update({ where: { id: emptySpot.id }, data: { status: 'occupied' } });
    console.log(`  Corrupted spot ${emptySpot.number}: set to "occupied" with no vessel`);

    const worker4 = new SpotSyncWorker();
    await worker4.execute();

    const fixedSpot = await prisma.parkingSpot.findUnique({ where: { id: emptySpot.id } });
    assert('Orphaned occupied spot fixed to available', fixedSpot?.status === 'available');

    const syncLogs = await prisma.activityLog.count({ where: { action: 'spot_sync_fix' } });
    assert('Sync fix logged in activity', syncLogs >= 1);
  }

  // Corrupt a spot: mark an occupied spot as available
  const occupiedSpot = await prisma.parkingSpot.findFirst({
    where: { status: 'occupied', vessel: { isNot: null } },
  });

  if (occupiedSpot) {
    await prisma.parkingSpot.update({ where: { id: occupiedSpot.id }, data: { status: 'available' } });
    console.log(`  Corrupted spot ${occupiedSpot.number}: set to "available" with vessel present`);

    const worker4b = new SpotSyncWorker();
    await worker4b.execute();

    const fixedSpot2 = await prisma.parkingSpot.findUnique({ where: { id: occupiedSpot.id } });
    assert('Spot with vessel fixed to occupied', fixedSpot2?.status === 'occupied');
  }

  // ──────────────────────────────────────────────
  // TEST 5: Activity Cleanup Worker
  // ──────────────────────────────────────────────
  console.log('\n── Test 5: Activity Cleanup Worker ──');

  // Create some old activity logs (100 days ago)
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 100);

  for (let i = 0; i < 5; i++) {
    await prisma.activityLog.create({
      data: {
        action: 'test_old_entry',
        details: `Old test log entry ${i + 1}`,
        createdAt: oldDate,
      },
    });
  }

  const oldCountBefore = await prisma.activityLog.count({ where: { action: 'test_old_entry' } });
  assert('Old activity entries created', oldCountBefore === 5);

  const worker5 = new ActivityCleanupWorker();
  await worker5.execute();

  const oldCountAfter = await prisma.activityLog.count({ where: { action: 'test_old_entry' } });
  assert('Old activity entries cleaned up', oldCountAfter === 0);

  // Verify recent entries were NOT deleted
  const recentCount = await prisma.activityLog.count({
    where: { createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
  });
  assert('Recent activity entries preserved', recentCount > 0, `${recentCount} entries remain`);

  // ──────────────────────────────────────────────
  // RESULTS
  // ──────────────────────────────────────────────
  console.log('\n========================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

testWorkers().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
