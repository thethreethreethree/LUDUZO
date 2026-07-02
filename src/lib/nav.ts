// Single source of truth for the app's information architecture (Phase 9 IA restructure).
// Grouped, intuitive navigation consumed by the dashboard home and the top nav.

export type NavLink = { href: string; label: string };
export type NavGroup = { title: string; links: NavLink[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Members",
    links: [
      { href: "/dashboard/members", label: "Members" },
      { href: "/dashboard/programs", label: "Programs" },
      { href: "/dashboard/gamification", label: "Gamification" },
      { href: "/dashboard/retention", label: "Retention" },
      { href: "/dashboard/groups", label: "Groups" },
      { href: "/dashboard/guest-passes", label: "Guest passes" },
      { href: "/dashboard/referrals", label: "Referrals" },
      { href: "/dashboard/documents", label: "Documents" },
    ],
  },
  {
    title: "Front desk",
    links: [
      { href: "/dashboard/checkins", label: "Check-ins" },
      { href: "/dashboard/kiosk", label: "Kiosk" },
      { href: "/dashboard/lockers", label: "Lockers" },
    ],
  },
  {
    title: "Schedule",
    links: [
      { href: "/dashboard/classes", label: "Classes" },
      { href: "/dashboard/appointments", label: "Appointments" },
      { href: "/dashboard/resources", label: "Resources" },
    ],
  },
  {
    title: "Sales & billing",
    links: [
      { href: "/dashboard/leads", label: "Leads / CRM" },
      { href: "/dashboard/plans", label: "Plans" },
      { href: "/dashboard/invoices", label: "Invoices" },
      { href: "/dashboard/pos", label: "Point of sale" },
      { href: "/dashboard/coupons", label: "Coupons" },
      { href: "/dashboard/gift-cards", label: "Gift cards" },
    ],
  },
  {
    title: "Team",
    links: [
      { href: "/dashboard/profile", label: "My profile" },
      { href: "/dashboard/staff", label: "Team" },
      { href: "/dashboard/shifts", label: "Shifts" },
      { href: "/dashboard/tasks", label: "Tasks" },
      { href: "/dashboard/messages", label: "Messages" },
      { href: "/dashboard/certifications", label: "Certifications" },
      { href: "/dashboard/payroll", label: "Payroll" },
      { href: "/dashboard/timeclock", label: "Time clock" },
    ],
  },
  {
    title: "Marketing",
    links: [
      { href: "/dashboard/announcements", label: "Announcements" },
      { href: "/dashboard/community", label: "Community" },
      { href: "/dashboard/feedback", label: "Reviews / NPS" },
    ],
  },
  {
    title: "Inventory",
    links: [
      { href: "/dashboard/inventory", label: "Inventory" },
      { href: "/dashboard/maintenance", label: "Maintenance" },
    ],
  },
  {
    title: "Insights",
    links: [
      { href: "/dashboard/analytics", label: "Analytics" },
      { href: "/dashboard/reports", label: "Reports" },
      { href: "/dashboard/activity", label: "Activity" },
    ],
  },
  {
    title: "Platform",
    links: [
      { href: "/dashboard/locations", label: "Locations" },
      { href: "/dashboard/settings", label: "Settings" },
      { href: "/dashboard/admin", label: "Admin" },
    ],
  },
];

// Concise top-nav: the primary destination per major area.
export const TOP_NAV: NavLink[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/members", label: "Members" },
  { href: "/dashboard/checkins", label: "Front desk" },
  { href: "/dashboard/classes", label: "Schedule" },
  { href: "/dashboard/invoices", label: "Sales" },
  { href: "/dashboard/staff", label: "Team" },
  { href: "/dashboard/analytics", label: "Insights" },
];
