import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'marina-jwt-secret-key-2024-very-secure';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    phone: string;
    role: string;
  };
}

export function generateToken(user: { id: string; name: string; phone: string; role: string }): string {
  return jwt.sign(
    { id: user.id, name: user.name, phone: user.phone, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'אין הרשאה - נדרש טוקן' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; name: string; phone: string; role: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(401).json({ error: 'משתמש לא נמצא' });
    }
    req.user = { id: user.id, name: user.name, phone: user.phone, role: user.role };
    next();
  } catch {
    return res.status(401).json({ error: 'טוקן לא תקין' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'אין הרשאה לפעולה זו' });
    }
    next();
  };
}
