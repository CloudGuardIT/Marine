import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/db';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const where = req.user!.role === 'customer'
      ? { vessel: { ownerId: req.user!.id } }
      : {};
    const reservations = await prisma.reservation.findMany({
      where,
      include: { vessel: true, spot: true },
      orderBy: { startDate: 'desc' },
    });
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

const reservationSchema = z.object({
  vesselId: z.string().uuid(),
  spotId: z.string().uuid(),
  startDate: z.string(),
  endDate: z.string(),
});

router.post('/', requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const data = reservationSchema.parse(req.body);
    const reservation = await prisma.reservation.create({
      data: {
        vesselId: data.vesselId,
        spotId: data.spotId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
      include: { vessel: true, spot: true },
    });
    res.status(201).json(reservation);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'נתונים לא תקינים' });
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.put('/:id', requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const data = reservationSchema.partial().extend({ status: z.string().optional() }).parse(req.body);
    const reservation = await prisma.reservation.update({
      where: { id: req.params.id },
      data: {
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate && { endDate: new Date(data.endDate) }),
        ...(data.status && { status: data.status }),
      },
      include: { vessel: true, spot: true },
    });
    res.json(reservation);
  } catch (err) {
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await prisma.reservation.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
