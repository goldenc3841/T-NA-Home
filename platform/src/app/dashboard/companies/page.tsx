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
    <div className="space-y-6 max-w-4xl mx-auto py-2 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#E05D38] tracking-tight flex items-center gap-2 font-serif">
            <Building className="h-6 w-6 text-[#E05D38]" />
            All Clients
          </h1>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-[#E05D38] hover:bg-[#C54824] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add New Client
        </button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A6C62]" />
        <input
          type="text"
          placeholder="Search by company..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-9 pr-4 py-2 bg-white border border-[#E3DBCF] rounded-lg text-xs text-[#2B231F] placeholder-[#7A6C62] focus:outline-none focus:border-[#E05D38] transition-colors shadow-sm"
        />
      </div>

      {/* Table Section */}
      {isLoading ? (
        <div className="glass-card rounded-xl border border-[#E3DBCF] p-8 text-center text-[#7A6C62] text-xs animate-pulse">
          Loading clients database...
        </div>
      ) : (
        <div className="glass-card rounded-xl border border-[#E3DBCF] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#FAF6EE] border-b border-[#E3DBCF] text-[#7A6C62] uppercase tracking-widest text-[9px] font-bold">
                  <th className="p-4">Client Name</th>
                  <th className="p-4">Last Activity</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3DBCF]">
                {paginatedCompanies.map((c) => {
                  const lastActiveDate = lastActivity[c.id];
                  return (
                    <tr 
                      key={c.id} 
                      onClick={() => router.push(`/dashboard/companies/${c.id}`)}
                      className="hover:bg-[#FAF6EE] active:bg-[#F2EBDC] transition-colors cursor-pointer group"
                    >
                      <td className="p-4">
                        <span className="font-bold text-[#2B231F] group-hover:text-[#E05D38] transition-all text-left">
                          {c.name}
                        </span>
                      </td>
                      <td className="p-4 text-[#7A6C62]">
                        {lastActiveDate ? (
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-[#7A6C62]" />
                            {formatRelativeTime(lastActiveDate)} ago
                          </span>
                        ) : (
                          <span className="text-[#7A6C62] italic">No activity</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <span className="px-3.5 py-1.5 rounded-lg bg-[#94BBE0]/30 border border-[#94BBE0]/60 text-[#1E3A5F] group-hover:bg-[#94BBE0] group-hover:text-[#1E3A5F] transition-all text-[11px] font-extrabold inline-block shadow-sm">
                          View Dashboard
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {paginatedCompanies.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-[#7A6C62] italic">
                      {searchQuery ? "No companies match your search." : "No clients registered."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-[#E3DBCF] bg-[#FAF6EE] flex items-center justify-between text-xs text-[#7A6C62]">
              <div>
                Page <span className="font-semibold text-[#2B231F]">{currentPage}</span> of <span className="font-semibold text-[#2B231F]">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#E3DBCF] text-xs text-[#7A6C62] hover:text-[#2B231F] disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#E3DBCF] text-xs text-[#7A6C62] hover:text-[#2B231F] disabled:opacity-40 transition-colors cursor-pointer"
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
            className="fixed inset-0 bg-[#2B231F]/40 backdrop-blur-sm z-50 animate-in fade-in duration-200"
            onClick={() => setIsCreateModalOpen(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#FAF6EE] border border-[#E3DBCF] rounded-xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3DBCF] mb-4">
              <h3 className="text-sm font-bold text-[#2B231F] uppercase tracking-widest flex items-center gap-2">
                <Building className="h-4 w-4 text-[#E05D38]" />
                Add New Client Profile
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[#7A6C62] hover:text-[#2B231F] transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <form onSubmit={handleCreateCompany} className="space-y-4 font-sans">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-[#7A6C62] block">Company Name</label>
                <input
                  type="text"
                  required
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Globex"
                  className="w-full bg-white border border-[#E3DBCF] rounded-lg px-3 py-2 text-xs text-[#2B231F] placeholder-[#7A6C62] focus:outline-none focus:border-[#E05D38] transition-colors"
                  disabled={isActionLoading}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[#E3DBCF] mt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-[#EDE7DC] text-xs font-semibold text-[#2B231F] border border-[#E3DBCF] transition-colors cursor-pointer"
                  disabled={isActionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="px-4 py-2 rounded-lg bg-[#E05D38] hover:bg-[#C54824] text-xs font-semibold text-white transition-all cursor-pointer"
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
