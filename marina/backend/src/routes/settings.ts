import { Router } from 'express';
import prisma from '../lib/db';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authMiddleware);

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
    const { name, phone, password, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, phone, password: hashed, role: role || 'customer' },
      select: { id: true, name: true, phone: true, role: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'מספר טלפון כבר קיים' });
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update user (admin only)
router.put('/users/:id', requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { name, phone, role, password } = req.body;
    const data: any = {};
    if (name) data.name = name;
    if (phone) data.phone = phone;
    if (role) data.role = role;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, phone: true, role: true, createdAt: true },
    });
    res.json(user);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'מספר טלפון כבר קיים' });
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Delete user (admin only)
router.delete('/users/:id', requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    // Check for vessels owned by user
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
    const { name, password } = req.body;
    const data: any = {};
    if (name) data.name = name;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      select: { id: true, name: true, phone: true, role: true, createdAt: true },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
