import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  console.log("[AUTH] Session check:", { 
    sessionID: req.sessionID,
    userId: req.session?.userId,
    hasSession: !!req.session 
  });
  
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.session?.userRole !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    userRole: string;
  }
}
