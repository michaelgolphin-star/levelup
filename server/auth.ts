import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import type { Role } from "./types.js";

const JWT_SECRET = process.env.JWT_SECRET || "DEV_ONLY_CHANGE_ME";

export function hashPassword(password: string) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  // bcrypt handles constant-time checks internally
  return bcrypt.compareSync(password, hash);
}

export function signToken(payload: { userId: string; orgId: string; role: Role }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "14d" });
}

export type AuthedRequest = Request & {
  auth?: { userId: string; orgId: string; role: Role };
};

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const [kind, token] = header.split(" ");
  if (kind !== "Bearer" || !token) return res.status(401).json({ error: "Missing bearer token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded?.userId || !decoded?.orgId || !decoded?.role) {
      return res.status(401).json({ error: "Invalid token" });
    }
    req.auth = { userId: decoded.userId, orgId: decoded.orgId, role: decoded.role };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "Missing auth" });
    if (!roles.includes(req.auth.role)) return res.status(403).json({ error: "Forbidden" });
    return next();
  };
}

// Defensive helper for timing-safe string equality if needed
export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
