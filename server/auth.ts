// server/auth.ts (FULL REPLACEMENT)
import { sign, verify } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import type { Role } from "./types.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

type AuthPayload = {
  userId: string;
  orgId: string;
  role: Role;
};

/** Password helpers */
export function hashPassword(password: string) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

/** JWT helpers */
export function signToken(payload: AuthPayload) {
  return sign(payload, JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function verifyToken(token: string): AuthPayload {
  return verify(token, JWT_SECRET) as AuthPayload;
}

/** Middleware */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);
    (req as any).auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).auth as AuthPayload | undefined;
    if (!auth || !roles.includes(auth.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
