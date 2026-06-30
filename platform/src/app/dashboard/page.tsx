"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  LayoutDashboard, 
  Building, 
  MessageSquare, 
  Layers, 
  User, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Activity,
  FileText,
  Clock
} from "lucide-react";

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

interface AggregateMetric {
  name: string;
  type: string;
  count: number;
  value: string;
  rawPct?: number;
}

export default function DashboardPage() {
  const supabase = createClient();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [sessions, setSessions] = useState<EvaluationSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<EvaluationSession | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalTurns: 0,
  });

  const [aggregates, setAggregates] = useState<AggregateMetric[]>([]);

  async function fetchCompanies() {
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .order("name", { ascending: true });
    setCompanies(data || []);
  }

  async function fetchDashboardData(companyId: string) {
    setIsLoading(true);
    try {
      const url = companyId 
        ? `/api/evaluations?company_id=${companyId}` 
        : "/api/evaluations";
      
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data: EvaluationSession[] = await res.json();
      
      setSessions(data || []);
      computeStatsAndAnalytics(data || []);
      
      // Auto-select the first session if available
      if (data && data.length > 0) {
        setSelectedSession(data[0]);
      } else {
        setSelectedSession(null);
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const computeStatsAndAnalytics = (sessionList: EvaluationSession[]) => {
    const totalSessions = sessionList.length;
    let totalTurns = 0;

    // We want to calculate aggregates by rubric criteria.
    // Map criteria name -> list of score values (to compute averages or distributions)
    const criteriaTracker: Record<string, { type: string; values: string[] }> = {};

    sessionList.forEach(s => {
      totalTurns += s.turns?.length || 0;
      s.turns?.forEach(t => {
        t.scores?.forEach(sc => {
          const critName = sc.criterion.name;
          const critType = sc.criterion.field_type;
          
          if (!criteriaTracker[critName]) {
            criteriaTracker[critName] = { type: critType, values: [] };
          }
          criteriaTracker[critName].values.push(sc.value);
        });
      });
    });

    const parsedAggregates = Object.entries(criteriaTracker).map(([name, tracker]) => {
      if (tracker.type === "rating") {
        const numericValues = tracker.values.map(v => parseFloat(v)).filter(v => !isNaN(v));
        const avg = numericValues.length > 0 
          ? numericValues.reduce((sum, curr) => sum + curr, 0) / numericValues.length 
          : 0;
        return {
          name,
          type: "rating",
          count: numericValues.length,
          value: avg.toFixed(2),
        };
      } else if (tracker.type === "boolean") {
        const passCount = tracker.values.filter(v => v === "Pass").length;
        const total = tracker.values.length;
        const passRate = total > 0 ? (passCount / total) * 100 : 0;
        return {
          name,
          type: "boolean",
          count: total,
          value: `${passRate.toFixed(0)}% Pass`,
          rawPct: passRate,
        };
      } else if (tracker.type === "select") {
        // Find the frequency of each value
        const frequencies: Record<string, number> = {};
        tracker.values.forEach(v => {
          frequencies[v] = (frequencies[v] || 0) + 1;
        });
        const total = tracker.values.length;
        
        // Find most frequent option
        let maxOption = "N/A";
        let maxPct = 0;
        
        if (total > 0) {
          const sortedFreq = Object.entries(frequencies).sort((a, b) => b[1] - a[1]);
          maxOption = sortedFreq[0][0];
          maxPct = (sortedFreq[0][1] / total) * 100;
        }

        return {
          name,
          type: "select",
          count: total,
          value: `${maxOption} (${maxPct.toFixed(0)}%)`,
        };
      } else {
        return {
          name,
          type: "text",
          count: tracker.values.length,
          value: `${tracker.values.length} comments`,
        };
      }
    });

    setStats({ totalSessions, totalTurns });
    setAggregates(parsedAggregates);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDashboardData(selectedCompanyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId]);

  return (
    <div className="space-y-8">
      {/* Upper Navigation Row / Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-7 w-7 text-violet-500" />
            Evaluations Dashboard
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Analyze prompt response metrics, aggregate criteria trends, and drill down into conversations.
          </p>
        </div>

        {/* Company Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          <Building className="h-4.5 w-4.5 text-slate-400" />
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="bg-slate-900/60 border border-white/5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-violet-500"
          >
            <option value="">All Client Companies</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="glass-card rounded-xl border border-white/5 p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Sessions Captured</div>
            <div className="text-2xl font-black text-white mt-1">{stats.totalSessions}</div>
          </div>
        </div>

        <div className="glass-card rounded-xl border border-white/5 p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Turns Logged</div>
            <div className="text-2xl font-black text-white mt-1">{stats.totalTurns}</div>
          </div>
        </div>

        <div className="glass-card rounded-xl border border-white/5 p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Average Turn Ratio</div>
            <div className="text-2xl font-black text-white mt-1">
              {stats.totalSessions > 0 ? (stats.totalTurns / stats.totalSessions).toFixed(1) : 0}
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl border border-white/5 p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Active Rubrics</div>
            <div className="text-2xl font-black text-white mt-1">1</div>
          </div>
        </div>
      </div>

      {/* Aggregate Metric Analytics */}
      <div className="glass-card rounded-xl border border-white/5 p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="h-4.5 w-4.5 text-violet-400" />
          Quality Trend Summaries (Across Captured Dialogues)
        </h2>

        {aggregates.length === 0 ? (
          <div className="text-slate-500 text-xs py-4 text-center">No evaluations captured to generate trends. Load the extension to begin.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {aggregates.map((agg, idx) => (
              <div key={idx} className="bg-slate-900/30 border border-white/5 rounded-lg p-4 space-y-2">
                <div className="text-xs font-semibold text-slate-300 truncate">{agg.name}</div>
                <div className="flex items-baseline justify-between">
                  <div className="text-xl font-extrabold text-violet-400">{agg.value}</div>
                  <span className="text-[9px] text-slate-500 uppercase font-medium">{agg.type}</span>
                </div>
                {/* Visual meter */}
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-violet-500 rounded-full" 
                    style={{
                      width: agg.type === "rating" 
                        ? `${(parseFloat(agg.value) / 5) * 100}%` 
                        : agg.type === "boolean" 
                          ? `${agg.rawPct}%` 
                          : "100%"
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session Logs & Detail Drill-Down Section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Left Column: Sessions List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card rounded-xl border border-white/5 p-5">
            <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2 border-b border-white/5 pb-2.5">
              <FileText className="h-4.5 w-4.5 text-violet-400" />
              Evaluation Sessions Logs
            </h2>

            {isLoading ? (
              <div className="text-slate-500 text-xs py-8 text-center">Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="text-slate-500 text-xs py-8 text-center">No sessions registered.</div>
            ) : (
              <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                {sessions.map((s) => {
                  const isSelected = selectedSession?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSession(s)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all text-xs flex justify-between items-start gap-4 ${
                        isSelected
                          ? "bg-violet-600/10 border-violet-500/30 text-violet-400"
                          : "bg-slate-900/10 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5"
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="font-semibold text-slate-200 truncate">{s.name}</div>
                        <div className="text-[10px] text-slate-400 truncate flex items-center gap-1.5">
                          <span>{s.feature.company.name}</span>
                          <span>•</span>
                          <span>{s.feature.name}</span>
                        </div>
                        <div className="text-[9px] text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          {new Date(s.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className="px-2 py-0.5 rounded bg-slate-950 font-bold text-[9px] text-slate-400 border border-white/5">
                          {s.turns?.length || 0} Turns
                        </span>
                        <ChevronRight className={`h-4 w-4 transition-transform ${isSelected ? "translate-x-1 text-violet-400" : "text-slate-500"}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Session In Depth Inspector */}
        <div className="lg:col-span-3">
          {selectedSession ? (
            <div className="glass-card rounded-xl border border-white/5 p-6 space-y-6">
              {/* Header Details */}
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/5 gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    {selectedSession.name}
                  </h2>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-300">{selectedSession.feature.company.name}</span>
                    <span>•</span>
                    <span>{selectedSession.feature.name}</span>
                    <span>•</span>
                    <span className="text-slate-500">Rubric: {selectedSession.rubric_version.rubric.title}</span>
                  </div>
                </div>
                <div className="text-xs text-slate-400 shrink-0 space-y-0.5 flex flex-col md:items-end">
                  <div className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-violet-400" />
                    <span>Evaluator: {selectedSession.evaluator?.full_name || "Unknown"}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Created: {new Date(selectedSession.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Turns Listing */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Conversation Turns ({selectedSession.turns?.length || 0})
                </h3>

                {(!selectedSession.turns || selectedSession.turns.length === 0) ? (
                  <div className="text-slate-500 text-xs py-8 text-center">
                    No conversation turns captured under this session yet.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {selectedSession.turns
                      .sort((a, b) => a.turn_number - b.turn_number)
                      .map((turn) => (
                        <div 
                          key={turn.id} 
                          className="border border-white/5 rounded-xl bg-slate-900/10 overflow-hidden"
                        >
                          {/* Turn Header */}
                          <div className="px-4 py-2 bg-slate-950 border-b border-white/5 flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
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
                                className="text-[10px] text-slate-500 hover:text-violet-400 flex items-center gap-1 transition-colors"
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
                              <span className="text-[9px] font-bold text-violet-400 uppercase tracking-wider block">Prompt</span>
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
                          <div className="border-t border-white/5 p-4 bg-slate-950/30 space-y-3">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Evaluator Scores</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {turn.scores?.map((score) => (
                                <div 
                                  key={score.id}
                                  className="bg-slate-900/40 border border-white/5 rounded-lg p-3 space-y-1"
                                >
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="font-semibold text-slate-200">{score.criterion.name}</span>
                                    <span className="px-2 py-0.5 rounded bg-violet-600/10 border border-violet-500/20 text-[10px] text-violet-400 font-bold">
                                      {score.value}
                                    </span>
                                  </div>
                                  {score.notes && (
                                    <div className="text-[10px] text-slate-400 leading-relaxed italic bg-slate-950/30 px-2 py-1.5 rounded border border-white/5 mt-1.5">
                                      &ldquo;{score.notes}&rdquo;
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-900/20 border border-dashed border-white/5 rounded-xl text-center">
              <MessageSquare className="h-8 w-8 text-slate-500 mb-2" />
              <p className="text-slate-400 text-xs">
                Select an evaluation session from the logs on the left to inspect its prompts, responses, and ratings.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
