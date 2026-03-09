import { Request, Response } from "express";
import axios from "axios";
import { getPool } from "../config/database";
import { ISubscriber, formatDateForMySQL } from "../models/Subscriber";
import * as XLSX from "xlsx";
import { RowDataPacket, ResultSetHeader } from "mysql2";

const noDBMode = process.env.NO_DB === "true";

// Helper function to check if database is available
const isDBAvailable = () => {
  if (noDBMode) return false;
  const pool = getPool();
  return pool !== null;
};

// Mock data for NO_DB mode
const mockSubscribers = [
  {
    id: 1,
    username: "testuser1",
    password: "pass123",
    fullName: "مستخدم تجريبي 1",
    phone: "0501234567",
    package: "خط ذهبي",
    monthlyPrice: 100.0,
    speed: 8,
    startDate: "2024-01-01",
    firstContactDate: "2024-01-01",
    isActive: true,
    isSuspended: false,
    notes: "مستخدم تجريبي",
    createdAt: "2024-01-01 00:00:00",
    updatedAt: "2024-01-01 00:00:00",
  },
  {
    id: 2,
    username: "testuser2",
    password: "pass456",
    fullName: "مستخدم تجريبي 2",
    phone: "0507654321",
    package: "خط فضي",
    monthlyPrice: 80.0,
    speed: 4,
    startDate: "2024-01-15",
    firstContactDate: "2024-01-15",
    isActive: false,
    isSuspended: false,
    notes: "مستخدم تجريبي آخر",
    createdAt: "2024-01-15 00:00:00",
    updatedAt: "2024-01-15 00:00:00",
  },
];

export const getSubscribers = async (req: Request, res: Response) => {
  try {
    const { search, page = 1, limit = 10, suspended } = req.query;
    const isSuspendedRoute = req.path.includes("/suspended");
    const showSuspended = suspended === "true" || isSuspendedRoute;
    const pool = getPool();
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(10000, Number(limit) || 10)); // Allow up to 10000 subscribers
    const offset = (pageNum - 1) * limitNum;

    if (noDBMode || !pool) {
      // Return mock data
      let filteredData = mockSubscribers;

      if (search) {
        const searchTerm = search.toString().toLowerCase();
        filteredData = mockSubscribers.filter(
          (sub) =>
            sub.username.toLowerCase().includes(searchTerm) ||
            sub.fullName.toLowerCase().includes(searchTerm) ||
            sub.phone.includes(searchTerm),
        );
      }

      // Filter by suspended status
      const showSuspended = suspended === "true" || isSuspendedRoute;
      filteredData = filteredData.filter(
        (sub) => sub.isSuspended === showSuspended,
      );

      const total = filteredData.length;
      const paginatedData = filteredData.slice(offset, offset + limitNum);

      // Add _id for compatibility
      const subscribersWithId = paginatedData.map((sub) => ({
        ...sub,
        _id: sub.id,
      }));

      return res.json({
        success: true,
        data: subscribersWithId,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum),
          limit: limitNum,
        },
      });
    }

    let query = "SELECT * FROM subscribers";
    let countQuery = "SELECT COUNT(*) as total FROM subscribers";
    const params: any[] = [];

    if (search) {
      const searchTerm = search.toString().toLowerCase().trim();

      // Handle special search terms for missing data
      if (
        searchTerm === "no phone" ||
        searchTerm === "لا هاتف" ||
        searchTerm === "بدون هاتف"
      ) {
        query += " WHERE (phone IS NULL OR phone = '' OR phone = 'null')";
        countQuery += " WHERE (phone IS NULL OR phone = '' OR phone = 'null')";
      } else if (
        searchTerm === "no date" ||
        searchTerm === "لا تاريخ" ||
        searchTerm === "بدون تاريخ"
      ) {
        query += " WHERE (startDate IS NULL OR startDate = '')";
        countQuery += " WHERE (startDate IS NULL OR startDate = '')";
      } else if (
        searchTerm === "no contact date" ||
        searchTerm === "لا تاريخ اتصال" ||
        searchTerm === "بدون تاريخ اول اتصال"
      ) {
        query += " WHERE (firstContactDate IS NULL OR firstContactDate = '')";
        countQuery +=
          " WHERE (firstContactDate IS NULL OR firstContactDate = '')";
      } else if (
        searchTerm === "no notes" ||
        searchTerm === "لا ملاحظات" ||
        searchTerm === "بدون ملاحظات"
      ) {
        query += " WHERE (notes IS NULL OR notes = '' OR notes = 'null')";
        countQuery += " WHERE (notes IS NULL OR notes = '' OR notes = 'null')";
      } else if (
        searchTerm === "missing data" ||
        searchTerm === "بيانات ناقصة" ||
        searchTerm === "معلومات ناقصة"
      ) {
        query +=
          " WHERE (phone IS NULL OR phone = '' OR phone = 'null' OR startDate IS NULL OR startDate = '' OR firstContactDate IS NULL OR firstContactDate = '' OR notes IS NULL OR notes = '' OR notes = 'null')";
        countQuery +=
          " WHERE (phone IS NULL OR phone = '' OR phone = 'null' OR startDate IS NULL OR startDate = '' OR firstContactDate IS NULL OR firstContactDate = '' OR notes IS NULL OR notes = '' OR notes = 'null')";
      } else {
        // Regular text search across multiple fields
        const searchCondition =
          " WHERE (username LIKE ? OR fullName LIKE ? OR phone LIKE ? OR `package` LIKE ? OR notes LIKE ? OR CAST(monthlyPrice AS CHAR) LIKE ?)";
        const searchValue = `%${search}%`;
        query += searchCondition;
        countQuery += searchCondition;
        params.push(
          searchValue,
          searchValue,
          searchValue,
          searchValue,
          searchValue,
          searchValue,
        );
      }
    }

    // Add suspended filter
    const suspendedCondition = showSuspended
      ? "isSuspended = TRUE"
      : "isSuspended = FALSE";

    if (search) {
      query += ` AND ${suspendedCondition}`;
      countQuery += ` AND ${suspendedCondition}`;
    } else {
      query += ` WHERE ${suspendedCondition}`;
      countQuery += ` WHERE ${suspendedCondition}`;
    }

    // Use string interpolation for LIMIT/OFFSET (safe because we validated as numbers)
    query += ` ORDER BY id ASC LIMIT ${limitNum} OFFSET ${offset}`;

    // Use pool.query() instead of pool.execute() to avoid prepared statement issues
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    const [countResult] = await pool.query<RowDataPacket[]>(countQuery, params);
    const total = countResult[0].total;

    // Add _id for compatibility
    const subscribersWithId = rows.map((sub) => ({
      ...sub,
      _id: sub.id,
    }));

    res.json({
      success: true,
      data: subscribersWithId,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error fetching subscribers:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching subscribers", error });
  }
};

// Helper function to calculate disconnection date (firstContactDate + 31 days)
const calculateDisconnectionDate = (
  firstContactDate: Date | string | null | undefined,
): string | null => {
  if (!firstContactDate) return null;
  const date = new Date(firstContactDate);
  date.setDate(date.getDate() + 32); // Add 32 days (so day 1 + 31 days = day 32)
  return formatDateForMySQL(date);
};

// Helper function to extract number from package/line string
// e.g., "خط 50" -> "50", "50 ميجا" -> "50", "خط رقم 100" -> "100", "50" -> "50"
const extractPackageNumber = (
  packageStr: string | null | undefined,
): string => {
  if (!packageStr) return "";
  const str = String(packageStr).trim();
  if (!str) return "";

  // Try to find numbers in the string
  const numbers = str.match(/\d+/g);
  if (numbers && numbers.length > 0) {
    // Return the first number found
    return numbers[0];
  }

  // If no numbers found, return empty string
  return "";
};

// Generate subscriber ID in format W{line}-{sequence}
// e.g., W02-001, W04-002, W50-003
const generateSubscriberId = async (
  pool: any,
  lineNumber: number,
): Promise<string> => {
  // Pad line number to 2 digits (e.g., 2 -> "02", 50 -> "50")
  const lineStr = String(lineNumber).padStart(2, "0");
  const prefix = `W${lineStr}-`;

  // Get the highest sequence number for this line from both subscribers and stopped_subscribers
  // Only count IDs that match the new format (W##-###)
  const [subscriberRows]: [RowDataPacket[], any] = await pool.execute(
    `SELECT id FROM subscribers WHERE id LIKE ? AND id REGEXP '^W[0-9]{2}-[0-9]{3}$' ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`],
  );

  const [stoppedRows]: [RowDataPacket[], any] = await pool.execute(
    `SELECT id FROM stopped_subscribers WHERE id LIKE ? AND id REGEXP '^W[0-9]{2}-[0-9]{3}$' ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`],
  );

  // Start from 100 (so first ID will be 101)
  let maxSequence = 100;

  // Check subscribers table
  if (subscriberRows.length > 0) {
    const existingId = subscriberRows[0].id;
    const match = existingId.match(/-(\d+)$/);
    if (match) {
      maxSequence = Math.max(maxSequence, parseInt(match[1], 10));
    }
  }

  // Check stopped_subscribers table
  if (stoppedRows.length > 0) {
    const existingId = stoppedRows[0].id;
    const match = existingId.match(/-(\d+)$/);
    if (match) {
      maxSequence = Math.max(maxSequence, parseInt(match[1], 10));
    }
  }

  const nextSequence = maxSequence + 1;

  // Pad sequence to 3 digits (e.g., 101 -> "101", 125 -> "125")
  const sequenceStr = String(nextSequence).padStart(3, "0");

  return `${prefix}${sequenceStr}`;
};

