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
    <aside className="w-64 bg-[#F7F3EB] border-r border-[#E3DBCF] flex flex-col justify-between shrink-0 font-sans shadow-sm">
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
        <div className="p-4">
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
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-[#E05D38] hover:text-[#C54824] hover:bg-[#E05D38]/10 transition-all cursor-pointer"
        >
          <LogOut className="h-4.5 w-4.5 text-[#E05D38]" />
          Log Out
        </button>
      </div>
    </aside>
  );
}
