"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, Mail, AlertTriangle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      router.refresh();
      router.push("/dashboard");
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || "An unexpected error occurred.");
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    if (!email.trim()) {
      setErrorMsg("Please enter your email address first, then click Forgot Password.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
      });

      if (error) throw error;

      setSuccessMsg("Password reset link sent! Please check your email inbox.");
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || "Failed to send password reset email.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center min-h-screen bg-[#FAF6EE] px-4 relative overflow-hidden">
      {/* Ambient Decorative Accents */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[#E05D38]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[350px] h-[350px] bg-[#94BBE0]/25 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#FAF6EE] rounded-2xl border border-[#E3DBCF] p-8 shadow-xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-[#E05D38] flex items-center justify-center font-black text-xl text-white shadow-lg shadow-[#E05D38]/25 mb-4">
            T
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#2B231F]">
            Welcome to TNA Home
          </h1>
          <p className="text-xs text-[#7A6C62] font-semibold mt-1.5">
            Sign in to start evaluating responses
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 text-xs font-semibold flex items-start gap-3">
            <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs font-semibold flex items-start gap-3">
            <span className="shrink-0 text-emerald-700 font-bold">✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A6C62]">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A6C62]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="evaluator@tna.com"
                className="w-full bg-white border border-[#E3DBCF] rounded-xl py-2.5 pl-11 pr-4 text-xs font-semibold text-[#2B231F] placeholder-[#7A6C62] focus:outline-none focus:border-[#E05D38] focus:ring-1 focus:ring-[#E05D38] transition-all shadow-sm"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A6C62]">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A6C62]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-[#E3DBCF] rounded-xl py-2.5 pl-11 pr-4 text-xs font-semibold text-[#2B231F] placeholder-[#7A6C62] focus:outline-none focus:border-[#E05D38] focus:ring-1 focus:ring-[#E05D38] transition-all shadow-sm"
                disabled={isLoading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 rounded-xl bg-[#E05D38] hover:bg-[#C54824] text-white font-bold text-xs uppercase tracking-wider cursor-pointer shadow-md shadow-[#E05D38]/20 transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-xs text-[#E05D38] hover:text-[#C54824] font-bold transition-colors cursor-pointer"
          >
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  );
}
