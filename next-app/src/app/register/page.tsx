"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { User, Mail, Phone, Lock, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { registerAction } from "@/app/actions/auth";
import { toast } from "sonner";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().refine((val) => {
    const clean = val.replace(/\D/g, "");
    return clean.length === 10;
  }, "Phone number must be exactly 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Confirm password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", phoneNumber: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: RegisterValues) => {
    try {
      setIsLoading(true);
      const cleanPhone = data.phoneNumber.replace(/\D/g, "");
      
      const res = await registerAction({
        name: data.name,
        email: data.email,
        phoneNumber: cleanPhone,
        password: data.password,
      });

      if (res.success) {
        toast.success(res.message);
        // Direct to verification page and pass email/password in state or query parameters
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}&p=${encodeURIComponent(Buffer.from(data.password).toString("base64"))}`);
      } else {
        toast.error(res.message || "Failed to register account");
      }
    } catch (err) {
      toast.error("An error occurred during registration. Please try again.");
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
            <CardTitle className="font-heading text-xl font-black text-foreground">Create FMPG Account</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Sign up today and start applying to premium career openings
            </CardDescription>
          </CardHeader>

          <CardContent className="p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider pl-2 flex items-center gap-1">
                  <User className="h-3 w-3 text-primary" /> Full Name
                </label>
                <Input type="text" {...register("name")} placeholder="John Doe" />
                {errors.name && <p className="text-[10px] text-destructive pl-2 font-bold">{errors.name.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider pl-2 flex items-center gap-1">
                  <Mail className="h-3 w-3 text-primary" /> Email Address
                </label>
                <Input type="email" {...register("email")} placeholder="john@example.com" />
                {errors.email && <p className="text-[10px] text-destructive pl-2 font-bold">{errors.email.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider pl-2 flex items-center gap-1">
                  <Phone className="h-3 w-3 text-primary" /> Phone Number
                </label>
                <Input type="tel" {...register("phoneNumber")} placeholder="10-digit number" />
                {errors.phoneNumber && <p className="text-[10px] text-destructive pl-2 font-bold">{errors.phoneNumber.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider pl-2 flex items-center gap-1">
                  <Lock className="h-3 w-3 text-primary" /> Password
                </label>
                <Input type="password" {...register("password")} placeholder="••••••••" />
                {errors.password && <p className="text-[10px] text-destructive pl-2 font-bold">{errors.password.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider pl-2 flex items-center gap-1">
                  <Lock className="h-3 w-3 text-primary" /> Confirm Password
                </label>
                <Input type="password" {...register("confirmPassword")} placeholder="••••••••" />
                {errors.confirmPassword && <p className="text-[10px] text-destructive pl-2 font-bold">{errors.confirmPassword.message}</p>}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-1.5 mt-4"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Create Account
              </Button>
            </form>
          </CardContent>

          <CardFooter className="bg-muted/10 border-t border-border/20 py-4 justify-center text-xs text-muted-foreground font-semibold flex flex-col gap-2">
            <div>
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline ml-1">
                Sign in
              </Link>
            </div>
            <p className="text-center text-[10px] text-muted-foreground/60 max-w-[280px]">
              By registering, you agree to our{" "}
              <a href="https://fmpg.in" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="https://fmpg.in" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Privacy Policy
              </a>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
