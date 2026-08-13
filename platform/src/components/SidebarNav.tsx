"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  LayoutDashboard, 
  Building, 
  LogOut, 
  User,
  UserPlus,
  X,
  Mail,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";

interface SidebarNavProps {
  profileName: string;
  profileRole: string;
}

export default function SidebarNav({ profileName, profileRole }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard
    },
    {
      name: "Clients",
      href: "/dashboard/companies",
      icon: Building
    }
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    setInviteSuccess("");

    if (!inviteEmail.trim()) {
      setInviteError("Please enter a valid email address.");
      return;
    }

    setIsInviting(true);
    try {
      const res = await fetch("/api/admin/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send user invitation.");
      }

      setInviteSuccess(data.message || `Invitation sent successfully to ${inviteEmail}`);
      setInviteEmail("");
    } catch (err: any) {
      setInviteError(err.message || "Failed to send user invitation.");
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <>
      <aside className="w-64 bg-[#FAF6EE] border-r border-[#E3DBCF] flex flex-col justify-between shrink-0 font-sans shadow-sm">
        {/* Top Header */}
        <div>
          <div className="h-16 flex items-center px-6 border-b border-[#E3DBCF]">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-lg bg-[#E05D38] flex items-center justify-center font-bold text-white shadow-md shadow-[#E05D38]/20 font-serif text-lg">
                T
              </span>
              <span className="font-serif font-bold text-xl text-[#E05D38] tracking-tight">
                TNA Home
              </span>
            </Link>
          </div>

          {/* Navigation Items */}
          <div className="p-4 space-y-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#7A6C62] px-3 mb-2 block font-sans">
                Menu Navigation
              </span>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                        isActive
                          ? "bg-[#E05D38]/10 text-[#E05D38] border-l-2 border-[#E05D38] pl-2.5"
                          : "text-[#5C4F47] hover:text-[#2B231F] hover:bg-[#EAE3D6]"
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 ${isActive ? "text-[#E05D38]" : "text-[#7A6C62]"}`} />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Invite Teammate Action */}
            <div className="pt-2 border-t border-[#E3DBCF]">
              <button
                type="button"
                onClick={() => {
                  setInviteError("");
                  setInviteSuccess("");
                  setIsInviteModalOpen(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-[#E05D38] bg-[#E05D38]/10 border border-[#E05D38]/20 hover:bg-[#E05D38] hover:text-white transition-all cursor-pointer shadow-sm group"
              >
                <UserPlus className="h-4.5 w-4.5 text-[#E05D38] group-hover:text-white transition-colors" />
                Invite User
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Profile Details */}
        <div className="p-4 border-t border-[#E3DBCF] space-y-3 font-sans">
          <div className="flex items-center gap-3 px-2.5 py-2 rounded-lg bg-white border border-[#E3DBCF] shadow-sm">
            <div className="h-9 w-9 rounded-full bg-[#94BBE0]/30 border border-[#94BBE0] flex items-center justify-center text-[#1E2833]">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-[#2B231F] truncate" title={profileName}>
                {profileName}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                <span className="text-[9px] text-[#7A6C62] font-extrabold uppercase tracking-widest">
                  {profileRole}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-[#7A6C62] hover:text-[#E05D38] hover:bg-[#E05D38]/10 transition-all cursor-pointer"
          >
            <LogOut className="h-4.5 w-4.5 text-[#7A6C62]" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Invite User Modal */}
      {isInviteModalOpen && (
        <>
          <div 
            className="fixed inset-0 bg-[#2B231F]/40 backdrop-blur-sm z-50 transition-opacity"
            onClick={() => setIsInviteModalOpen(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#FAF6EE] border border-[#E3DBCF] rounded-2xl p-6 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#E3DBCF] mb-5">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#E05D38]/10 border border-[#E05D38]/20 flex items-center justify-center text-[#E05D38]">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#2B231F]">Invite New User</h3>
                  <p className="text-[11px] text-[#7A6C62] font-semibold">Grant account access to TNA Home</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="text-[#7A6C62] hover:text-[#2B231F] p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {inviteError && (
              <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 text-xs font-semibold flex items-start gap-2.5">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-600" />
                <span>{inviteError}</span>
              </div>
            )}

            {inviteSuccess && (
              <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs font-semibold flex items-start gap-2.5">
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-700" />
                <span>{inviteSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A6C62]">
                  Colleague Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A6C62]" />
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full bg-white border border-[#E3DBCF] rounded-xl py-2.5 pl-11 pr-4 text-xs font-semibold text-[#2B231F] placeholder-[#7A6C62] focus:outline-none focus:border-[#E05D38] focus:ring-1 focus:ring-[#E05D38] transition-all shadow-sm"
                    disabled={isInviting}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E3DBCF]">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-[#EDE7DC] text-xs font-bold text-[#2B231F] border border-[#E3DBCF] transition-colors cursor-pointer"
                  disabled={isInviting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="px-4 py-2 rounded-lg bg-[#E05D38] hover:bg-[#C54824] text-xs font-bold text-white transition-all cursor-pointer shadow-sm flex items-center gap-2"
                >
                  {isInviting ? "Sending Invite..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
