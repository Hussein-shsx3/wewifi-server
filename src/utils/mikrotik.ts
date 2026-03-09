import { RouterOSClient } from "routeros-client";

// Mikrotik connection settings from environment
const getMikrotikConfig = () => ({
  host: process.env.MIKROTIK_HOST || "192.168.88.1",
  user: process.env.MIKROTIK_USER || "admin",
  password: process.env.MIKROTIK_PASSWORD || "",
  port: parseInt(process.env.MIKROTIK_PORT || "8728"),
  timeout: 2000, // 2 second timeout for fast failure
});

// Cache for active users (refresh every 30 seconds)
let activeUsersCache: Set<string> = new Set();
let lastCacheUpdate: number = 0;
let lastErrorTime: number = 0;
// null = not checked yet, true = available, false = unavailable
let mikrotikAvailable: boolean | null = null;
let errorLogged: boolean = false; // Track if we've logged the error
let initialCheckDone: boolean = false; // Track if initial check is done
let initialCheckPromise: Promise<void> | null = null; // Promise for initial check
const CACHE_DURATION = 30000; // 30 seconds
const ERROR_COOLDOWN = 60000; // 1 minute cooldown after error

/**
 * Connect to Mikrotik and get list of active PPPoE/Hotspot users
 */
export const refreshActiveUsers = async (): Promise<Set<string>> => {
  // If Mikrotik was unavailable recently, don't try again immediately
  if (
    mikrotikAvailable === false &&
    Date.now() - lastErrorTime < ERROR_COOLDOWN
  ) {
    return activeUsersCache;
  }

  const config = getMikrotikConfig();
  let client: RouterOSClient | null = null;

  try {
    client = new RouterOSClient({
      host: config.host,
      user: config.user,
      password: config.password,
      port: config.port,
      timeout: config.timeout,
    });

    // Handle connection errors
    client.on("error", (err: any) => {
      // Silently ignore - we handle errors in the catch block
    });

    await client.connect();
    mikrotikAvailable = true;
    errorLogged = false; // Reset error flag on successful connection
    console.log(
      `✓ Connected to Mikrotik router (${config.host}:${config.port})`
    );

    // Get active PPPoE users using RouterOS API
    const pppoeActive = await (client as any).write(["/ppp/active/print"]);

    // Get active Hotspot users (if you use hotspot)
    let hotspotActive: any[] = [];
    try {
      hotspotActive = await (client as any).write(["/ip/hotspot/active/print"]);
    } catch (e) {
      // Hotspot might not be configured
    }

    // Combine all active usernames
    const activeUsers = new Set<string>();

    if (Array.isArray(pppoeActive)) {
      pppoeActive.forEach((user: any) => {
        if (user.name) {
          activeUsers.add(user.name.toLowerCase());
        }
      });
    }

    if (Array.isArray(hotspotActive)) {
      hotspotActive.forEach((user: any) => {
        if (user.user) {
          activeUsers.add(user.user.toLowerCase());
        }
      });
    }

    await client.close();

    activeUsersCache = activeUsers;
    lastCacheUpdate = Date.now();

    console.log(`✓ Found ${activeUsers.size} active users on Mikrotik`);
    return activeUsers;
  } catch (error: any) {
    // Try to close client if it exists
    if (client) {
      try {
        await client.close();
      } catch (e) {
        // Ignore close errors
      }
    }

    // Consider previous state: treat null (not checked) same as available
    const wasAvailable = mikrotikAvailable !== false;
    mikrotikAvailable = false;
    lastErrorTime = Date.now();
    lastCacheUpdate = Date.now(); // Mark as updated so we don't retry immediately

    // Only log error once (first time it fails)
    if (wasAvailable && !errorLogged) {
      errorLogged = true;
      console.warn(
        `⚠ Mikrotik not available (${config.host}:${
          config.port
        }) - all users will show as inactive. Error: ${error?.message || error}`
      );
    }

    // Return empty set
    return activeUsersCache;
  }
};

/**
 * Initialize Mikrotik connection at server startup
 * This runs in background so it doesn't block the server
 */
export const initMikrotik = (): void => {
  if (initialCheckPromise) return;

  initialCheckPromise = refreshActiveUsers()
    .then(() => {
      initialCheckDone = true;
    })
    .catch(() => {
      initialCheckDone = true;
    });
};

