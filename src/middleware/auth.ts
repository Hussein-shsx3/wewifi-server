import { Request, Response, NextFunction } from "express";
import session from "express-session";

declare module "express-session" {
  interface SessionData {
    adminId?: string;
    isAuthenticated?: boolean;
  }
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.session?.isAuthenticated) {
    next();
  } else {
    res.redirect("/login");
  }
};

export const publicMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.session?.isAuthenticated) {
    res.redirect("/dashboard");
  } else {
    next();
  }
};
