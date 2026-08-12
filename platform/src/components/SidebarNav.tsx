"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  LayoutDashboard, 
  Building, 
  LogOut, 
  User 
} from "lucide-react";

interface SidebarNavProps {
  profileName: string;
  profileRole: string;
}

export default function SidebarNav({ profileName, profileRole }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

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

  return (
    <aside className="w-64 bg-slate-900/60 border-r border-white/5 flex flex-col justify-between shrink-0 glass font-sans">
      {/* Top Header */}
      <div>
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-violet-500/20 font-serif">
              T
            </span>
            <span className="font-serif font-bold text-xl bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent tracking-tight">
              TNA Home
            </span>
          </Link>
        </div>

        {/* Navigation Items */}
        <div className="p-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-3 mb-2 block font-sans">
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
                      ? "bg-violet-600/10 text-violet-400 border-l-2 border-violet-500 pl-2.5"
                      : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? "text-violet-400" : "text-slate-400"}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Profile Details */}
      <div className="p-4 border-t border-white/5 space-y-3 font-sans">
        <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-white/5 border border-white/5">
          <div className="h-9 w-9 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
            <User className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-200 truncate" title={profileName}>
              {profileName}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest">
                {profileRole}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all cursor-pointer"
        >
          <LogOut className="h-4.5 w-4.5 text-rose-400" />
          Log Out
        </button>
      </div>
    </aside>
  );
}
