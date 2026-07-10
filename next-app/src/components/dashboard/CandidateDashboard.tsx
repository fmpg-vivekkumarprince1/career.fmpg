"use client";

import React from "react";
import Link from "next/link";
import { Briefcase, MapPin, Calendar, FileText, CheckCircle2, ChevronRight, Download, Award, AlertCircle, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { formatCurrencyValue } from "@/lib/currencyFormatter";

export default function CandidateDashboard({ applications, user }: { applications: any[]; user: any }) {
  
  // Custom stepper utility for candidate application status tracking
  const getStatusStep = (status: string) => {
    switch (status) {
      case "pending": return 1;
      case "reviewing": return 2;
      case "shortlisted": return 3;
      case "offered": return 4;
      case "hired": return 5;
      default: return 1;
    }
  };

  const steps = [
    { label: "Applied", step: 1 },
    { label: "Reviewing", step: 2 },
    { label: "Shortlisted", step: 3 },
    { label: "Offered", step: 4 },
    { label: "Onboarded", step: 5 },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 mt-24 text-left">
      

      {/* 2. Main Applications Grid */}
      <div className="flex flex-col gap-6">
        <h2 className="font-heading text-xl font-extrabold text-foreground pl-2 flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" /> Active Job Applications ({applications.length})
        </h2>

        {applications.length > 0 ? (
          <div className="flex flex-col gap-6">
            {applications.map((app) => {
              const currentStep = getStatusStep(app.status);
              const isOffered = app.status === "offered";
              const isHired = app.status === "hired";
              const isRejected = app.status === "rejected";

              return (
                <Card key={app._id} className="rounded-3xl border border-border/40 shadow-sm hover:shadow-md transition-all overflow-hidden glass-panel">
                  
                  {/* Job and Meta details */}
                  <CardHeader className="bg-muted/10 border-b border-border/20 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-col gap-1.5 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-primary tracking-widest px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                          {app.jobId?.department || "General"}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" /> Applied {new Date(app.createdAt).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                      <CardTitle className="font-heading text-lg font-bold mt-1.5 text-foreground">
                        {app.jobId?.title || "Role Opening"}
                      </CardTitle>
                      <CardDescription className="text-xs font-semibold text-primary">
                        {app.jobId?.company || "FMPG"}
                      </CardDescription>
                    </div>

                    {/* Badge Status */}
                    <div className="shrink-0">
                      <Badge
                        variant={
                          isRejected
                            ? "destructive"
                            : isHired
                              ? "success"
                              : isOffered
                                ? "secondary"
                                : "default"
                        }
                        className="text-[10px] font-extrabold"
                      >
                        {app.status}
                      </Badge>
                    </div>
                  </CardHeader>

                  {/* Onboarding and Status Stepper details */}
                  <CardContent className="p-6 flex flex-col gap-8">
                    
                    {/* Visual Milestones Stepper */}
                    {!isRejected && (
                      <div className="w-full py-4 px-2">
                        <div className="flex items-center justify-between relative">
                          {/* Background connector line */}
                          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-muted -translate-y-1/2 z-0" />
                          
                          {/* Active filled connector */}
                          <div
                            className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 z-0 transition-all duration-500"
                            style={{
                              width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
                            }}
                          />

                          {steps.map((st) => {
                            const active = st.step <= currentStep;
                            return (
                              <div key={st.step} className="flex flex-col items-center gap-2 z-10">
                                <div
                                  className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black border transition-all duration-300 ${
                                    active
                                      ? "bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/20"
                                      : "bg-card border-border/80 text-muted-foreground"
                                  }`}
                                >
                                  {active ? "✓" : st.step}
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                  active ? "text-primary font-black" : "text-muted-foreground"
                                }`}>
                                  {st.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Rejected fallback block */}
                    {isRejected && (
                      <div className="p-5 rounded-2xl bg-destructive/5 border border-destructive/20 flex items-start gap-3.5 text-xs text-destructive font-semibold">
                        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-sm">Application Update</h4>
                          <p className="mt-1 leading-relaxed text-muted-foreground">
                            Thank you for your interest in FMPG. After careful review, our hiring team has decided not to proceed with your application at this time. We encourage you to check back for future openings!
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Offer letter acceptance banner */}
                    {isOffered && app.offerLetterId && (
                      <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-pulse">
                        <div className="flex items-start gap-3 text-left">
                          <Award className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-heading text-sm font-extrabold text-foreground">Congratulations! You have been issued an employment offer.</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">Please review, sign, and submit the legal contract before expiration.</p>
                          </div>
                        </div>
                        <Button
                          asChild
                          className="w-full sm:w-auto bg-primary text-white hover:bg-primary-hover shadow-md shrink-0 flex items-center gap-1.5"
                        >
                          <Link href={`/contract/${app.offerLetterId._id}`}>
                            View & Sign Contract <ChevronRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    )}

                    {/* Fully Onboarded/Hired block */}
                    {isHired && app.offerLetterId && (
                      <div className="p-6 rounded-2xl bg-slate-50 text-slate-900 border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-start gap-3 text-left">
                          <FileCheck className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-heading text-sm font-extrabold text-slate-900">Welcome aboard the FMPG family!</h4>
                            <p className="text-xs text-slate-500 mt-0.5">Your signed employment contract has been approved. Download your documentation below.</p>
                          </div>
                        </div>
                        <a
                          href={`/api/certificates/pdf?id=${app.offerLetterId._id}`} // mock endpoint for pdf downloads
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full sm:w-auto h-11 px-5 rounded-2xl bg-primary text-white hover:bg-primary-hover text-xs font-bold uppercase tracking-wider shadow-md shrink-0 flex items-center justify-center gap-1.5 transition-all duration-300"
                        >
                          <Download className="h-4 w-4" /> Download Signed PDF
                        </a>
                      </div>
                    )}

                    {/* Dynamic Questionnaire Responses overview */}
                    {app.questionAnswers && app.questionAnswers.length > 0 && (
                      <div className="flex flex-col gap-3 pt-4 border-t border-border/25">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Your Answers</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {app.questionAnswers.map((qa: any, idx: number) => (
                            <div key={idx} className="p-3.5 rounded-xl bg-muted/20 border border-border/30 text-xs">
                              <p className="font-bold text-foreground truncate">{qa.questionText}</p>
                              <p className="mt-1 text-muted-foreground font-semibold leading-relaxed">
                                {qa.questionType === "rating" 
                                  ? `Score: ${qa.answer} ★` 
                                  : Array.isArray(qa.answer) 
                                    ? qa.answer.join(", ") 
                                    : qa.answer || "No response"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center flex flex-col items-center gap-3 bg-muted/10 rounded-[32px] border border-border/40">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground text-2xl">
              📂
            </div>
            <h3 className="font-heading text-lg font-bold text-foreground">No applications found</h3>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
              You haven't submitted any job applications yet. Visit our openings page and launch your next-gen career.
            </p>
            <Button asChild className="mt-2.5">
              <Link href="/jobs">Explore Career Openings</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
