"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { verifyEmailAction, resendOTPAction, loginAction } from "@/app/actions/auth";
import { toast } from "sonner";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const qEmail = searchParams.get("email") || "";
    const qP = searchParams.get("p") || "";
    
    if (qEmail) {
      setEmail(qEmail);
    } else {
      toast.error("No email provided for verification. Redirecting to login.");
      router.push("/login");
    }

    if (qP) {
      try {
        const decoded = Buffer.from(qP, "base64").toString("utf-8");
        setPassword(decoded);
      } catch (err) {
        // Safe fail
      }
    }
  }, [searchParams, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, ""); // Allow only digits
    if (val.length <= 6) {
      setOtp(val);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      return toast.error("OTP is required");
    }
    if (otp.length !== 6) {
      return toast.error("OTP must be exactly 6 digits");
    }

    try {
      setIsLoading(true);
      const res = await verifyEmailAction(email, otp);

      if (res.success) {
        toast.success(res.message);

        // Auto login if we have a temporary password
        if (password) {
          try {
            const loginRes = await loginAction({ email, password });
            if (loginRes.success) {
              toast.success("Successfully authenticated and logged in!");
              router.push("/dashboard");
              router.refresh();
              return;
            }
          } catch (err) {
            console.error("Auto login error after verify:", err);
          }
        }
        
        // Fallback to login redirect
        router.push("/login");
      } else {
        toast.error(res.message || "Email verification failed");
      }
    } catch (err) {
      toast.error("An error occurred during verification. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setIsResending(true);
      const res = await resendOTPAction(email);
      if (res.success) {
        toast.success(res.message || "A new verification code has been sent!");
        setOtp("");
      } else {
        toast.error(res.message || "Failed to resend code");
      }
    } catch (err) {
      toast.error("Failed to resend verification code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className="rounded-3xl border border-border/40 shadow-xl overflow-hidden glass-panel">
      <CardHeader className="bg-muted/10 border-b border-border/20 py-6 text-center">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-3">
          <ShieldCheck className="h-6 w-6 text-primary animate-pulse" />
        </div>
        <CardTitle className="font-heading text-xl font-black text-foreground">Verify Your Email</CardTitle>
        <CardDescription className="text-xs text-muted-foreground mt-0.5 max-w-[280px] mx-auto">
          We've sent a 6-digit verification code to
          <span className="block text-primary font-bold break-all mt-1">{email}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="p-8">
        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex flex-col gap-2 text-center">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">
              Enter Verification Code
            </label>
            <Input
              type="text"
              value={otp}
              onChange={handleChange}
              placeholder="000000"
              maxLength={6}
              autoComplete="one-time-code"
              className="w-full px-4 py-6 bg-background border border-border/60 rounded-xl text-foreground placeholder-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-center text-3xl tracking-[0.5em] font-mono font-bold"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading || !email}
            className="w-full flex items-center justify-center gap-1.5"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Verify Email
          </Button>
        </form>
      </CardContent>

      <CardFooter className="bg-muted/10 border-t border-border/20 py-5 justify-center text-xs text-muted-foreground font-semibold flex flex-col gap-3">
        <div className="text-center">
          <span className="text-muted-foreground/75">Didn't receive the code?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || !email}
            className="text-primary hover:underline ml-1 font-bold disabled:opacity-50"
          >
            {isResending ? "Sending..." : "Resend code"}
          </button>
        </div>
        <Link href="/login" className="text-muted-foreground/60 hover:text-foreground hover:underline transition-colors font-medium">
          Back to Login
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-muted/20 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-grid-pattern relative">
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent pointer-events-none" />

      {/* Brand logo header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 text-center mb-6">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <img 
            src="/fmpg-logo.png" 
            alt="FMPG Logo" 
            className="h-10 w-auto shrink-0 group-hover:scale-105 transition-transform duration-300"
          />
          <span className="font-heading text-2xl font-black tracking-widest text-foreground uppercase">
            FM<span className="text-primary">PG</span>
          </span>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <Suspense fallback={
          <Card className="rounded-3xl border border-border/40 shadow-xl overflow-hidden glass-panel p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-2 text-xs text-muted-foreground font-semibold">Loading verification details...</p>
          </Card>
        }>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
