import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SidebarNav from "@/components/SidebarNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the public profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const userEmail = (user.email || "").toLowerCase();
  const isAdminEmail = ["goldenc5310@gmail.com", "pisurajc@gmail.com"].includes(userEmail);
  const resolvedRole = isAdminEmail ? "admin" : (profile?.role || "evaluator");

  return (
    <div className="flex h-screen bg-[#FAF6EE] text-[#2B231F] overflow-hidden">
      {/* Sidebar Nav (Client Component) */}
      <SidebarNav
        profileName={profile?.full_name || user.email || "Evaluator"}
        profileRole={resolvedRole}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
