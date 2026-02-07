// server/auth.ts (FULL REPLACEMENT)
import { sign, verify, type Secret, type JwtPayload } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import type { Role } from "./types.js";

type AuthPayload = {
  userId: string;
  orgId: string;
  role: Role;
};

function getJwtSecret(): Secret {
  const s = process.env.JWT_SECRET;
  if (!s || typeof s !== "string" || s.trim().length < 16) {
    // 16+ chars: basic sanity check to avoid "secret='test'" accidents
    throw new Error("JWT_SECRET is not set (or too short). Set a strong JWT_SECRET in env.");
  }
  return s;
}

/** Password helpers */
export function hashPassword(password: string) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

/** JWT helpers */
export function signToken(payload: AuthPayload) {
  const secret = getJwtSecret();
  return sign(payload, secret, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload {
  const secret = getJwtSecret();
  const decoded = verify(token, secret) as JwtPayload | string;

  if (!decoded || typeof decoded !== "object") {
    throw new Error("Invalid token payload");
  }

  const userId = decoded.userId;
  const orgId = decoded.orgId;
  const role = decoded.role;

  if (typeof userId !== "string" || typeof orgId !== "string" || typeof role !== "string") {
    throw new Error("Invalid token payload shape");
  }

  if (role !== "user" && role !== "manager" && role !== "admin") {
    throw new Error("Invalid role in token");
  }

  return { userId, orgId, role: role as Role };
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
    return next();
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
    return next();
  };
}
