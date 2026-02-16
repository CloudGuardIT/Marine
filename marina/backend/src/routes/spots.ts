import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/db';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { getIO } from '../socket';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req, res) => {
  try {
    const spots = await prisma.parkingSpot.findMany({
      include: {
        vessel: {
          include: { owner: { select: { id: true, name: true, phone: true, role: true } } },
        },
      },
      orderBy: [{ zone: 'asc' }, { row: 'asc' }, { col: 'asc' }],
    });
    res.json(spots);
  } catch (err) {
    console.error('Get spots error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/layout', async (_req, res) => {
  try {
    const spots = await prisma.parkingSpot.findMany({
      include: {
        vessel: {
          include: { owner: { select: { id: true, name: true, phone: true, role: true } } },
        },
      },
      orderBy: [{ zone: 'asc' }, { row: 'asc' }, { col: 'asc' }],
    });

    const zones: Record<string, typeof spots> = {};
    for (const spot of spots) {
      if (!zones[spot.zone]) zones[spot.zone] = [];
      zones[spot.zone].push(spot);
    }
    res.json({ spots, zones });
  } catch (err) {
    console.error('Get layout error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

const spotSchema = z.object({
  number: z.string().min(1),
  zone: z.enum(['A', 'B', 'C', 'D']),
  row: z.number().int().min(0),
  col: z.number().int().min(0),
  status: z.enum(['available', 'occupied', 'reserved', 'maintenance']).optional(),
  width: z.number().positive().optional(),
  length: z.number().positive().optional(),
});

router.post('/', requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const data = spotSchema.parse(req.body);
    const spot = await prisma.parkingSpot.create({ data });
    getIO().emit('spot:updated', [spot]);
    res.status(201).json(spot);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'נתונים לא תקינים', details: err.errors });
    console.error('Create spot error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.put('/:id', requireRole('admin', 'operator'), async (req: AuthRequest, res) => {
  try {
    const data = spotSchema.partial().parse(req.body);
    const spot = await prisma.parkingSpot.update({
      where: { id: req.params.id },
      data,
      include: { vessel: true },
    });
    getIO().emit('spot:updated', [spot]);
    res.json(spot);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'נתונים לא תקינים', details: err.errors });
    console.error('Update spot error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.delete('/:id', requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const spot = await prisma.parkingSpot.findUnique({ where: { id: req.params.id }, include: { vessel: true } });
    if (!spot) return res.status(404).json({ error: 'מקום חניה לא נמצא' });
    if (spot.vessel) return res.status(400).json({ error: 'לא ניתן למחוק מקום תפוס' });
    await prisma.reservation.deleteMany({ where: { spotId: req.params.id } });
    await prisma.parkingSpot.delete({ where: { id: req.params.id } });
    getIO().emit('spot:updated', [{ id: req.params.id, deleted: true }]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete spot error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
