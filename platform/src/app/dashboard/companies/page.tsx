"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { 
  Building, 
  Plus, 
  Search, 
  Clock, 
  X
} from "lucide-react";

interface Company {
  id: string;
  name: string;
  created_at: string;
}

function CompaniesPageContent() {
  const supabase = createClient();
  const router = useRouter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [lastActivity, setLastActivity] = useState<Record<string, string>>({});
  
  // Search & Pagination States
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Creation & UI States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  async function fetchCompanies() {
    setIsLoading(true);
    try {
      // 1. Fetch companies
      const { data: companiesData } = await supabase
        .from("companies")
        .select("*")
        .order("name", { ascending: true });
      
      const loadedCompanies = companiesData || [];
      setCompanies(loadedCompanies);
      
      // 2. Fetch last activity from sessions
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("updated_at, feature:features!inner(company_id)");
      
      const activityMap: Record<string, string> = {};
      if (sessionData) {
        sessionData.forEach((s: any) => {
          const cId = s.feature?.company_id;
          if (cId) {
            if (!activityMap[cId] || new Date(s.updated_at) > new Date(activityMap[cId])) {
              activityMap[cId] = s.updated_at;
            }
          }
        });
      }
      setLastActivity(activityMap);
    } catch (err) {
      console.error("Error fetching workspace data:", err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    setIsActionLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .insert({ name: newCompanyName.trim() })
      .select()
      .single();

    setIsActionLoading(false);
    if (error) {
      alert("Error creating client profile: " + error.message);
    } else if (data) {
      setNewCompanyName("");
      setIsCreateModalOpen(false);
      
      // Redirect directly to the new client's dashboard workspace
      router.push(`/dashboard/companies/${data.id}`);
    }
  };

  useEffect(() => {
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to format relative time (e.g. 3d, 2hr)
  function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) {
      return `${diffMins}m`;
    } else if (diffHours < 24) {
      return `${diffHours}hr`;
    } else {
      return `${diffDays}d`;
    }
  }

  // Filter clients
  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const totalPages = Math.max(1, Math.ceil(filteredCompanies.length / ITEMS_PER_PAGE));
  const paginatedCompanies = filteredCompanies.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Building className="h-6 w-6 text-violet-500" />
            All Clients
          </h1>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add New Client
        </button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-550" />
        <input
          type="text"
          placeholder="Search by company..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-9 pr-4 py-2 bg-slate-950/40 border border-white/5 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>

      {/* Table Section */}
      {isLoading ? (
        <div className="glass-card rounded-xl border border-white/5 p-8 text-center text-slate-500 text-xs animate-pulse">
          Loading clients database...
        </div>
      ) : (
        <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-950/65 border-b border-white/5 text-slate-400 uppercase tracking-widest text-[9px] font-bold">
                  <th className="p-4">Client Name</th>
                  <th className="p-4">Last Activity</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedCompanies.map((c) => {
                  const lastActiveDate = lastActivity[c.id];
                  return (
                    <tr key={c.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="p-4">
                        <Link
                          href={`/dashboard/companies/${c.id}`}
                          className="font-bold text-slate-200 hover:text-violet-400 hover:underline transition-all cursor-pointer text-left"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="p-4 text-slate-400">
                        {lastActiveDate ? (
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-500" />
                            {formatRelativeTime(lastActiveDate)} ago
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">No activity</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          href={`/dashboard/companies/${c.id}`}
                          className="px-3.5 py-1.5 rounded-lg bg-violet-600/10 border border-violet-500/20 text-violet-450 hover:bg-violet-600 hover:text-white transition-all text-[11px] font-bold cursor-pointer inline-block"
                        >
                          View Dashboard
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {paginatedCompanies.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-500 italic">
                      {searchQuery ? "No companies match your search." : "No clients registered."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-white/5 bg-slate-950/20 flex items-center justify-between text-xs text-slate-400">
              <div>
                Page <span className="font-semibold text-slate-200">{currentPage}</span> of <span className="font-semibold text-slate-200">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-white/5 text-xs text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-white/5 text-xs text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Client Modal */}
      {isCreateModalOpen && (
        <>
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
            onClick={() => setIsCreateModalOpen(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-slate-900 border border-white/10 rounded-xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Building className="h-4 w-4 text-violet-500" />
                Add New Client Profile
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Company Name</label>
                <input
                  type="text"
                  required
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Globex"
                  className="w-full bg-slate-950/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-violet-500 transition-colors"
                  disabled={isActionLoading}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-white/5 mt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-xs font-semibold text-slate-350 border border-white/5 transition-colors cursor-pointer"
                  disabled={isActionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition-all cursor-pointer"
                >
                  {isActionLoading ? "Creating..." : "Create Client"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

export default function CompaniesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-slate-400 text-xs">Loading workspace...</div>
        </div>
      }
    >
      <CompaniesPageContent />
    </Suspense>
  );
}