// Get subscribers about to be disconnected (disconnectionDate within next 7 days or already passed)
export const getSubscribersAboutToDisconnect = async (
  req: Request,
  res: Response,
) => {
  try {
    const pool = getPool();

    if (noDBMode || !pool) {
      return res.json({ success: true, data: [] });
    }

    // Get subscribers where disconnectionDate is within the next 7 days or has already passed
    // and they haven't been given a new username yet
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id as _id, id, username, password, fullName, facilityType, phone, \`package\`, 
              monthlyPrice, speed, startDate, firstContactDate, disconnectionDate, 
              isActive, isSuspended, notes, createdAt, updatedAt
       FROM subscribers 
       WHERE disconnectionDate IS NOT NULL 
         AND disconnectionDate <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
         AND isSuspended = FALSE
       ORDER BY disconnectionDate ASC`,
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching subscribers about to disconnect:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching data", error });
  }
};

export const createSubscriber = async (req: Request, res: Response) => {
  try {
    const {
      username,
      fullName,
      facilityType,
      phone,
      password,
      package: packageName,
      startDate,
      firstContactDate,
      monthlyPrice,
      speed,
      notes,
      isSuspended = false,
    } = req.body;

    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    // Extract line number from package name (required for ID generation)
    const lineNumber = parseInt(extractPackageNumber(packageName), 10);
    if (!lineNumber || isNaN(lineNumber)) {
      return res
        .status(400)
        .json({ success: false, message: "رقم الخط مطلوب لإنشاء ID المشترك" });
    }

    // Generate ID automatically based on line number
    const generatedId = await generateSubscriberId(pool, lineNumber);

    // Check if username already exists
    const [existing] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM subscribers WHERE username = ?",
      [username],
    );
    if (existing.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Username already exists" });
    }

    // Check if phone already exists (only if phone is provided)
    if (phone) {
      const [existingPhone] = await pool.execute<RowDataPacket[]>(
        "SELECT id FROM subscribers WHERE phone = ?",
        [phone],
      );
      if (existingPhone.length > 0) {
        return res
          .status(400)
          .json({ success: false, message: "Phone already exists" });
      }
    }

    // Calculate disconnection date (firstContactDate + 32 days)
    const disconnectionDate = calculateDisconnectionDate(firstContactDate);

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO subscribers (id, username, password, fullName, facilityType, phone, \`package\`, monthlyPrice, startDate, firstContactDate, disconnectionDate, isActive, isSuspended, notes, speed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generatedId,
        username,
        password,
        fullName,
        facilityType || null,
        phone || null,
        lineNumber,
        monthlyPrice || 0,
        formatDateForMySQL(startDate) || formatDateForMySQL(new Date()),
        formatDateForMySQL(firstContactDate),
        disconnectionDate,
        true,
        isSuspended,
        notes || null,
        speed || 4,
      ],
    );

    const [newSubscriber] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM subscribers WHERE id = ?",
      [generatedId],
    );

    res.status(201).json({
      success: true,
      id: generatedId,
      data: { ...newSubscriber[0], _id: newSubscriber[0].id },
      message: `تم إنشاء المشترك بنجاح - ID: ${generatedId}`,
    });
  } catch (error) {
    console.error("Error creating subscriber:", error);
    res
      .status(500)
      .json({ success: false, message: "Error creating subscriber", error });
  }
};

export const updateSubscriber = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    // Get current subscriber data first (to save old username/speed if changed)
    const [currentSubscriber] = await pool.execute<RowDataPacket[]>(
      "SELECT username, password, firstContactDate, disconnectionDate, speed FROM subscribers WHERE id = ?",
      [id],
    );

    if (currentSubscriber.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Subscriber not found" });
    }

    const oldUsername = currentSubscriber[0].username;
    const oldPassword = currentSubscriber[0].password;
    const oldFirstContactDate = currentSubscriber[0].firstContactDate;
    const oldDisconnectionDate = currentSubscriber[0].disconnectionDate;
    const oldSpeed = currentSubscriber[0].speed || 4;

    // Build dynamic update query
    const fields: string[] = [];
    const values: any[] = [];

    // Check if username is being changed
    const isUsernameChanging =
      updates.username !== undefined && updates.username !== oldUsername;

    // Check if speed is being changed
    const isSpeedChanging =
      updates.speed !== undefined && parseInt(updates.speed) !== oldSpeed;

    console.log("updateSubscriber - oldUsername:", oldUsername);
    console.log("updateSubscriber - newUsername:", updates.username);
    console.log("updateSubscriber - isUsernameChanging:", isUsernameChanging);
    console.log("updateSubscriber - oldSpeed:", oldSpeed);
    console.log("updateSubscriber - newSpeed:", updates.speed);
    console.log("updateSubscriber - isSpeedChanging:", isSpeedChanging);

    if (updates.username !== undefined) {
      fields.push("username = ?");
      values.push(updates.username);
    }
    if (updates.password !== undefined) {
      fields.push("password = ?");
      values.push(updates.password);
    }
    if (updates.fullName !== undefined) {
      fields.push("fullName = ?");
      values.push(updates.fullName);
    }
    if (updates.facilityType !== undefined) {
      fields.push("facilityType = ?");
      values.push(updates.facilityType);
    }
    if (updates.phone !== undefined) {
      fields.push("phone = ?");
      values.push(updates.phone);
    }
    if (updates.package !== undefined) {
      fields.push("`package` = ?");
      values.push(extractPackageNumber(updates.package));
    }
    if (updates.monthlyPrice !== undefined) {
      fields.push("monthlyPrice = ?");
      values.push(updates.monthlyPrice);
    }
    if (updates.startDate !== undefined) {
      fields.push("startDate = ?");
      values.push(formatDateForMySQL(updates.startDate));
    }
    if (updates.firstContactDate !== undefined && !isSpeedChanging) {
      // Only update firstContactDate manually if speed is NOT changing
      // When speed changes, we'll set new dates automatically
      fields.push("firstContactDate = ?");
      values.push(formatDateForMySQL(updates.firstContactDate));
      // Also update disconnection date when firstContactDate changes
      fields.push("disconnectionDate = ?");
      values.push(calculateDisconnectionDate(updates.firstContactDate));
    }
    if (updates.notes !== undefined) {
      fields.push("notes = ?");
      values.push(updates.notes);
    }
    if (updates.speed !== undefined) {
      fields.push("speed = ?");
      values.push(updates.speed);
    }
    if (updates.isSuspended !== undefined) {
      fields.push("isSuspended = ?");
      values.push(updates.isSuspended);
    }

    if (fields.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No fields to update" });
    }

    // If username is changing, save old username to history and available usernames
    if (isUsernameChanging) {
      // Calculate dates for history record
      const usageStartDate = oldFirstContactDate
        ? formatDateForMySQL(oldFirstContactDate)
        : null;
      const usageEndDate = oldFirstContactDate
        ? calculateDisconnectionDate(oldFirstContactDate)
        : null;

      // Save to username history with usage dates
      await pool.execute(
        "INSERT INTO username_history (subscriber_id, old_username, old_password, usage_start_date, usage_end_date) VALUES (?, ?, ?, ?, ?)",
        [id, oldUsername, oldPassword, usageStartDate, usageEndDate],
      );

      // Delete the new username from available_usernames if it exists there
      await pool.execute("DELETE FROM available_usernames WHERE username = ?", [
        updates.username,
      ]);
    }

    // Track speed history entry for response
    let speedHistoryEntry: any = null;
    let oldUsernameAddedToAvailable = false;

    // If speed is changing, save to speed history and reset dates
    if (isSpeedChanging) {
      // Calculate days used with old speed
      let daysUsed = 0;
      if (oldFirstContactDate) {
        const startDate = new Date(oldFirstContactDate);
        const today = new Date();
        startDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        daysUsed = Math.floor(
          (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysUsed < 0) daysUsed = 0;
      }

      const usageStartDate = oldFirstContactDate
        ? formatDateForMySQL(oldFirstContactDate)
        : null;
      const usageEndDate = formatDateForMySQL(new Date());

      // Save to speed history
      await pool.execute(
        "INSERT INTO speed_history (subscriber_id, old_speed, new_speed, usage_start_date, usage_end_date, days_used) VALUES (?, ?, ?, ?, ?, ?)",
        [id, oldSpeed, updates.speed, usageStartDate, usageEndDate, daysUsed],
      );

      // Store entry data for response
      speedHistoryEntry = {
        old_speed: oldSpeed,
        new_speed: updates.speed,
        usage_start_date: usageStartDate,
        usage_end_date: usageEndDate,
        days_used: daysUsed,
      };

      // Add old username to available_usernames with remaining days
      // Only if the username is also changing (user selected a new username)
      if (isUsernameChanging && oldUsername) {
        // Calculate remaining days on old username
        let remainingDays = 31 - daysUsed;
        if (remainingDays < 0) remainingDays = 0;

        // The old username keeps its original expiry date
        const oldExpiryDate = oldDisconnectionDate
          ? formatDateForMySQL(oldDisconnectionDate)
          : null;
        const oldFirstDate = oldFirstContactDate
          ? formatDateForMySQL(oldFirstContactDate)
          : null;

        // Check if username already exists in available_usernames
        const [existingUsername] = await pool.execute<RowDataPacket[]>(
          "SELECT id FROM available_usernames WHERE username = ?",
          [oldUsername],
        );

        if (existingUsername.length === 0) {
          // Add old username to available_usernames with its remaining expiry
          await pool.execute(
            "INSERT INTO available_usernames (username, password, speed, firstContactDate, expiryDate, isUsed) VALUES (?, ?, ?, ?, ?, FALSE)",
            [oldUsername, oldPassword, oldSpeed, oldFirstDate, oldExpiryDate],
          );
          oldUsernameAddedToAvailable = true;
          console.log(
            `Added old username ${oldUsername} to available_usernames with ${remainingDays} days remaining`,
          );
        }

        // Delete the new username from available_usernames if it exists there
        await pool.execute(
          "DELETE FROM available_usernames WHERE username = ?",
          [updates.username],
        );
      }

      // Reset firstContactDate and disconnectionDate for new speed period
      const today = new Date();
      const newDisconnectionDate = calculateDisconnectionDate(today);

      // Add or update the date fields
      const dateFieldIndex = fields.findIndex(
        (f) => f === "firstContactDate = ?",
      );
      if (dateFieldIndex === -1) {
        fields.push("firstContactDate = ?");
        values.splice(values.length, 0, formatDateForMySQL(today));
      } else {
        values[dateFieldIndex] = formatDateForMySQL(today);
      }

      const discFieldIndex = fields.findIndex(
        (f) => f === "disconnectionDate = ?",
      );
      if (discFieldIndex === -1) {
        fields.push("disconnectionDate = ?");
        values.splice(values.length, 0, newDisconnectionDate);
      } else {
        values[discFieldIndex] = newDisconnectionDate;
      }
    }

    values.push(id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE subscribers SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Subscriber not found" });
    }

    const [updated] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM subscribers WHERE id = ?",
      [id],
    );

    res.json({
      success: true,
      data: { ...updated[0], _id: updated[0].id },
      speedHistoryEntry: speedHistoryEntry,
      message: isUsernameChanging
        ? "تم تحديث المشترك وحفظ اسم المستخدم القديم في الأسماء المتاحة"
        : "Subscriber updated successfully",
    });
  } catch (error) {
    console.error("Error updating subscriber:", error);
    res
      .status(500)
      .json({ success: false, message: "Error updating subscriber", error });
  }
};

export const deleteSubscriber = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM subscribers WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Subscriber not found" });
    }

    res.json({ success: true, message: "Subscriber deleted successfully" });
  } catch (error) {
    console.error("Error deleting subscriber:", error);
    res
      .status(500)
      .json({ success: false, message: "Error deleting subscriber", error });
  }
};

export const deleteAllSubscribers = async (req: Request, res: Response) => {
  try {
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM subscribers",
    );

    res.json({
      success: true,
      message: `تم حذف ${result.affectedRows} مشترك`,
      deleted: result.affectedRows,
    });
  } catch (error) {
    console.error("Error deleting all subscribers:", error);
    res
      .status(500)
      .json({ success: false, message: "Error deleting subscribers", error });
  }
};

export const uploadExcel = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const results: any[] = [];
    const errors: any[] = [];
    const skipped: any[] = [];
    const updated: any[] = [];

    if (data.length === 0) {
      return res.json({
        success: false,
        message: "الملف فارغ أو لا يحتوي على بيانات (File is empty)",
        uploaded: 0,
      });
    }

    // Helper function to get value from row - more flexible matching
    const getFieldValue = (row: any, ...keys: string[]): string => {
      // First try exact matches
      for (const key of keys) {
        if (row.hasOwnProperty(key)) {
          const value = row[key];
          if (value !== undefined && value !== null) {
            const strValue = String(value).trim();
            if (
              strValue !== "" &&
              strValue !== "-" &&
              strValue.toLowerCase() !== "none"
            ) {
              return strValue;
            }
          }
        }
      }

      // Then try trimmed key matches (in case Excel has extra spaces)
      for (const key of keys) {
        const trimmedKey = key.trim();
        for (const rowKey in row) {
          if (row.hasOwnProperty(rowKey) && rowKey.trim() === trimmedKey) {
            const value = row[rowKey];
            if (value !== undefined && value !== null) {
              const strValue = String(value).trim();
              if (
                strValue !== "" &&
                strValue !== "-" &&
                strValue.toLowerCase() !== "none"
              ) {
                return strValue;
              }
            }
          }
        }
      }

      return "";
    };

    const columnNames = Object.keys(data[0] || {});
    console.log("Excel column names detected:", columnNames);
    console.log("First row data:", JSON.stringify(data[0]));
    console.log("First row keys:", Object.keys(data[0] || {}));

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex] as Record<string, any>;

      // Skip completely empty rows
      const rowValues = Object.values(row || {}).filter(
        (v) => v !== undefined && v !== null && v !== "",
      );
      if (rowValues.length === 0) {
        console.log(`Row ${rowIndex + 1}: Skipped (completely empty)`);
        continue;
      }

      try {
        // Check for ID first (for updating existing subscribers)
        const id = getFieldValue(row, "ID", "id", "رقم", "الرقم");

        const username = getFieldValue(
          row,
          "Username",
          "اسم المستخدم",
          "username",
          "User Name",
        );

        // If no username and no ID, skip this row entirely
        if (!username && !id) {
          console.log(`Row ${rowIndex + 1}: Skipped (no username or ID)`);
          continue;
        }

        const password = getFieldValue(
          row,
          "Password",
          "كلمة المرور",
          "password",
        );
        const fullName = getFieldValue(
          row,
          "اسم الزبون",
          "اسم العميل",
          "fullName",
          "Full Name",
        );
        const facilityType = getFieldValue(
          row,
          "نوع المنشأة",
          "نوع المنشاة",
          "المنشأة",
          "facilityType",
          "Facility Type",
        );
        const phone = getFieldValue(
          row,
          "رقم الجوال",
          "رقم الهاتف",
          "phone",
          "Phone",
          "الجوال",
        );
        const packageName = getFieldValue(row, "الخط", "خط", "line");
        const monthlyPrice = getFieldValue(
          row,
          "المبلغ",
          "المبلغ الشهري",
          "monthlyPrice",
          "Price",
        );
        // تاريخ بداية الاشتراك - startDate
        const startDateStr = getFieldValue(
          row,
          "تاريخ بداية الاشتراك",
          "تاريخ البداية",
          "التاريخ",
          "startDate",
          "Start Date",
          "Date",
        );
        console.log(
          `Row ${rowIndex + 1} - About to check firstContactDate, row keys:`,
          Object.keys(row),
        );
        console.log(
          `Row ${rowIndex + 1} - row has 'تاريخ اول اتصال':`,
          row.hasOwnProperty("تاريخ اول اتصال"),
        );
        console.log(
          `Row ${rowIndex + 1} - row['تاريخ اول اتصال'] =`,
          row["تاريخ اول اتصال"],
        );

        // Try direct access first
        let firstContactDateStr = "";
        if (
          row.hasOwnProperty("تاريخ اول اتصال") &&
          row["تاريخ اول اتصال"] !== null &&
          row["تاريخ اول اتصال"] !== undefined
        ) {
          firstContactDateStr = String(row["تاريخ اول اتصال"]).trim();
          console.log(
            `Row ${rowIndex + 1} - Direct access worked: "${firstContactDateStr}"`,
          );
        } else {
          // Fallback to getFieldValue
          firstContactDateStr = getFieldValue(
            row,
            "تاريخ اول اتصال",
            "تاريخ الاتصال الأول",
            "تاريخ اول الاتصال",
            "تاريخ أول اتصال",
            "تاريخ أول الاتصال",
            "تاريخ اول اتصال", // without alef hamza
            "تاريخ اول الاتصال", // without alef hamza
            "firstContactDate",
            "First Contact Date",
            "first_contact_date",
            "تاريخ_اول_اتصال",
          );
          console.log(
            `Row ${rowIndex + 1} - Fallback getFieldValue: "${firstContactDateStr}"`,
          );
        }

        console.log(
          `Row ${rowIndex + 1} - Final firstContactDateStr: "${firstContactDateStr}"`,
        );
        console.log(
          `Row ${rowIndex + 1} - Available columns:`,
          Object.keys(row),
        );
        const notes = getFieldValue(
          row,
          "ملاحظات",
          "notes",
          "Notes",
          "Remarks",
          "__EMPTY",
        );
        const isSuspendedStr = getFieldValue(
          row,
          "معطل",
          "متوقف",
          "isSuspended",
          "Suspended",
        );

        // Parse speed from notes - if notes contains "8" or "8 ميجا" then speed is 8, otherwise 4
        let speed = 4; // Default speed
        if (notes) {
          const notesLower = notes.toLowerCase();
          if (
            notesLower.includes("8") ||
            notesLower.includes("8 ميجا") ||
            notesLower.includes("8ميجا")
          ) {
            speed = 8;
          }
        }

        // All other fields are optional - use default values if not provided
        const finalPassword = password || "";
        const finalFullName = fullName || username;
        const finalFacilityType = facilityType || null;
        const finalPhone = phone || null; // Use null instead of empty string to avoid unique constraint issues
        const finalPackageName = extractPackageNumber(packageName) || "";
        const finalIsSuspended = isSuspendedStr
          ? isSuspendedStr.toLowerCase() === "true" || isSuspendedStr === "1"
          : false;

        // Helper function to parse date from Excel (handle multiple formats)
        const parseExcelDate = (dateStr: any): Date | null => {
          if (!dateStr) return null;

          // Convert to string and trim
          const str = String(dateStr).trim();
          if (!str) return null;

          const numValue = Number(str);
          if (!isNaN(numValue) && numValue > 10000 && numValue < 100000) {
            // Excel serial date number - convert to JS date
            return new Date((numValue - 25569) * 86400 * 1000);
          }

          // Try different date formats
          const dateFormats = [
            // YYYY-MM-DD
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
            // DD/MM/YYYY or MM/DD/YYYY
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            // DD-MM-YYYY or MM-DD-YYYY
            /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
            // DD.MM.YYYY
            /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
          ];

          for (const format of dateFormats) {
            const match = str.match(format);
            if (match) {
              const [, part1, part2, part3] = match;
              const year = parseInt(part3, 10);
              const month = parseInt(part2, 10);
              const day = parseInt(part1, 10);

              // Check if it's a valid date
              if (
                year >= 1900 &&
                year <= 2100 &&
                month >= 1 &&
                month <= 12 &&
                day >= 1 &&
                day <= 31
              ) {
                // For YYYY-MM-DD format
                if (format === dateFormats[0]) {
                  return new Date(year, month - 1, day);
                }
                // For other formats, assume DD/MM/YYYY if day > 12, otherwise MM/DD/YYYY
                else if (day > 12) {
                  return new Date(year, month - 1, day);
                } else if (month > 12) {
                  return new Date(year, day - 1, month);
                } else {
                  return new Date(year, month - 1, day);
                }
              }
            }
          }

          // Try parsing as general date string
          const parsed = new Date(str);
          if (
            !isNaN(parsed.getTime()) &&
            parsed.getFullYear() >= 1900 &&
            parsed.getFullYear() <= 2100
          ) {
            return parsed;
          }

          return null;
        };

        // Parse startDate from Excel only
        const parsedStartDate = parseExcelDate(startDateStr);

        // Parse firstContactDate from Excel
        const parsedFirstContactDate = parseExcelDate(firstContactDateStr);
        console.log(
          `Row ${rowIndex + 1} - parsedFirstContactDate: ${parsedFirstContactDate}`,
        );

        // Check if username exists - if yes, UPDATE instead of skip
        if (username) {
          const [existingUser] = await pool.execute<RowDataPacket[]>(
            "SELECT id, firstContactDate FROM subscribers WHERE username = ?",
            [username],
          );

          if (existingUser.length > 0) {
            // UPDATE existing subscriber by username - don't override firstContactDate if already set
            const updateFields: string[] = [];
            const updateValues: any[] = [];

            updateFields.push("password = ?");
            updateValues.push(finalPassword);

            updateFields.push("fullName = ?");
            updateValues.push(fullName || null);

            updateFields.push("facilityType = ?");
            updateValues.push(finalFacilityType);

            updateFields.push("phone = ?");
            updateValues.push(finalPhone);

            updateFields.push("`package` = ?");
            updateValues.push(finalPackageName);

            updateFields.push("monthlyPrice = ?");
            updateValues.push(Number(monthlyPrice) || 0);

            if (parsedStartDate) {
              updateFields.push("startDate = ?");
              updateValues.push(formatDateForMySQL(parsedStartDate));
            }

            // firstContactDate: use provided value or startDate as fallback
            const dateToUseForContact =
              parsedFirstContactDate || parsedStartDate;
            if (dateToUseForContact) {
              // Always set firstContactDate and disconnectionDate when we have a date
              updateFields.push("firstContactDate = ?");
              updateValues.push(formatDateForMySQL(dateToUseForContact));
              updateFields.push("disconnectionDate = ?");
              updateValues.push(
                calculateDisconnectionDate(dateToUseForContact),
              );
            }

            updateFields.push("notes = ?");
            updateValues.push(notes || null);

            updateFields.push("isSuspended = ?");
            updateValues.push(finalIsSuspended);

            // Always update speed based on notes
            updateFields.push("speed = ?");
            updateValues.push(speed);

            updateValues.push(username);

            await pool.execute(
              `UPDATE subscribers SET ${updateFields.join(
                ", ",
              )} WHERE username = ?`,
              updateValues,
            );

            updated.push({
              id: existingUser[0].id,
              username,
              fullName: fullName || "(لم يتغير)",
            });
            continue;
          }
        }

        // Skip if no username for new subscriber
        if (!username) {
          console.log(
            `Row ${rowIndex + 1}: Skipped (no username for new subscriber)`,
          );
          skipped.push({
            row: rowIndex + 1,
            reason: "اسم المستخدم مطلوب",
          });
          continue;
        }

        // Skip if no package/line number (required for generating ID)
        if (!finalPackageName) {
          console.log(
            `Row ${rowIndex + 1}: Skipped (package/line number required for ID generation)`,
          );
          skipped.push({
            row: rowIndex + 1,
            reason: "رقم الخط مطلوب لتوليد ID",
            username: username,
          });
          continue;
        }

        // Generate ID automatically based on line/package number
        const lineNumber = parseInt(finalPackageName, 10) || 0;
        const generatedId = await generateSubscriberId(pool, lineNumber);

        // Insert new subscriber with generated ID - firstContactDate can now come from Excel
        // Calculate disconnectionDate: use firstContactDate if available, otherwise use startDate
        const dateForDisconnection = parsedFirstContactDate || parsedStartDate;

        console.log(
          `Row ${rowIndex + 1} - INSERT: parsedFirstContactDate=${parsedFirstContactDate}, parsedStartDate=${parsedStartDate}, dateForDisconnection=${dateForDisconnection}`,
        );

        const disconnectionDateForInsert = dateForDisconnection
          ? calculateDisconnectionDate(dateForDisconnection)
          : null;

        console.log(
          `Row ${rowIndex + 1} - disconnectionDateForInsert=${disconnectionDateForInsert}`,
        );

        // If no firstContactDate but we have startDate, use startDate as firstContactDate too
        const finalFirstContactDate = parsedFirstContactDate || parsedStartDate;

        await pool.execute<ResultSetHeader>(
          `INSERT INTO subscribers (id, username, password, fullName, facilityType, phone, \`package\`, monthlyPrice, startDate, firstContactDate, disconnectionDate, isActive, isSuspended, notes, speed)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generatedId,
            username,
            finalPassword,
            finalFullName,
            finalFacilityType,
            finalPhone,
            finalPackageName,
            Number(monthlyPrice) || 0,
            parsedStartDate ? formatDateForMySQL(parsedStartDate) : null,
            finalFirstContactDate
              ? formatDateForMySQL(finalFirstContactDate)
              : null,
            disconnectionDateForInsert,
            true,
            finalIsSuspended,
            notes || null,
            speed,
          ],
        );

        // Track which fields were missing (firstContactDate is now optional)
        const missingFields: string[] = [];
        if (!password) missingFields.push("password");
        if (!fullName) missingFields.push("fullName");
        if (!phone) missingFields.push("phone");
        if (!packageName) missingFields.push("package");
        if (!monthlyPrice) missingFields.push("monthlyPrice");
        if (!startDateStr) missingFields.push("startDate");
        // firstContactDate is optional - not tracked as missing

        results.push({
          row: rowIndex + 1,
          id: generatedId,
          username,
          fullName: finalFullName,
          missingFields: missingFields.length > 0 ? missingFields : undefined,
        });
      } catch (error) {
        errors.push({ row: rowIndex + 1, error: (error as Error).message });
      }
    }

    // Count subscribers with missing fields
    const withMissingFields = results.filter(
      (r) => r.missingFields && r.missingFields.length > 0,
    );

    res.json({
      success: true,
      message: `تم استيراد ${results.length} مشترك جديد و تحديث ${
        updated.length
      } مشترك موجود${
        skipped.length > 0 ? ` و تم تخطي ${skipped.length} صف` : ""
      }`,
      uploaded: results.length,
      updated: updated.length,
      skipped: skipped.length,
      skippedList: skipped.length > 0 ? skipped : undefined,
      detectedColumns: columnNames,
      updatedList: updated.length > 0 ? updated : undefined,
      withMissingFields:
        withMissingFields.length > 0 ? withMissingFields : undefined,
      missingFieldsCount: withMissingFields.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res
      .status(500)
      .json({ success: false, message: "Error uploading file", error });
  }
};

// Upload credentials (update username/password by ID)
export const uploadCredentials = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const updated: any[] = [];
    const errors: any[] = [];
    const notFound: any[] = [];

    if (data.length === 0) {
      return res.json({
        success: false,
        message: "الملف فارغ أو لا يحتوي على بيانات",
        updated: 0,
      });
    }

    // Helper function to get value from row
    const getFieldValue = (row: any, ...keys: string[]): string => {
      for (const key of keys) {
        if (row.hasOwnProperty(key)) {
          const value = row[key];
          if (value !== undefined && value !== null) {
            return String(value).trim();
          }
        }
      }
      return "";
    };

    const columnNames = Object.keys(data[0] || {});
    console.log("Credentials update - columns detected:", columnNames);

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex] as Record<string, any>;

      try {
        const id = getFieldValue(row, "ID", "id", "رقم", "الرقم");
        const username = getFieldValue(
          row,
          "Username",
          "اسم المستخدم",
          "username",
        );
        const password = getFieldValue(
          row,
          "Password",
          "كلمة المرور",
          "password",
        );
        const startDateStr = getFieldValue(
          row,
          "التاريخ",
          "startDate",
          "Start Date",
        );

        if (!id) {
          errors.push({ row: rowIndex + 1, error: "لا يوجد ID" });
          continue;
        }

        // Check if subscriber exists
        const [existing] = await pool.execute<RowDataPacket[]>(
          "SELECT id, fullName, username FROM subscribers WHERE id = ?",
          [id],
        );

        if (existing.length === 0) {
          notFound.push({ row: rowIndex + 1, id, error: "المشترك غير موجود" });
          continue;
        }

        // Check if new username is already used by another subscriber
        if (username && username !== existing[0].username) {
          const [usernameCheck] = await pool.execute<RowDataPacket[]>(
            "SELECT id FROM subscribers WHERE username = ? AND id != ?",
            [username, id],
          );
          if (usernameCheck.length > 0) {
            errors.push({
              row: rowIndex + 1,
              error: `اسم المستخدم "${username}" مستخدم من مشترك آخر`,
            });
            continue;
          }
        }

        // Helper function to parse date from Excel (handle multiple formats)
        const parseExcelDate = (dateStr: any): Date | null => {
          if (!dateStr) return null;

          const numValue = Number(dateStr);
          if (!isNaN(numValue) && numValue > 10000 && numValue < 100000) {
            // Excel serial date number - convert to JS date
            return new Date((numValue - 25569) * 86400 * 1000);
          } else if (typeof dateStr === "string") {
            // Try parsing DD/MM/YYYY or MM/DD/YYYY format
            const parts = dateStr.split("/");
            if (parts.length === 3) {
              const day = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10);
              const year = parseInt(parts[2], 10);
              // Assume DD/MM/YYYY (common in Arabic regions)
              if (day > 12) {
                return new Date(year, month - 1, day);
              } else if (month > 12) {
                return new Date(year, day - 1, month);
              } else {
                return new Date(year, month - 1, day);
              }
            } else {
              const parsed = new Date(dateStr);
              if (!isNaN(parsed.getTime())) {
                return parsed;
              }
            }
          }
          return null;
        };

        // Update username, password, and startDate
        const updates: string[] = [];
        const values: any[] = [];
        const updatedFields: string[] = [];

        if (username) {
          updates.push("username = ?");
          values.push(username);
          updatedFields.push("اسم المستخدم");
        }
        if (password) {
          updates.push("password = ?");
          values.push(password);
          updatedFields.push("كلمة المرور");
        }
        if (startDateStr) {
          const parsedStartDate = parseExcelDate(startDateStr);
          if (parsedStartDate) {
            updates.push("startDate = ?");
            values.push(formatDateForMySQL(parsedStartDate));
            updatedFields.push("التاريخ");
          }
        }

        if (updates.length > 0) {
          values.push(id);
          await pool.execute(
            `UPDATE subscribers SET ${updates.join(", ")} WHERE id = ?`,
            values,
          );

          updated.push({
            id,
            fullName: existing[0].fullName,
            username: username || "(لم يتغير)",
            password: password ? "(تم التحديث)" : "(لم يتغير)",
            updatedFields: updatedFields.join("، "),
          });
        }
      } catch (error) {
        errors.push({ row: rowIndex + 1, error: (error as Error).message });
      }
    }

    res.json({
      success: true,
      message: `تم تحديث بيانات الدخول لـ ${updated.length} مشترك`,
      updated: updated.length,
      updatedList: updated,
      notFound: notFound.length > 0 ? notFound : undefined,
      errors: errors.length > 0 ? errors : undefined,
      detectedColumns: columnNames,
    });
  } catch (error) {
    console.error("Error uploading credentials:", error);
    res
      .status(500)
      .json({ success: false, message: "Error uploading file", error });
  }
};

// Bulk delete subscribers
export const bulkDelete = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No IDs provided" });
    }

    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    const placeholders = ids.map(() => "?").join(",");
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM subscribers WHERE id IN (${placeholders})`,
      ids,
    );

    res.json({
      success: true,
      message: `تم حذف ${result.affectedRows} مشترك`,
      deleted: result.affectedRows,
    });
  } catch (error) {
    console.error("Error bulk deleting:", error);
    res
      .status(500)
      .json({ success: false, message: "Error deleting subscribers", error });
  }
};

