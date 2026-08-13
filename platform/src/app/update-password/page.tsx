"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, KeyRound, AlertTriangle, CheckCircle2, ArrowLeft, Mail, User } from "lucide-react";
import Link from "next/link";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userEmail, setUserEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const handleSessionData = (session: any) => {
      if (!session || !isMounted) return;
      setHasSession(true);
      setCheckingAuth(false);
      if (session.user?.email) setUserEmail(session.user.email);
      
      const metaName = session.user?.user_metadata?.full_name || "";
      if (metaName && !metaName.includes("@")) {
        const nameParts = metaName.trim().split(" ");
        if (nameParts[0]) setFirstName(nameParts[0]);
        if (nameParts.length > 1) setLastName(nameParts.slice(1).join(" "));
      } else {
        setFirstName("");
        setLastName("");
      }
    };

    // 1. Subscribe to auth state changes FIRST (catches #access_token hash parsing)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        handleSessionData(session);
      }
    });

    // 2. Check current session & handle URL parameters
    const initAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      if (code) {
        try {
          const { data: codeData } = await supabase.auth.exchangeCodeForSession(code);
          if (codeData?.session) {
            handleSessionData(codeData.session);
            return;
          }
        } catch (e) {
          console.error("Error exchanging code for session:", e);
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        handleSessionData(session);
      } else {
        // If hash contains tokens, wait briefly for Supabase auth listener to process
        const hasHashToken = typeof window !== "undefined" && (window.location.hash.includes("access_token") || window.location.hash.includes("type="));
        if (!hasHashToken) {
          if (isMounted) setCheckingAuth(false);
        } else {
          setTimeout(() => {
            if (isMounted) setCheckingAuth(false);
          }, 1500);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg("First name and last name are required.");
      setIsLoading(false);
      return;
    }

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
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const { error } = await supabase.auth.updateUser({
        password: password.trim(),
        data: {
          full_name: fullName,
        },
      });

      if (error) {
        throw error;
      }

      // Also update public profiles table
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ full_name: fullName })
          .eq("id", user.id);
      }

      setSuccessMsg("Account configured successfully! Redirecting to dashboard...");
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || "Failed to configure account.");
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
          <div className="h-12 w-12 rounded-xl bg-[#E05D38] flex items-center justify-center text-white shadow-lg shadow-[#E05D38]/25 mb-4 font-bold text-xl">
            T
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#2B231F]">
            Complete Your Account Setup
          </h1>
          <p className="text-xs text-[#7A6C62] font-semibold mt-1.5 text-center">
            Enter your name and password to activate your TNA Home account
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

        {/* Informational tip if testing while logged in as Admin */}
        {["goldenc5310@gmail.com", "pisurajc@gmail.com"].includes((userEmail || "").toLowerCase()) && (
          <div className="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs font-semibold">
            💡 <strong>Testing an invite link?</strong> Your browser is currently logged into your Admin account (<span className="font-mono">{userEmail}</span>). To test account creation as the new invited user, copy the link into an <strong>Incognito / Private Window</strong> or another browser!
          </div>
        )}

        {checkingAuth ? (
          <div className="p-8 text-center text-xs text-[#7A6C62] font-semibold animate-pulse">
            Verifying invitation request...
          </div>
        ) : !hasSession ? (
          <div className="text-center space-y-4 py-4">
            <p className="text-xs text-rose-700 font-semibold bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl">
              Invalid or expired invitation link. Please ask your administrator to send a new invitation.
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Pre-filled Email Address (Read-only / Cannot be edited) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A6C62]">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A6C62]" />
                <input
                  type="email"
                  value={userEmail}
                  disabled
                  readOnly
                  className="w-full bg-[#EAE3D6]/50 border border-[#E3DBCF] rounded-xl py-2.5 pl-11 pr-4 text-xs font-semibold text-[#7A6C62] cursor-not-allowed shadow-inner"
                />
              </div>
            </div>

            {/* First Name & Last Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A6C62]">
                  First Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A6C62]" />
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className="w-full bg-white border border-[#E3DBCF] rounded-xl py-2.5 pl-11 pr-4 text-xs font-semibold text-[#2B231F] placeholder-[#7A6C62] focus:outline-none focus:border-[#E05D38] focus:ring-1 focus:ring-[#E05D38] transition-all shadow-sm"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A6C62]">
                  Last Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A6C62]" />
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    className="w-full bg-white border border-[#E3DBCF] rounded-xl py-2.5 pl-11 pr-4 text-xs font-semibold text-[#2B231F] placeholder-[#7A6C62] focus:outline-none focus:border-[#E05D38] focus:ring-1 focus:ring-[#E05D38] transition-all shadow-sm"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
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

            {/* Confirm Password Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A6C62]">
                Confirm Password
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
              {isLoading ? "Activating Account..." : "Create Account"}
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
