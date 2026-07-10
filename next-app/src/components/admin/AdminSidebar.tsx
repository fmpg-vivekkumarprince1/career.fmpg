"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Star,
  ScrollText,
  Briefcase,
  Shield,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

// ---------------------------------------------------------------------------
// Nav config
// ---------------------------------------------------------------------------
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",       href: "/admin/dashboard",       icon: LayoutDashboard },
  { label: "Employees",       href: "/admin/employees",       icon: Users           },
  { label: "Applications",    href: "/admin/applications",    icon: FileText        },
  { label: "Recommendations", href: "/admin/recommendations", icon: Star            },
  { label: "Certificates",    href: "/admin/certificates",    icon: Shield          },
  { label: "Audit Logs",      href: "/admin/audit-logs",      icon: ScrollText      },
  { label: "Job Postings",    href: "/admin/dashboard",       icon: Briefcase       },
];

// ---------------------------------------------------------------------------
// Helper – derive initials from a full name
// ---------------------------------------------------------------------------
function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface AdminSidebarProps {
  userName: string;
  userRole: string;
  userEmail: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AdminSidebar({
  userName,
  userRole,
  userEmail,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Active check: exact match OR starts-with for nested routes
  const isActive = (href: string) =>
    pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(href));

  // Logout handler
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutAction();
    } finally {
      router.push("/login");
    }
  };

  // Formatted role label
  const roleLabel =
    userRole === "super-admin"
      ? "Super Admin"
      : userRole === "admin"
      ? "Administrator"
      : userRole === "employee"
      ? "Employee"
      : userRole;

  return (
    <aside
      className={`
        relative flex flex-col h-screen
        bg-white/85 backdrop-blur-xl
        border-r border-slate-200/60
        shadow-sm z-30
        transition-all duration-300 ease-in-out
        ${collapsed ? "w-[72px]" : "w-64"}
      `}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Toggle button                                                        */}
      {/* ------------------------------------------------------------------ */}
      <button
        onClick={() => setCollapsed((prev) => !prev)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="
          absolute -right-3 top-6 z-40
          flex items-center justify-center
          w-6 h-6 rounded-full
          bg-gradient-to-br from-emerald-500 to-emerald-600
          border border-emerald-400/20
          text-white shadow-lg
          hover:scale-110 active:scale-95
          transition-transform duration-150
        "
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      {/* ------------------------------------------------------------------ */}
      {/* Branding                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={`
          flex items-center gap-3 px-4 py-5
          border-b border-slate-200/60
          ${collapsed ? "justify-center px-2" : ""}
        `}
      >
        {/* FMPG logo image */}
        <img 
          src="/fmpg-logo.png" 
          alt="FMPG Admin Logo" 
          className="w-9 h-9 flex-shrink-0 object-contain"
        />

        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-slate-900 font-bold text-sm leading-tight tracking-wide truncate">
              FMPG Admin
            </p>
            <p className="text-slate-400 text-xs truncate">Control Panel</p>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Navigation                                                           */}
      {/* ------------------------------------------------------------------ */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-1 px-2">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={label}
              href={href}
              title={collapsed ? label : undefined}
              className={`
                group relative flex items-center gap-3
                rounded-xl px-3 py-2.5
                text-sm font-medium
                transition-all duration-200 ease-in-out
                ${collapsed ? "justify-center" : ""}
                ${
                  active
                    ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }
              `}
            >
              {/* Active indicator bar */}
              {active && !collapsed && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-emerald-400" />
              )}

              <Icon
                className={`
                  flex-shrink-0 w-5 h-5
                  transition-colors duration-200
                  ${active ? "text-white" : "text-slate-400 group-hover:text-slate-900"}
                `}
              />

              {!collapsed && (
                <span className="truncate">{label}</span>
              )}

              {/* Tooltip for collapsed state */}
              {collapsed && (
                <span className="
                  pointer-events-none absolute left-full ml-3 z-50
                  whitespace-nowrap rounded-lg
                  bg-slate-900 border border-slate-800
                  px-2.5 py-1.5 text-xs text-white
                  opacity-0 group-hover:opacity-100
                  -translate-x-1 group-hover:translate-x-0
                  transition-all duration-150
                  shadow-xl
                ">
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* User info + logout                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="border-t border-slate-200/60 p-3">
        <div
          className={`
            flex items-center gap-3
            ${collapsed ? "justify-center flex-col" : ""}
          `}
        >
          {/* Avatar initials */}
          <div className="
            flex-shrink-0 flex items-center justify-center
            w-9 h-9 rounded-full
            bg-gradient-to-br from-emerald-500 to-emerald-600
            text-white text-xs font-bold
            ring-2 ring-emerald-500/10
            shadow-md shadow-emerald-500/20
          ">
            {getInitials(userName)}
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 text-sm font-semibold truncate leading-tight">
                {userName}
              </p>
              <p className="text-slate-400 text-xs truncate">{roleLabel}</p>
            </div>
          )}

          {/* Logout button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Logout"
            aria-label="Logout"
            className="
              flex-shrink-0 flex items-center justify-center
              w-8 h-8 rounded-lg
              text-slate-400 hover:text-red-600
              hover:bg-red-50
              transition-all duration-150
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Email – only when expanded */}
        {!collapsed && (
          <p className="mt-2 px-1 text-slate-400 text-[11px] truncate">
            {userEmail}
          </p>
        )}
      </div>
    </aside>
  );
}
