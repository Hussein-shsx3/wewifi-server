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
  const d = new Date(date);
  return d.toISOString().split("T")[0];
};

export default ISubscriber;