// Bulk update subscribers
export const bulkUpdate = async (req: Request, res: Response) => {
  try {
    const { ids, field, value } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No IDs provided" });
    }

    if (!field) {
      return res
        .status(400)
        .json({ success: false, message: "No field specified" });
    }

    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    // Validate allowed fields (isActive is excluded - controlled by Mikrotik)
    const allowedFields = [
      "package",
      "monthlyPrice",
      "notes",
      "startDate",
      "firstContactDate",
    ];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({ success: false, message: "Invalid field" });
    }

    // Handle field name for SQL (package is reserved)
    const sqlField = field === "package" ? "`package`" : field;

    const placeholders = ids.map(() => "?").join(",");
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE subscribers SET ${sqlField} = ? WHERE id IN (${placeholders})`,
      [value, ...ids],
    );

    res.json({
      success: true,
      message: `تم تحديث ${result.affectedRows} مشترك`,
      updated: result.affectedRows,
    });
  } catch (error) {
    console.error("Error bulk updating:", error);
    res
      .status(500)
      .json({ success: false, message: "Error updating subscribers", error });
  }
};

// Export subscribers data to Excel
export const exportSubscribers = async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const isSuspendedExport = req.path.includes("/suspended");

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    // Get subscribers (filtered by suspended status)
    const suspendedCondition = isSuspendedExport
      ? "WHERE isSuspended = TRUE"
      : "WHERE isSuspended = FALSE";
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM subscribers ${suspendedCondition} ORDER BY id ASC`,
    );

    // Prepare data for Excel with Arabic headers
    const excelData = rows.map((sub: any) => ({
      ID: sub.id || "-",
      "اسم المستخدم": sub.username || "-",
      "كلمة المرور": sub.password || "-",
      "اسم الزبون": sub.fullName || "-",
      "رقم الجوال": sub.phone || "-",
      الخط: sub.package || "-",
      المبلغ: sub.monthlyPrice || 0,
      التاريخ: sub.startDate ? formatDateForMySQL(sub.startDate) : "-",
      "تاريخ اول اتصال": sub.firstContactDate
        ? formatDateForMySQL(sub.firstContactDate)
        : "-",
      الحالة: sub.isActive ? "نشط" : "غير نشط",
      ملاحظات: sub.notes || "-",
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 8 }, // ID
      { wch: 20 }, // اسم المستخدم
      { wch: 15 }, // كلمة المرور
      { wch: 25 }, // اسم الزبون
      { wch: 15 }, // رقم الجوال
      { wch: 15 }, // الخط
      { wch: 10 }, // المبلغ
      { wch: 12 }, // التاريخ
      { wch: 15 }, // تاريخ اول اتصال
      { wch: 10 }, // الحالة
      { wch: 30 }, // ملاحظات
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "المشتركين");

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Set headers for file download
    const fileName = `${isSuspendedExport ? "suspended_" : ""}subscribers_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(buffer);
  } catch (error) {
    console.error("Error exporting subscribers:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting subscribers",
      error,
    });
  }
};

// Get subscriber profile with username history
export const getSubscriberProfile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    // Get subscriber details
    const [subscribers] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM subscribers WHERE id = ?",
      [id],
    );

    if (subscribers.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Subscriber not found" });
    }

    const subscriber = subscribers[0];

    // Get username history
    const [usernameHistory] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM username_history WHERE subscriber_id = ? ORDER BY changed_at DESC",
      [id],
    );

    // Get speed history
    const [speedHistory] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM speed_history WHERE subscriber_id = ? ORDER BY changed_at DESC",
      [id],
    );

    res.json({
      success: true,
      data: {
        subscriber: {
          ...subscriber,
          _id: subscriber.id,
        },
        usernameHistory: usernameHistory,
        speedHistory: speedHistory,
      },
    });
  } catch (error) {
    console.error("Error fetching subscriber profile:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching subscriber profile",
      error,
    });
  }
};

// Change subscriber username (saves old one to history)
export const changeSubscriberUsername = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newUsername, newPassword } = req.body;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    if (!newUsername) {
      return res
        .status(400)
        .json({ success: false, message: "New username is required" });
    }

    // Get current subscriber data
    const [subscribers] = await pool.execute<RowDataPacket[]>(
      "SELECT id, username, password, firstContactDate FROM subscribers WHERE id = ?",
      [id],
    );

    if (subscribers.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Subscriber not found" });
    }

    const subscriber = subscribers[0];

    // Check if new username is already in use
    const [existing] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM subscribers WHERE username = ? AND id != ?",
      [newUsername, id],
    );

    if (existing.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Username already in use" });
    }

    // Calculate dates for history record
    const usageStartDate = subscriber.firstContactDate
      ? formatDateForMySQL(subscriber.firstContactDate)
      : null;
    const usageEndDate = subscriber.firstContactDate
      ? calculateDisconnectionDate(subscriber.firstContactDate)
      : null;

    // Save old username to history with usage dates
    await pool.execute(
      "INSERT INTO username_history (subscriber_id, old_username, old_password, usage_start_date, usage_end_date) VALUES (?, ?, ?, ?, ?)",
      [
        id,
        subscriber.username,
        subscriber.password,
        usageStartDate,
        usageEndDate,
      ],
    );

    // Delete the new username from available_usernames if it exists there
    await pool.execute("DELETE FROM available_usernames WHERE username = ?", [
      newUsername,
    ]);

    // Update subscriber with new username
    const updateFields = ["username = ?"];
    const updateValues: any[] = [newUsername];

    if (newPassword) {
      updateFields.push("password = ?");
      updateValues.push(newPassword);
    }

    updateValues.push(id);
    await pool.execute(
      `UPDATE subscribers SET ${updateFields.join(", ")} WHERE id = ?`,
      updateValues,
    );

    res.json({
      success: true,
      message: "Username changed successfully. Old username saved to history.",
      data: {
        oldUsername: subscriber.username,
        newUsername,
      },
    });
  } catch (error) {
    console.error("Error changing username:", error);
    res.status(500).json({
      success: false,
      message: "Error changing username",
      error,
    });
  }
};

// Get username history for a subscriber
export const getUsernameHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    const [history] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM username_history WHERE subscriber_id = ? ORDER BY changed_at DESC",
      [id],
    );

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Error fetching username history:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching username history",
      error,
    });
  }
};

// Manually add a username history entry
export const addUsernameHistoryEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { old_username, old_password, usage_start_date, usage_end_date } =
      req.body;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    if (!old_username) {
      return res
        .status(400)
        .json({ success: false, message: "اسم المستخدم القديم مطلوب" });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO username_history (subscriber_id, old_username, old_password, usage_start_date, usage_end_date) VALUES (?, ?, ?, ?, ?)",
      [
        id,
        old_username,
        old_password || null,
        usage_start_date || null,
        usage_end_date || null,
      ],
    );

    res.json({
      success: true,
      message: "تم إضافة السجل بنجاح",
      data: {
        id: result.insertId,
        subscriber_id: id,
        old_username,
        old_password,
        usage_start_date,
        usage_end_date,
        changed_at: new Date(),
      },
    });
  } catch (error) {
    console.error("Error adding username history entry:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في إضافة السجل",
      error,
    });
  }
};

// Update a username history entry
export const updateUsernameHistoryEntry = async (
  req: Request,
  res: Response,
) => {
  try {
    const { historyId } = req.params;
    const { old_username, old_password, usage_start_date, usage_end_date } =
      req.body;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    if (!old_username) {
      return res
        .status(400)
        .json({ success: false, message: "اسم المستخدم القديم مطلوب" });
    }

    await pool.execute(
      "UPDATE username_history SET old_username = ?, old_password = ?, usage_start_date = ?, usage_end_date = ? WHERE id = ?",
      [
        old_username,
        old_password || null,
        usage_start_date || null,
        usage_end_date || null,
        historyId,
      ],
    );

    res.json({
      success: true,
      message: "تم تحديث السجل بنجاح",
    });
  } catch (error) {
    console.error("Error updating username history entry:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في تحديث السجل",
      error,
    });
  }
};

// Delete a username history entry
export const deleteUsernameHistoryEntry = async (
  req: Request,
  res: Response,
) => {
  try {
    const { historyId } = req.params;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    await pool.execute("DELETE FROM username_history WHERE id = ?", [
      historyId,
    ]);

    res.json({
      success: true,
      message: "تم حذف السجل بنجاح",
    });
  } catch (error) {
    console.error("Error deleting username history entry:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في حذف السجل",
      error,
    });
  }
};

// Get speed history for a subscriber
export const getSpeedHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    const [history] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM speed_history WHERE subscriber_id = ? ORDER BY changed_at DESC",
      [id],
    );

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Error fetching speed history:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching speed history",
      error,
    });
  }
};

// ============ AVAILABLE USERNAMES MANAGEMENT ============

// Get all available usernames
export const getAvailableUsernames = async (req: Request, res: Response) => {
  try {
    const { showUsed, speed } = req.query;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    let query = `
      SELECT 
        id, username, password, speed, isUsed, createdAt,
        firstContactDate, expiryDate,
        CASE 
          WHEN expiryDate IS NOT NULL THEN DATEDIFF(expiryDate, CURDATE())
          ELSE 31
        END as remainingDays
      FROM available_usernames WHERE 1=1
    `;
    const params: any[] = [];

    if (showUsed !== "true") {
      query += " AND (isUsed = FALSE OR isUsed IS NULL)";
    }

    if (speed) {
      query += " AND speed = ?";
      params.push(Number(speed));
    }

    query += " ORDER BY id ASC";

    const [usernames] = await pool.execute<RowDataPacket[]>(query, params);

    // Process to ensure remainingDays doesn't go negative
    const processedUsernames = (usernames as any[]).map((u) => ({
      ...u,
      remainingDays: Math.max(0, u.remainingDays || 31),
    }));

    res.json({
      success: true,
      data: processedUsernames,
      total: processedUsernames.length,
    });
  } catch (error) {
    console.error("Error fetching available usernames:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching available usernames",
      error,
    });
  }
};

// Add single available username
export const addAvailableUsername = async (req: Request, res: Response) => {
  try {
    const { username, password, speed } = req.body;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    if (!username) {
      return res
        .status(400)
        .json({ success: false, message: "Username is required" });
    }

    // Check if username already exists in available_usernames
    const [existingAvailable] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM available_usernames WHERE username = ?",
      [username],
    );

    if (existingAvailable.length > 0) {
      return res.status(400).json({
        success: false,
        message: "اسم المستخدم موجود بالفعل في الأسماء المتاحة",
      });
    }

    // Check if username already exists in subscribers
    const [existingSubscriber] = await pool.execute<RowDataPacket[]>(
      "SELECT id, fullName FROM subscribers WHERE username = ?",
      [username],
    );

    if (existingSubscriber.length > 0) {
      return res.status(400).json({
        success: false,
        message: `اسم المستخدم مستخدم بالفعل من قبل المشترك: ${existingSubscriber[0].fullName}`,
      });
    }

    // Check if username exists in username_history (previously used usernames)
    const [existingHistory] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM username_history WHERE old_username = ?",
      [username],
    );

    if (existingHistory.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "اسم المستخدم موجود في سجل الأسماء السابقة ولا يمكن إضافته إلى الأسماء المتاحة",
      });
    }

    await pool.execute(
      "INSERT INTO available_usernames (username, password, speed) VALUES (?, ?, ?)",
      [username, password || null, speed || 4],
    );

    res.json({
      success: true,
      message: "Username added successfully",
    });
  } catch (error) {
    console.error("Error adding available username:", error);
    res.status(500).json({
      success: false,
      message: "Error adding available username",
      error,
    });
  }
};

// Send SMS via TweetSMS provider
export const sendSmsMessage = async (req: Request, res: Response) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res
        .status(400)
        .json({ success: false, message: "رقم الهاتف ونص الرسالة مطلوبان" });
    }

    // Prefer server environment API key, fall back to provided constant
    const apiKey =
      process.env.TWEETSMS_API_KEY ||
      "$2y$10$XUXBBOuO5did0BHqKgmX8.69fLL1VCBTgi5pWckxHSrRJJKxRpwxK";
    const sender = process.env.SMS_SENDER || "WeNet";

    // Normalize phone to international format if it starts with 0 (e.g., 0594... -> 972594...)
    let normalized = String(phone).replace(/[^0-9]/g, "");
    if (normalized.startsWith("0")) {
      normalized = `972${normalized.slice(1)}`;
    }

    const url = `https://www.tweetsms.ps/api.php?comm=sendsms&api_key=${encodeURIComponent(
      apiKey,
    )}&to=${encodeURIComponent(normalized)}&message=${encodeURIComponent(
      message,
    )}&sender=${encodeURIComponent(sender)}`;

    const response = await axios.get(url, { timeout: 15000 });

    // Return provider response so caller can inspect status
    res.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error("Error sending SMS:", error?.message || error);
    res
      .status(500)
      .json({
        success: false,
        message: "خطأ في إرسال الرسالة",
        error: error?.message || error,
      });
  }
};

// Upload available usernames from Excel
export const uploadAvailableUsernames = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    const speed = req.body.speed || 4;
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let added = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const row of data as any[]) {
      try {
        const username = row.Username || row.username || row["اسم المستخدم"];
        const password = row.Password || row.password || row["كلمة المرور"];

        // Skip if both username and password are empty
        if (!username && !password) continue;
        // Skip if only username is missing
        if (!username) continue;

        // Skip header rows that might be included as data
        const usernameStr = String(username).trim();
        const passwordStr = String(password || "").trim();
        const lowerUsername = usernameStr.toLowerCase();
        const lowerPassword = passwordStr.toLowerCase();

        // Skip if username looks like a header (case insensitive)
        if (
          lowerUsername === "username" ||
          lowerUsername === "اسم المستخدم" ||
          lowerUsername === "user" ||
          lowerUsername === "name" ||
          lowerUsername === "user name" ||
          usernameStr === "Username" ||
          usernameStr === "USERNAME"
        ) {
          skipped++;
          continue;
        }

        // Skip if password looks like a header (case insensitive)
        if (
          lowerPassword === "password" ||
          lowerPassword === "كلمة المرور" ||
          lowerPassword === "pass" ||
          lowerPassword === "pwd" ||
          passwordStr === "Password" ||
          passwordStr === "PASSWORD"
        ) {
          skipped++;
          continue;
        }

        // Check if already exists in available_usernames
        const [existingAvailable] = await pool.execute<RowDataPacket[]>(
          "SELECT id FROM available_usernames WHERE username = ?",
          [username],
        );

        if (existingAvailable.length > 0) {
          skipped++;
          continue;
        }

        // Check if already exists in subscribers
        const [existingSubscriber] = await pool.execute<RowDataPacket[]>(
          "SELECT id FROM subscribers WHERE username = ?",
          [username],
        );

        if (existingSubscriber.length > 0) {
          skipped++;
          continue;
        }

        await pool.execute(
          "INSERT INTO available_usernames (username, password, speed) VALUES (?, ?, ?)",
          [username, password || null, speed],
        );
        added++;
      } catch (e) {
        errors.push({ username: row.Username, error: (e as Error).message });
      }
    }

    // Auto cleanup any invalid entries that might have slipped through
    await pool.execute(
      `DELETE FROM available_usernames 
       WHERE LOWER(username) IN ('username', 'user', 'name', 'user name', 'اسم المستخدم')
       OR LOWER(password) IN ('password', 'pass', 'pwd', 'كلمة المرور')
       OR username = 'Username' OR password = 'Password'`,
    );

    res.json({
      success: true,
      message: `Added ${added} usernames, skipped ${skipped} duplicates`,
      added,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error uploading available usernames:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading available usernames",
      error,
    });
  }
};

// Clean up invalid usernames (headers that were accidentally imported)
// Also removes usernames that are already used by subscribers
export const cleanupInvalidUsernames = async (req: Request, res: Response) => {
  try {
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    // Delete invalid header entries
    const [result1] = await pool.execute<ResultSetHeader>(
      `DELETE FROM available_usernames 
       WHERE LOWER(username) IN ('username', 'user', 'name', 'user name', 'اسم المستخدم')
       OR LOWER(password) IN ('password', 'pass', 'pwd', 'كلمة المرور')
       OR username = 'Username' OR password = 'Password'`,
    );

    // Delete usernames that are already used by subscribers
    const [result2] = await pool.execute<ResultSetHeader>(
      `DELETE FROM available_usernames 
       WHERE username IN (SELECT username FROM subscribers)`,
    );

    const totalDeleted = result1.affectedRows + result2.affectedRows;

    res.json({
      success: true,
      message: `Cleaned up ${totalDeleted} entries (${result1.affectedRows} invalid, ${result2.affectedRows} already used)`,
      deleted: totalDeleted,
      invalidDeleted: result1.affectedRows,
      alreadyUsedDeleted: result2.affectedRows,
    });
  } catch (error) {
    console.error("Error cleaning up invalid usernames:", error);
    res.status(500).json({
      success: false,
      message: "Error cleaning up invalid usernames",
      error,
    });
  }
};

// Delete available username
export const deleteAvailableUsername = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM available_usernames WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Username not found" });
    }

    res.json({
      success: true,
      message: "Username deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting available username:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting available username",
      error,
    });
  }
};

// Update available username
export const updateAvailableUsername = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { username, password } = req.body;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE available_usernames SET username = ?, password = ? WHERE id = ?",
      [username, password || null, id],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Username not found" });
    }

    res.json({
      success: true,
      message: "Username updated successfully",
    });
  } catch (error) {
    console.error("Error updating available username:", error);
    res.status(500).json({
      success: false,
      message: "Error updating available username",
      error,
    });
  }
};

// Delete all available usernames
export const deleteAllAvailableUsernames = async (
  req: Request,
  res: Response,
) => {
  try {
    const { speed } = req.query;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    let query =
      "DELETE FROM available_usernames WHERE (isUsed = FALSE OR isUsed IS NULL)";
    const params: any[] = [];

    if (speed) {
      query += " AND speed = ?";
      params.push(Number(speed));
    }

    const [result] = await pool.execute<ResultSetHeader>(query, params);

    res.json({
      success: true,
      message: `Deleted ${result.affectedRows} available usernames`,
      deleted: result.affectedRows,
    });
  } catch (error) {
    console.error("Error deleting all available usernames:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting available usernames",
      error,
    });
  }
};

// Assign available username to subscriber
export const assignUsernameToSubscriber = async (
  req: Request,
  res: Response,
) => {
  try {
    const { availableUsernameId, subscriberId } = req.body;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    if (!availableUsernameId || !subscriberId) {
      return res.status(400).json({
        success: false,
        message: "Both availableUsernameId and subscriberId are required",
      });
    }

    // Get the available username
    const [availableUsernames] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM available_usernames WHERE id = ? AND (isUsed = FALSE OR isUsed IS NULL)",
      [availableUsernameId],
    );

    if (availableUsernames.length === 0) {
      return res.status(404).json({
        success: false,
        message: "اسم المستخدم غير موجود أو مستخدم بالفعل",
      });
    }

    const availableUsername = availableUsernames[0];

    // Check if this username is already used by another subscriber
    const [existingSubscribers] = await pool.execute<RowDataPacket[]>(
      "SELECT id, fullName FROM subscribers WHERE username = ? AND id != ?",
      [availableUsername.username, subscriberId],
    );

    if (existingSubscribers.length > 0) {
      return res.status(400).json({
        success: false,
        message: `اسم المستخدم مستخدم بالفعل من قبل المشترك: ${existingSubscribers[0].fullName}`,
      });
    }

    // Get the subscriber
    const [subscribers] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM subscribers WHERE id = ?",
      [subscriberId],
    );

    if (subscribers.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Subscriber not found" });
    }

    const subscriber = subscribers[0];

    // Calculate dates for history record
    const usageStartDate = subscriber.firstContactDate
      ? formatDateForMySQL(subscriber.firstContactDate)
      : null;
    const usageEndDate = subscriber.firstContactDate
      ? calculateDisconnectionDate(subscriber.firstContactDate)
      : null;

    // Save old username to history with usage dates
    await pool.execute(
      "INSERT INTO username_history (subscriber_id, old_username, old_password, usage_start_date, usage_end_date) VALUES (?, ?, ?, ?, ?)",
      [
        subscriberId,
        subscriber.username,
        subscriber.password,
        usageStartDate,
        usageEndDate,
      ],
    );

    // Update subscriber with new username, speed and reset firstContactDate/disconnectionDate
    const today = new Date();
    const newDisconnectionDate = calculateDisconnectionDate(today);
    const newSpeed = availableUsername.speed || 4;

    await pool.execute(
      "UPDATE subscribers SET username = ?, password = ?, speed = ?, firstContactDate = ?, disconnectionDate = ? WHERE id = ?",
      [
        availableUsername.username,
        availableUsername.password,
        newSpeed,
        formatDateForMySQL(today),
        newDisconnectionDate,
        subscriberId,
      ],
    );

    // Delete the available username since it's now assigned
    await pool.execute("DELETE FROM available_usernames WHERE id = ?", [
      availableUsernameId,
    ]);

    res.json({
      success: true,
      message: "Username assigned successfully",
      data: {
        oldUsername: subscriber.username,
        newUsername: availableUsername.username,
        subscriberId,
      },
    });
  } catch (error) {
    console.error("Error assigning username:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في تعيين اسم المستخدم: " + (error as Error).message,
    });
  }
};

// =====================
// STOPPED SUBSCRIBERS
// =====================

// Get all stopped subscribers
export const getStoppedSubscribers = async (req: Request, res: Response) => {
  try {
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM stopped_subscribers ORDER BY stoppedAt DESC",
    );

    res.json({
      success: true,
      data: rows,
      total: rows.length,
    });
  } catch (error) {
    console.error("Error fetching stopped subscribers:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching stopped subscribers",
      error,
    });
  }
};

// Stop a subscriber (move to stopped_subscribers)
export const stopSubscriber = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    // Get the subscriber data
    const [subscribers] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM subscribers WHERE id = ?",
      [id],
    );

    if (subscribers.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "المشترك غير موجود" });
    }

    const subscriber = subscribers[0];

    // Insert into stopped_subscribers
    await pool.execute(
      `INSERT INTO stopped_subscribers 
       (original_id, username, password, fullName, phone, \`package\`, facilityType, 
        startDate, firstContactDate, disconnectionDate, speed, notes, stoppedReason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subscriber.id,
        subscriber.username,
        subscriber.password,
        subscriber.fullName,
        subscriber.phone,
        subscriber.package,
        subscriber.facilityType,
        subscriber.startDate,
        subscriber.firstContactDate,
        subscriber.disconnectionDate,
        subscriber.speed,
        subscriber.notes,
        reason || null,
      ],
    );

    // Add username back to available_usernames if it exists
    if (subscriber.username) {
      try {
        await pool.execute(
          "INSERT INTO available_usernames (username, password, speed) VALUES (?, ?, ?)",
          [subscriber.username, subscriber.password, subscriber.speed || 4],
        );
      } catch (e) {
        // Username might already exist in available_usernames, ignore
      }
    }

    // Delete from subscribers
    await pool.execute("DELETE FROM subscribers WHERE id = ?", [id]);

    res.json({
      success: true,
      message: "تم إيقاف المشترك بنجاح",
      data: { subscriberId: id, fullName: subscriber.fullName },
    });
  } catch (error) {
    console.error("Error stopping subscriber:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في إيقاف المشترك",
      error,
    });
  }
};

// Reactivate a stopped subscriber (move back to subscribers)
export const reactivateSubscriber = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    // Get the stopped subscriber data
    const [stoppedSubscribers] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM stopped_subscribers WHERE id = ?",
      [id],
    );

    if (stoppedSubscribers.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "المشترك المتوقف غير موجود" });
    }

    const stopped = stoppedSubscribers[0];

    // Check if username is still available or used by someone else
    if (stopped.username) {
      const [existingSubscriber] = await pool.execute<RowDataPacket[]>(
        "SELECT id FROM subscribers WHERE username = ?",
        [stopped.username],
      );

      if (existingSubscriber.length > 0) {
        return res.status(400).json({
          success: false,
          message:
            "اسم المستخدم مستخدم حالياً من مشترك آخر. يرجى تغيير اسم المستخدم قبل إعادة التفعيل.",
        });
      }
    }

    // Calculate new disconnection date
    const today = new Date();
    const newDisconnectionDate = calculateDisconnectionDate(today);

    // Generate new ID based on package/line number
    // Handle both string and number package values
    let lineNumber = 1;
    if (stopped.package) {
      const parsed = parseInt(String(stopped.package), 10);
      if (!isNaN(parsed) && parsed > 0) {
        lineNumber = parsed;
      }
    }
    const newId = await generateSubscriberId(pool, lineNumber);

    // Insert back into subscribers with generated ID
    await pool.execute<ResultSetHeader>(
      `INSERT INTO subscribers 
       (id, username, password, fullName, phone, \`package\`, facilityType, 
        startDate, firstContactDate, disconnectionDate, speed, notes, isSuspended)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [
        newId,
        stopped.username,
        stopped.password,
        stopped.fullName,
        stopped.phone,
        stopped.package,
        stopped.facilityType,
        stopped.startDate,
        formatDateForMySQL(today), // New firstContactDate
        newDisconnectionDate,
        stopped.speed,
        stopped.notes,
      ],
    );

    // Remove username from available_usernames if it was added there
    if (stopped.username) {
      await pool.execute("DELETE FROM available_usernames WHERE username = ?", [
        stopped.username,
      ]);
    }

    // Delete from stopped_subscribers
    await pool.execute("DELETE FROM stopped_subscribers WHERE id = ?", [id]);

    res.json({
      success: true,
      message: "تم إعادة تفعيل المشترك بنجاح",
      data: {
        newSubscriberId: newId,
        fullName: stopped.fullName,
      },
    });
  } catch (error) {
    console.error("Error reactivating subscriber:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في إعادة تفعيل المشترك: " + (error as Error).message,
      error,
    });
  }
};

// Delete stopped subscriber permanently
export const deleteStoppedSubscriber = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM stopped_subscribers WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "المشترك المتوقف غير موجود" });
    }

    res.json({
      success: true,
      message: "تم حذف المشترك المتوقف نهائياً",
    });
  } catch (error) {
    console.error("Error deleting stopped subscriber:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في حذف المشترك المتوقف",
      error,
    });
  }
};

// Get subscribers with usernames expiring in 1 day before disconnection date
export const getExpiringUsernames = async (req: Request, res: Response) => {
  try {
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    // Get subscribers where disconnectionDate is tomorrow or within next day
    // (1 day before the deadline means disconnectionDate - 1 day = today)
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id as _id, id, username, password, fullName, facilityType, phone, \`package\`, 
              monthlyPrice, speed, startDate, firstContactDate, disconnectionDate, 
              isActive, isSuspended, notes, createdAt, updatedAt
       FROM subscribers 
       WHERE disconnectionDate IS NOT NULL 
         AND disconnectionDate <= DATE_ADD(CURDATE(), INTERVAL 2 DAY)
         AND isSuspended = FALSE
       ORDER BY disconnectionDate ASC`,
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching expiring usernames:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب المشتركين المنتهية صلاحيتهم",
      error,
    });
  }
};

