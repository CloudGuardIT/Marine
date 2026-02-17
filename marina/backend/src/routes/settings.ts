import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/db';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import { workerManager } from '../workers/worker-manager';

const BCRYPT_ROUNDS = 12;

const router = Router();
router.use(authMiddleware);

const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(9).max(15).regex(/^0\d{8,13}$/, 'מספר טלפון לא תקין'),
  password: z.string().min(8),
  role: z.enum(['admin', 'operator', 'customer']).default('customer'),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().min(9).max(15).regex(/^0\d{8,13}$/, 'מספר טלפון לא תקין').optional(),
  role: z.enum(['admin', 'operator', 'customer']).optional(),
  password: z.string().min(8).optional(),
});

const profileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  password: z.string().min(8).optional(),
});

// Get worker statuses (admin only)
router.get('/workers', requireRole('admin'), (_req, res) => {
  try {
    res.json(workerManager.getStatuses());
  } catch (err) {
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get all users (admin only)
router.get('/users', requireRole('admin'), async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, phone: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Create user (admin only)
router.post('/users', requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const data = createUserSchema.parse(req.body);
    const hashed = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { name: data.name, phone: data.phone, password: hashed, role: data.role },
      select: { id: true, name: true, phone: true, role: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'נתונים לא תקינים', details: err.errors });
    if (err.code === 'P2002') return res.status(409).json({ error: 'מספר טלפון כבר קיים' });
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update user (admin only)
router.put('/users/:id', requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const validated = updateUserSchema.parse(req.body);
    const data: any = {};
    if (validated.name) data.name = validated.name;
    if (validated.phone) data.phone = validated.phone;
    if (validated.role) data.role = validated.role;
    if (validated.password) data.password = await bcrypt.hash(validated.password, BCRYPT_ROUNDS);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, phone: true, role: true, createdAt: true },
    });
    res.json(user);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'נתונים לא תקינים', details: err.errors });
    if (err.code === 'P2002') return res.status(409).json({ error: 'מספר טלפון כבר קיים' });
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Delete user (admin only) - cannot delete self
router.delete('/users/:id', requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: 'לא ניתן למחוק את עצמך' });
    }
    const vesselCount = await prisma.vessel.count({ where: { ownerId: req.params.id } });
    if (vesselCount > 0) {
      return res.status(400).json({ error: 'לא ניתן למחוק משתמש עם כלי שייט' });
    }
    await prisma.activityLog.deleteMany({ where: { userId: req.params.id } });
    await prisma.tractorRequest.deleteMany({ where: { requesterId: req.params.id } });
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update own profile
router.put('/profile', async (req: AuthRequest, res) => {
  try {
    const validated = profileSchema.parse(req.body);
    const data: any = {};
    if (validated.name) data.name = validated.name;
    if (validated.password) data.password = await bcrypt.hash(validated.password, BCRYPT_ROUNDS);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      select: { id: true, name: true, phone: true, role: true, createdAt: true },
    });
    res.json(user);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'נתונים לא תקינים', details: err.errors });
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
