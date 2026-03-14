import { NextFunction, Request, Response } from "express";
import { writeActivityLog } from "../utils/activityLog";

const exportPaths = new Set([
  "/export",
  "/export-backup",
  "/available-usernames/export",
]);

const resolveActionLabel = (method: string, path: string) => {
  // Subscribers
  if (method === "POST" && path === "/") return "ADD_SUBSCRIBER";
  if (method === "PUT" && /^\/[^/]+$/.test(path)) return "UPDATE_SUBSCRIBER";
  if (method === "DELETE" && /^\/[^/]+$/.test(path)) return "DELETE_SUBSCRIBER";
  if (method === "DELETE" && path === "/all") return "DELETE_ALL_SUBSCRIBERS";
  if (method === "POST" && path === "/bulk-delete") return "BULK_DELETE_SUBSCRIBERS";
  if (method === "POST" && path === "/bulk-update") return "BULK_UPDATE_SUBSCRIBERS";
  if (method === "POST" && path === "/upload") return "IMPORT_SUBSCRIBERS_EXCEL";
  if (method === "POST" && path === "/upload-credentials")
    return "IMPORT_CREDENTIALS_EXCEL";
  if (method === "GET" && path === "/export") return "EXPORT_SUBSCRIBERS_EXCEL";
  if (method === "GET" && path === "/export-backup") return "EXPORT_BACKUP_EXCEL";

  // Profile/username/speed history
  if (method === "POST" && /^\/change-username\/[^/]+$/.test(path))
    return "CHANGE_SUBSCRIBER_USERNAME";
  if (method === "POST" && /^\/username-history\/[^/]+$/.test(path))
    return "ADD_USERNAME_HISTORY";
  if (method === "PUT" && /^\/username-history\/[^/]+$/.test(path))
    return "UPDATE_USERNAME_HISTORY";
  if (method === "DELETE" && /^\/username-history\/[^/]+$/.test(path))
    return "DELETE_USERNAME_HISTORY";

  // Available usernames
  if (method === "POST" && path === "/available-usernames")
    return "ADD_AVAILABLE_USERNAME";
  if (method === "PUT" && /^\/available-usernames\/[^/]+$/.test(path))
    return "UPDATE_AVAILABLE_USERNAME";
  if (method === "DELETE" && /^\/available-usernames\/[^/]+$/.test(path))
    return "DELETE_AVAILABLE_USERNAME";
  if (method === "DELETE" && path === "/available-usernames/all")
    return "DELETE_ALL_AVAILABLE_USERNAMES";
  if (method === "POST" && path === "/available-usernames/upload")
    return "IMPORT_AVAILABLE_USERNAMES_EXCEL";
  if (method === "GET" && path === "/available-usernames/export")
    return "EXPORT_AVAILABLE_USERNAMES_EXCEL";
  if (method === "POST" && path === "/assign-username")
    return "ASSIGN_USERNAME_TO_SUBSCRIBER";

  // Stopped subscribers
  if (method === "POST" && /^\/stop\/[^/]+$/.test(path)) return "STOP_SUBSCRIBER";
  if (method === "POST" && /^\/reactivate\/[^/]+$/.test(path))
    return "REACTIVATE_SUBSCRIBER";
  if (method === "POST" && path === "/reactivate-bulk")
    return "BULK_REACTIVATE_SUBSCRIBERS";
  if (method === "DELETE" && /^\/stopped\/[^/]+$/.test(path))
    return "DELETE_STOPPED_SUBSCRIBER";

  // Expiring/actions
  if (method === "POST" && /^\/expiring-usernames\/reset-special\/[^/]+$/.test(path))
    return "RESET_SPECIAL_SUBSCRIBER_CYCLE";
  if (method === "POST" && path === "/bulk-change-usernames")
    return "BULK_CHANGE_USERNAMES";

  // Communication
  if (method === "POST" && path === "/sms") return "SEND_SMS";

  return `${method} ${path}`;
};

const isSensitiveKey = (key: string) => {
  const normalized = key.toLowerCase();
  return (
    normalized.includes("password") ||
    normalized.includes("pass") ||
    normalized.includes("token") ||
    normalized.includes("secret")
  );
};

const sanitizeForLog = (value: any): any => {
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeForLog);
  }
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    Object.keys(value).forEach((key) => {
      if (isSensitiveKey(key)) {
        out[key] = "***";
      } else {
        out[key] = sanitizeForLog(value[key]);
      }
    });
    return out;
  }
  if (typeof value === "string" && value.length > 300) {
    return `${value.slice(0, 300)}...`;
  }
  return value;
};

const activityLogMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.path === "/logs") return next();

  const shouldTrack = req.method !== "GET" || exportPaths.has(req.path);
  if (!shouldTrack) return next();

  res.on("finish", () => {
    const actor = ((req.session as any)?.adminId as string | undefined) || "admin";
    const payload = {
      query: sanitizeForLog(req.query || {}),
      body: sanitizeForLog(req.body || {}),
      params: sanitizeForLog(req.params || {}),
    };
    const details = JSON.stringify(payload).slice(0, 2000);
    const statusCode = res.statusCode || 200;
    const action = resolveActionLabel(req.method, req.path);
    const ipAddress = req.ip || null;

    void writeActivityLog({
      actor,
      action,
      method: req.method,
      endpoint: req.originalUrl || req.path,
      statusCode,
      details,
      ipAddress,
    });
  });

  next();
};

export default activityLogMiddleware;

