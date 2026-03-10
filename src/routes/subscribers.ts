import { Router, Request, Response } from "express";
import multer from "multer";
import { authMiddleware } from "../middleware/auth";
import {
  getSubscribers,
  createSubscriber,
  updateSubscriber,
  deleteSubscriber,
  deleteAllSubscribers,
  uploadExcel,
  uploadCredentials,
  bulkDelete,
  bulkUpdate,
  exportSubscribers,
  getSubscriberProfile,
  changeSubscriberUsername,
  getUsernameHistory,
  getSpeedHistory,
  getAvailableUsernames,
  addAvailableUsername,
  uploadAvailableUsernames,
  deleteAvailableUsername,
  updateAvailableUsername,
  deleteAllAvailableUsernames,
  assignUsernameToSubscriber,
  getSubscribersAboutToDisconnect,
  cleanupInvalidUsernames,
  getStoppedSubscribers,
  stopSubscriber,
  reactivateSubscriber,
  bulkReactivateSubscribers,
  deleteStoppedSubscriber,
  getExpiringUsernames,
  resetSpecialSubscriberCycle,
  bulkChangeUsernames,
  searchByOldUsername,
  getDashboardStats,
  addUsernameHistoryEntry,
  updateUsernameHistoryEntry,
  deleteUsernameHistoryEntry,
  sendSmsMessage,
} from "../controllers/subscriberController";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Apply auth middleware to all subscriber routes
router.use(authMiddleware);

// Dashboard stats route
router.get("/dashboard-stats", getDashboardStats);

// Main subscriber routes
router.get("/", getSubscribers);
router.get("/export", exportSubscribers);
router.get("/about-to-disconnect", getSubscribersAboutToDisconnect);
router.post("/", createSubscriber);
router.put("/:id", updateSubscriber);
router.delete("/all", deleteAllSubscribers);
router.delete("/:id", deleteSubscriber);
router.post("/upload", upload.single("file"), uploadExcel);
router.post("/upload-credentials", upload.single("file"), uploadCredentials);
router.post("/bulk-delete", bulkDelete);
router.post("/bulk-update", bulkUpdate);

// Profile and username history routes
router.get("/profile/:id", getSubscriberProfile);
router.post("/change-username/:id", changeSubscriberUsername);
router.get("/username-history/:id", getUsernameHistory);
router.post("/username-history/:id", addUsernameHistoryEntry);
router.put("/username-history/:historyId", updateUsernameHistoryEntry);
router.delete("/username-history/:historyId", deleteUsernameHistoryEntry);
router.get("/speed-history/:id", getSpeedHistory);

// Available usernames routes
router.get("/available-usernames", getAvailableUsernames);
router.post("/available-usernames", addAvailableUsername);
router.post(
  "/available-usernames/upload",
  upload.single("file"),
  uploadAvailableUsernames,
);
router.delete("/available-usernames/all", deleteAllAvailableUsernames);
router.post("/available-usernames/cleanup", cleanupInvalidUsernames);
router.put("/available-usernames/:id", updateAvailableUsername);
router.delete("/available-usernames/:id", deleteAvailableUsername);
router.post("/assign-username", assignUsernameToSubscriber);

// Stopped subscribers routes
router.get("/stopped", getStoppedSubscribers);
router.post("/stop/:id", stopSubscriber);
router.post("/reactivate/:id", reactivateSubscriber);
router.post("/reactivate-bulk", bulkReactivateSubscribers);
router.delete("/stopped/:id", deleteStoppedSubscriber);

// Expiring usernames routes
router.get("/expiring-usernames", getExpiringUsernames);
router.post("/expiring-usernames/reset-special/:id", resetSpecialSubscriberCycle);
router.post("/bulk-change-usernames", bulkChangeUsernames);
router.get("/search-old-username", searchByOldUsername);

// SMS route
router.post("/sms", sendSmsMessage);

export default router;
