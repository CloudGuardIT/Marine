import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import prisma from '../lib/db';
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Rate limit login: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'יותר מדי ניסיונות התחברות. נסה שוב בעוד 15 דקות' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit registration: 3 per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'יותר מדי ניסיונות הרשמה. נסה שוב מאוחר יותר' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  phone: z.string().min(9).max(15),
  password: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(9).max(15).regex(/^0\d{8,13}$/, 'מספר טלפון לא תקין'),
  password: z.string().min(8, 'סיסמה חייבת להכיל לפחות 8 תווים'),
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { phone, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(401).json({ error: 'מספר טלפון או סיסמה שגויים' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'מספר טלפון או סיסמה שגויים' });
    }
    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role, createdAt: user.createdAt },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'נתונים לא תקינים' });
    }
    console.error('Login error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.post('/register', registerLimiter, async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existing) {
      return res.status(409).json({ error: 'מספר טלפון כבר רשום' });
    }
    const hashed = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: { name: data.name, phone: data.phone, password: hashed, role: 'customer' },
    });
    const token = generateToken(user);
    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role, createdAt: user.createdAt },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'נתונים לא תקינים' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, phone: true, role: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });
    res.json(user);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
