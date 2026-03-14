import mysql, { ResultSetHeader } from "mysql2/promise";

// MySQL connection pool
let pool: mysql.Pool;
let noDBMode = process.env.NO_DB === "true";

export const connectDB = async () => {
  if (noDBMode) {
    console.log("⚠️ Running in NO_DB mode - using mock data");
    return;
  }

  try {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || "localhost",
      port: parseInt(process.env.MYSQL_PORT || "3306"),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || "subscribers_db",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // Test connection
    const connection = await pool.getConnection();
    console.log("✓ MySQL connected successfully");
    connection.release();

    // Create tables if not exist
    await createTables();
  } catch (error) {
    console.error("MySQL connection failed:", error);
    process.exit(1);
  }
};

// Create subscribers table
const createTables = async () => {
  if (noDBMode) return;

  const createSubscribersTable = `
    CREATE TABLE IF NOT EXISTS subscribers (
      id INT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(100),
      fullName VARCHAR(200),
      facilityType VARCHAR(200),
      phone VARCHAR(50),
      \`package\` VARCHAR(100),
      monthlyPrice DECIMAL(10, 2) DEFAULT 0,
      speed INT DEFAULT 4,
      startDate DATE,
      firstContactDate DATE,
      disconnectionDate DATE,
      isActive BOOLEAN DEFAULT TRUE,
      isSuspended BOOLEAN DEFAULT FALSE,
      notes TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_username (username),
      INDEX idx_phone (phone),
      INDEX idx_fullName (fullName),
      INDEX idx_isSuspended (isSuspended)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  // Table for storing username history when usernames are changed
  const createUsernameHistoryTable = `
    CREATE TABLE IF NOT EXISTS username_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      subscriber_id INT NOT NULL,
      old_username VARCHAR(100) NOT NULL,
      old_password VARCHAR(100),
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_subscriber_id (subscriber_id),
      FOREIGN KEY (subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  // Table for available usernames that haven't been assigned yet
  const createAvailableUsernamesTable = `
    CREATE TABLE IF NOT EXISTS available_usernames (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(100),
      \`package\` VARCHAR(200),
      startDate DATE NULL,
      isUsed BOOLEAN DEFAULT FALSE,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_username (username),
      INDEX idx_isUsed (isUsed)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  // Activity logs table for auditing dashboard operations
  const createActivityLogsTable = `
    CREATE TABLE IF NOT EXISTS activity_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      actor VARCHAR(100) DEFAULT 'admin',
      action VARCHAR(255) NOT NULL,
      method VARCHAR(10) NOT NULL,
      endpoint VARCHAR(255) NOT NULL,
      statusCode INT DEFAULT 200,
      details TEXT NULL,
      ipAddress VARCHAR(120) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_createdAt (createdAt),
      INDEX idx_method (method),
      INDEX idx_actor (actor)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await pool.execute(createSubscribersTable);
    console.log("✓ Subscribers table ready");

    await pool.execute(createUsernameHistoryTable);
    console.log("✓ Username history table ready");

    await pool.execute(createAvailableUsernamesTable);
    console.log("✓ Available usernames table ready");

    await pool.execute(createActivityLogsTable);
    console.log("✓ Activity logs table ready");

    // Alter existing table to allow NULL values for phone and other fields
    const alterStatements = [
      "ALTER TABLE subscribers MODIFY COLUMN phone VARCHAR(50) NULL",
      "ALTER TABLE subscribers MODIFY COLUMN fullName VARCHAR(200) NULL",
      "ALTER TABLE subscribers MODIFY COLUMN `package` VARCHAR(100) NULL",
    ];

    for (const sql of alterStatements) {
      try {
        await pool.execute(sql);
      } catch (e) {
        // Ignore errors if column is already nullable
      }
    }

    // Add isSuspended column if it doesn't exist
    try {
      await pool.execute(
        "ALTER TABLE subscribers ADD COLUMN isSuspended BOOLEAN DEFAULT FALSE",
      );
      console.log("✓ Added isSuspended column to subscribers table");
    } catch (e) {
      console.log("⚠️ Failed to add isSuspended column:", (e as Error).message);
    }

    // Add index for isSuspended if it doesn't exist
    try {
      await pool.execute(
        "ALTER TABLE subscribers ADD INDEX idx_isSuspended (isSuspended)",
      );
      console.log("✓ Added index for isSuspended column");
    } catch (e) {
      console.log(
        "⚠️ Failed to add index for isSuspended:",
        (e as Error).message,
      );
    }

    // Add speed column if it doesn't exist
    try {
      await pool.execute(
        "ALTER TABLE subscribers ADD COLUMN speed INT DEFAULT 4",
      );
      console.log("✓ Added speed column to subscribers table");
    } catch (e) {
      console.log("⚠️ Failed to add speed column:", (e as Error).message);
    }

    // Add facilityType column if it doesn't exist
    try {
      await pool.execute(
        "ALTER TABLE subscribers ADD COLUMN facilityType VARCHAR(200) NULL",
      );
      console.log("✓ Added facilityType column to subscribers table");
    } catch (e) {
      console.log(
        "⚠️ Failed to add facilityType column:",
        (e as Error).message,
      );
    }

    // Add disconnectionDate column if it doesn't exist
    try {
      await pool.execute(
        "ALTER TABLE subscribers ADD COLUMN disconnectionDate DATE NULL",
      );
      console.log("✓ Added disconnectionDate column to subscribers table");
    } catch (e) {
      console.log(
        "⚠️ Failed to add disconnectionDate column:",
        (e as Error).message,
      );
    }

    // Add speed column to available_usernames if it doesn't exist
    try {
      await pool.execute(
        "ALTER TABLE available_usernames ADD COLUMN speed INT DEFAULT 4",
      );
      console.log("✓ Added speed column to available_usernames table");
    } catch (e) {
      console.log(
        "⚠️ Failed to add speed column to available_usernames:",
        (e as Error).message,
      );
    }

    // Create stopped_subscribers table for inactive subscribers
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS stopped_subscribers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          original_id INT,
          username VARCHAR(100),
          password VARCHAR(100),
          fullName VARCHAR(200),
          phone VARCHAR(50),
          \`package\` VARCHAR(100),
          facilityType VARCHAR(200),
          startDate DATE,
          firstContactDate DATE,
          disconnectionDate DATE,
          speed INT DEFAULT 4,
          notes TEXT,
          stoppedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          stoppedReason VARCHAR(500),
          INDEX idx_username (username),
          INDEX idx_fullName (fullName),
          INDEX idx_phone (phone)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log("✓ Stopped subscribers table ready");
    } catch (e) {
      console.log(
        "⚠️ Failed to create stopped_subscribers table:",
        (e as Error).message,
      );
    }

    // Update existing rows to set isSuspended = FALSE where it's NULL
    try {
      const [updateResult] = await pool.execute<ResultSetHeader>(
        "UPDATE subscribers SET isSuspended = FALSE WHERE isSuspended IS NULL",
      );
      console.log(
        `✓ Checked for NULL isSuspended values, affected rows: ${updateResult.affectedRows}`,
      );
    } catch (e) {
      console.log(
        "⚠️ Failed to update existing subscribers:",
        (e as Error).message,
      );
    }

    // Remove unique constraint from phone if exists
    try {
      await pool.execute("ALTER TABLE subscribers DROP INDEX phone");
    } catch (e) {
      // Index might not exist, ignore
    }

    // Drop foreign key constraint from username_history before changing ID type
    try {
      await pool.execute(
        "ALTER TABLE username_history DROP FOREIGN KEY username_history_ibfk_1",
      );
      console.log("✓ Dropped foreign key constraint from username_history");
    } catch (e) {
      // Foreign key might not exist or already dropped
    }

    // Also change subscriber_id in username_history to VARCHAR
    try {
      await pool.execute(
        "ALTER TABLE username_history MODIFY COLUMN subscriber_id VARCHAR(20)",
      );
      console.log("✓ Changed username_history.subscriber_id to VARCHAR(20)");
    } catch (e) {
      console.log(
        "⚠️ Failed to change username_history.subscriber_id type:",
        (e as Error).message,
      );
    }

    // Change ID column from INT to VARCHAR for new ID format (W04-001)
    try {
      await pool.execute(
        "ALTER TABLE subscribers MODIFY COLUMN id VARCHAR(20) NOT NULL",
      );
      console.log("✓ Changed subscribers.id to VARCHAR(20)");
    } catch (e) {
      console.log(
        "⚠️ Failed to change subscribers.id type:",
        (e as Error).message,
      );
    }

    // Change package column to INT for line number
    try {
      await pool.execute(
        "ALTER TABLE subscribers MODIFY COLUMN `package` INT NULL",
      );
      console.log("✓ Changed subscribers.package to INT");
    } catch (e) {
      console.log(
        "⚠️ Failed to change subscribers.package type:",
        (e as Error).message,
      );
    }

    // Change stopped_subscribers ID to VARCHAR as well
    try {
      await pool.execute(
        "ALTER TABLE stopped_subscribers MODIFY COLUMN original_id VARCHAR(20)",
      );
      console.log("✓ Changed stopped_subscribers.original_id to VARCHAR(20)");
    } catch (e) {
      console.log(
        "⚠️ Failed to change stopped_subscribers.original_id type:",
        (e as Error).message,
      );
    }

    // Add date columns to username_history for tracking usage period
    try {
      await pool.execute(
        "ALTER TABLE username_history ADD COLUMN usage_start_date DATE NULL",
      );
      console.log("✓ Added usage_start_date column to username_history");
    } catch (e) {
      console.log(
        "⚠️ Failed to add usage_start_date column:",
        (e as Error).message,
      );
    }

    try {
      await pool.execute(
        "ALTER TABLE username_history ADD COLUMN usage_end_date DATE NULL",
      );
      console.log("✓ Added usage_end_date column to username_history");
    } catch (e) {
      console.log(
        "⚠️ Failed to add usage_end_date column:",
        (e as Error).message,
      );
    }

    // Create speed_history table for tracking speed changes
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS speed_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          subscriber_id VARCHAR(20) NOT NULL,
          old_speed INT NOT NULL,
          new_speed INT NOT NULL,
          usage_start_date DATE NULL,
          usage_end_date DATE NULL,
          days_used INT DEFAULT 0,
          changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_subscriber_id (subscriber_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log("✓ Speed history table ready");
    } catch (e) {
      console.log(
        "⚠️ Failed to create speed_history table:",
        (e as Error).message,
      );
    }

    // Add expiryDate column to available_usernames for tracking remaining days
    try {
      await pool.execute(
        "ALTER TABLE available_usernames ADD COLUMN expiryDate DATE NULL",
      );
      console.log("✓ Added expiryDate column to available_usernames");
    } catch (e) {
      console.log("⚠️ Failed to add expiryDate column:", (e as Error).message);
    }

    // Add firstContactDate column to available_usernames for calculating remaining days
    try {
      await pool.execute(
        "ALTER TABLE available_usernames ADD COLUMN firstContactDate DATE NULL",
      );
      console.log("✓ Added firstContactDate column to available_usernames");
    } catch (e) {
      console.log(
        "⚠️ Failed to add firstContactDate column:",
        (e as Error).message,
      );
    }

    // Add startDate column to available_usernames for request date tracking
    try {
      await pool.execute(
        "ALTER TABLE available_usernames ADD COLUMN startDate DATE NULL",
      );
      console.log("✓ Added startDate column to available_usernames");
    } catch (e) {
      console.log("⚠️ Failed to add startDate column:", (e as Error).message);
    }

    console.log("✓ Table schema updated (nullable fields)");
  } catch (error) {
    console.error("Error creating tables:", error);
  }
};

// Get database pool (returns null in NO_DB mode)
export const getPool = () => {
  return noDBMode ? null : pool;
};
