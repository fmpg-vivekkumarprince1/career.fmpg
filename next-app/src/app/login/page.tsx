"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Mail, Lock, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { loginAction } from "@/app/actions/auth";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginValues) => {
    try {
      setIsLoading(true);
      const res = await loginAction(data);

      if (res.success) {
        toast.success("Successfully logged in!");
        
        // Check role and redirect
        const role = res.data?.role;
        const isAdmin = ["admin", "super-admin", "employee"].includes(role);
        
        if (isAdmin) {
          router.push("/admin/dashboard");
        } else {
          router.push(redirectPath);
        }
        router.refresh();
      } else {
        if (res.requiresVerification) {
          toast.info(res.message);
          router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
        } else {
          toast.error(res.message || "Invalid credentials");
        }
      }
    } catch (err) {
      toast.error("An error occurred. Please try again.");
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
          <CardHeader className="bg-muted/10 border-b border-border/20 py-5 text-center">
            <CardTitle className="font-heading text-xl font-black text-foreground">Sign In to FMPG</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Enter your registered candidate credentials below
            </CardDescription>
          </CardHeader>

          <CardContent className="p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider pl-2 flex items-center gap-1">
                  <Mail className="h-3 w-3 text-primary" /> Email Address
                </label>
                <Input type="email" {...register("email")} placeholder="john@example.com" />
                {errors.email && <p className="text-[10px] text-destructive pl-2 font-bold">{errors.email.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center pr-2">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider pl-2 flex items-center gap-1">
                    <Lock className="h-3 w-3 text-primary" /> Password
                  </label>
                  <Link href="/forgot-password" className="text-[10px] font-bold text-primary hover:underline">
                    Forgot Password?
                  </Link>
                </div>
                <Input type="password" {...register("password")} placeholder="••••••••" />
                {errors.password && <p className="text-[10px] text-destructive pl-2 font-bold">{errors.password.message}</p>}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-1.5 mt-4"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Sign In
              </Button>
            </form>
          </CardContent>

          <CardFooter className="bg-muted/10 border-t border-border/20 py-4 justify-center text-xs text-muted-foreground font-semibold">
            New applicant?{" "}
            <Link href="/register" className="text-primary hover:underline ml-1">
              Create an account
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-muted/20 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-grid-pattern relative">
        <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 text-center mb-6">
          <div className="inline-flex items-center gap-2.5">
            <img 
              src="/fmpg-logo.png" 
              alt="FMPG Logo" 
              className="h-10 w-auto shrink-0"
            />
            <span className="font-heading text-2xl font-black tracking-widest text-foreground uppercase">
              FM<span className="text-primary">PG</span>
            </span>
          </div>
        </div>
        <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
          <Card className="rounded-3xl border border-border/40 shadow-xl overflow-hidden glass-panel p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-2 text-xs text-muted-foreground font-semibold">Loading sign in portal...</p>
          </Card>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
