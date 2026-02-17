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

// CSV Export endpoints
router.get('/export/vessels', async (_req, res) => {
  try {
    const vessels = await prisma.vessel.findMany({
      include: {
        owner: { select: { name: true, phone: true } },
        spot: { select: { number: true, zone: true } },
      },
      orderBy: { name: 'asc' },
    });

    const statusLabels: Record<string, string> = { parked: 'חונה', in_water: 'במים', transit: 'בהעברה', maintenance: 'תחזוקה' };
    const typeLabels: Record<string, string> = { motorboat: 'סירת מנוע', sailboat: 'מפרשית', yacht: 'יאכטה', jetski: 'אופנוע ים' };

    const BOM = '\uFEFF';
    const header = 'שם,מספר רישוי,סוג,אורך (מ),בעלים,טלפון בעלים,מקום חניה,אזור,סטטוס,השקה אחרונה';
    const rows = vessels.map((v) =>
      [
        v.name,
        v.registrationNumber,
        typeLabels[v.type] || v.type,
        v.length,
        v.owner.name,
        v.owner.phone,
        v.spot?.number || '',
        v.spot?.zone || '',
        statusLabels[v.status] || v.status,
        v.lastLaunch ? new Date(v.lastLaunch).toLocaleString('he-IL') : '',
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="vessels-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(BOM + header + '\n' + rows.join('\n'));
  } catch (err) {
    console.error('Export vessels error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/export/activity', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const activities = await prisma.activityLog.findMany({
      where: { createdAt: { gte: since } },
      include: {
        user: { select: { name: true } },
        vessel: { select: { name: true, registrationNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const BOM = '\uFEFF';
    const header = 'תאריך,שעה,פעולה,פרטים,משתמש,כלי שייט';
    const rows = activities.map((a) =>
      [
        new Date(a.createdAt).toLocaleDateString('he-IL'),
        new Date(a.createdAt).toLocaleTimeString('he-IL'),
        a.action,
        a.details || '',
        a.user?.name || 'מערכת',
        a.vessel?.name || '',
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="activity-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(BOM + header + '\n' + rows.join('\n'));
  } catch (err) {
    console.error('Export activity error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/export/tractor', async (_req, res) => {
  try {
    const requests = await prisma.tractorRequest.findMany({
      include: {
        vessel: { select: { name: true, registrationNumber: true } },
        requester: { select: { name: true, phone: true } },
        operator: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const statusLabels: Record<string, string> = { pending: 'ממתין', accepted: 'אושר', in_progress: 'בביצוע', completed: 'הושלם', cancelled: 'בוטל' };

    const BOM = '\uFEFF';
    const header = 'תאריך,סוג,כלי שייט,מספר רישוי,מבקש,טלפון,מפעיל,סטטוס,עדיפות,הערות,אושר בתאריך,הושלם בתאריך';
    const rows = requests.map((r) =>
      [
        new Date(r.createdAt).toLocaleString('he-IL'),
        r.type === 'launch' ? 'השקה' : 'שליפה',
        r.vessel.name,
        r.vessel.registrationNumber,
        r.requester.name,
        r.requester.phone,
        r.operator?.name || '',
        statusLabels[r.status] || r.status,
        r.priority,
        r.notes || '',
        r.acceptedAt ? new Date(r.acceptedAt).toLocaleString('he-IL') : '',
        r.completedAt ? new Date(r.completedAt).toLocaleString('he-IL') : '',
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tractor-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(BOM + header + '\n' + rows.join('\n'));
  } catch (err) {
    console.error('Export tractor error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
