export interface Task {
  id: string;
  title: string;
  category: "buckingham" | "personal-tasks" | "tools" | "team";
  priority: "high" | "medium" | "low";
  notes: string | null;
  status: "todo" | "done";
  source: "manual" | "dump" | "email";
  created_at: string;
  created_date: string;
  completed_date: string | null;
  due_date: string | null;
}

export interface BriefingItem {
  title: string;
  reason: string;
  category: string;
  priority: string;
}

export interface Briefing {
  date: string;
  summary: string;
  items: BriefingItem[];
  scanned_at: string;
}

export interface DayLog {
  date: string;
  content: string;
  updated_at: string;
}

export const CATEGORIES = [
  { id: "buckingham", label: "Buckingham", color: "#1B3A5C" },
  { id: "personal-tasks", label: "Personal Tasks", color: "#C9A84C" },
  { id: "tools", label: "Tools", color: "#7C5CBF" },
  { id: "team", label: "Team", color: "#D4880F" },
] as const;

export const PRIORITIES = ["high", "medium", "low"] as const;
