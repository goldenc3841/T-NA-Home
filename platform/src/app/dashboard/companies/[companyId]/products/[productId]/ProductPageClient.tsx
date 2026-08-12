"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  Building, 
  Plus, 
  Layers,
  Clock,
  X,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  FileText,
  FileSpreadsheet
} from "lucide-react";

interface EvaluationSession {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  feature: {
    id: string;
    name: string;
    company: {
      id: string;
      name: string;
    };
  };
  rubric_version: {
    id: string;
    rubric: {
      id: string;
      title: string;
    };
  };
  evaluator: {
    id: string;
    full_name: string;
  };
  turns: Array<{
    id: string;
    prompt: string;
    response: string;
    source_url: string | null;
    turn_number: number;
    created_at: string;
    scores: Array<{
      id: string;
      value: string;
      notes: string | null;
      criterion: {
        id: string;
        name: string;
        field_type: string;
      };
    }>;
  }>;
}

interface RubricVersion {
  id: string;
  version_number: number;
  is_active: boolean;
}

interface Rubric {
  id: string;
  title: string;
  rubric_versions: RubricVersion[];
}

interface ProductPageClientProps {
  companyId: string;
  productId: string;
}

export default function ProductPageClient({ companyId, productId }: ProductPageClientProps) {
  const supabase = createClient();
  const router = useRouter();

  // Data States
  const [productName, setProductName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [sessions, setSessions] = useState<EvaluationSession[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [profile, setProfile] = useState<{ id: string; full_name: string } | null>(null);

  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [inspectedSession, setInspectedSession] = useState<EvaluationSession | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Modal States
  const [isStartEvalModalOpen, setIsStartEvalModalOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [selectedRubricVersionId, setSelectedRubricVersionId] = useState("");

  async function fetchProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("id", user.id)
          .single();
        setProfile(data);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  }

  async function fetchProductAndSessionsData() {
    setIsLoading(true);
    try {
      // 1. Fetch Product details (feature and company names)
      const { data: featureData } = await supabase
        .from("features")
        .select("name, company:companies(name)")
        .eq("id", productId)
        .single();
      
      if (featureData) {
        setProductName(featureData.name);
        setCompanyName((featureData.company as any)?.name || "Client");
      }

      // 2. Fetch Sessions for this product feature
      const res = await fetch(`/api/evaluations?company_id=${companyId}`);
      if (!res.ok) throw new Error();
      const sessionsData: EvaluationSession[] = await res.json();
      const filtered = (sessionsData || []).filter(s => s.feature?.id === productId);
      setSessions(filtered);

      // 3. Fetch Rubrics (to get active rubric versions for starting evaluations)
      const { data: rubricsData } = await supabase
        .from("rubrics")
        .select(`
          id,
          title,
          rubric_versions (
            id,
            version_number,
            is_active
          )
        `)
        .eq("company_id", companyId);
      setRubrics(rubricsData || []);
    } catch (err) {
      console.error("Error loading product sessions log:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchProfile();
    fetchProductAndSessionsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Handle Start Evaluation Session
  const handleStartEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRubricVersionId || !newSessionName.trim() || !profile) {
      alert("Please fill in all fields.");
      return;
    }

    setIsActionLoading(true);
    try {
      const { data, error } = await supabase
        .from("sessions")
        .insert({
          feature_id: productId,
          rubric_version_id: selectedRubricVersionId,
          evaluator_id: profile.id,
          name: newSessionName.trim()
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        // Refetch sessions
        const res = await fetch(`/api/evaluations?company_id=${companyId}`);
        if (res.ok) {
          const sessionsData: EvaluationSession[] = await res.json();
          const filtered = (sessionsData || []).filter(s => s.feature?.id === productId);
          setSessions(filtered);
        }
        setNewSessionName("");
        setIsStartEvalModalOpen(false);
      }
    } catch (err: any) {
      alert("Error starting evaluation: " + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Helpers
  function formatExactDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

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

  // Compile dropdown options
  const activeRubricVersions: Array<{ id: string; title: string }> = [];
  rubrics.forEach(r => {
    r.rubric_versions?.forEach(v => {
      if (v.is_active) {
        activeRubricVersions.push({
          id: v.id,
          title: `${r.title} (v${v.version_number})`
        });
      }
    });
  });

  // Pagination slicing
  const totalPages = Math.max(1, Math.ceil(sessions.length / ITEMS_PER_PAGE));
  const paginatedSessions = sessions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2 font-sans">
      {/* Clickable Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs font-semibold text-[#7A6C62]">
        <Link 
          href={`/dashboard/companies/${companyId}`}
          className="hover:text-[#E05D38] transition-colors uppercase tracking-wider text-[10px] text-[#2B231F] font-bold"
        >
          {companyName}
        </Link>
        <ChevronRight className="h-3 w-3 text-[#7A6C62]" />
        <span className="text-[#2B231F] font-bold border-b border-[#E05D38]/30 pb-0.5 uppercase tracking-wider text-[10px]">
          {productName}
        </span>
      </nav>

      {/* Header and Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E3DBCF]">
        <div>
          <h1 className="text-2xl font-bold text-[#E05D38] tracking-tight flex items-center gap-2 font-serif">
            <Layers className="h-6 w-6 text-[#E05D38]" />
            Evaluation Sessions Log
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              if (activeRubricVersions.length === 0) {
                alert("Please configure an active rubric version in the Rubrics Builder first.");
                return;
              }
              setSelectedRubricVersionId(activeRubricVersions[0].id);
              setIsStartEvalModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-[#E05D38] hover:bg-[#C54824] text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Start New Evaluation
          </button>
          <Link
            href={`/dashboard/rubrics?companyId=${companyId}`}
            className="px-3.5 py-2 rounded-lg bg-white hover:bg-[#FAF6EE] text-[#2B231F] text-xs font-bold border border-[#E3DBCF] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create New Rubric
          </Link>
        </div>
      </div>

      {/* Sessions Logs Table Section */}
      {isLoading ? (
        <div className="glass-card rounded-xl border border-[#E3DBCF] p-8 text-center text-[#7A6C62] text-xs animate-pulse">
          Loading sessions log database...
        </div>
      ) : sessions.length === 0 ? (
        <div className="glass-card rounded-xl border border-[#E3DBCF] p-8 text-center text-[#7A6C62] text-xs">
          No evaluation sessions logged under this product feature. Click "Start New Evaluation" to begin.
        </div>
      ) : (
        <div className="glass-card rounded-xl border border-[#E3DBCF] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#FAF6EE] border-b border-[#E3DBCF] text-[#7A6C62] uppercase tracking-widest text-[9px] font-bold">
                  <th className="p-4">ID</th>
                  <th className="p-4">Session Name</th>
                  <th className="p-4">Rubric</th>
                  <th className="p-4">Created</th>
                  <th className="p-4">Last Activity</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3DBCF] text-[#2B231F]">
                {paginatedSessions.map((session) => (
                  <tr 
                    key={session.id} 
                    className="hover:bg-[#FAF6EE] transition-colors cursor-pointer group"
                    onClick={() => router.push(`/dashboard/companies/${companyId}/products/${productId}/sessions/${session.id}`)}
                  >
                    <td className="p-4 font-mono text-[10px] text-[#7A6C62]">
                      {session.id.substring(0, 8)}
                    </td>
                    <td className="p-4 font-bold text-[#2B231F] group-hover:text-[#E05D38] transition-colors">
                      {session.name}
                    </td>
                    <td className="p-4 text-[#7A6C62]">
                      {session.rubric_version?.rubric?.title}
                    </td>
                    <td className="p-4 text-[#7A6C62]">
                      {formatExactDate(session.created_at)}
                    </td>
                    <td className="p-4 text-[#7A6C62]">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-[#7A6C62]" />
                        {formatRelativeTime(session.updated_at)} ago
                      </span>
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/dashboard/companies/${companyId}/products/${productId}/sessions/${session.id}`}
                        className="px-3.5 py-1.5 rounded-lg bg-violet-600/10 border border-violet-500/20 text-violet-450 hover:bg-violet-600 hover:text-white transition-all text-[11px] font-bold cursor-pointer inline-block"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
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
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-white/5 text-xs text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-450 transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-white/5 text-xs text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-450 transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Start Evaluation Modal */}
      {isStartEvalModalOpen && (
        <>
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
            onClick={() => setIsStartEvalModalOpen(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-slate-900 border border-white/10 rounded-xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-500" />
                Start New Evaluation
              </h3>
              <button 
                onClick={() => setIsStartEvalModalOpen(false)}
                className="text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <form onSubmit={handleStartEvaluation} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450 block">Session Name</label>
                <input
                  type="text"
                  required
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="e.g. Session QA - July 20"
                  className="w-full bg-slate-950/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-violet-500 transition-colors"
                  disabled={isActionLoading}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450 block">Product</label>
                <input
                  type="text"
                  value={productName}
                  disabled
                  className="w-full bg-slate-950/20 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-500 opacity-60"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450 block">Select Rubric</label>
                <select
                  value={selectedRubricVersionId}
                  onChange={(e) => setSelectedRubricVersionId(e.target.value)}
                  className="w-full bg-slate-950/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-violet-500 transition-colors"
                  disabled={isActionLoading}
                >
                  {activeRubricVersions.map(r => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5 mt-4">
                <button
                  type="button"
                  onClick={() => setIsStartEvalModalOpen(false)}
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
                  {isActionLoading ? "Starting..." : "Start Session"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Slide-over Inspection Drawer */}
      {inspectedSession && (
        <>
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 animate-in fade-in duration-300"
            onClick={() => setInspectedSession(null)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-slate-900/95 border-l border-white/10 z-50 shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-300 ease-out">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-start justify-between gap-4 bg-slate-950/45">
              <div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-violet-400">Evaluation Session Inspector</div>
                <h2 className="text-xl font-extrabold text-white mt-1.5 flex items-center gap-2 leading-tight">
                  {inspectedSession.name}
                </h2>
                <div className="text-xs text-slate-450 mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-slate-350">{inspectedSession.feature.company.name}</span>
                  <span>•</span>
                  <span>{inspectedSession.feature.name}</span>
                  <span>•</span>
                  <span className="text-slate-500">Rubric: {inspectedSession.rubric_version?.rubric?.title}</span>
                </div>
              </div>
              
              <button
                onClick={() => setInspectedSession(null)}
                className="h-8 w-8 rounded-lg border border-white/10 hover:border-white/20 flex items-center justify-center text-slate-455 hover:text-white hover:bg-white/5 transition-all cursor-pointer shrink-0"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metadata Card */}
              <div className="bg-slate-950/40 border border-white/5 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-505">Evaluator:</span>
                  <span className="text-slate-300 font-semibold">{inspectedSession.evaluator?.full_name || "Unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-505">Created:</span>
                  <span className="text-slate-350">{new Date(inspectedSession.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-550">Last Modified:</span>
                  <span className="text-slate-350">{new Date(inspectedSession.updated_at).toLocaleString()}</span>
                </div>
              </div>

              {/* Turns Listing */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                  Conversation Turns ({inspectedSession.turns?.length || 0})
                </h3>

                {(!inspectedSession.turns || inspectedSession.turns.length === 0) ? (
                  <div className="text-slate-500 text-xs py-8 text-center bg-slate-950/20 rounded-xl border border-dashed border-white/5">
                    No conversation turns captured under this session yet.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {inspectedSession.turns
                      .sort((a, b) => a.turn_number - b.turn_number)
                      .map((turn) => (
                        <div 
                          key={turn.id} 
                          className="border border-white/5 rounded-xl bg-slate-900/30 overflow-hidden"
                        >
                          {/* Turn Header */}
                          <div className="px-4 py-2 bg-slate-950 border-b border-white/5 flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-350 flex items-center gap-1.5">
                              <span className="h-4.5 w-4.5 rounded-full bg-violet-600/20 text-violet-400 border border-violet-500/30 flex items-center justify-center text-[10px] font-bold">
                                {turn.turn_number}
                              </span>
                              Turn Dialogue
                            </span>
                            {turn.source_url && (
                              <a 
                                href={turn.source_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-[10px] text-slate-500 hover:text-violet-450 flex items-center gap-1 transition-colors"
                              >
                                <Clock className="h-3 w-3" />
                                URL Source
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>

                          {/* Turn Content */}
                          <div className="p-4 space-y-4">
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-violet-455 uppercase tracking-wider block">Prompt</span>
                              <div className="bg-slate-950/60 rounded-lg p-3 text-xs text-slate-300 font-mono border border-white/5 whitespace-pre-wrap leading-relaxed">
                                {turn.prompt}
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider block">Response</span>
                              <div className="bg-slate-950/60 rounded-lg p-3 text-xs text-slate-300 font-mono border border-white/5 whitespace-pre-wrap leading-relaxed">
                                {turn.response}
                              </div>
                            </div>
                          </div>

                          {/* Scores List */}
                          {turn.scores && turn.scores.length > 0 && (
                            <div className="border-t border-white/5 p-4 bg-slate-950/30 space-y-3">
                              <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block">Evaluator Scores</span>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {turn.scores.map((score) => (
                                  <div 
                                    key={score.id}
                                    className="bg-slate-900/40 border border-white/5 rounded-lg p-3 space-y-1"
                                  >
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="font-semibold text-slate-350">{score.criterion.name}</span>
                                      <span className="px-2 py-0.5 rounded bg-violet-600/10 border border-violet-500/20 text-[10px] text-violet-400 font-bold">
                                        {score.value}
                                      </span>
                                    </div>
                                    {score.notes && (
                                      <div className="text-[10px] text-slate-450 leading-relaxed italic bg-slate-950/30 px-2 py-1.5 rounded border border-white/5 mt-1.5">
                                        &ldquo;{score.notes}&rdquo;
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
