// server/auth.ts (FULL REPLACEMENT — hardened, minimal-behavior-change)
import pkg from "jsonwebtoken";
import type { Secret, JwtPayload } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import type { Role } from "./types.js";

const { sign, verify } = pkg as unknown as {
  sign: (payload: any, secret: Secret, options?: any) => string;
  verify: (token: string, secret: Secret, options?: any) => JwtPayload | string;
};

export type AuthPayload = {
  userId: string;
  orgId: string;
  role: Role;
};

const ROLE_SET = new Set<Role>(["user", "manager", "admin"]);
const ROLE_ORDER: Record<Role, number> = { user: 1, manager: 2, admin: 3 };

function getJwtSecret(): Secret {
  const s = process.env.JWT_SECRET;
  if (!s || typeof s !== "string" || s.trim().length < 16) {
    throw new Error("JWT_SECRET is not set (or too short). Set a strong JWT_SECRET in env.");
  }
  return s.trim();
}

function readBearerToken(req: Request): string | null {
  // Express normalizes headers, but be defensive.
  const raw = (req.headers.authorization || req.headers.Authorization) as any;
  if (typeof raw !== "string") return null;

  const v = raw.trim();
  if (!v) return null;

  // Accept "Bearer <token>" with any extra whitespace
  const m = v.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  const token = (m[1] || "").trim();
  return token || null;
}

/** Password helpers */
export function hashPassword(password: string) {
  // 10 rounds is fine for MVP; can increase later if needed
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

/** JWT helpers */
export function signToken(payload: AuthPayload) {
  const secret = getJwtSecret();

  // Optional: tighten later with issuer/audience if you want.
  // For now: stable, backwards-compatible.
  return sign(payload, secret, {
    expiresIn: "7d",
    // issuer: process.env.JWT_ISSUER,
    // audience: process.env.JWT_AUDIENCE,
  });
}

function coerceAuthPayload(decoded: JwtPayload | string): AuthPayload {
  if (!decoded || typeof decoded !== "object") {
    throw new Error("Invalid token payload");
  }

  const userId = (decoded as any).userId;
  const orgId = (decoded as any).orgId;
  const role = (decoded as any).role;

  if (typeof userId !== "string" || typeof orgId !== "string" || typeof role !== "string") {
    throw new Error("Invalid token payload shape");
  }

  const r = role as Role;
  if (!ROLE_SET.has(r)) {
    throw new Error("Invalid role in token");
  }

  // Light hardening: avoid empty ids
  if (!userId.trim() || !orgId.trim()) {
    throw new Error("Invalid token payload values");
  }

  return { userId, orgId, role: r };
}

export function verifyToken(token: string): AuthPayload {
  const secret = getJwtSecret();

  // `verify` validates exp/nbf automatically if present.
  // clockTolerance keeps dev/proxy clocks from causing random 401s.
  const decoded = verify(token, secret, { clockTolerance: 10 });

  return coerceAuthPayload(decoded);
}

/** Middleware */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = readBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const payload = verifyToken(token);
    (req as any).auth = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/**
 * Role guard (exact roles)
 * Usage: requireRole(["admin"]) or requireRole(["admin","manager"])
 */
export function requireRole(roles: Role[]) {
  const allowed = new Set<Role>(roles);
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).auth as AuthPayload | undefined;
    if (!auth || !ROLE_SET.has(auth.role) || !allowed.has(auth.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}

/**
 * Optional helper (hierarchy)
 * Usage: requireMinRole("manager") allows manager/admin.
 * Not used by default; safe to keep available.
 */
export function requireMinRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).auth as AuthPayload | undefined;
    if (!auth || !ROLE_SET.has(auth.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (ROLE_ORDER[auth.role] < ROLE_ORDER[minRole]) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}
