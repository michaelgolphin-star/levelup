// server/auth.ts (FULL REPLACEMENT)
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import type { Role } from "./types.js";

const JWT_SECRET = process.env.JWT_SECRET || "DEV_ONLY_CHANGE_ME";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "14d";

export function hashPassword(password: string) {
  // bcrypt includes a random salt internally; sync is fine for small apps
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

export function signToken(payload: { userId: string; orgId: string; role: Role }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export type AuthedRequest = Request & {
  auth?: { userId: string; orgId: string; role: Role };
};

function readBearerToken(req: Request): string | null {
  const header = String(req.headers.authorization || "").trim();
  if (!header) return null;

  // tolerate extra spaces + casing
  const parts = header.split(/\s+/);
  if (parts.length < 2) return null;

  const kind = parts[0];
  const token = parts.slice(1).join(" ").trim(); // JWT won't contain spaces; this is defensive
  if (!/^bearer$/i.test(kind) || !token) return null;

  return token;
}

function normalizeRole(v: any): Role | null {
  const s = String(v || "").toLowerCase();
  if (s === "user" || s === "manager" || s === "admin") return s as Role;
  return null;
}

function pickTokenPayload(decoded: any): { userId: string; orgId: string; role: Role } | null {
  // Support a couple of legacy/common shapes just in case
  const userId = decoded?.userId ?? decoded?.sub ?? decoded?.uid;
  const orgId = decoded?.orgId ?? decoded?.organizationId ?? decoded?.org;
  const role = normalizeRole(decoded?.role);

  if (!userId || !orgId || !role) return null;
  return { userId: String(userId), orgId: String(orgId), role };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = readBearerToken(req);
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const payload = pickTokenPayload(decoded);

    if (!payload) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    req.auth = payload;
    return next();
  } catch (err: any) {
    const name = err?.name || "JWTError";
    // Common: JsonWebTokenError, TokenExpiredError
    return res.status(401).json({ error: `Invalid token (${name})` });
  }
}

export function requireRole(roles: Role[]) {
  // normalize roles list defensively
  const allowed = roles.map((r) => normalizeRole(r)).filter(Boolean) as Role[];

  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "Missing auth" });
    if (!allowed.includes(req.auth.role)) return res.status(403).json({ error: "Forbidden" });
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
