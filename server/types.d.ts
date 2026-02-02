import "express";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        orgId: string;
        role: "user" | "manager" | "admin";
      };
    }
  }
}

export {};
