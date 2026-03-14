import { getPool } from "../config/database";

type ActivityLogInput = {
  actor?: string | null;
  action: string;
  method: string;
  endpoint: string;
  statusCode: number;
  details?: string | null;
  ipAddress?: string | null;
};

export const writeActivityLog = async (payload: ActivityLogInput) => {
  try {
    const pool = getPool();
    if (!pool) return;

    await pool.execute(
      `INSERT INTO activity_logs (actor, action, method, endpoint, statusCode, details, ipAddress)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.actor || "admin",
        payload.action,
        payload.method,
        payload.endpoint,
        payload.statusCode,
        payload.details || null,
        payload.ipAddress || null,
      ],
    );
  } catch (error) {
    // Logging should never break the main request flow.
    console.error("Error writing activity log:", error);
  }
};

