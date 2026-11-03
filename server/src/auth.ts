import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config';
import { getStaffById, type StaffRow } from './db';

export interface StaffClaims {
  sub: string;
  merchantId: string;
  role: string;
}

export function signStaffToken(staff: StaffRow): string {
  const claims: StaffClaims = { sub: staff.id, merchantId: staff.merchant_id, role: staff.role };
  return jwt.sign(claims, config.jwtSecret, { expiresIn: '30d' });
}

export function verifyToken(token: string): StaffClaims | null {
  try {
    return jwt.verify(token, config.jwtSecret) as StaffClaims;
  } catch {
    return null;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      staff?: StaffRow;
    }
  }
}

export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const claims = token ? verifyToken(token) : null;
  if (!claims) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const staff = getStaffById(claims.sub);
  if (!staff) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  req.staff = staff;
  next();
}
