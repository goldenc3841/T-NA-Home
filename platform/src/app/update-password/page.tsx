"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, KeyRound, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // Listen for password recovery or active session state
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setHasSession(true);
      }
      setCheckingAuth(false);
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
      }
      setCheckingAuth(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please verify and try again.");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (error) {
        throw error;
      }

      setSuccessMsg("Password updated successfully! Redirecting to dashboard...");
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || "Failed to update password.");
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
          <div className="h-12 w-12 rounded-xl bg-[#E05D38] flex items-center justify-center text-white shadow-lg shadow-[#E05D38]/25 mb-4">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#2B231F]">
            Set New Password
          </h1>
          <p className="text-xs text-[#7A6C62] font-semibold mt-1.5 text-center">
            Enter your new password below to update your account credentials
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
            <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-700" />
            <span>{successMsg}</span>
          </div>
        )}

        {checkingAuth ? (
          <div className="p-8 text-center text-xs text-[#7A6C62] font-semibold animate-pulse">
            Verifying password reset request...
          </div>
        ) : !hasSession ? (
          <div className="text-center space-y-4 py-4">
            <p className="text-xs text-rose-700 font-semibold bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl">
              Invalid or expired password reset link. Please request a new link from the login page.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-xs text-[#E05D38] hover:text-[#C54824] font-bold transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A6C62]">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A6C62]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-white border border-[#E3DBCF] rounded-xl py-2.5 pl-11 pr-4 text-xs font-semibold text-[#2B231F] placeholder-[#7A6C62] focus:outline-none focus:border-[#E05D38] focus:ring-1 focus:ring-[#E05D38] transition-all shadow-sm"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A6C62]">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A6C62]" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
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
              {isLoading ? "Updating Password..." : "Update Password"}
            </button>
          </form>
        )}

        <div className="mt-5 text-center">
          <Link
            href="/login"
            className="text-xs text-[#7A6C62] hover:text-[#2B231F] font-bold transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
