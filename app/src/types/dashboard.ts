// Shared types for the Financial Intelligence Dashboard.
// These describe UI/presentation data only — no financial logic lives here.

export type Trend = 'up' | 'down' | 'neutral';

export interface KpiCard {
  /** Lucide icon name registered in Icon.astro. */
  icon: string;
  label: string;
  value: string;
  /** Short qualifier shown under the value, e.g. "High approval chance". */
  hint: string;
  /** Change indicator relative to the previous period. */
  change: string;
  trend: Trend;
  href: string;
}

export interface QuickAction {
  icon: string;
  label: string;
  description: string;
  href: string;
}

export type ActivityStatus = 'success' | 'pending' | 'info';

export interface ActivityItem {
  icon: string;
  title: string;
  detail: string;
  time: string;
  status: ActivityStatus;
}

export interface SidebarLink {
  icon: string;
  label: string;
  href: string;
}