/**
 * Check if a specific user is currently connected to Mikrotik
 * Returns true if active, false if not connected or error
 */
export const checkMikrotikConnection = async (
  username: string
): Promise<boolean> => {
  // If initial check not done yet, return false immediately (don't wait)
  if (!initialCheckDone) {
    return false;
  }

  // If Mikrotik is not available, return false immediately
  if (mikrotikAvailable !== true) {
    return false;
  }

  // Use cache
  return activeUsersCache.has(username.toLowerCase());
};

/**
 * Get status string for legacy compatibility
 */
export const getMikrotikStatus = async (username: string): Promise<string> => {
  const isActive = await checkMikrotikConnection(username);
  return isActive ? "online" : "offline";
};

/**
 * Get all active users from Mikrotik
 */
export const getActiveUsers = async (): Promise<string[]> => {
  if (
    Date.now() - lastCacheUpdate < CACHE_DURATION &&
    activeUsersCache.size > 0
  ) {
    return Array.from(activeUsersCache);
  }

  const users = await refreshActiveUsers();
  return Array.from(users);
};

/**
 * Test Mikrotik connection
 */
export const testMikrotikConnection = async (): Promise<{
  success: boolean;
  message: string;
}> => {
  const config = getMikrotikConfig();

  try {
    const client = new RouterOSClient({
      host: config.host,
      user: config.user,
      password: config.password,
      port: config.port,
      timeout: config.timeout,
    });

    await client.connect();
    const identity = await (client as any).write(["/system/identity/print"]);
    await client.close();

    return {
      success: true,
      message: `Connected to Mikrotik: ${identity[0]?.name || "Unknown"}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to connect: ${(error as Error).message}`,
    };
  }
};

/**
 * Get remote address (IP) for a specific PPPoE user from Mikrotik
 */
export const getRemoteAddressForUser = async (
  username: string
): Promise<{
  remoteAddress: string | null;
  isActive: boolean;
  callerID?: string;
  uptime?: string;
}> => {
  // If Mikrotik is not available, return null
  if (!mikrotikAvailable) {
    return { remoteAddress: null, isActive: false };
  }

  const config = getMikrotikConfig();
  let client: RouterOSClient | null = null;

  try {
    client = new RouterOSClient({
      host: config.host,
      user: config.user,
      password: config.password,
      port: config.port,
      timeout: config.timeout,
    });

    client.on("error", () => {});
    await client.connect();

    // Get active PPPoE sessions and find the user
    const pppoeActive = await (client as any).write(["/ppp/active/print"]);

    await client.close();

    if (Array.isArray(pppoeActive)) {
      const userSession = pppoeActive.find(
        (user: any) => user.name?.toLowerCase() === username.toLowerCase()
      );

      if (userSession) {
        return {
          remoteAddress:
            userSession.address || userSession["remote-address"] || null,
          isActive: true,
          callerID: userSession["caller-id"] || null,
          uptime: userSession.uptime || null,
        };
      }
    }

    // User not found in active sessions
    return { remoteAddress: null, isActive: false };
  } catch (error) {
    if (client) {
      try {
        await client.close();
      } catch (e) {}
    }
    return { remoteAddress: null, isActive: false };
  }
};

/**
 * Update first contact date for a user when they connect
 * This should be called when a user becomes active for the first time
 */
export const updateFirstContactDate = async (
  username: string
): Promise<boolean> => {
  const { getPool } = await import("../config/database");

  if (!getPool) return false;

  try {
    const pool = getPool();
    if (!pool) return false;

    // Check if user exists and doesn't have firstContactDate set
    // Only set it once - never update if already set (allows manual editing)
    const [existing] = await pool.execute<any[]>(
      "SELECT id, firstContactDate FROM subscribers WHERE username = ?",
      [username]
    );

    if (existing.length > 0 && !existing[0].firstContactDate) {
      // Set firstContactDate to current date only if not already set
      await pool.execute(
        "UPDATE subscribers SET firstContactDate = CURDATE() WHERE username = ? AND firstContactDate IS NULL",
        [username]
      );
      return true;
    }

    return false; // Already has firstContactDate or user doesn't exist
  } catch (error) {
    console.error("Error updating first contact date:", error);
    return false;
  }
};
