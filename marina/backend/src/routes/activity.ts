import { Router } from 'express';
import prisma from '../lib/db';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('admin', 'operator'));

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const action = req.query.action as string;

    const where: any = {};
    if (action) where.action = action;

    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, phone: true, role: true } },
          vessel: { select: { id: true, name: true, registrationNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({ activities, total, limit, offset });
  } catch (err) {
    console.error('Get activities error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Security events (admin only) - failed logins, unauthorized access, etc.
router.get('/security', requireRole('admin'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const securityActions = ['login_failed', 'unauthorized_access', 'invalid_token', 'forbidden_access', 'rate_limited'];

    const [events, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: { action: { in: securityActions } },
        include: {
          user: { select: { id: true, name: true, phone: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.activityLog.count({
        where: { action: { in: securityActions } },
      }),
    ]);

    res.json({ events, total });
  } catch (err) {
    console.error('Get security events error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