// Bulk change usernames from available usernames
export const bulkChangeUsernames = async (req: Request, res: Response) => {
  try {
    const { subscriberIds } = req.body;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    if (
      !subscriberIds ||
      !Array.isArray(subscriberIds) ||
      subscriberIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "يرجى تحديد المشتركين",
      });
    }

    // Get subscribers with their speeds and firstContactDate
    const [subscribers] = await pool.execute<RowDataPacket[]>(
      `SELECT id, username, password, speed, firstContactDate FROM subscribers WHERE id IN (${subscriberIds.map(() => "?").join(",")})`,
      subscriberIds,
    );

    // Group subscribers by speed
    const subscribersBySpeed: { [key: number]: RowDataPacket[] } = {
      4: [],
      8: [],
    };
    for (const sub of subscribers) {
      const speed = sub.speed || 4;
      if (!subscribersBySpeed[speed]) subscribersBySpeed[speed] = [];
      subscribersBySpeed[speed].push(sub);
    }

    // Get available usernames for each speed
    const available4M = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM available_usernames WHERE (isUsed = FALSE OR isUsed IS NULL) AND speed = 4 ORDER BY id ASC",
    );
    const available8M = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM available_usernames WHERE (isUsed = FALSE OR isUsed IS NULL) AND speed = 8 ORDER BY id ASC",
    );

    const availableBySpeed: { [key: number]: RowDataPacket[] } = {
      4: available4M[0] as RowDataPacket[],
      8: available8M[0] as RowDataPacket[],
    };

    // Check if we have enough usernames for each speed
    for (const speed of [4, 8]) {
      const needed = subscribersBySpeed[speed]?.length || 0;
      const available = availableBySpeed[speed]?.length || 0;
      if (needed > available) {
        return res.status(400).json({
          success: false,
          message: `لا توجد أسماء مستخدمين كافية لسرعة ${speed} ميجا. المتاح: ${available}, المطلوب: ${needed}`,
        });
      }
    }

    const results = {
      success: [] as {
        subscriberId: string;
        oldUsername: string;
        newUsername: string;
      }[],
      failed: [] as { subscriberId: string; reason: string }[],
    };

    // Process each speed group
    for (const speed of [4, 8]) {
      const subs = subscribersBySpeed[speed] || [];
      const availableList = availableBySpeed[speed] || [];

      for (let i = 0; i < subs.length; i++) {
        const subscriber = subs[i];
        const availableUsername = availableList[i];

        try {
          const oldUsername = subscriber.username;
          const oldPassword = subscriber.password;

          // Calculate dates for history record
          const usageStartDate = subscriber.firstContactDate
            ? formatDateForMySQL(subscriber.firstContactDate)
            : null;
          const usageEndDate = subscriber.firstContactDate
            ? calculateDisconnectionDate(subscriber.firstContactDate)
            : null;

          // Save old username to history with usage dates
          await pool.execute(
            "INSERT INTO username_history (subscriber_id, old_username, old_password, usage_start_date, usage_end_date) VALUES (?, ?, ?, ?, ?)",
            [
              subscriber.id,
              oldUsername,
              oldPassword,
              usageStartDate,
              usageEndDate,
            ],
          );

          // Calculate new dates
          const today = new Date();
          const newFirstContactDate = formatDateForMySQL(today);
          const newDisconnectionDate = calculateDisconnectionDate(today);

          // Update subscriber with new username, password, and new dates (keep same speed)
          await pool.execute(
            "UPDATE subscribers SET username = ?, password = ?, firstContactDate = ?, disconnectionDate = ? WHERE id = ?",
            [
              availableUsername.username,
              availableUsername.password,
              newFirstContactDate,
              newDisconnectionDate,
              subscriber.id,
            ],
          );

          // Delete the used username from available_usernames
          await pool.execute("DELETE FROM available_usernames WHERE id = ?", [
            availableUsername.id,
          ]);

          results.success.push({
            subscriberId: subscriber.id,
            oldUsername: oldUsername || "",
            newUsername: availableUsername.username,
          });
        } catch (error) {
          console.error(`Error processing subscriber ${subscriber.id}:`, error);
          results.failed.push({
            subscriberId: subscriber.id,
            reason: "خطأ في المعالجة",
          });
        }
      }
    }

    res.json({
      success: true,
      message: `تم تغيير ${results.success.length} من ${subscriberIds.length} اسم مستخدم بنجاح`,
      data: results,
    });
  } catch (error) {
    console.error("Error bulk changing usernames:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في تغيير أسماء المستخدمين",
      error,
    });
  }
};

