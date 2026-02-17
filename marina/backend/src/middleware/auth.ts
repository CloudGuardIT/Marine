import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/db';
import { getIO } from '../socket';

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
const JWT_SECRET: string = process.env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    phone: string;
    role: string;
  };
}

export function generateToken(user: { id: string; name: string; phone: string; role: string }): string {
  // Only include id and role in JWT - phone is sensitive data
  return jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!header || !header.startsWith('Bearer ')) {
    // Log unauthorized access attempt (no token)
    logSecurityEvent(null, 'unauthorized_access', `גישה ללא טוקן ל-${req.method} ${req.path} מ-IP: ${ip}`);
    return res.status(401).json({ error: 'אין הרשאה - נדרש טוקן' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      logSecurityEvent(null, 'invalid_token', `טוקן עם ID לא קיים ל-${req.method} ${req.path} מ-IP: ${ip}`);
      return res.status(401).json({ error: 'משתמש לא נמצא' });
    }
    req.user = { id: user.id, name: user.name, phone: user.phone, role: user.role };
    next();
  } catch {
    logSecurityEvent(null, 'invalid_token', `טוקן לא תקין ל-${req.method} ${req.path} מ-IP: ${ip}`);
    return res.status(401).json({ error: 'טוקן לא תקין' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      logSecurityEvent(
        req.user?.id || null,
        'forbidden_access',
        `${req.user?.name || 'אנונימי'} (${req.user?.role || '?'}) ניסה לגשת ל-${req.method} ${req.path} — נדרש: ${roles.join('/')} מ-IP: ${ip}`
      );
      return res.status(403).json({ error: 'אין הרשאה לפעולה זו' });
    }
    next();
  };
}

// Async security event logger — fire and forget
function logSecurityEvent(userId: string | null, action: string, details: string) {
  prisma.activityLog.create({
    data: { userId, action, details },
  }).then((event) => {
    getIO().emit('security:event', { action, details, createdAt: event.createdAt });
  }).catch((err) => {
    console.error('Security log error:', err);
  });
}
