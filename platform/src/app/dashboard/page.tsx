"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { 
  Building, 
  Layers, 
  Clock, 
  Folder, 
  ChevronRight, 
  ChevronDown, 
  X,
  ExternalLink,
  Sparkles
} from "lucide-react";

import { useRouter } from "next/navigation";

interface Company {
  id: string;
  name: string;
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

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();

  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [sessions, setSessions] = useState<EvaluationSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFeatures, setExpandedFeatures] = useState<Record<string, boolean>>({});
  const [inspectedSession, setInspectedSession] = useState<EvaluationSession | null>(null);

  async function fetchProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name, role, company_id")
          .eq("id", user.id)
          .single();
        setProfile(data);
        if (data?.role === "client_viewer" && data?.company_id) {
          router.push(`/dashboard/companies/${data.company_id}`);
        }
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  }

  async function fetchDashboardData() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/evaluations");
      if (!res.ok) throw new Error();
      const data: EvaluationSession[] = await res.json();
      setSessions(data || []);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchProfile();
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to format relative time (e.g. 3m, 2hr, 1d)
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

  // Helper to format exact date (e.g., July 17, 2026)
  function formatExactDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  // Find unique recently evaluated companies sorted by their max updated_at date (limited to 4)
  const seenCompanies = new Set<string>();
  const recentCompanies: Array<{ id: string; name: string; lastActivity: string }> = [];
  
  sessions.forEach((s) => {
    const company = s.feature?.company;
    if (company && !seenCompanies.has(company.id)) {
      seenCompanies.add(company.id);
      if (recentCompanies.length < 4) {
        recentCompanies.push({
          id: company.id,
          name: company.name,
          lastActivity: s.updated_at
        });
      }
    }
  });

  // Group sessions by feature
  interface GroupedFeatureRow {
    featureId: string;
    featureName: string;
    companyId: string;
    companyName: string;
    lastActivity: string;
    sessions: Array<{ id: string; name: string; updated_at: string }>;
  }

  const groupedFeaturesMap: Record<string, GroupedFeatureRow> = {};
  sessions.forEach((s) => {
    const feat = s.feature;
    if (!feat) return;

    if (!groupedFeaturesMap[feat.id]) {
      groupedFeaturesMap[feat.id] = {
        featureId: feat.id,
        featureName: feat.name,
        companyId: feat.company.id,
        companyName: feat.company.name,
        lastActivity: s.updated_at,
        sessions: []
      };
    }

    if (groupedFeaturesMap[feat.id].sessions.length < 3) {
      groupedFeaturesMap[feat.id].sessions.push({
        id: s.id,
        name: s.name,
        updated_at: s.updated_at
      });
    }
  });

  const recentFeatures = Object.values(groupedFeaturesMap).sort((a, b) => 
    new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );

  const toggleFeatureExpand = (featureId: string) => {
    setExpandedFeatures(prev => ({
      ...prev,
      [featureId]: !prev[featureId]
    }));
  };


  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#E05D38]/10 via-[#F5E590]/20 to-[#FAF6EE] border border-[#E3DBCF] p-6 md:p-8">
        <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
          <Sparkles className="h-24 w-24 text-[#E05D38]" />
        </div>
        <div className="relative z-10 space-y-1">
          <h1 className="text-3xl md:text-4xl font-bold text-[#E05D38] tracking-tight font-serif">
            Welcome, <span className="text-[#2B231F] font-serif">
              {profile?.full_name 
                ? (profile.full_name.includes("@") 
                    ? profile.full_name.split("@")[0].split(".")[0].charAt(0).toUpperCase() + profile.full_name.split("@")[0].split(".")[0].slice(1)
                    : profile.full_name.split(" ")[0].charAt(0).toUpperCase() + profile.full_name.split(" ")[0].slice(1))
                : "Evaluator"}
            </span>
          </h1>
        </div>
      </div>

      {/* Section: Recently Evaluated Companies */}
      <div className="space-y-3 font-sans">
        <h2 className="text-xs uppercase font-extrabold tracking-widest text-[#7A6C62] flex items-center gap-2">
          <Building className="h-3.5 w-3.5 text-[#E05D38]" />
          Recently Evaluated Companies
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="glass-card h-28 rounded-xl border border-[#E3DBCF] p-4 animate-pulse flex flex-col justify-between">
                <div className="h-4 bg-[#EDE7DC] rounded w-2/3" />
                <div className="h-3 bg-[#EDE7DC] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : recentCompanies.length === 0 ? (
          <div className="glass-card rounded-xl border border-[#E3DBCF] p-6 text-center text-[#7A6C62] text-xs">
            No evaluated companies yet. Perform evaluations with the Chrome extension to see them here.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {recentCompanies.map((company) => (
              <Link
                key={company.id}
                href={`/dashboard/companies/${company.id}`}
                className="glass-card w-full rounded-xl border border-[#E3DBCF] p-4 hover:border-[#E05D38] hover:bg-white transition-all duration-300 group/pill shadow-sm"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] text-[#7A6C62] font-bold uppercase tracking-wider">Client</div>
                    <div className="text-sm font-bold text-[#2B231F] mt-0.5 truncate group-hover/pill:text-[#E05D38] transition-colors">
                      {company.name}
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-[#E05D38]/10 border border-[#E05D38]/20 flex items-center justify-center text-[#E05D38] shrink-0">
                    <Building className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-1.5 text-[10px] text-[#7A6C62]">
                  <Clock className="h-3.5 w-3.5 text-[#7A6C62]" />
                  <span>Last Activity: <span className="font-semibold text-[#2B231F]">{formatRelativeTime(company.lastActivity)}</span></span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Section: Recent Evaluations Tree */}
      <div className="space-y-3 font-sans">
        <h2 className="text-xs uppercase font-extrabold tracking-widest text-[#7A6C62] flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-[#E05D38]" />
          Recent Evaluations
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="glass-card h-14 rounded-xl border border-white/5 p-4 animate-pulse flex items-center justify-between">
                <div className="h-4 bg-slate-800 rounded w-1/3" />
                <div className="h-4 bg-slate-800 rounded w-12" />
              </div>
            ))}
          </div>
        ) : recentFeatures.length === 0 ? (
          <div className="glass-card rounded-xl border border-white/5 p-8 text-center text-slate-500 text-xs">
            No evaluation sessions captured yet.
          </div>
        ) : (
          <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
            <div className="divide-y divide-white/5">
              {recentFeatures.map((row) => {
                const isExpanded = !!expandedFeatures[row.featureId];
                return (
                  <div key={row.featureId} className="p-4 transition-colors hover:bg-[#FAF6EE]/50">
                    {/* Feature Row Header */}
                    <div 
                      onClick={() => toggleFeatureExpand(row.featureId)}
                      className="flex items-center justify-between gap-4 cursor-pointer group/row"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-white border border-[#E3DBCF] flex items-center justify-center text-[#7A6C62] group-hover/row:border-[#E05D38] group-hover/row:text-[#E05D38] transition-colors shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <Folder className="h-4 w-4 text-[#E05D38] shrink-0" />
                          <span className="font-bold text-xs md:text-sm text-[#2B231F] truncate group-hover/row:text-[#E05D38] transition-colors">
                            {row.companyName}
                          </span>
                          <span className="text-[#7A6C62] font-medium text-xs">•</span>
                          <Link
                            href={`/dashboard/companies/${row.companyId}/products/${row.featureId}`}
                            className="text-xs md:text-sm text-[#2B231F] hover:text-[#E05D38] hover:underline truncate transition-colors cursor-pointer font-bold"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.featureName}
                          </Link>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] text-[#1E3A5F] font-extrabold bg-[#94BBE0]/30 px-2.5 py-1 rounded-md border border-[#94BBE0]/60 shadow-sm">
                          {formatRelativeTime(row.lastActivity)}
                        </span>
                      </div>
                    </div>

                    {/* Expandable Session Tree */}
                    {isExpanded && (
                      <div className="pl-6 mt-3 space-y-1 relative animate-in fade-in duration-200">
                        {/* Vertical line connecting Feature to subfolders */}
                        <div className="absolute left-3.5 top-0 bottom-4 w-px bg-[#E3DBCF]" />
                        
                        {/* Subfolder header */}
                        <div className="relative pl-8 py-1.5 flex items-center gap-2 text-[10px] font-bold text-[#7A6C62] uppercase tracking-wider">
                          {/* Horizontal connector to parent line */}
                          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-px bg-[#E3DBCF]" />
                          <Folder className="h-3.5 w-3.5 text-[#7A6C62] shrink-0" />
                          <span>Evaluation Sessions</span>
                        </div>
                        
                        {/* Nested sessions list */}
                        <div className="pl-4 space-y-1 relative">
                          {/* Vertical line for the sub-sessions */}
                          <div className="absolute left-7.5 top-0 bottom-4 w-px bg-[#E3DBCF]" />
                          
                          {row.sessions.map((session, sIdx) => {
                            const isLastSession = sIdx === row.sessions.length - 1;
                            return (
                              <div 
                                key={session.id}
                                onClick={() => {
                                  // Find the full evaluation session object
                                  const fullSession = sessions.find(s => s.id === session.id);
                                  if (fullSession) setInspectedSession(fullSession);
                                }}
                                className="relative pl-10 pr-3 py-1.5 rounded-lg hover:bg-white transition-all cursor-pointer flex items-center justify-between text-xs text-[#2B231F] hover:text-[#E05D38] group/session font-bold"
                              >
                                {/* Vertical line segment */}
                                <div className={`absolute left-7.5 top-0 w-px bg-[#E3DBCF] ${isLastSession ? "h-1/2" : "bottom-0"}`} />
                                {/* Horizontal connector line */}
                                <div className="absolute left-7.5 top-1/2 -translate-y-1/2 w-3.5 h-px bg-[#E3DBCF]" />
                                
                                <div className="flex items-center gap-2 min-w-0">
                                  <Folder className="h-3.5 w-3.5 text-[#E05D38]/80 group-hover/session:text-[#E05D38] shrink-0" />
                                  <span className="truncate font-bold text-[#2B231F] group-hover/session:text-[#E05D38] transition-colors">{session.name}</span>
                                  <span className="text-[10px] text-[#7A6C62] font-normal">({formatExactDate(session.updated_at)})</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Drawer Overlay */}
      {inspectedSession && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 animate-in fade-in duration-300"
            onClick={() => setInspectedSession(null)}
          />
          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-slate-900/95 border-l border-white/10 z-50 shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-300 ease-out">
            {/* Drawer Header */}
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
                  <span className="text-slate-500">Rubric: {inspectedSession.rubric_version.rubric.title}</span>
                </div>
              </div>
              
              <button
                onClick={() => setInspectedSession(null)}
                className="h-8 w-8 rounded-lg border border-white/10 hover:border-white/20 flex items-center justify-center text-slate-450 hover:text-white hover:bg-white/5 transition-all cursor-pointer shrink-0"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            
            {/* Drawer Scrollable Content */}
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
                              <span className="text-[9px] font-bold text-violet-450 uppercase tracking-wider block">Prompt</span>
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
    </div>
  );
}
