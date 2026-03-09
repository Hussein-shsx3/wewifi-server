import express, { Request, Response } from "express";
import dotenv from "dotenv";
import path from "path";
import session from "express-session";
import cors from "cors";
import helmet from "helmet";
import { connectDB } from "./config/database";
import authRoutes from "./routes/auth";
import subscriberRoutes from "./routes/subscribers";
import { authMiddleware } from "./middleware/auth";

dotenv.config();

// Handle unhandled promise rejections to prevent server crashes
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit - just log the error
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Don't exit - just log the error
});

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MySQL Database
connectDB();

// Middleware
// Helmet sets a bunch of security headers by default, including
// Cross-Origin-Opener-Policy and Origin-Agent-Cluster. When the
// app is served over plain HTTP (e.g. using an IP address during
// local development) Chrome will complain that those headers are
// being ignored because the origin is not "trustworthy". The
// warnings are harmless but noisy, so we disable the problematic
// headers in non‑production environments. In production you should
// serve over HTTPS or from localhost so the headers can be applied.
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP to allow inline scripts
    crossOriginOpenerPolicy: false, // avoid COOP warnings on http/IP
    originAgentCluster: false, // avoid Origin-Agent-Cluster warnings
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// View engine setup (EJS)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/", authRoutes);

// Dashboard route
app.get("/dashboard", authMiddleware, (req: Request, res: Response) => {
  res.render("dashboard");
});

// API routes
app.use("/api/subscribers", subscriberRoutes);

// Redirect root to dashboard if authenticated, otherwise to login
app.get("/", (req: Request, res: Response) => {
  if (req.session?.isAuthenticated) {
    res.redirect("/dashboard");
  } else {
    res.redirect("/login");
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Error handler
app.use((err: any, req: Request, res: Response) => {
  console.error("Error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server is running on http://localhost:${PORT}`);
  console.log(`✓ Visit http://localhost:${PORT}/login to access the dashboard`);
});
