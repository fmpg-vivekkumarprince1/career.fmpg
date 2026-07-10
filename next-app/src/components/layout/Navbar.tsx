"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  User, 
  LogOut, 
  Menu, 
  X, 
  Shield, 
  ChevronDown, 
  Award, 
  PhoneCall, 
  MessageSquare, 
  Share2,
  LayoutDashboard,
  Grid,
  ClipboardList,
  Users,
  Settings,
  Bell
} from "lucide-react";
import { getMeAction, logoutAction } from "@/app/actions/auth";
import { toast } from "sonner";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userBtnRef = useRef<HTMLButtonElement>(null);
  
  const pathname = usePathname();
  const router = useRouter();

  // Fetch authentication state on load
  useEffect(() => {
    async function loadUser() {
      const res = await getMeAction();
      if (res.success) {
        setUser(res.data);
        
        // Dynamically fetch unread notification counts
        try {
          const { getUserNotificationsAction } = await import("@/app/actions/jobs");
          const notifRes = await getUserNotificationsAction({ limit: 1 });
          if (notifRes.success && notifRes.data) {
            setUnreadCount(notifRes.data.unreadCount);
          }
        } catch (err) {}
      } else {
        setUser(null);
        setUnreadCount(0);
      }
    }
    loadUser();
  }, [pathname]);

  // Sticky header transition
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setIsSticky(true);
      } else {
        setIsSticky(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    const res = await logoutAction();
    if (res.success) {
      setUser(null);
      toast.success("Successfully logged out");
      router.push("/");
      router.refresh();
    } else {
      toast.error("Logout failed");
    }
  };

  const isSuperAdmin = user && user.role === "super-admin";
  const isAdmin = user && (user.role === "admin" || user.role === "super-admin");
  const isEmployee = user && user.role === "employee";
  const isHR = user && (
    user.department?.toUpperCase() === "HR" || 
    user.department === "General Management/Administration" || 
    user.role === "admin" || 
    user.role === "super-admin"
  );
  const hasDashboardAccess = isAdmin || (isHR && user.permissions?.canAccessDashboard);
  const showAdminConsole = hasDashboardAccess || isAdmin || isHR || (isEmployee && user.permissions?.canManageRecommendations);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuOpen &&
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node) &&
        userBtnRef.current &&
        !userBtnRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  // Close dropdowns on route change
  useEffect(() => {
    setShowAdminDropdown(false);
    setUserMenuOpen(false);
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className={`w-full py-4 px-6 md:px-12 z-[100] transition-all duration-500 border-b border-transparent ${
          isSticky
            ? "fixed top-0 left-0 bg-background/95 backdrop-blur-md border-border/40 shadow-md py-3"
            : "absolute bg-transparent"
        }`}
        style={{
          boxShadow: isSticky ? "0 10px 30px -10px rgba(5, 150, 105, 0.05)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <img 
              src="/fmpg-logo.png" 
              alt="FMPG Logo" 
              className="h-10 w-auto shrink-0 group-hover:scale-105 transition-transform duration-300"
            />
            <span className="font-heading text-2xl font-black tracking-widest text-foreground uppercase">
              FM<span className="text-emerald-600">PG</span>
            </span>
          </Link>

          {/* Desktop links */}
          <nav className="hidden md:flex items-center gap-6 font-heading text-xs font-bold uppercase tracking-wider">
            <Link
              href="/"
              className={`py-1.5 transition-colors duration-300 hover:text-emerald-600 ${
                pathname === "/" ? "text-emerald-600" : "text-muted-foreground"
              }`}
            >
              Home
            </Link>

            <Link
              href="/jobs"
              className={`py-1.5 transition-colors duration-300 hover:text-emerald-600 ${
                pathname.startsWith("/jobs") ? "text-emerald-600" : "text-muted-foreground"
              }`}
            >
              Careers
            </Link>



            {/* My Applications for standard candidates */}
            {user && user.role === "user" && (
              <Link
                href="/dashboard"
                className={`py-1.5 transition-colors duration-300 hover:text-emerald-600 flex items-center gap-1.5 ${
                  pathname === "/dashboard" ? "text-emerald-600" : "text-muted-foreground"
                }`}
              >
                My Applications
              </Link>
            )}


            {/* Write Review for Active/Former Employees */}
            {isEmployee && (user.status === "active" || user.status === "former") && (
              <Link
                href="/reviews/submit"
                className={`py-1.5 transition-colors duration-300 hover:text-emerald-600 flex items-center gap-1.5 ${
                  pathname === "/reviews/submit" ? "text-emerald-600" : "text-muted-foreground"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" /> Write Review
              </Link>
            )}

            <Link
              href="/contact"
              className={`py-1.5 transition-colors duration-300 hover:text-emerald-600 flex items-center gap-1.5 ${
                pathname === "/contact" ? "text-emerald-600" : "text-muted-foreground"
              }`}
            >
              <PhoneCall className="h-3.5 w-3.5" /> Contact
            </Link>

            {/* Admin Console Dropdown */}
            {showAdminConsole && (
              <div className="relative">
                <button
                  onMouseEnter={() => setShowAdminDropdown(true)}
                  onClick={() => setShowAdminDropdown(!showAdminDropdown)}
                  className="flex items-center gap-1 text-amber-550 hover:text-amber-600 py-1.5 cursor-pointer"
                >
                  <Shield className="h-3.5 w-3.5" /> Admin Console <ChevronDown className="h-3.5 w-3.5" />
                </button>

                {showAdminDropdown && (
                  <div 
                    onMouseLeave={() => setShowAdminDropdown(false)}
                    className="absolute top-full right-0 mt-2 w-64 bg-card border border-border/40 rounded-2xl p-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-250 z-50"
                  >
                    {hasDashboardAccess && (
                      <Link
                        href="/admin/dashboard"
                        className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <LayoutDashboard className="h-4 w-4 text-emerald-600" />
                        <span>Admin Dashboard</span>
                      </Link>
                    )}
                    {(isAdmin || (isHR && user.permissions?.canGenerateCertificate)) && (
                      <Link
                        href="/admin/certificates"
                        className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Award className="h-4 w-4 text-amber-500" />
                        <span>Certificates & Offers</span>
                      </Link>
                    )}
                    {(isAdmin || (isHR && user.permissions?.canManageReviews)) && (
                      <Link
                        href="/admin/reviews"
                        className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <MessageSquare className="h-4 w-4 text-indigo-500" />
                        <span>Review Moderation</span>
                      </Link>
                    )}
                    {(isAdmin || (isEmployee && user.permissions?.canManageRecommendations)) && (
                      <Link
                        href="/admin/recommendations"
                        className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Grid className="h-4 w-4 text-teal-500" />
                        <span>Recommendation Management</span>
                      </Link>
                    )}
                    {isAdmin && (
                      <Link
                        href="/admin/users"
                        className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Users className="h-4 w-4 text-purple-500" />
                        <span>User Directory</span>
                      </Link>
                    )}
                    {(isAdmin || (isHR && user.permissions?.canManageEmployees)) && (
                      <Link
                        href="/admin/employees"
                        className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Users className="h-4 w-4 text-blue-500" />
                        <span>Employee Registry</span>
                      </Link>
                    )}
                    {isSuperAdmin && (
                      <>
                        <Link
                          href="/admin/manage-hr"
                          className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 rounded-xl text-muted-foreground hover:text-foreground transition-colors border-t border-border/40 mt-1.5 pt-1.5"
                        >
                          <Settings className="h-4 w-4 text-amber-500 animate-spin-slow" />
                          <span>HR Staff Configuration</span>
                        </Link>
                        <Link
                          href="/admin/audit-logs"
                          className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ClipboardList className="h-4 w-4 text-rose-500" />
                          <span>Audit Logs</span>
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* User Controls */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="hidden md:flex items-center gap-3">
                {/* Notification Bell */}
                <Link
                  href="/notifications"
                  className="relative h-10 w-10 rounded-xl border border-border/40 hover:bg-muted/30 text-muted-foreground hover:text-foreground flex items-center justify-center transition-all duration-300 cursor-pointer"
                  title="Notifications"
                >
                  <Bell className="h-4.5 w-4.5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-4.5 w-4.5 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full flex items-center justify-center border-2 border-background">
                      {unreadCount}
                    </span>
                  )}
                </Link>

                <div className="relative">
                  <button
                    ref={userBtnRef}
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-500/20 hover:border-emerald-500 bg-emerald-500/5 text-emerald-600 text-xs font-bold uppercase tracking-wider transition-all duration-300 shadow-md shadow-emerald-600/5 cursor-pointer"
                  >
                    <User className="h-3.5 w-3.5" /> {user.name.split(" ")[0]}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`} />
                  </button>

                  {userMenuOpen && (
                    <div
                      ref={userMenuRef}
                      className="absolute top-full right-0 mt-2 w-64 bg-card border border-border/40 rounded-2xl p-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-250 z-50 text-left"
                    >
                      {/* User Info Header */}
                      <div className="px-3 py-2 border-b border-border/40 mb-2">
                        <p className="font-heading text-sm font-black text-foreground truncate">{user.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                        <span className="inline-block text-[9px] text-emerald-650 bg-emerald-600/10 px-2 py-0.5 rounded-full font-bold uppercase mt-1.5 tracking-wider">
                          {user.role}
                        </span>
                        {user.department && (
                          <p className="text-[9px] text-blue-500 mt-1 uppercase font-semibold">Dept: {user.department}</p>
                        )}
                      </div>

                      {/* Menu Options */}
                      <div className="flex flex-col gap-1">
                        {/* Dashboard Link */}
                        <Link
                          href={hasDashboardAccess ? "/admin/dashboard" : "/dashboard"}
                          className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <LayoutDashboard className="h-3.5 w-3.5 text-emerald-600" />
                          <span>My Dashboard</span>
                        </Link>

                        {/* Employee Profile inside dropdown for employees/admins */}
                        {(isEmployee || isAdmin) && (
                          <Link
                            href="/employee/profile"
                            className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Share2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Employee Profile</span>
                          </Link>
                        )}

                        {/* Notifications inside dropdown */}
                        <Link
                          href="/notifications"
                          className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <span className="flex items-center gap-2.5">
                            <Bell className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Notifications</span>
                          </span>
                          {unreadCount > 0 && (
                            <span className="h-4.5 w-4.5 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full flex items-center justify-center">
                              {unreadCount}
                            </span>
                          )}
                        </Link>
                      </div>

                      <div className="h-[1px] bg-border/40 my-2" />

                      {/* Sign Out Button */}
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-rose-500 hover:bg-rose-500/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-3">
                <Link
                  href="/login"
                  className="px-5 py-2.5 rounded-xl border border-border/40 hover:border-emerald-500/50 text-foreground text-xs font-bold uppercase tracking-wider transition-all duration-300"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-550 text-xs font-bold uppercase tracking-wider shadow-md shadow-emerald-600/10 transition-all duration-300"
                >
                  Join Us
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsOpen(true)}
              className="md:hidden h-10 w-10 flex items-center justify-center rounded-xl border border-border/40 text-foreground hover:text-emerald-600 hover:border-emerald-500 transition-all duration-300 cursor-pointer"
              aria-label="Open sidebar menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Panel */}
      <div
        className={`md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] transition-opacity duration-300 ${
          isOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        }`}
        onClick={() => setIsOpen(false)}
      >
        <div
          className={`absolute top-0 right-0 h-screen w-72 bg-card border-l border-border/40 shadow-2xl p-6 flex flex-col gap-6 transition-transform duration-300 ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center border-b border-border/20 pb-4">
            <span className="font-heading font-extrabold text-xl tracking-wider text-foreground">
              FM<span className="text-emerald-600">PG</span>
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex flex-col gap-3 font-heading text-xs font-bold uppercase tracking-wider overflow-y-auto max-h-[80vh] pr-2">
            <Link
              href="/"
              onClick={() => setIsOpen(false)}
              className={`px-4 py-2.5 rounded-xl hover:bg-muted/30 transition-colors ${
                pathname === "/" ? "bg-emerald-600/10 text-emerald-600 font-bold" : "text-muted-foreground"
              }`}
            >
              Home
            </Link>

            <Link
              href="/jobs"
              onClick={() => setIsOpen(false)}
              className={`px-4 py-2.5 rounded-xl hover:bg-muted/30 transition-colors ${
                pathname.startsWith("/jobs") ? "bg-emerald-600/10 text-emerald-600 font-bold" : "text-muted-foreground"
              }`}
            >
              Careers
            </Link>



            {/* My Applications for mobile standard candidates */}
            {user && user.role === "user" && (
              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className={`px-4 py-2.5 rounded-xl hover:bg-muted/30 flex items-center gap-2 transition-colors ${
                  pathname === "/dashboard" ? "bg-emerald-600/10 text-emerald-600 font-bold" : "text-muted-foreground"
                }`}
              >
                <ClipboardList className="h-4 w-4 text-emerald-600" /> My Applications
              </Link>
            )}



            {/* Write Review for Active/Former Employees */}
            {isEmployee && (user.status === "active" || user.status === "former") && (
              <Link
                href="/reviews/submit"
                onClick={() => setIsOpen(false)}
                className={`px-4 py-2.5 rounded-xl hover:bg-muted/30 flex items-center gap-2 transition-colors ${
                  pathname === "/reviews/submit" ? "bg-emerald-600/10 text-emerald-600 font-bold" : "text-muted-foreground"
                }`}
              >
                <MessageSquare className="h-4 w-4 text-indigo-500" /> Write Review
              </Link>
            )}

            <Link
              href="/contact"
              onClick={() => setIsOpen(false)}
              className={`px-4 py-2.5 rounded-xl hover:bg-muted/30 flex items-center gap-2 transition-colors ${
                pathname === "/contact" ? "bg-emerald-600/10 text-emerald-600 font-bold" : "text-muted-foreground"
              }`}
            >
              <PhoneCall className="h-4 w-4 text-emerald-600" /> Contact Us
            </Link>

            {/* Admin Console mobile section */}
            {showAdminConsole && (
              <>
                <div className="h-[1px] bg-border/20 my-1" />
                <span className="text-[10px] text-amber-600 px-4 font-black uppercase tracking-widest block mb-1">Administration</span>

                {hasDashboardAccess && (
                  <Link
                    href="/admin/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2.5 rounded-xl hover:bg-muted/30 text-muted-foreground flex items-center gap-2"
                  >
                    <LayoutDashboard className="h-4 w-4 text-emerald-600" /> Admin Dashboard
                  </Link>
                )}
                {(isAdmin || (isHR && user.permissions?.canGenerateCertificate)) && (
                  <Link
                    href="/admin/certificates"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2.5 rounded-xl hover:bg-muted/30 text-muted-foreground flex items-center gap-2"
                  >
                    <Award className="h-4 w-4 text-amber-500" /> Certificates & Offers
                  </Link>
                )}
                {(isAdmin || (isHR && user.permissions?.canManageReviews)) && (
                  <Link
                    href="/admin/reviews"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2.5 rounded-xl hover:bg-muted/30 text-muted-foreground flex items-center gap-2"
                  >
                    <MessageSquare className="h-4 w-4 text-indigo-500" /> Review Moderation
                  </Link>
                )}
                {(isAdmin || (isEmployee && user.permissions?.canManageRecommendations)) && (
                  <Link
                    href="/admin/recommendations"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2.5 rounded-xl hover:bg-muted/30 text-muted-foreground flex items-center gap-2"
                  >
                    <Grid className="h-4 w-4 text-teal-500" /> Recommendation Management
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    href="/admin/users"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2.5 rounded-xl hover:bg-muted/30 text-muted-foreground flex items-center gap-2"
                  >
                    <Users className="h-4 w-4 text-purple-500" /> User Directory
                  </Link>
                )}
                {(isAdmin || (isHR && user.permissions?.canManageEmployees)) && (
                  <Link
                    href="/admin/employees"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2.5 rounded-xl hover:bg-muted/30 text-muted-foreground flex items-center gap-2"
                  >
                    <Users className="h-4 w-4 text-blue-500" /> Employee Registry
                  </Link>
                )}
                {isSuperAdmin && (
                  <>
                    <Link
                      href="/admin/manage-hr"
                      onClick={() => setIsOpen(false)}
                      className="px-4 py-2.5 rounded-xl hover:bg-muted/30 text-muted-foreground flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4 text-amber-500 animate-spin-slow" /> HR Staff Configuration
                    </Link>
                    <Link
                      href="/admin/audit-logs"
                      onClick={() => setIsOpen(false)}
                      className="px-4 py-2.5 rounded-xl hover:bg-muted/30 text-muted-foreground flex items-center gap-2"
                    >
                      <ClipboardList className="h-4 w-4 text-rose-500" /> Audit Logs
                    </Link>
                  </>
                )}
              </>
            )}

            <div className="h-[1px] bg-border/20 my-2" />

            {user ? (
              <>
                {/* Mobile User details header for premium feel */}
                <div className="px-4 py-2 border-b border-border/20 mb-2">
                  <p className="text-sm font-black text-foreground truncate">{user.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                  <span className="inline-block text-[9px] text-emerald-600 bg-emerald-600/10 px-2 py-0.5 rounded-full font-bold uppercase mt-1 tracking-wider">
                    {user.role}
                  </span>
                </div>

                {/* Mobile Notification Bell */}
                <Link
                  href="/notifications"
                  onClick={() => setIsOpen(false)}
                  className={`px-4 py-2.5 rounded-xl hover:bg-muted/30 flex items-center justify-between transition-colors ${
                    pathname === "/notifications" ? "bg-emerald-600/10 text-emerald-600 font-bold" : "text-muted-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-emerald-600" /> Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="h-5 w-5 bg-amber-500 text-slate-950 font-black text-[10px] rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </Link>

                <Link
                  href={hasDashboardAccess ? "/admin/dashboard" : "/dashboard"}
                  onClick={() => setIsOpen(false)}
                  className={`px-4 py-2.5 rounded-xl hover:bg-muted/30 flex items-center gap-2 transition-colors ${
                    pathname === "/dashboard" || pathname === "/admin/dashboard" ? "bg-emerald-600/10 text-emerald-600 font-bold" : "text-muted-foreground"
                  }`}
                >
                  <User className="h-4 w-4 text-emerald-600" /> My Dashboard
                </Link>

                {/* Employee Profile inside mobile user area if user is employee or admin */}
                {(isEmployee || isAdmin) && (
                  <Link
                    href="/employee/profile"
                    onClick={() => setIsOpen(false)}
                    className={`px-4 py-2.5 rounded-xl hover:bg-muted/30 flex items-center gap-2 transition-colors ${
                      pathname === "/employee/profile" ? "bg-emerald-600/10 text-emerald-600 font-bold" : "text-muted-foreground"
                    }`}
                  >
                    <Share2 className="h-4 w-4 text-emerald-600" /> Employee Profile
                  </Link>
                )}

                <div className="h-[1px] bg-border/20 my-2" />

                <button
                  onClick={() => {
                    setIsOpen(false);
                    handleLogout();
                  }}
                  className="px-4 py-2.5 rounded-xl text-rose-500 hover:bg-rose-500/10 text-left flex items-center gap-2 cursor-pointer font-bold uppercase tracking-wider"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border/40 text-center text-xs font-bold uppercase tracking-wider text-foreground"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-center text-xs font-bold uppercase tracking-wider shadow-md"
                >
                  Join Us
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </>
  );
}
