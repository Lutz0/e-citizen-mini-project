import { Construction, Droplets, Lightbulb, Trash2, Waves, Wrench } from "lucide-react";

/** Vocabulary shared with the backend (apps/service_requests/domain.py). */
export const CATEGORIES = [
  { value: "streetlights", label: "Streetlights", icon: Lightbulb, example: "Broken or flickering lights" },
  { value: "water", label: "Water supply", icon: Droplets, example: "No water, leaks, burst pipes" },
  { value: "waste", label: "Waste collection", icon: Trash2, example: "Overflowing bins, uncollected waste" },
  { value: "roads", label: "Roads", icon: Construction, example: "Potholes, damaged surfaces, signs" },
  { value: "drainage", label: "Drainage", icon: Waves, example: "Blocked drains, flooding" },
  { value: "other", label: "Other", icon: Wrench, example: "Anything else in your community" },
];

export const STATUSES = [
  { value: "pending", label: "Pending", description: "Received and waiting to be picked up" },
  { value: "in_progress", label: "In Progress", description: "Being worked on" },
  { value: "resolved", label: "Resolved", description: "The issue has been fixed" },
];

export const SEVERITIES = [
  { value: "low", label: "Low", level: 1, hint: "A minor inconvenience" },
  { value: "medium", label: "Medium", level: 2, hint: "Affects daily life" },
  { value: "high", label: "High", level: 3, hint: "Safety risk or urgent" },
];

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "severity", label: "Highest severity first" },
  { value: "updated", label: "Recently updated" },
];

export const byValue = (list, value) => list.find((item) => item.value === value);
export const categoryLabel = (value) => byValue(CATEGORIES, value)?.label ?? value;
export const statusLabel = (value) => byValue(STATUSES, value)?.label ?? value;
export const severityLabel = (value) => byValue(SEVERITIES, value)?.label ?? value;

export const ROLES = { CITIZEN: "citizen", ADMIN: "admin" };
export const homePathFor = (user) => (user?.role === ROLES.ADMIN ? "/admin" : "/requests");
