import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/db';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { getIO } from '../socket';

const router = Router();
router.use(authMiddleware);

const vesselSchema = z.object({
  name: z.string().min(1),
  registrationNumber: z.string().min(1),
  length: z.number().positive(),
  type: z.string().optional(),
  ownerId: z.string().uuid(),
  spotId: z.string().uuid().nullable().optional(),
  status: z.enum(['parked', 'in_water', 'maintenance', 'transit']).optional(),
  imageUrl: z.string().nullable().optional(),
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const where = req.user!.role === 'customer' ? { ownerId: req.user!.id } : {};
    const vessels = await prisma.vessel.findMany({
      where,
      include: { owner: { select: { id: true, name: true, phone: true, role: true } }, spot: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(vessels);
  } catch (err) {
    console.error('Get vessels error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const vessel = await prisma.vessel.findUnique({
      where: { id: req.params.id },
      include: { owner: { select: { id: true, name: true, phone: true, role: true } }, spot: true },
    });
    if (!vessel) return res.status(404).json({ error: 'כלי שייט לא נמצא' });

    // Customers can only view their own vessels
    if (req.user!.role === 'customer' && vessel.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'אין הרשאה לצפות בכלי שייט זה' });
    }

    res.json(vessel);
  } catch (err) {
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.post('/', requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const data = vesselSchema.parse(req.body);
    const vessel = await prisma.vessel.create({
      data: {
        name: data.name,
        registrationNumber: data.registrationNumber,
        length: data.length,
        type: data.type || 'motorboat',
        ownerId: data.ownerId,
        spotId: data.spotId || null,
        status: data.status || 'parked',
        imageUrl: data.imageUrl || null,
      },
      include: { owner: { select: { id: true, name: true, phone: true, role: true } }, spot: true },
    });

    if (data.spotId) {
      await prisma.parkingSpot.update({ where: { id: data.spotId }, data: { status: 'occupied' } });
    }

    await prisma.activityLog.create({
      data: { userId: req.user!.id, vesselId: vessel.id, action: 'vessel_created', details: `כלי שייט "${vessel.name}" נוצר` },
    });

    getIO().emit('vessel:updated', vessel);
    res.status(201).json(vessel);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'נתונים לא תקינים', details: err.errors });
    console.error('Create vessel error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.put('/:id', requireRole('admin', 'operator'), async (req: AuthRequest, res) => {
  try {
    const data = vesselSchema.partial().parse(req.body);
    const existing = await prisma.vessel.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'כלי שייט לא נמצא' });

    // Handle spot changes
    if (data.spotId !== undefined && data.spotId !== existing.spotId) {
      if (existing.spotId) {
        await prisma.parkingSpot.update({ where: { id: existing.spotId }, data: { status: 'available' } });
      }
      if (data.spotId) {
        await prisma.parkingSpot.update({ where: { id: data.spotId }, data: { status: 'occupied' } });
      }
    }

    const vessel = await prisma.vessel.update({
      where: { id: req.params.id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.registrationNumber && { registrationNumber: data.registrationNumber }),
        ...(data.length && { length: data.length }),
        ...(data.type && { type: data.type }),
        ...(data.ownerId && { ownerId: data.ownerId }),
        ...(data.spotId !== undefined && { spotId: data.spotId }),
        ...(data.status && { status: data.status }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.status === 'in_water' && { lastLaunch: new Date() }),
      },
      include: { owner: { select: { id: true, name: true, phone: true, role: true } }, spot: true },
    });

    await prisma.activityLog.create({
      data: { userId: req.user!.id, vesselId: vessel.id, action: 'vessel_updated', details: `כלי שייט "${vessel.name}" עודכן` },
    });

    getIO().emit('vessel:updated', vessel);
    if (data.spotId !== undefined) {
      const spots = await prisma.parkingSpot.findMany({ include: { vessel: true } });
      getIO().emit('spot:updated', spots);
    }
    res.json(vessel);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'נתונים לא תקינים', details: err.errors });
    console.error('Update vessel error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.delete('/:id', requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const vessel = await prisma.vessel.findUnique({ where: { id: req.params.id } });
    if (!vessel) return res.status(404).json({ error: 'כלי שייט לא נמצא' });

    if (vessel.spotId) {
      await prisma.parkingSpot.update({ where: { id: vessel.spotId }, data: { status: 'available' } });
    }

    await prisma.activityLog.deleteMany({ where: { vesselId: vessel.id } });
    await prisma.tractorRequest.deleteMany({ where: { vesselId: vessel.id } });
    await prisma.reservation.deleteMany({ where: { vesselId: vessel.id } });
    await prisma.vessel.delete({ where: { id: req.params.id } });

    await prisma.activityLog.create({
      data: { userId: req.user!.id, action: 'vessel_deleted', details: `כלי שייט "${vessel.name}" נמחק` },
    });

    getIO().emit('vessel:updated', { id: vessel.id, deleted: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete vessel error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
