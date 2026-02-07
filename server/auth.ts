// server/auth.ts (FULL REPLACEMENT)
import * as jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import type { Role } from "./types.js";

// Explicitly type the secret to satisfy jsonwebtoken typings across versions
const JWT_SECRET: jwt.Secret = (process.env.JWT_SECRET || "DEV_ONLY_CHANGE_ME") as jwt.Secret;

export function hashPassword(password: string) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

export function signToken(payload: { userId: string; orgId: string; role: Role }) {
  const options: jwt.SignOptions = { expiresIn: "14d" };
  return jwt.sign(payload, JWT_SECRET, options);
}

export type AuthedRequest = Request & {
  auth?: { userId: string; orgId: string; role: Role };
};

function readBearerToken(req: Request): string | null {
  const header = String(req.headers.authorization || "").trim();
  if (!header) return null;

  const parts = header.split(/\s+/);
  if (parts.length < 2) return null;

  const kind = parts[0];
  const token = parts.slice(1).join(" ").trim();
  if (!/^bearer$/i.test(kind) || !token) return null;

  return token;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = readBearerToken(req);
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const userId = decoded?.userId;
    const orgId = decoded?.orgId;
    const role = decoded?.role;

    if (!userId || !orgId || !role) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    req.auth = { userId, orgId, role };
    return next();
  } catch (err: any) {
    const name = err?.name || "JWTError";
    return res.status(401).json({ error: `Invalid token (${name})` });
  }
}

export function requireRole(roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "Missing auth" });
    if (!roles.includes(req.auth.role)) return res.status(403).json({ error: "Forbidden" });
    return next();
  };
}

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
