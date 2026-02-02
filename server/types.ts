export type Role = "user" | "manager" | "admin";

export type User = {
  id: string;
  username: string;
  passwordHash: string;
  orgId: string;
  role: Role;
  createdAt: string;
};

export type Org = {
  id: string;
  name: string;
  createdAt: string;
};

export type CheckIn = {
  id: string;
  orgId: string;
  userId: string;
  ts: string; // ISO timestamp
  dayKey: string; // YYYY-MM-DD
  mood: number; // 1-10
  energy: number; // 1-10
  stress: number; // 1-10
  note: string | null;
  tagsJson: string; // JSON string array
  createdAt: string;
};

export type Habit = {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  targetPerWeek: number;
  createdAt: string;
  archivedAt: string | null;
};
