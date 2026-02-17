import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/db';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { getIO } from '../socket';
import { getQueuePosition, getEstimatedWait } from '../services/tractor-queue';

const router = Router();
router.use(authMiddleware);

router.get('/my-position', async (req: AuthRequest, res) => {
  try {
    const requests = await prisma.tractorRequest.findMany({
      where: {
        requesterId: req.user!.id,
        status: { in: ['pending', 'accepted', 'in_progress'] },
      },
      include: {
        vessel: { include: { spot: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = await Promise.all(
      requests.map(async (r) => {
        const position = r.status === 'pending' ? await getQueuePosition(r.id) : 0;
        const estimatedWait = r.status === 'pending' ? await getEstimatedWait(r.id) : 0;
        return {
          id: r.id,
          vesselId: r.vesselId,
          vesselName: r.vessel.name,
          type: r.type,
          status: r.status,
          position,
          estimatedWait,
          createdAt: r.createdAt,
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error('Get my position error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/queue', requireRole('admin', 'operator'), async (_req, res) => {
  try {
    const requests = await prisma.tractorRequest.findMany({
      where: { status: { in: ['pending', 'accepted', 'in_progress'] } },
      include: {
        vessel: { include: { owner: { select: { id: true, name: true, phone: true, role: true } }, spot: true } },
        requester: { select: { id: true, name: true, phone: true, role: true } },
        operator: { select: { id: true, name: true, phone: true, role: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
    res.json(requests);
  } catch (err) {
    console.error('Get queue error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const where = req.user!.role === 'customer' ? { requesterId: req.user!.id } : {};
    const requests = await prisma.tractorRequest.findMany({
      where,
      include: {
        vessel: { include: { spot: true } },
        requester: { select: { id: true, name: true, phone: true, role: true } },
        operator: { select: { id: true, name: true, phone: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

const createSchema = z.object({
  vesselId: z.string().uuid(),
  type: z.enum(['launch', 'retrieve']),
  priority: z.number().int().min(0).max(10).optional(),
  notes: z.string().optional(),
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createSchema.parse(req.body);
    const vessel = await prisma.vessel.findUnique({ where: { id: data.vesselId } });
    if (!vessel) return res.status(404).json({ error: 'כלי שייט לא נמצא' });

    // Customers can only request for their own vessels
    if (req.user!.role === 'customer' && vessel.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'אין הרשאה ליצור בקשה עבור כלי שייט זה' });
    }

    // Validate request type matches vessel status
    if (data.type === 'launch' && vessel.status !== 'parked') {
      return res.status(400).json({ error: 'כלי השייט אינו חונה כרגע' });
    }
    if (data.type === 'retrieve' && vessel.status !== 'in_water') {
      return res.status(400).json({ error: 'כלי השייט אינו במים כרגע' });
    }

    // Check for existing pending request
    const existing = await prisma.tractorRequest.findFirst({
      where: { vesselId: data.vesselId, status: { in: ['pending', 'accepted', 'in_progress'] } },
    });
    if (existing) return res.status(409).json({ error: 'כבר קיימת בקשה פעילה לכלי שייט זה' });

    const request = await prisma.tractorRequest.create({
      data: {
        vesselId: data.vesselId,
        requesterId: req.user!.id,
        type: data.type,
        priority: data.priority || 0,
        notes: data.notes || null,
      },
      include: {
        vessel: { include: { owner: { select: { id: true, name: true, phone: true, role: true } }, spot: true } },
        requester: { select: { id: true, name: true, phone: true, role: true } },
        operator: { select: { id: true, name: true, phone: true, role: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        vesselId: data.vesselId,
        action: 'tractor_requested',
        details: `בקשת ${data.type === 'launch' ? 'השקה' : 'שליפה'} ל"${vessel.name}"`,
      },
    });

    const activity = await prisma.activityLog.findFirst({ orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true, phone: true, role: true } }, vessel: true } });
    getIO().emit('tractor:created', request);
    getIO().emit('activity:new', activity);
    res.status(201).json(request);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'נתונים לא תקינים', details: err.errors });
    console.error('Create tractor request error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.put('/:id/accept', requireRole('admin', 'operator'), async (req: AuthRequest, res) => {
  try {
    const request = await prisma.tractorRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: 'בקשה לא נמצאה' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'הבקשה כבר טופלה' });

    // Update vessel to transit
    await prisma.vessel.update({ where: { id: request.vesselId }, data: { status: 'transit' } });

    const updated = await prisma.tractorRequest.update({
      where: { id: req.params.id },
      data: { status: 'accepted', operatorId: req.user!.id, acceptedAt: new Date() },
      include: {
        vessel: { include: { owner: { select: { id: true, name: true, phone: true, role: true } }, spot: true } },
        requester: { select: { id: true, name: true, phone: true, role: true } },
        operator: { select: { id: true, name: true, phone: true, role: true } },
      },
    });

    await prisma.activityLog.create({
      data: { userId: req.user!.id, vesselId: request.vesselId, action: 'tractor_accepted', details: `בקשה אושרה ע"י ${req.user!.name}` },
    });

    const activity = await prisma.activityLog.findFirst({ orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true, phone: true, role: true } }, vessel: true } });
    getIO().emit('tractor:updated', updated);
    getIO().emit('vessel:updated', updated.vessel);
    getIO().emit('activity:new', activity);
    res.json(updated);
  } catch (err) {
    console.error('Accept request error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.put('/:id/complete', requireRole('admin', 'operator'), async (req: AuthRequest, res) => {
  try {
    const request = await prisma.tractorRequest.findUnique({ where: { id: req.params.id }, include: { vessel: true } });
    if (!request) return res.status(404).json({ error: 'בקשה לא נמצאה' });
    if (!['accepted', 'in_progress'].includes(request.status)) return res.status(400).json({ error: 'לא ניתן להשלים בקשה זו' });

    let newStatus: string;
    let spotUpdate: any = {};
    if (request.type === 'launch') {
      newStatus = 'in_water';
      if (request.vessel.spotId) {
        await prisma.parkingSpot.update({ where: { id: request.vessel.spotId }, data: { status: 'available' } });
        spotUpdate = { spotId: null };
      }
    } else {
      newStatus = 'parked';
    }

    const vessel = await prisma.vessel.update({
      where: { id: request.vesselId },
      data: {
        status: newStatus,
        ...(newStatus === 'in_water' && { lastLaunch: new Date() }),
        ...spotUpdate,
      },
      include: { owner: { select: { id: true, name: true, phone: true, role: true } }, spot: true },
    });

    const updated = await prisma.tractorRequest.update({
      where: { id: req.params.id },
      data: { status: 'completed', completedAt: new Date() },
      include: {
        vessel: { include: { owner: { select: { id: true, name: true, phone: true, role: true } }, spot: true } },
        requester: { select: { id: true, name: true, phone: true, role: true } },
        operator: { select: { id: true, name: true, phone: true, role: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        vesselId: request.vesselId,
        action: request.type === 'launch' ? 'vessel_launched' : 'vessel_retrieved',
        details: `"${request.vessel.name}" ${request.type === 'launch' ? 'הושק למים' : 'נשלף מהמים'}`,
      },
    });

    const activity = await prisma.activityLog.findFirst({ orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true, phone: true, role: true } }, vessel: true } });
    getIO().emit('tractor:updated', updated);
    getIO().emit('vessel:updated', vessel);
    getIO().emit('activity:new', activity);

    // Emit updated spots
    const spots = await prisma.parkingSpot.findMany({ include: { vessel: true } });
    getIO().emit('spot:updated', spots);

    res.json(updated);
  } catch (err) {
    console.error('Complete request error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.put('/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const request = await prisma.tractorRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: 'בקשה לא נמצאה' });
    if (request.status === 'completed' || request.status === 'cancelled') {
      return res.status(400).json({ error: 'לא ניתן לבטל בקשה זו' });
    }

    // Only the requester, admin, or operator can cancel
    const isOwner = request.requesterId === req.user!.id;
    const isAdminOrOperator = ['admin', 'operator'].includes(req.user!.role);
    if (!isOwner && !isAdminOrOperator) {
      return res.status(403).json({ error: 'אין הרשאה לבטל בקשה זו' });
    }

    // If it was accepted/in_progress, revert vessel status
    if (['accepted', 'in_progress'].includes(request.status)) {
      const vessel = await prisma.vessel.findUnique({ where: { id: request.vesselId } });
      if (vessel && vessel.status === 'transit') {
        const revertStatus = request.type === 'launch' ? 'parked' : 'in_water';
        await prisma.vessel.update({ where: { id: request.vesselId }, data: { status: revertStatus } });
      }
    }

    const updated = await prisma.tractorRequest.update({
      where: { id: req.params.id },
      data: { status: 'cancelled' },
      include: {
        vessel: { include: { owner: { select: { id: true, name: true, phone: true, role: true } }, spot: true } },
        requester: { select: { id: true, name: true, phone: true, role: true } },
        operator: { select: { id: true, name: true, phone: true, role: true } },
      },
    });

    await prisma.activityLog.create({
      data: { userId: req.user!.id, vesselId: request.vesselId, action: 'tractor_cancelled', details: 'בקשה בוטלה' },
    });

    const activity = await prisma.activityLog.findFirst({ orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true, phone: true, role: true } }, vessel: true } });
    getIO().emit('tractor:updated', updated);
    getIO().emit('activity:new', activity);
    res.json(updated);
  } catch (err) {
    console.error('Cancel request error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
