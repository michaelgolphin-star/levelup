import type { Role } from "./types";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        orgId: string;
        role: Role;
      };
    }
  }
}

export {};
