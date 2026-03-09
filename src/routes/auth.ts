import { Router, Request, Response } from "express";
import { publicMiddleware } from "../middleware/auth";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

router.get("/login", publicMiddleware, (req: Request, res: Response) => {
  res.render("login", { error: null });
});

router.post("/login", publicMiddleware, (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAuthenticated = true;
    req.session.adminId = "admin";
    res.redirect("/dashboard");
  } else {
    res.render("login", { error: "Invalid username or password" });
  }
});

router.get("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Could not log out");
    }
    res.redirect("/login");
  });
});

export default router;
