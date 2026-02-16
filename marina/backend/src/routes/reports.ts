import { Router } from 'express';
import prisma from '../lib/db';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/dashboard', async (_req, res) => {
  try {
    const [totalVessels, inWater, parked, totalSpots, availableSpots, pendingRequests, todayActivities] =
      await Promise.all([
        prisma.vessel.count(),
        prisma.vessel.count({ where: { status: 'in_water' } }),
        prisma.vessel.count({ where: { status: 'parked' } }),
        prisma.parkingSpot.count(),
        prisma.parkingSpot.count({ where: { status: 'available' } }),
        prisma.tractorRequest.count({ where: { status: 'pending' } }),
        prisma.activityLog.count({
          where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        }),
      ]);

    res.json({ totalVessels, inWater, parked, availableSpots, totalSpots, pendingRequests, todayActivities });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/vessels-by-status', async (_req, res) => {
  try {
    const statuses = await prisma.vessel.groupBy({ by: ['status'], _count: { id: true } });
    res.json(statuses.map((s) => ({ status: s.status, count: s._count.id })));
  } catch (err) {
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/spots-by-zone', async (_req, res) => {
  try {
    const zones = await prisma.parkingSpot.groupBy({ by: ['zone', 'status'], _count: { id: true } });
    res.json(zones.map((z) => ({ zone: z.zone, status: z.status, count: z._count.id })));
  } catch (err) {
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/activity-summary', async (_req, res) => {
  try {
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const activities = await prisma.activityLog.findMany({
      where: { createdAt: { gte: last7Days } },
      select: { action: true, createdAt: true },
    });

    const byDay: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    for (const a of activities) {
      const day = a.createdAt.toISOString().split('T')[0];
      byDay[day] = (byDay[day] || 0) + 1;
      byAction[a.action] = (byAction[a.action] || 0) + 1;
    }
    res.json({ byDay, byAction, total: activities.length });
  } catch (err) {
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/tractor-stats', async (_req, res) => {
  try {
    const [total, completed, avgTime] = await Promise.all([
      prisma.tractorRequest.count(),
      prisma.tractorRequest.count({ where: { status: 'completed' } }),
      prisma.tractorRequest.findMany({
        where: { status: 'completed', completedAt: { not: null } },
        select: { createdAt: true, completedAt: true },
      }),
    ]);

    let averageMinutes = 0;
    if (avgTime.length > 0) {
      const totalMs = avgTime.reduce((sum, r) => sum + (r.completedAt!.getTime() - r.createdAt.getTime()), 0);
      averageMinutes = Math.round(totalMs / avgTime.length / 60000);
    }

    res.json({ total, completed, pending: total - completed, averageMinutes });
  } catch (err) {
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
