// Subscriber interface for MySQL
export interface ISubscriber {
  id?: number;
  username: string;
  password: string;
  fullName: string;
  facilityType?: string;
  phone: string;
  package: string;
  monthlyPrice: number;
  speed: number;
  startDate: Date | string;
  firstContactDate?: Date | string | null;
  disconnectionDate?: Date | string | null;
  isActive: boolean;
  isSuspended: boolean;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Username history interface
export interface IUsernameHistory {
  id?: number;
  subscriber_id: number;
  old_username: string;
  old_password?: string;
  changed_at?: Date;
}

// Available username interface
export interface IAvailableUsername {
  id?: number;
  username: string;
  password?: string;
  package?: string;
  isUsed: boolean;
  createdAt?: Date;
}

// Helper to format date for MySQL
export const formatDateForMySQL = (
  date: Date | string | null | undefined,
): string | null => {
  if (!date) return null;
  const raw = String(date).trim();

  // Keep YYYY-MM-DD untouched to avoid timezone shifts.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  // Support manual inputs like DD/MM/YYYY (Arabic UI expectation).
  const slashMatch = raw.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/);
  if (slashMatch) {
    const a = Number(slashMatch[1]);
    const b = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);

    let day: number;
    let month: number;

    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (a <= 12 && b > 12) {
      month = a;
      day = b;
    } else {
      day = a;
      month = b;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  // Use local date parts (not UTC) to avoid one-day offset bugs.
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default ISubscriber;
