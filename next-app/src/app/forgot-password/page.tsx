"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Loader2, CheckCircle2, Lock, KeyRound, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { forgotPasswordAction, resetPasswordAction } from "@/app/actions/auth";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP + New Password
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      return toast.error("Please enter a valid email address");
    }

    try {
      setIsLoading(true);
      const res = await forgotPasswordAction(email);

      if (res.success) {
        toast.success(res.message);
        setStep(2);
      } else {
        toast.error(res.message || "Failed to initiate password reset");
      }
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.length !== 6) {
      return toast.error("Please enter the 6-digit OTP code");
    }
    if (!newPassword || newPassword.length < 6) {
      return toast.error("New password must be at least 6 characters");
    }
    if (newPassword !== confirmPassword) {
      return toast.error("Passwords do not match");
    }

    try {
      setIsLoading(true);
      const res = await resetPasswordAction({
        email,
        otp,
        newPassword,
      });

      if (res.success) {
        toast.success(res.message);
        router.push("/login");
      } else {
        toast.error(res.message || "Failed to reset password");
      }
    } catch (err) {
      toast.error("An error occurred during password reset. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setIsLoading(true);
      const res = await forgotPasswordAction(email);
      if (res.success) {
        toast.success("A new password reset OTP code has been sent!");
        setOtp("");
      } else {
        toast.error(res.message || "Failed to resend code");
      }
    } catch (err) {
      toast.error("Failed to resend code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

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
        <Card className="rounded-3xl border border-border/40 shadow-xl overflow-hidden glass-panel">
          <CardHeader className="bg-muted/10 border-b border-border/20 py-6 text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-3">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="font-heading text-xl font-black text-foreground">Reset Password</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5 max-w-[280px] mx-auto">
              {step === 1
                ? "Enter your email to receive a password reset code"
                : "Enter the OTP code sent to your email along with your new password"}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-8">
            {step === 1 ? (
              <form onSubmit={handleSendOTP} className="space-y-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider pl-2 flex items-center gap-1">
                    <Mail className="h-3 w-3 text-primary" /> Email Address
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-1.5 mt-4"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Send Reset Code
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider pl-2 text-center">
                    Enter 6-Digit Code
                  </label>
                  <Input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full px-4 py-4 bg-background border border-border/60 rounded-xl text-foreground placeholder-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-center text-xl tracking-[0.3em] font-mono font-bold"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider pl-2 flex items-center gap-1">
                    <Lock className="h-3 w-3 text-primary" /> New Password
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider pl-2 flex items-center gap-1">
                    <Lock className="h-3 w-3 text-primary" /> Confirm Password
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-1.5 mt-4"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Update Password
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="bg-muted/10 border-t border-border/20 py-4 justify-center text-xs text-muted-foreground font-semibold flex flex-col gap-3">
            {step === 2 && (
              <div className="flex flex-col gap-2 text-center w-full">
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={isLoading}
                  className="text-primary hover:underline text-xs"
                >
                  Didn't receive code? Resend Code
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-muted-foreground hover:text-foreground text-[10px] uppercase tracking-wider font-black"
                >
                  ← Change Email Address
                </button>
              </div>
            )}
            <Link href="/login" className="text-muted-foreground/60 hover:text-foreground hover:underline transition-colors font-medium">
              Back to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
