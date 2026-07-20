"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  Building, 
  Cpu, 
  Plus, 
  Layers,
  Clock,
  X,
  ChevronRight,
  ExternalLink,
  Folder,
  ArrowLeft,
  ChevronLeft,
  Settings,
  FileText
} from "lucide-react";

interface Company {
  id: string;
  name: string;
}

interface Feature {
  id: string;
  name: string;
  description: string;
}

interface RubricVersion {
  id: string;
  version_number: number;
  is_active: boolean;
}

interface Rubric {
  id: string;
  title: string;
  description: string;
  rubric_versions: RubricVersion[];
}

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

interface ClientDashboardProps {
  companyId: string;
}

export default function ClientDashboardClient({ companyId }: ClientDashboardProps) {
  const supabase = createClient();
  const router = useRouter();

  // Data States
  const [company, setCompany] = useState<Company | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [sessions, setSessions] = useState<EvaluationSession[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [profile, setProfile] = useState<{ id: string; full_name: string } | null>(null);

  // UI & Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [inspectedSession, setInspectedSession] = useState<EvaluationSession | null>(null);

  // Pagination & Search States
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Modal States
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductDesc, setNewProductDesc] = useState("");

  const [isStartEvalModalOpen, setIsStartEvalModalOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [selectedFeatureId, setSelectedFeatureId] = useState("");
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

  async function fetchDashboardData() {
    setIsLoading(true);
    try {
      // 1. Fetch Company Info
      const { data: companyData } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", companyId)
        .single();
      setCompany(companyData);

      // 2. Fetch Products/Features
      const { data: featuresData } = await supabase
        .from("features")
        .select("id, name, description")
        .eq("company_id", companyId)
        .order("name", { ascending: true });
      setFeatures(featuresData || []);

      // 3. Fetch Evaluation Sessions for this company
      const res = await fetch(`/api/evaluations?company_id=${companyId}`);
      if (!res.ok) throw new Error();
      const sessionsData: EvaluationSession[] = await res.json();
      setSessions(sessionsData || []);

      // 4. Fetch Rubrics & Rubric Versions for this company
      const { data: rubricsData } = await supabase
        .from("rubrics")
        .select(`
          id,
          title,
          description,
          rubric_versions (
            id,
            version_number,
            is_active
          )
        `)
        .eq("company_id", companyId)
        .order("title", { ascending: true });
      setRubrics(rubricsData || []);
    } catch (err) {
      console.error("Error loading client dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchProfile();
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Handle Add Product (Feature)
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;

    setIsActionLoading(true);
    try {
      const { data, error } = await supabase
        .from("features")
        .insert({
          company_id: companyId,
          name: newProductName.trim(),
          description: newProductDesc.trim() || null
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setFeatures(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        setNewProductName("");
        setNewProductDesc("");
        setIsAddProductModalOpen(false);
      }
    } catch (err: any) {
      alert("Error adding product: " + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Start Evaluation Session
  const handleStartEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeatureId || !selectedRubricVersionId || !newSessionName.trim() || !profile) {
      alert("Please fill in all fields.");
      return;
    }

    setIsActionLoading(true);
    try {
      const { data, error } = await supabase
        .from("sessions")
        .insert({
          feature_id: selectedFeatureId,
          rubric_version_id: selectedRubricVersionId,
          evaluator_id: profile.id,
          name: newSessionName.trim()
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        // Refetch evaluation sessions
        const res = await fetch(`/api/evaluations?company_id=${companyId}`);
        if (res.ok) {
          const sessionsData = await res.json();
          setSessions(sessionsData || []);
        }
        setNewSessionName("");
        setIsStartEvalModalOpen(false);
      }
    } catch (err: any) {
      alert("Error creating evaluation session: " + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Date Formatter helpers
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

  // Filter sessions by selected product
  const filteredSessions = sessions;

  // Pagination for sessions
  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / ITEMS_PER_PAGE));
  const paginatedSessions = filteredSessions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Extract all active rubric versions for the Start Evaluation dropdown selection
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Back button */}
      <button
        onClick={() => router.push("/dashboard/companies")}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-xs font-semibold cursor-pointer py-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </button>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <Building className="h-7 w-7 text-violet-500" />
            {company?.name || "Client Workspace"}
          </h1>
        </div>
        <button
          onClick={() => setIsAddProductModalOpen(true)}
          className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-lg"
        >
          <Plus className="h-4 w-4" />
          Add New Product
        </button>
      </div>

      {/* Products/Features Pills (Top Section) */}
      <div className="space-y-2">
        <h2 className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Products</h2>
        {isLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="glass-card h-14 w-48 rounded-xl border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : features.length === 0 ? (
          <div className="glass-card rounded-xl border border-white/5 p-4 text-center text-slate-500 text-xs">
            No products added yet. Click "+ Add New Product" to start.
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {features.map((product) => (
              <Link
                key={product.id}
                href={`/dashboard/companies/${companyId}/products/${product.id}`}
                className="glass-card rounded-xl border border-white/5 p-4 text-left cursor-pointer transition-all duration-300 w-52 shrink-0 flex flex-col justify-between hover:border-violet-500/40 hover:bg-white/5 group"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-xs text-slate-200 group-hover:text-violet-400 transition-colors truncate">
                    {product.name}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[10px] text-slate-550 line-clamp-1 mt-1.5 leading-normal">
                  {product.description || "No description provided."}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Two Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left Column: Evaluation Sessions (3/5 width) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="glass-card rounded-xl border border-white/5 p-5">
            <div className="flex justify-between items-center pb-3 border-b border-white/5 mb-4">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-violet-450" />
                Evaluation Sessions
              </h2>
              <button
                onClick={() => {
                  if (features.length === 0) {
                    alert("Please add a product first before starting an evaluation.");
                    return;
                  }
                  if (activeRubricVersions.length === 0) {
                    alert("Please configure an active rubric in the Rubrics Builder page first.");
                    return;
                  }
                  setSelectedFeatureId(features[0].id);
                  setSelectedRubricVersionId(activeRubricVersions[0].id);
                  setIsStartEvalModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-violet-600/15 border border-violet-500/20 text-violet-450 hover:bg-violet-600 hover:text-white transition-all text-[11px] font-bold cursor-pointer"
              >
                + Start New Evaluation
              </button>
            </div>

            {isLoading ? (
              <div className="text-slate-500 text-xs py-8 text-center animate-pulse">Loading evaluations...</div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-slate-500 text-xs py-8 text-center">
                {selectedProductId ? "No evaluations for this product." : "No evaluation sessions recorded yet."}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-950/65 border-b border-white/5 text-slate-500 uppercase tracking-widest text-[9px] font-bold">
                        <th className="p-3">ID</th>
                        <th className="p-3">Product</th>
                        <th className="p-3">Rubric</th>
                        <th className="p-3">Created</th>
                        <th className="p-3">Last Activity</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {paginatedSessions.map((session) => (
                        <tr key={session.id} className="hover:bg-white/[0.01] transition-colors text-slate-300">
                          <td className="p-3 font-mono text-[10px] text-slate-400">
                            {session.id.substring(0, 8)}
                          </td>
                          <td className="p-3">
                            <Link
                              href={`/dashboard/companies/${companyId}/products/${session.feature?.id}`}
                              className="font-semibold text-slate-200 hover:text-violet-400 hover:underline transition-colors truncate max-w-[120px] block"
                              title={session.feature?.name}
                            >
                              {session.feature?.name}
                            </Link>
                          </td>
                          <td className="p-3 text-slate-400 truncate max-w-[120px]" title={session.rubric_version?.rubric?.title}>
                            {session.rubric_version?.rubric?.title}
                          </td>
                          <td className="p-3 text-slate-450 text-[10px]">
                            {new Date(session.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          <td className="p-3 text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-500" />
                              {formatRelativeTime(session.updated_at)} ago
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setInspectedSession(session)}
                              className="px-2.5 py-1 rounded bg-slate-950 hover:bg-violet-600 border border-white/5 text-slate-400 hover:text-white transition-all text-[10px] font-bold cursor-pointer"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/5">
                    <div>
                      Page <span className="font-semibold text-slate-200">{currentPage}</span> of <span className="font-semibold text-slate-200">{totalPages}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/5 text-xs hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 transition-colors cursor-pointer"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/5 text-xs hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 transition-colors cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Client Rubrics (2/5 width) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card rounded-xl border border-white/5 p-5">
            <div className="flex justify-between items-center pb-3 border-b border-white/5 mb-4">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2 truncate">
                <Settings className="h-4.5 w-4.5 text-violet-450" />
                {company?.name || "Client"} Rubrics
              </h2>
              <Link
                href={`/dashboard/rubrics`}
                className="px-3 py-1.5 rounded-lg bg-violet-600/15 border border-violet-500/20 text-violet-450 hover:bg-violet-600 hover:text-white transition-all text-[11px] font-bold cursor-pointer shrink-0"
              >
                + New
              </Link>
            </div>

            {isLoading ? (
              <div className="text-slate-500 text-xs py-8 text-center animate-pulse">Loading rubrics...</div>
            ) : rubrics.length === 0 ? (
              <div className="text-slate-500 text-xs py-8 text-center">No rubrics registered for this company.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-950/65 border-b border-white/5 text-slate-500 uppercase tracking-widest text-[9px] font-bold">
                      <th className="p-3">ID</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rubrics.map((rubric) => {
                      const hasActive = rubric.rubric_versions?.some(v => v.is_active);
                      return (
                        <tr key={rubric.id} className="hover:bg-white/[0.01] transition-colors text-slate-350">
                          <td className="p-3 font-mono text-[9px] text-slate-450">
                            {rubric.id.substring(0, 8)}
                          </td>
                          <td className="p-3 font-bold text-slate-200 truncate max-w-[120px]" title={rubric.title}>
                            {rubric.title}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              hasActive 
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}>
                              {hasActive ? "Active" : "Draft"}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <Link
                              href={`/dashboard/rubrics`}
                              className="text-[10px] font-extrabold text-violet-400 hover:text-violet-300 hover:underline transition-colors"
                            >
                              {hasActive ? "View/Apply" : "Edit"}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Slide-over Inspection Drawer */}
      {inspectedSession && (
        <>
          <div 
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-40 animate-in fade-in duration-300"
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
                className="h-8 w-8 rounded-lg border border-white/10 hover:border-white/20 flex items-center justify-center text-slate-450 hover:text-white hover:bg-white/5 transition-all cursor-pointer shrink-0"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metadata Card */}
              <div className="bg-slate-950/40 border border-white/5 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Evaluator:</span>
                  <span className="text-slate-300 font-semibold">{inspectedSession.evaluator?.full_name || "Unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Created:</span>
                  <span className="text-slate-350">{new Date(inspectedSession.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Modified:</span>
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

                          {/* Turn Content (Prompt / Response) */}
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

                          {/* Scores List for this Turn */}
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

      {/* Add Product Modal */}
      {isAddProductModalOpen && (
        <>
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
            onClick={() => setIsAddProductModalOpen(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-slate-900 border border-white/10 rounded-xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Layers className="h-4 w-4 text-violet-500" />
                Add New Product
              </h3>
              <button 
                onClick={() => setIsAddProductModalOpen(false)}
                className="text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450 block">Product Name</label>
                <input
                  type="text"
                  required
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="e.g. Customer Support Chatbot"
                  className="w-full bg-slate-950/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-violet-500 transition-colors"
                  disabled={isActionLoading}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450 block">Description</label>
                <textarea
                  value={newProductDesc}
                  onChange={(e) => setNewProductDesc(e.target.value)}
                  placeholder="e.g. Evaluates dialog responses for accuracy and safety guidelines."
                  rows={3}
                  className="w-full bg-slate-950/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-violet-500 transition-colors"
                  disabled={isActionLoading}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-white/5 mt-4">
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(false)}
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
                  {isActionLoading ? "Adding..." : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </>
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
                  placeholder="e.g. Ingestion QA - July 20"
                  className="w-full bg-slate-950/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-violet-500 transition-colors"
                  disabled={isActionLoading}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450 block">Select Product</label>
                <select
                  value={selectedFeatureId}
                  onChange={(e) => setSelectedFeatureId(e.target.value)}
                  className="w-full bg-slate-950/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-violet-500 transition-colors"
                  disabled={isActionLoading}
                >
                  {features.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
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
    </div>
  );
}