// Search subscriber by old username
export const searchByOldUsername = async (req: Request, res: Response) => {
  try {
    const { username } = req.query;
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "يرجى إدخال اسم المستخدم للبحث",
      });
    }

    // Search in username_history
    const [historyResults] = await pool.execute<RowDataPacket[]>(
      `SELECT h.*, s.id as subscriberId, s.username as currentUsername, s.fullName, s.phone, s.speed
       FROM username_history h
       JOIN subscribers s ON h.subscriber_id = s.id
       WHERE h.old_username LIKE ?
       ORDER BY h.changed_at DESC`,
      [`%${username}%`],
    );

    if (historyResults.length === 0) {
      return res.json({
        success: true,
        found: false,
        message: "لم يتم العثور على مشترك بهذا الاسم القديم",
        data: null,
      });
    }

    res.json({
      success: true,
      found: true,
      data: historyResults,
    });
  } catch (error) {
    console.error("Error searching by old username:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في البحث",
      error,
    });
  }
};

// Get comprehensive dashboard statistics
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const pool = getPool();

    if (!pool) {
      return res
        .status(503)
        .json({ success: false, message: "Database not available" });
    }

    // Get current date info
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1,
    );
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    // Total subscribers
    const [totalResult] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as total FROM subscribers",
    );

    // Subscribers by speed
    const [speedResult] = await pool.execute<RowDataPacket[]>(
      "SELECT speed, COUNT(*) as count FROM subscribers GROUP BY speed ORDER BY speed",
    );

    // Available usernames by speed
    const [availableResult] = await pool.execute<RowDataPacket[]>(
      "SELECT speed, COUNT(*) as count FROM available_usernames WHERE isUsed = FALSE OR isUsed IS NULL GROUP BY speed ORDER BY speed",
    );

    // Total available usernames
    const [totalAvailableResult] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as total FROM available_usernames WHERE isUsed = FALSE OR isUsed IS NULL",
    );

    // Subscribers about to disconnect (within 7 days)
    const [expiringResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM subscribers 
       WHERE disconnectionDate IS NOT NULL 
       AND disconnectionDate BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)`,
    );

    // Already expired (disconnection date passed)
    const [expiredResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM subscribers 
       WHERE disconnectionDate IS NOT NULL 
       AND disconnectionDate < CURDATE()`,
    );

    // Stopped subscribers count
    const [stoppedResult] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as total FROM stopped_subscribers",
    );

    // New subscribers this week
    const [newThisWeekResult] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as total FROM subscribers WHERE createdAt >= ?",
      [formatDateForMySQL(startOfWeek)],
    );

    // New subscribers this month
    const [newThisMonthResult] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as total FROM subscribers WHERE createdAt >= ?",
      [formatDateForMySQL(startOfMonth)],
    );

    // Available usernames added this week
    const [availableThisWeekResult] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as total FROM available_usernames WHERE createdAt >= ?",
      [formatDateForMySQL(startOfWeek)],
    );

    // Speed changes this week
    const [speedChangesWeekResult] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as total FROM speed_history WHERE changed_at >= ?",
      [formatDateForMySQL(startOfWeek)],
    );

    // Username changes this week
    const [usernameChangesWeekResult] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as total FROM username_history WHERE changed_at >= ?",
      [formatDateForMySQL(startOfWeek)],
    );

    // Subscribers by facility type
    const [facilityResult] = await pool.execute<RowDataPacket[]>(
      `SELECT facilityType, COUNT(*) as count FROM subscribers 
       WHERE facilityType IS NOT NULL AND facilityType != '' 
       GROUP BY facilityType ORDER BY count DESC LIMIT 10`,
    );

    // Recent speed changes
    const [recentSpeedChanges] = await pool.execute<RowDataPacket[]>(
      `SELECT sh.*, s.fullName, s.username 
       FROM speed_history sh 
       LEFT JOIN subscribers s ON sh.subscriber_id = s.id 
       ORDER BY sh.changed_at DESC LIMIT 5`,
    );

    // Daily new subscribers for last 7 days (for chart)
    const [dailyNewSubscribers] = await pool.execute<RowDataPacket[]>(
      `SELECT DATE(createdAt) as date, COUNT(*) as count 
       FROM subscribers 
       WHERE createdAt >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(createdAt) 
       ORDER BY date ASC`,
    );

    // Daily available usernames added for last 7 days (for chart)
    const [dailyAvailableAdded] = await pool.execute<RowDataPacket[]>(
      `SELECT DATE(createdAt) as date, COUNT(*) as count 
       FROM available_usernames 
       WHERE createdAt >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(createdAt) 
       ORDER BY date ASC`,
    );

    // Available usernames with remaining days breakdown
    const [availableDaysBreakdown] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        CASE 
          WHEN expiryDate IS NULL OR DATEDIFF(expiryDate, CURDATE()) >= 31 THEN 'full'
          WHEN DATEDIFF(expiryDate, CURDATE()) >= 15 THEN 'half'
          WHEN DATEDIFF(expiryDate, CURDATE()) >= 7 THEN 'quarter'
          ELSE 'low'
        END as category,
        COUNT(*) as count
       FROM available_usernames 
       WHERE isUsed = FALSE OR isUsed IS NULL
       GROUP BY category`,
    );

    res.json({
      success: true,
      data: {
        overview: {
          totalSubscribers: totalResult[0]?.total || 0,
          totalAvailableUsernames: totalAvailableResult[0]?.total || 0,
          expiringSubscribers: expiringResult[0]?.total || 0,
          expiredSubscribers: expiredResult[0]?.total || 0,
          stoppedSubscribers: stoppedResult[0]?.total || 0,
        },
        thisWeek: {
          newSubscribers: newThisWeekResult[0]?.total || 0,
          availableUsernamesAdded: availableThisWeekResult[0]?.total || 0,
          speedChanges: speedChangesWeekResult[0]?.total || 0,
          usernameChanges: usernameChangesWeekResult[0]?.total || 0,
        },
        thisMonth: {
          newSubscribers: newThisMonthResult[0]?.total || 0,
        },
        subscribersBySpeed: speedResult,
        availableBySpeed: availableResult,
        facilityTypes: facilityResult,
        recentSpeedChanges: recentSpeedChanges,
        charts: {
          dailyNewSubscribers: dailyNewSubscribers,
          dailyAvailableAdded: dailyAvailableAdded,
        },
        availableDaysBreakdown: availableDaysBreakdown,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard stats",
      error,
    });
  }
};
