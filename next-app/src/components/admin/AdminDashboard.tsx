"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  FileUser,
  Users,
  Award,
  ShieldAlert,
  Plus,
  Search,
  Filter,
  Mail,
  Phone,
  Calendar,
  ArrowRight,
  Loader2,
  Download,
  Trash,
  Check,
  X,
  ShieldCheck,
  ClipboardList,
  Info,
  FileSpreadsheet,
  Settings,
  ChevronRight,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getEmployeesAction,
  updateEmployeeAction,
  terminateEmployeeAction,
  bulkUploadEmployeesAction,
  getJobsAction,
  saveJobAction,
  getJobApplicationsAction,
  getAIRecommendationsAction,
  getAllRecommendationsAction,
  updateRecommendationStatusAction,
  getAuditLogsAction
} from "@/app/actions/admin";
import { toast } from "sonner";

interface AdminDashboardProps {
  initialMetrics: any;
  initialJobs: any[];
  initialEmployees: any;
  initialRecommendations: any[];
  initialAuditLogs: any[];
}

export default function AdminDashboard({
  initialMetrics,
  initialJobs,
  initialEmployees,
  initialRecommendations,
  initialAuditLogs
}: AdminDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  // State managers
  const [metrics, setMetrics] = useState(initialMetrics.metrics);
  const [statusCounts, setStatusCounts] = useState(initialMetrics.statusCounts);
  const [recentLogs, setRecentLogs] = useState(initialMetrics.recentLogs);
  const [jobs, setJobs] = useState(initialJobs);
  const [employees, setEmployees] = useState(initialEmployees.users);
  const [employeeStats, setEmployeeStats] = useState(initialEmployees.stats);
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);

  // Search & filter states
  const [empSearch, setEmpSearch] = useState("");
  const [empRoleFilter, setEmpRoleFilter] = useState("");
  const [empStatusFilter, setEmpStatusFilter] = useState("");
  const [empLoading, setEmpLoading] = useState(false);

  // Job editor states
  const [isEditingJob, setIsEditingJob] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [jobForm, setJobForm] = useState({
    title: "",
    company: "FMPG",
    location: "",
    type: "Full-time",
    salary: "",
    department: "",
    position: "",
    description: "",
    requirements: "",
    responsibilities: "",
    isActive: true,
    hrContactName: "",
    hrContactEmail: "",
    hrContactPhone: "",
    questions: [] as any[]
  });
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionType, setNewQuestionType] = useState("text");
  const [newQuestionRequired, setNewQuestionRequired] = useState(true);

  // Applicant list state
  const [selectedJobForApps, setSelectedJobForApps] = useState<string | null>(null);
  const [jobApplications, setJobApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);

  // AI Matching recommendation state
  const [selectedJobForAI, setSelectedJobForAI] = useState<string | null>(null);
  const [aiMatches, setAiMatches] = useState<any[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);

  // Bulk Upload states
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState("");
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);

  // Edit employee modal
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [empForm, setEmpForm] = useState({
    role: "employee",
    status: "active",
    department: "",
    position: "",
    positionLevel: "Junior",
    permissions: {
      canGenerateCertificate: false,
      canGenerateOfferLetter: false,
      canCreateJob: false,
      canViewApplicants: false,
      canManageReviews: false,
      canManageEmployees: false,
      canManageRecommendations: false,
      canAccessDashboard: false
    }
  });

  // Reload employee list based on filters
  const handleFetchEmployees = async () => {
    try {
      setEmpLoading(true);
      const res = await getEmployeesAction({
        page: 1,
        limit: 100,
        search: empSearch,
        role: empRoleFilter,
        status: empStatusFilter
      });
      if (res.success && res.data) {
        setEmployees(res.data.users);
        setEmployeeStats(res.data.stats);
      }
    } catch (err) {
      toast.error("Failed to load employee list");
    } finally {
      setEmpLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "employees") {
      handleFetchEmployees();
    }
  }, [empSearch, empRoleFilter, empStatusFilter, activeTab]);

  // Load applicants for selected job
  useEffect(() => {
    if (selectedJobForApps) {
      const loadApps = async () => {
        try {
          setLoadingApps(true);
          const res = await getJobApplicationsAction(selectedJobForApps);
          if (res.success && res.data) {
            setJobApplications(res.data);
          }
        } catch (err) {
          toast.error("Failed to load applicants");
        } finally {
          setLoadingApps(false);
        }
      };
      loadApps();
    }
  }, [selectedJobForApps]);

  // Load AI matching suggestions
  useEffect(() => {
    if (selectedJobForAI) {
      const loadAI = async () => {
        try {
          setLoadingAI(true);
          const res = await getAIRecommendationsAction(selectedJobForAI);
          if (res.success && res.data) {
            setAiMatches(res.data);
          } else {
            setAiMatches([]);
          }
        } catch (err) {
          toast.error("Failed to fetch matching insights");
        } finally {
          setLoadingAI(false);
        }
      };
      loadAI();
    }
  }, [selectedJobForAI]);

  // Handle Save Job Opening
  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await saveJobAction(editingJobId, jobForm);
      if (res.success) {
        toast.success(res.message);
        setIsEditingJob(false);
        setEditingJobId(null);
        // Refresh job listings
        const jobRes = await getJobsAction();
        if (jobRes.success && jobRes.data) setJobs(jobRes.data);
      } else {
        toast.error(res.message || "Failed to save job post");
      }
    } catch (err) {
      toast.error("Failed to submit job data");
    }
  };

  // Add application question helper
  const handleAddQuestion = () => {
    if (!newQuestionText.trim()) return;
    setJobForm((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          questionText: newQuestionText.trim(),
          type: newQuestionType,
          required: newQuestionRequired
        }
      ]
    }));
    setNewQuestionText("");
  };

  const handleRemoveQuestion = (idx: number) => {
    setJobForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx)
    }));
  };

  // Handle Update Recommendation Status
  const handleUpdateRecStatus = async (id: string, newStatus: "reviewed" | "selected" | "rejected") => {
    try {
      const notes = prompt("Enter review comments or admin notes:") || "";
      const res = await updateRecommendationStatusAction(id, newStatus, notes);
      if (res.success) {
        toast.success(res.message);
        const recRes = await getAllRecommendationsAction();
        if (recRes.success && recRes.data) setRecommendations(recRes.data);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error("Operation failed");
    }
  };

  // Handle Bulk Upload CSV
  const handleBulkUpload = async () => {
    if (!bulkCsvText.trim()) return toast.error("Please paste CSV data first");
    try {
      setIsUploadingBulk(true);
      const lines = bulkCsvText.split("\n");
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      
      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split(",").map((c) => c.trim());
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = cols[idx] || "";
        });
        rows.push(obj);
      }

      if (rows.length === 0) return toast.error("No valid CSV rows parsed");

      const res = await bulkUploadEmployeesAction(rows);
      if (res.success) {
        toast.success(res.message);
        setShowBulkModal(false);
        setBulkCsvText("");
        handleFetchEmployees();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error("CSV import failed");
    } finally {
      setIsUploadingBulk(false);
    }
  };

  // Handle Edit employee role & permissions
  const handleSelectEmpForEdit = (user: any) => {
    setSelectedEmp(user);
    setEmpForm({
      role: user.role,
      status: user.status || "active",
      department: user.department || "",
      position: user.position || "",
      positionLevel: user.positionLevel || "Junior",
      permissions: {
        canGenerateCertificate: user.permissions?.canGenerateCertificate || false,
        canGenerateOfferLetter: user.permissions?.canGenerateOfferLetter || false,
        canCreateJob: user.permissions?.canCreateJob || false,
        canViewApplicants: user.permissions?.canViewApplicants || false,
        canManageReviews: user.permissions?.canManageReviews || false,
        canManageEmployees: user.permissions?.canManageEmployees || false,
        canManageRecommendations: user.permissions?.canManageRecommendations || false,
        canAccessDashboard: user.permissions?.canAccessDashboard || false
      }
    });
  };

  const handleUpdateEmployee = async () => {
    if (!selectedEmp) return;
    try {
      const res = await updateEmployeeAction(selectedEmp._id, empForm);
      if (res.success) {
        toast.success(res.message);
        setSelectedEmp(null);
        handleFetchEmployees();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error("Failed to update employee details");
    }
  };

  // Handle termination
  const handleTerminate = async (userId: string, name: string) => {
    const reason = prompt(`Are you sure you want to conclude the contract for ${name}? Enter termination reason:`);
    if (reason === null) return;
    try {
      const res = await terminateEmployeeAction(userId, { reason: reason || "Termination of contract" });
      if (res.success) {
        toast.success(res.message);
        handleFetchEmployees();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error("Operation failed");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar navigation */}
      <aside className="w-64 bg-card border-r border-border/40 flex flex-col p-6 gap-6 glass-panel select-none shrink-0">
        <div className="flex items-center gap-2.5">
          <img 
            src="/fmpg-logo.png" 
            alt="FMPG Logo" 
            className="h-9 w-auto shrink-0"
          />
          <span className="font-heading text-xl font-black tracking-widest text-foreground uppercase">
            FM<span className="text-primary">PG</span> Admin
          </span>
        </div>

        <nav className="flex flex-col gap-1.5 flex-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left ${
              activeTab === "overview"
                ? "bg-primary text-slate-900 shadow-lg shadow-primary/10"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" /> Overview & Feeds
          </button>

          <button
            onClick={() => {
              setActiveTab("jobs");
              setIsEditingJob(false);
              setEditingJobId(null);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left ${
              activeTab === "jobs"
                ? "bg-primary text-slate-900 shadow-lg shadow-primary/10"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            }`}
          >
            <Briefcase className="h-4 w-4" /> Job Openings
          </button>

          <button
            onClick={() => {
              setActiveTab("applicants");
              if (jobs.length > 0 && !selectedJobForApps) {
                setSelectedJobForApps(jobs[0]._id);
              }
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left ${
              activeTab === "applicants"
                ? "bg-primary text-slate-900 shadow-lg shadow-primary/10"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            }`}
          >
            <FileUser className="h-4 w-4" /> Applicant Pipeline
          </button>

          <button
            onClick={() => {
              setActiveTab("employees");
              handleFetchEmployees();
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left ${
              activeTab === "employees"
                ? "bg-primary text-slate-900 shadow-lg shadow-primary/10"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" /> Employee Directory
          </button>

          <button
            onClick={() => setActiveTab("referrals")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left ${
              activeTab === "referrals"
                ? "bg-primary text-slate-900 shadow-lg shadow-primary/10"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            }`}
          >
            <Award className="h-4 w-4" /> Employee Referrals
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left ${
              activeTab === "audit"
                ? "bg-primary text-slate-900 shadow-lg shadow-primary/10"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            }`}
          >
            <ShieldAlert className="h-4 w-4" /> Security Audit Trace
          </button>
        </nav>

        <div className="border-t border-border/20 pt-4 flex flex-col gap-2">
          <Link
            href="/"
            className="w-full text-center px-4 py-2.5 rounded-xl border border-border/40 text-[10px] font-bold text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-all"
          >
            Back to Careers Landing
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-10 overflow-y-auto space-y-8 max-w-6xl">
        {/* TOP BAR */}
        <div className="flex justify-between items-center pb-4 border-b border-border/20">
          <div>
            <h1 className="text-2xl font-black font-heading tracking-tight capitalize">
              {activeTab} Management Panel
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Securely monitor and configure the FMPG Careers Portal, roles, certificates, and applicant details
            </p>
          </div>
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stat Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="glass-panel border-border/40 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-y-0 right-0 w-1 bg-primary" />
                <CardContent className="p-6">
                  <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">Total Candidates</p>
                  <h3 className="text-3xl font-black mt-1 text-foreground">{metrics.totalCandidates}</h3>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Submitted applications</p>
                </CardContent>
              </Card>

              <Card className="glass-panel border-border/40 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-y-0 right-0 w-1 bg-amber-500" />
                <CardContent className="p-6">
                  <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">Active Openings</p>
                  <h3 className="text-3xl font-black mt-1 text-foreground">{metrics.activeOpenings}</h3>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Live recruiting jobs</p>
                </CardContent>
              </Card>

              <Card className="glass-panel border-border/40 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-y-0 right-0 w-1 bg-blue-500" />
                <CardContent className="p-6">
                  <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">Pending Contracts</p>
                  <h3 className="text-3xl font-black mt-1 text-foreground">{metrics.pendingContracts}</h3>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Acceptance agreements</p>
                </CardContent>
              </Card>

              <Card className="glass-panel border-border/40 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-y-0 right-0 w-1 bg-emerald-500" />
                <CardContent className="p-6">
                  <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">Active Employees</p>
                  <h3 className="text-3xl font-black mt-1 text-foreground">{metrics.totalEmployees}</h3>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Active system personnel</p>
                </CardContent>
              </Card>
            </div>

            {/* Middle Layout (Chart + Recent Activity) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Custom SVG-based Glassmorphic Chart */}
              <Card className="glass-panel border-border/40 col-span-12 md:col-span-7 shadow-sm overflow-hidden">
                <CardHeader className="py-5 bg-muted/10 border-b border-border/20">
                  <CardTitle className="text-sm font-black text-foreground">Application Pipeline Status</CardTitle>
                </CardHeader>
                <CardContent className="p-6 flex flex-col items-center">
                  {/* Clean Animated SVG Bar Chart */}
                  <div className="w-full h-48 flex justify-around items-end pt-4 pb-2 border-b border-border/30">
                    {Object.entries(statusCounts).map(([status, count]: [string, any]) => {
                      const max = Math.max(...Object.values(statusCounts) as number[], 1);
                      const heightPercent = Math.max(10, Math.min(100, (count / max) * 100));
                      const colors: Record<string, string> = {
                        pending: "from-yellow-400 to-yellow-600 bg-yellow-500",
                        reviewing: "from-blue-400 to-blue-600 bg-blue-500",
                        shortlisted: "from-indigo-400 to-indigo-600 bg-emerald-600",
                        rejected: "from-red-400 to-red-600 bg-red-500",
                        offered: "from-emerald-400 to-emerald-600 bg-emerald-500",
                        hired: "from-teal-400 to-teal-600 bg-teal-500"
                      };
                      return (
                        <div key={status} className="flex flex-col items-center group relative w-12">
                          <span className="text-[10px] font-black text-foreground mb-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5">
                            {count}
                          </span>
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-8 rounded-t-lg bg-gradient-to-t ${colors[status]} shadow-md hover:brightness-110 transition-all duration-500 cursor-pointer`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="w-full flex justify-around text-[9px] font-black uppercase text-muted-foreground mt-3 select-none">
                    {Object.keys(statusCounts).map((status) => (
                      <span key={status} className="w-12 text-center break-words">{status}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Audit Feed */}
              <Card className="glass-panel border-border/40 col-span-12 md:col-span-5 shadow-sm overflow-hidden flex flex-col h-full max-h-[300px]">
                <CardHeader className="py-5 bg-muted/10 border-b border-border/20">
                  <CardTitle className="text-sm font-black text-foreground">Recent Activity Logs</CardTitle>
                </CardHeader>
                <CardContent className="p-4 overflow-y-auto space-y-3 flex-1 scrollbar-thin">
                  {recentLogs.map((log: any) => (
                    <div key={log._id} className="flex items-start gap-2.5 text-[10px] leading-tight pb-2 border-b border-border/10 last:border-0">
                      <div className="h-5 w-5 shrink-0 rounded bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {log.action?.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-foreground">
                          {log.actor?.name || "System"} <span className="text-muted-foreground font-normal">({log.actor?.role || "core"})</span>
                        </p>
                        <p className="text-muted-foreground/90 mt-0.5">
                          Performed <strong className="text-primary">{log.action}</strong> on <span className="font-semibold text-foreground">{log.resourceEntity}</span>
                        </p>
                      </div>
                      <span className="text-[9px] text-muted-foreground/60 shrink-0 font-medium">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* JOB OPENINGS TAB */}
        {activeTab === "jobs" && (
          <div className="space-y-6">
            {!isEditingJob ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Available Careers Openings</h3>
                  <Button
                    onClick={() => {
                      setEditingJobId(null);
                      setJobForm({
                        title: "",
                        company: "FMPG",
                        location: "",
                        type: "Full-time",
                        salary: "",
                        department: "",
                        position: "",
                        description: "",
                        requirements: "",
                        responsibilities: "",
                        isActive: true,
                        hrContactName: "",
                        hrContactEmail: "",
                        hrContactPhone: "",
                        questions: []
                      });
                      setIsEditingJob(true);
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" /> Post New Job
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {jobs.map((job) => (
                    <Card key={job._id} className="glass-panel border-border/40 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                      <CardHeader className="bg-muted/10 border-b border-border/20 py-4 flex flex-row justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-foreground">{job.title}</h4>
                            <Badge variant={job.isActive ? "default" : "secondary"} className="text-[9px] font-black">
                              {job.isActive ? "Active" : "Archived"}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">{job.company} • {job.location}</p>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-[10px] font-medium text-muted-foreground">
                          <div>
                            <span className="font-bold text-foreground">Type:</span> {job.type}
                          </div>
                          <div>
                            <span className="font-bold text-foreground">Salary:</span> {job.salary}
                          </div>
                          <div>
                            <span className="font-bold text-foreground">Dept:</span> {job.department || "General"}
                          </div>
                          <div>
                            <span className="font-bold text-foreground">Questions:</span> {job.questions?.length || 0}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[10px] font-bold py-1.5 flex-1"
                            onClick={() => {
                              setEditingJobId(job._id);
                              setJobForm({
                                title: job.title,
                                company: job.company || "FMPG",
                                location: job.location || "",
                                type: job.type || "Full-time",
                                salary: job.salary || "",
                                department: job.department || "",
                                position: job.position || "",
                                description: job.description || "",
                                requirements: Array.isArray(job.requirements) ? job.requirements.join("\n") : job.requirements || "",
                                responsibilities: Array.isArray(job.responsibilities) ? job.responsibilities.join("\n") : job.responsibilities || "",
                                isActive: job.isActive,
                                hrContactName: job.hrContact?.name || "",
                                hrContactEmail: job.hrContact?.email || "",
                                hrContactPhone: job.hrContact?.phone || "",
                                questions: job.questions || []
                              });
                              setIsEditingJob(true);
                            }}
                          >
                            Edit Details
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-[10px] font-bold py-1.5 flex-1"
                            onClick={() => {
                              setSelectedJobForApps(job._id);
                              setActiveTab("applicants");
                            }}
                          >
                            Applications
                          </Button>
                          <Button
                            size="sm"
                            className="text-[10px] font-bold py-1.5 flex-1"
                            onClick={() => {
                              setSelectedJobForAI(job._id);
                              setActiveTab("applicants"); // direct to pipeline with AI matches loaded!
                            }}
                          >
                            AI Recommendations
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              // Job Form Editor Panel
              <Card className="glass-panel border-border/40 shadow-sm overflow-hidden">
                <CardHeader className="py-5 bg-muted/10 border-b border-border/20">
                  <CardTitle className="text-sm font-black text-foreground">
                    {editingJobId ? "Edit Career Post" : "Draft New Career Opening"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <form onSubmit={handleSaveJob} className="space-y-6 text-left">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground pl-1">Job Title</label>
                        <Input
                          type="text"
                          value={jobForm.title}
                          onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                          required
                          placeholder="e.g. Senior Lead HR Associate"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground pl-1">Location</label>
                        <Input
                          type="text"
                          value={jobForm.location}
                          onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                          placeholder="e.g. Remote / Chandigarh / Hoshiarpur"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground pl-1">Department</label>
                        <Input
                          type="text"
                          value={jobForm.department}
                          onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
                          placeholder="e.g. Management, HR, Operations"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground pl-1">Employment Type</label>
                        <select
                          className="w-full px-3 py-2 bg-background border border-border/40 rounded-xl text-xs font-semibold"
                          value={jobForm.type}
                          onChange={(e) => setJobForm({ ...jobForm, type: e.target.value })}
                        >
                          <option value="Full-time">Full-time</option>
                          <option value="Part-time">Part-time</option>
                          <option value="Contract">Contract</option>
                          <option value="Internship">Internship</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground pl-1">Salary Offer Range</label>
                        <Input
                          type="text"
                          value={jobForm.salary}
                          onChange={(e) => setJobForm({ ...jobForm, salary: e.target.value })}
                          placeholder="e.g. ₹35,000 - ₹50,000 / month"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black uppercase text-muted-foreground pl-1">Detailed Description</label>
                      <textarea
                        rows={4}
                        className="w-full px-3 py-2 bg-background border border-border/40 rounded-xl text-xs font-medium focus:ring-1 focus:ring-primary"
                        value={jobForm.description}
                        onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                        required
                        placeholder="Write a clear narrative of roles and goals..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground pl-1">Requirements (one per line)</label>
                        <textarea
                          rows={4}
                          className="w-full px-3 py-2 bg-background border border-border/40 rounded-xl text-xs font-medium focus:ring-1 focus:ring-primary"
                          value={jobForm.requirements}
                          onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })}
                          placeholder="e.g. 3 years HR experience..."
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground pl-1">Responsibilities (one per line)</label>
                        <textarea
                          rows={4}
                          className="w-full px-3 py-2 bg-background border border-border/40 rounded-xl text-xs font-medium focus:ring-1 focus:ring-primary"
                          value={jobForm.responsibilities}
                          onChange={(e) => setJobForm({ ...jobForm, responsibilities: e.target.value })}
                          placeholder="e.g. Host weekly candidate reviews..."
                        />
                      </div>
                    </div>

                    {/* HR Contact fields */}
                    <div className="border-t border-border/20 pt-4 space-y-4">
                      <h4 className="text-xs font-black uppercase text-foreground">HR Signatory Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-black uppercase text-muted-foreground pl-1">Contact Name</label>
                          <Input
                            type="text"
                            value={jobForm.hrContactName}
                            onChange={(e) => setJobForm({ ...jobForm, hrContactName: e.target.value })}
                            placeholder="John Doe"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-black uppercase text-muted-foreground pl-1">Contact Email</label>
                          <Input
                            type="email"
                            value={jobForm.hrContactEmail}
                            onChange={(e) => setJobForm({ ...jobForm, hrContactEmail: e.target.value })}
                            placeholder="hr@fmpg.in"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-black uppercase text-muted-foreground pl-1">Contact Phone</label>
                          <Input
                            type="tel"
                            value={jobForm.hrContactPhone}
                            onChange={(e) => setJobForm({ ...jobForm, hrContactPhone: e.target.value })}
                            placeholder="10-digit number"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Custom Screening Questions */}
                    <div className="border-t border-border/20 pt-4 space-y-4">
                      <h4 className="text-xs font-black uppercase text-foreground">Screening Evaluation Questions</h4>
                      <div className="flex flex-col md:flex-row gap-3 items-end bg-muted/20 p-4 rounded-2xl border border-border/40">
                        <div className="flex-1 flex flex-col gap-1.5">
                          <label className="text-[9px] font-black uppercase text-muted-foreground">Question Text</label>
                          <Input
                            type="text"
                            value={newQuestionText}
                            onChange={(e) => setNewQuestionText(e.target.value)}
                            placeholder="Why are you a good fit for this role?"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5 w-32">
                          <label className="text-[9px] font-black uppercase text-muted-foreground">Answer Type</label>
                          <select
                            className="px-3 py-2 bg-background border border-border/40 rounded-xl text-xs font-semibold"
                            value={newQuestionType}
                            onChange={(e) => setNewQuestionType(e.target.value)}
                          >
                            <option value="text">Paragraph Text</option>
                            <option value="boolean">Yes/No choice</option>
                          </select>
                        </div>
                        <Button type="button" onClick={handleAddQuestion}>Add Question</Button>
                      </div>

                      <div className="space-y-2 mt-2">
                        {jobForm.questions.map((q, idx) => (
                          <div key={idx} className="flex justify-between items-center px-4 py-2 bg-muted/40 rounded-xl border border-border/10 text-xs font-semibold">
                            <span>Q{idx + 1}: {q.questionText} <span className="text-[10px] text-muted-foreground">({q.type})</span></span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive font-black"
                              onClick={() => handleRemoveQuestion(idx)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-border/20">
                      <Button variant="outline" type="button" onClick={() => setIsEditingJob(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingJobId ? "Save Changes" : "Post Opening"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* APPLICANT PIPELINE TAB */}
        {activeTab === "applicants" && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-3 items-center">
                <label className="text-xs font-black uppercase text-muted-foreground">Focus Job Posting:</label>
                <select
                  className="px-3 py-2 bg-card border border-border/40 rounded-xl text-xs font-semibold shadow-sm"
                  value={selectedJobForApps || ""}
                  onChange={(e) => {
                    setSelectedJobForApps(e.target.value || null);
                    setSelectedJobForAI(null); // clear AI tab choice
                    setAiMatches([]);
                  }}
                >
                  <option value="">-- Choose Job Opening --</option>
                  {jobs.map((job) => (
                    <option key={job._id} value={job._id}>{job.title}</option>
                  ))}
                </select>
              </div>

              {selectedJobForApps && (
                <div className="flex gap-2">
                  <Button
                    variant={selectedJobForAI === selectedJobForApps ? "default" : "outline"}
                    size="sm"
                    className="text-xs font-bold"
                    onClick={() => {
                      if (selectedJobForAI === selectedJobForApps) {
                        setSelectedJobForAI(null);
                        setAiMatches([]);
                      } else {
                        setSelectedJobForAI(selectedJobForApps);
                      }
                    }}
                  >
                    Recommend Candidates (AI Matching)
                  </Button>
                </div>
              )}
            </div>

            {/* AI Recommendation Engine Display */}
            {selectedJobForAI && (
              <Card className="glass-panel border-emerald-500/30 bg-emerald-950/5 shadow-md overflow-hidden animate-in fade-in duration-300">
                <CardHeader className="py-4 bg-emerald-950/10 border-b border-emerald-500/20">
                  <CardTitle className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Award className="h-4 w-4" /> Heuristic Profile Recommendation Engine
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {loadingAI ? (
                    <div className="py-8 text-center flex items-center justify-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                      <span className="text-xs text-muted-foreground font-semibold">Running heuristic parsing comparisons...</span>
                    </div>
                  ) : aiMatches.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground font-semibold">
                      No applications submitted for this opening yet to compare.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {aiMatches.map((match) => (
                        <div
                          key={match.applicationId}
                          className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-card border border-border/40 rounded-2xl gap-4 hover:border-emerald-500/20 transition-colors"
                        >
                          <div className="space-y-1.5 text-left">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-foreground">{match.fullName}</h4>
                              <Badge className="text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Match Score: {match.score}%
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-medium">{match.email} • {match.phone}</p>
                            <div className="space-y-0.5 pl-2 border-l border-emerald-500/30">
                              {match.reasons.map((r: string, idx: number) => (
                                <p key={idx} className="text-[9px] text-muted-foreground/80 flex items-center gap-1">
                                  <span className="h-1 w-1 rounded-full bg-emerald-500 shrink-0" /> {r}
                                </p>
                              ))}
                            </div>
                          </div>

                          <div className="flex gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[10px] font-bold py-1 px-3"
                              onClick={() => router.push(`/admin/applications/${match.applicationId}`)}
                            >
                              Assessment Center
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* General Job Applicant Pipeline */}
            {selectedJobForApps && !selectedJobForAI && (
              <Card className="glass-panel border-border/40 shadow-sm overflow-hidden">
                <CardHeader className="py-4 bg-muted/10 border-b border-border/20 text-left">
                  <CardTitle className="text-xs font-black uppercase text-muted-foreground">Applications In Pipeline</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingApps ? (
                    <div className="py-12 text-center flex justify-center items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground font-semibold">Loading applicants details...</span>
                    </div>
                  ) : jobApplications.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground font-bold">
                      No applications currently in pipeline for this job opening.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/20">
                      {jobApplications.map((app) => (
                        <div key={app._id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-muted/10 transition-all text-left">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-foreground">{app.fullName}</h4>
                              <Badge className="text-[9px] font-black capitalize">{app.status}</Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-3">
                              <span className="flex items-center gap-0.5"><Mail className="h-3 w-3 text-primary" /> {app.email}</span>
                              <span className="flex items-center gap-0.5"><Phone className="h-3 w-3 text-primary" /> {app.phone}</span>
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="text-[10px] font-black"
                              onClick={() => router.push(`/admin/applications/${app._id}`)}
                            >
                              Go to Assessment Center <ChevronRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!selectedJobForApps && (
              <div className="py-16 text-center text-xs text-muted-foreground font-bold glass-panel border border-border/40 rounded-3xl">
                Please select a job opening from the dropdown to monitor live applicant pipeline entries.
              </div>
            )}
          </div>
        )}

        {/* EMPLOYEE DIRECTORY TAB */}
        {activeTab === "employees" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Employee Statistics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-card border border-border/40 p-4 rounded-2xl text-left">
                <p className="text-[9px] uppercase font-black tracking-wider text-muted-foreground">Total Staff</p>
                <h4 className="text-2xl font-black mt-0.5 text-foreground">
                  {employeeStats.totalEmployees + employeeStats.totalAdmins + employeeStats.totalSuperAdmins}
                </h4>
              </div>
              <div className="bg-card border border-border/40 p-4 rounded-2xl text-left">
                <p className="text-[9px] uppercase font-black tracking-wider text-muted-foreground">Active Staff</p>
                <h4 className="text-2xl font-black mt-0.5 text-foreground">{employeeStats.activeStaff}</h4>
              </div>
              <div className="bg-card border border-border/40 p-4 rounded-2xl text-left">
                <p className="text-[9px] uppercase font-black tracking-wider text-muted-foreground">Suspended</p>
                <h4 className="text-2xl font-black mt-0.5 text-foreground">{employeeStats.suspendedAccounts}</h4>
              </div>
              <div className="bg-card border border-border/40 p-4 rounded-2xl text-left">
                <p className="text-[9px] uppercase font-black tracking-wider text-muted-foreground">Former Employees</p>
                <h4 className="text-2xl font-black mt-0.5 text-foreground">{employeeStats.formerEmployees}</h4>
              </div>
            </div>

            {/* Filter tools */}
            <div className="flex flex-wrap gap-4 items-center justify-between bg-card p-4 rounded-2xl border border-border/40">
              <div className="flex gap-2 flex-1 max-w-sm">
                <Input
                  type="text"
                  placeholder="Search employees..."
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="flex gap-3 items-center">
                <select
                  className="px-3 py-2 bg-background border border-border/40 rounded-xl text-xs font-semibold"
                  value={empRoleFilter}
                  onChange={(e) => setEmpRoleFilter(e.target.value)}
                >
                  <option value="">All Roles</option>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                  <option value="super-admin">Super Admin</option>
                </select>

                <select
                  className="px-3 py-2 bg-background border border-border/40 rounded-xl text-xs font-semibold"
                  value={empStatusFilter}
                  onChange={(e) => setEmpStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="former">Former</option>
                </select>

                <Button
                  onClick={() => setShowBulkModal(true)}
                  variant="outline"
                  size="sm"
                  className="text-xs font-bold"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1 text-primary" /> Bulk CSV Upload
                </Button>
              </div>
            </div>

            {/* Employees List */}
            <Card className="glass-panel border-border/40 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {empLoading ? (
                  <div className="py-12 text-center flex justify-center items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground font-semibold">Loading personnel registry...</span>
                  </div>
                ) : employees.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground font-bold">
                    No active staff matching the specified filters.
                  </div>
                ) : (
                  <div className="divide-y divide-border/20">
                    {employees.map((emp: any) => (
                      <div key={emp._id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-muted/10 transition-all text-left">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-foreground">{emp.name}</h4>
                            <Badge variant="outline" className="text-[9px] font-black uppercase">{emp.role}</Badge>
                            <Badge className="text-[9px] font-black uppercase">{emp.status || "active"}</Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-semibold flex flex-wrap gap-x-4">
                            <span>Email: {emp.email}</span>
                            {emp.phoneNumber && <span>Phone: {emp.phoneNumber}</span>}
                            {emp.employeeId && <span className="text-primary font-bold">ID: {emp.employeeId}</span>}
                          </p>
                          <p className="text-[10px] text-muted-foreground/80 font-medium">
                            Dept: {emp.department || "General Administration"} • Pos: {emp.position || "Staff"} ({emp.positionLevel || "Junior"})
                          </p>
                        </div>

                        <div className="flex gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[10px] font-bold"
                            onClick={() => handleSelectEmpForEdit(emp)}
                          >
                            <Settings className="h-3.5 w-3.5 mr-1" /> Access Controls
                          </Button>
                          {emp.status !== "former" && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="text-[10px] font-bold"
                              onClick={() => handleTerminate(emp._id, emp.name)}
                            >
                              Conclude Contract
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Edit Access Controls Dialog */}
            {selectedEmp && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-card border border-border/40 rounded-3xl w-full max-w-lg p-8 shadow-xl overflow-hidden glass-panel max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h4 className="font-heading text-lg font-black text-foreground">Personnel Controls: {selectedEmp.name}</h4>
                      <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Configure role permissions, position parameters, and system authority</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedEmp(null)}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="space-y-4 text-left">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground">Portal Role</label>
                        <select
                          className="px-3 py-2 bg-background border border-border/40 rounded-xl text-xs font-semibold"
                          value={empForm.role}
                          onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })}
                        >
                          <option value="employee">Employee</option>
                          <option value="admin">Administrator</option>
                          <option value="super-admin">Super Admin</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground">Account Status</label>
                        <select
                          className="px-3 py-2 bg-background border border-border/40 rounded-xl text-xs font-semibold"
                          value={empForm.status}
                          onChange={(e) => setEmpForm({ ...empForm, status: e.target.value })}
                        >
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                          <option value="former">Former</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground">Department</label>
                        <Input
                          type="text"
                          value={empForm.department}
                          onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground">Position</label>
                        <Input
                          type="text"
                          value={empForm.position}
                          onChange={(e) => setEmpForm({ ...empForm, position: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground">Level</label>
                        <select
                          className="px-3 py-2 bg-background border border-border/40 rounded-xl text-xs font-semibold"
                          value={empForm.positionLevel}
                          onChange={(e) => setEmpForm({ ...empForm, positionLevel: e.target.value })}
                        >
                          <option value="Junior">Junior</option>
                          <option value="Senior">Senior</option>
                          <option value="Lead">Lead</option>
                          <option value="Manager">Manager</option>
                          <option value="Director">Director</option>
                        </select>
                      </div>
                    </div>

                    {/* Permissions checklist */}
                    <div className="border-t border-border/20 pt-4 space-y-3">
                      <label className="text-[10px] font-black uppercase text-muted-foreground">Granular Administrative Permissions</label>
                      <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                        {Object.keys(empForm.permissions).map((permKey) => (
                          <label key={permKey} className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={(empForm.permissions as any)[permKey]}
                              onChange={(e) =>
                                setEmpForm({
                                  ...empForm,
                                  permissions: {
                                    ...empForm.permissions,
                                    [permKey]: e.target.checked
                                  }
                                })
                              }
                              className="rounded border-border/40 text-primary focus:ring-primary h-4 w-4"
                            />
                            <span className="capitalize">{permKey.replace(/([A-Z])/g, " $1")}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-border/20">
                      <Button variant="outline" onClick={() => setSelectedEmp(null)}>
                        Cancel
                      </Button>
                      <Button onClick={handleUpdateEmployee}>
                        Save Privileges
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CSV Bulk Modal */}
            {showBulkModal && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-card border border-border/40 rounded-3xl w-full max-w-xl p-8 shadow-xl glass-panel">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-heading text-lg font-black text-foreground">Bulk CSV Employee Upload</h4>
                      <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Paste CSV rows below. Must include email, name, role, department, position headers</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowBulkModal(false)}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-muted/30 p-3 rounded-xl border border-border/10 text-left text-[9px] font-mono text-muted-foreground leading-tight select-all">
                      name,email,phoneNumber,role,department,position<br />
                      John Doe,john@example.com,9876543210,employee,Engineering,SDE<br />
                      Jane Smith,jane@example.com,9876543211,admin,HR,Manager
                    </div>

                    <textarea
                      rows={8}
                      className="w-full p-4 bg-background border border-border/40 rounded-2xl text-xs font-mono focus:ring-1 focus:ring-primary text-foreground"
                      placeholder="Paste CSV contents..."
                      value={bulkCsvText}
                      onChange={(e) => setBulkCsvText(e.target.value)}
                    />

                    <div className="flex justify-end gap-3 pt-4 border-t border-border/20">
                      <Button variant="outline" onClick={() => setShowBulkModal(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleBulkUpload} disabled={isUploadingBulk}>
                        {isUploadingBulk ? "Processing..." : "Import Employee Batch"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* REFERRALS TAB */}
        {activeTab === "referrals" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="glass-panel border-border/40 shadow-sm overflow-hidden">
              <CardHeader className="py-4 bg-muted/10 border-b border-border/20 text-left">
                <CardTitle className="text-xs font-black uppercase text-muted-foreground">Trusted Employee Referrals Feed</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {recommendations.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground font-bold">
                    No active employee referral recommendations submitted yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border/20">
                    {recommendations.map((rec: any) => (
                      <div key={rec._id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-muted/10 transition-all text-left">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-foreground">Candidate: {rec.recommendedUserName}</h4>
                            <Badge variant="outline" className="text-[9px] font-black uppercase">{rec.status}</Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-semibold">
                            Referred email: {rec.recommendedUserEmail} • Job Opportunity: {rec.jobId?.title || "FMPG Openings"}
                          </p>
                          <div className="bg-muted/20 border border-border/10 p-3 rounded-xl max-w-xl text-[10px] text-muted-foreground leading-normal mt-2">
                            <strong className="text-foreground">Message from Referrer ({rec.recommender?.name || "Employee"} - {rec.recommender?.employeeId}):</strong><br />
                            "{rec.recommendationMessage || "Highly skilled candidate recommended for review"}"
                          </div>
                        </div>

                        {rec.status === "pending" && (
                          <div className="flex gap-2 shrink-0 pt-2 md:pt-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50"
                              onClick={() => handleUpdateRecStatus(rec._id, "selected")}
                            >
                              Accept Referral
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[10px] font-bold text-destructive hover:bg-red-50"
                              onClick={() => handleUpdateRecStatus(rec._id, "rejected")}
                            >
                              Decline
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* SECURITY AUDIT TAB */}
        {activeTab === "audit" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="glass-panel border-border/40 shadow-sm overflow-hidden">
              <CardHeader className="py-4 bg-muted/10 border-b border-border/20 text-left">
                <CardTitle className="text-xs font-black uppercase text-muted-foreground">Complete System Operations Audit Trail</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {auditLogs.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground font-bold">
                    No operations logs stored in security audit trace yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border/10">
                    {auditLogs.map((log: any) => (
                      <div key={log._id} className="p-4 flex justify-between items-start text-xs hover:bg-muted/10 transition-all text-left">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-muted-foreground font-bold">[{log._id.slice(-6)}]</span>
                            <strong className="text-primary font-black uppercase">{log.action}</strong>
                            <span className="font-bold text-foreground">on {log.resourceEntity}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-medium">
                            Actor: {log.actor?.name || "System Operations"} ({log.actor?.email || "core"}) • {log.actor?.role}
                          </p>
                          {log.changes && (
                            <div className="text-[9px] font-mono text-muted-foreground mt-1 select-all bg-muted/20 p-2 rounded border border-border/10">
                              Changes: {JSON.stringify(log.changes)}
                            </div>
                          )}
                        </div>

                        <span className="text-[10px] text-muted-foreground/60 shrink-0 font-semibold pl-2">
                          {new Date(log.createdAt).toLocaleString("en-GB")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
