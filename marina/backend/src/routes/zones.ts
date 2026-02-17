import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/db';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { getIO } from '../socket';

const router = Router();
router.use(authMiddleware);

// GET /api/zones - list all zones with spots
router.get('/', async (_req, res) => {
  try {
    const zones = await prisma.zone.findMany({
      include: {
        spots: {
          include: {
            vessel: {
              include: { owner: { select: { id: true, name: true, role: true } } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(zones);
  } catch (err) {
    console.error('Get zones error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

const zoneSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  polygon: z.array(z.tuple([z.number(), z.number()])).min(3),
});

// POST /api/zones - create zone (admin only)
router.post('/', requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const data = zoneSchema.parse(req.body);
    const zone = await prisma.zone.create({
      data: {
        name: data.name,
        color: data.color,
        polygon: data.polygon,
      },
      include: { spots: true },
    });
    getIO().emit('zone:updated', zone);
    res.status(201).json(zone);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'נתונים לא תקינים', details: err.errors });
    console.error('Create zone error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// PUT /api/zones/:id - update zone (admin only)
router.put('/:id', requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const data = zoneSchema.partial().parse(req.body);
    const zone = await prisma.zone.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.polygon !== undefined && { polygon: data.polygon }),
      },
      include: { spots: true },
    });
    getIO().emit('zone:updated', zone);
    res.json(zone);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'נתונים לא תקינים', details: err.errors });
    console.error('Update zone error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// DELETE /api/zones/:id - delete zone if no spots (admin only)
router.delete('/:id', requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const zone = await prisma.zone.findUnique({
      where: { id: req.params.id },
      include: { spots: true },
    });
    if (!zone) return res.status(404).json({ error: 'אזור לא נמצא' });
    if (zone.spots.length > 0) return res.status(400).json({ error: 'לא ניתן למחוק אזור עם מקומות חניה' });

    await prisma.zone.delete({ where: { id: req.params.id } });
    getIO().emit('zone:deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete zone error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
