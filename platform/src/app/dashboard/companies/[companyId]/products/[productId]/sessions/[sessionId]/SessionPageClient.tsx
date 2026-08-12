"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  Building, 
  Layers, 
  Clock, 
  ChevronRight, 
  ArrowLeft,
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  MessageSquare,
  Sparkles,
  Award,
  AlertCircle,
  Trash2,
  Download
} from "lucide-react";

interface Criterion {
  id: string;
  name: string;
  field_type: string;
  field_options: any;
}

interface Score {
  id: string;
  value: string;
  notes: string | null;
  criterion_id: string;
  criterion?: {
    id: string;
    name: string;
    rubric_version?: {
      id: string;
      version_number: number;
      rubric?: {
        id: string;
        title: string;
      };
    };
  };
}

interface Turn {
  id: string;
  prompt: string;
  response: string;
  turn_number: number;
  source_url: string | null;
  created_at: string;
  scores: Score[];
}

interface EvaluationSession {
  id: string;
  name: string;
  rubric_version_id: string;
  created_at: string;
  updated_at: string;
  rubric_version?: {
    id: string;
    version_number: number;
    rubric: {
      id: string;
      title: string;
    };
  };
}

interface SessionPageClientProps {
  companyId: string;
  productId: string;
  sessionId: string;
}

export default function SessionPageClient({ companyId, productId, sessionId }: SessionPageClientProps) {
  const supabase = createClient();
  const router = useRouter();

  // Data States
  const [session, setSession] = useState<EvaluationSession | null>(null);
  const [productName, setProductName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [totalProductEvaluations, setTotalProductEvaluations] = useState(0);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);

  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTurns, setExpandedTurns] = useState<Record<string, boolean>>({});

  // Pagination for Detailed Evaluations table
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  async function fetchSessionData() {
    setIsLoading(true);
    try {
      // 1. Fetch current session & nested feature details
      const { data: sessionData, error: sessionErr } = await supabase
        .from("sessions")
        .select(`
          id, 
          name, 
          rubric_version_id, 
          created_at, 
          updated_at, 
          feature:features(name, company:companies(name)),
          rubric_version:rubric_versions(
            id,
            version_number,
            rubric:rubrics(
              id,
              title
            )
          )
        `)
        .eq("id", sessionId)
        .single();
      
      if (sessionErr) throw sessionErr;
      
      if (sessionData) {
        setSession({
          id: sessionData.id,
          name: sessionData.name,
          rubric_version_id: sessionData.rubric_version_id,
          created_at: sessionData.created_at,
          updated_at: sessionData.updated_at,
          rubric_version: sessionData.rubric_version as any
        });
        const feature = Array.isArray(sessionData.feature)
          ? sessionData.feature[0]
          : (sessionData.feature as any);
        if (feature) {
          setProductName(feature.name || "");
          setCompanyName((feature.company as any)?.name || "Client");
        }
      }

      // 2. Fetch all sessions for this product to count total product turns (evaluations)
      const { data: allProductSessions } = await supabase
        .from("sessions")
        .select("id, turns (id)")
        .eq("feature_id", productId);
      
      let productTurnCount = 0;
      allProductSessions?.forEach(s => {
        productTurnCount += s.turns?.length || 0;
      });
      setTotalProductEvaluations(productTurnCount);

      // 3. Fetch Rubric Criteria for the MOST CURRENT (active) version of this session's rubric
      if (sessionData?.rubric_version_id) {
        // 3a. Retrieve the rubric_id of this version
        const { data: currentVersionInfo } = await supabase
          .from("rubric_versions")
          .select("rubric_id")
          .eq("id", sessionData.rubric_version_id)
          .single();

        if (currentVersionInfo) {
          // 3b. Retrieve the active version for this rubric
          const { data: activeVersionInfo } = await supabase
            .from("rubric_versions")
            .select("id")
            .eq("rubric_id", currentVersionInfo.rubric_id)
            .eq("is_active", true)
            .single();
            
          const targetVersionId = activeVersionInfo?.id || sessionData.rubric_version_id;

          // 3c. Load criteria for the current active version (fallback to current version if none active)
          const { data: criteriaData } = await supabase
            .from("rubric_criteria")
            .select("id, name, field_type, field_options")
            .eq("rubric_version_id", targetVersionId)
            .order("created_at", { ascending: true });
          
          setCriteria(criteriaData || []);
        } else {
          // Fallback if rubric_versions record is not found
          const { data: criteriaData } = await supabase
            .from("rubric_criteria")
            .select("id, name, field_type, field_options")
            .eq("rubric_version_id", sessionData.rubric_version_id)
            .order("created_at", { ascending: true });
          setCriteria(criteriaData || []);
        }
      }

      // 4. Fetch Turns and their Scores in this session
      const { data: turnsData } = await supabase
        .from("turns")
        .select(`
          id,
          prompt,
          response,
          turn_number,
          source_url,
          created_at,
          scores (
            id,
            value,
            notes,
            criterion_id,
            criterion:rubric_criteria (
              id,
              name,
              rubric_version:rubric_versions (
                id,
                version_number,
                rubric:rubrics (
                  id,
                  title
                )
              )
            )
          )
        `)
        .eq("session_id", sessionId)
        .order("turn_number", { ascending: false });
      
      setTurns(turnsData as unknown as Turn[] || []);
    } catch (err) {
      console.error("Error loading session workspace details:", err);
    } finally {
      setIsLoading(false);
    }
  }

  // Check if turn scores mismatch the current criteria fields
  const hasMismatchedCriteria = (turn: Turn) => {
    if (criteria.length === 0) return false;
    const hasAll = criteria.every(crit => turn.scores?.some(s => s.criterion?.name === crit.name));
    const hasNoExtras = turn.scores?.every(s => criteria.some(crit => crit.name === s.criterion?.name)) ?? true;
    return !hasAll || !hasNoExtras;
  };

  // Delete turn row from database and local state
  const handleDeleteTurn = async (turnId: string) => {
    if (!window.confirm("Are you sure you want to delete this evaluation row? This action cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("turns")
        .delete()
        .eq("id", turnId);

      if (error) throw error;

      setTurns(prev => {
        const updated = prev.filter(t => t.id !== turnId);
        const newTotalPages = Math.ceil(updated.length / ITEMS_PER_PAGE);
        if (currentPage > newTotalPages && newTotalPages > 0) {
          setCurrentPage(newTotalPages);
        }
        return updated;
      });
    } catch (err: any) {
      alert("Error deleting evaluation row: " + err.message);
    }
  };

  // Export Detailed Evaluations table to downloadable CSV file
  const handleExportCSV = () => {
    if (turns.length === 0) {
      alert("No data available to export.");
      return;
    }

    const headers = [
      "Convo ID",
      "Input",
      "Output",
      "Rubric Used",
      ...criteria.map(crit => crit.name),
      "Note"
    ];

    const escapeCSV = (val: string | null | undefined) => {
      if (val === null || val === undefined) return '""';
      const formatted = String(val).replace(/"/g, '""');
      return `"${formatted}"`;
    };

    const rows = turns.map((turn) => {
      const convoId = getConversationId(turn, turn.turn_number - 1);
      const rubricUsed = getRubricUsed(turn);
      const note = turn.scores?.find(s => s.notes)?.notes || "";
      const criteriaScores = criteria.map(crit => {
        const scoreObj = turn.scores?.find(s => s.criterion_id === crit.id || s.criterion?.name === crit.name);
        return scoreObj?.value || "";
      });

      return [
        convoId,
        turn.prompt,
        turn.response,
        rubricUsed,
        ...criteriaScores,
        note
      ].map(escapeCSV).join(",");
    });

    const csvContent = [headers.map(escapeCSV).join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const clientClean = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const dateClean = new Date().toISOString().split("T")[0];
    
    link.setAttribute("href", url);
    link.setAttribute("download", `${clientClean}-evaluations-${dateClean}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get name of the rubric used for this turn
  const getRubricUsed = (turn: Turn) => {
    const firstScore = turn.scores?.[0] as any;
    const rubricTitle = firstScore?.criterion?.rubric_version?.rubric?.title;
    const versionNum = firstScore?.criterion?.rubric_version?.version_number;
    if (rubricTitle && versionNum) {
      return `${rubricTitle} (v${versionNum})`;
    }
    if (session?.rubric_version?.rubric?.title) {
      return `${session.rubric_version.rubric.title} (v${session.rubric_version.version_number})`;
    }
    return "N/A";
  };

  useEffect(() => {
    fetchSessionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Synthetic Conversation ID grouping
  function getConversationId(turn: Turn, index: number): string {
    // If source URL suggests a convo ID, extract it
    if (turn.source_url) {
      try {
        const url = new URL(turn.source_url);
        const lastSegment = url.pathname.split("/").filter(Boolean).pop();
        if (lastSegment && (/^\d+$/.test(lastSegment) || lastSegment.length >= 4)) {
          return `G${lastSegment.substring(0, 4)}`;
        }
      } catch {
        // ignore url parse error
      }
    }
    // Else mock groupings: group every 2 turns together under the same convo code
    const groupNum = Math.floor(index / 2) + 1;
    // Prefix based on company/session
    const prefix = session?.name ? session.name.substring(0, 2).toUpperCase() : "S";
    return `${prefix}${groupNum}00${groupNum}`;
  }

  // Calculate dynamic analytics per criterion in the current session
  const calculatedAnalytics = criteria.map(crit => {
    // Collect all scores for this criterion in this session
    const scoresForCrit = turns
      .flatMap(t => t.scores || [])
      .filter(s => s.criterion_id === crit.id);
    
    const scoreCount = scoresForCrit.length;

    if (scoreCount === 0) {
      return {
        id: crit.id,
        name: crit.name,
        fieldType: crit.field_type,
        displayValue: "No Data"
      };
    }

    if (crit.field_type === "boolean" || crit.field_type === "select") {
      // Find number of passing values
      const passCount = scoresForCrit.filter(s => {
        const val = s.value.toUpperCase();
        return val === "PASS" || val === "TRUE" || val === "YES";
      }).length;
      const passRate = (passCount / scoreCount) * 100;
      return {
        id: crit.id,
        name: crit.name,
        fieldType: crit.field_type,
        displayValue: `${passRate.toFixed(1)}% PASS`
      };
    }

    if (crit.field_type === "rating") {
      // Sum up numeric scores
      const sum = scoresForCrit.reduce((acc, s) => {
        const parsed = parseFloat(s.value);
        return acc + (isNaN(parsed) ? 0 : parsed);
      }, 0);
      const average = sum / scoreCount;

      // Extract max score from options config
      let maxScore = 5;
      if (crit.field_options) {
        if (Array.isArray(crit.field_options)) {
          const numbers = crit.field_options.map(Number).filter(n => !isNaN(n));
          if (numbers.length > 0) maxScore = Math.max(...numbers);
        } else if (crit.field_options.max) {
          maxScore = Number(crit.field_options.max);
        }
      }
      return {
        id: crit.id,
        name: crit.name,
        fieldType: crit.field_type,
        displayValue: `${average.toFixed(2)} / ${maxScore.toFixed(2)}`
      };
    }

    // Fallback display
    return {
      id: crit.id,
      name: crit.name,
      fieldType: crit.field_type,
      displayValue: `${scoreCount} Evaluations`
    };
  });

  const toggleRowExpand = (turnId: string) => {
    setExpandedTurns(prev => ({
      ...prev,
      [turnId]: !prev[turnId]
    }));
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(turns.length / ITEMS_PER_PAGE));
  const paginatedTurns = turns.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      {/* Clickable Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-450">
        <Link 
          href={`/dashboard/companies/${companyId}`}
          className="hover:text-slate-200 transition-colors uppercase tracking-wider text-[10px]"
        >
          {companyName}
        </Link>
        <ChevronRight className="h-3 w-3 text-slate-650" />
        <Link 
          href={`/dashboard/companies/${companyId}/products/${productId}`}
          className="hover:text-slate-200 transition-colors uppercase tracking-wider text-[10px]"
        >
          {productName}
        </Link>
        <ChevronRight className="h-3 w-3 text-slate-650" />
        <span className="text-violet-400 border-b border-violet-500/30 pb-0.5 uppercase tracking-wider text-[10px] truncate max-w-[150px]" title={session?.name}>
          {session?.name || "Session"}
        </span>
      </nav>

      {/* Header and Back Link */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => router.push(`/dashboard/companies/${companyId}/products/${productId}`)}
          className="flex items-center gap-2 text-slate-450 hover:text-slate-200 transition-colors text-xs font-semibold cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sessions Log
        </button>

        {session?.rubric_version?.rubric && (
          <Link
            href={`/dashboard/rubrics?companyId=${companyId}&rubricId=${session.rubric_version.rubric.id}`}
            className="px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/25 hover:border-violet-400 hover:bg-violet-600/10 text-violet-450 hover:text-violet-300 transition-all text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow"
            title={`Open Rubrics Builder: ${session.rubric_version.rubric.title}`}
          >
            <Award className="h-3.5 w-3.5" />
            Rubric Used: {session.rubric_version.rubric.title} (v{session.rubric_version.version_number})
          </Link>
        )}
      </div>

      {/* Top Section: Session Summary Dashboard Banner */}
      <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
        <div className="bg-slate-950/65 px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            Session Summary Dashboard
          </h2>
          <span className="text-[10px] text-violet-400 font-extrabold uppercase bg-violet-650/10 border border-violet-500/30 px-3 py-1 rounded-full">
            {totalProductEvaluations} Total Evaluations
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-xs animate-pulse">
            Calculating analytics metrics...
          </div>
        ) : calculatedAnalytics.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs italic">
            No grading criteria configuration resolved for this session.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/5">
            {calculatedAnalytics.map((metric) => (
              <div key={metric.id} className="p-5 flex flex-col justify-between space-y-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  {metric.name}
                </span>
                <span className="text-xl font-black text-white tracking-tight">
                  {metric.displayValue}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Section: Detailed Evaluations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
            <MessageSquare className="h-4.5 w-4.5 text-violet-500" />
            Detailed Evaluations
          </h2>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-350 hover:text-white border border-white/5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>

        {isLoading ? (
          <div className="glass-card rounded-xl border border-white/5 p-8 text-center text-slate-500 text-xs animate-pulse">
            Loading evaluation turns list...
          </div>
        ) : turns.length === 0 ? (
          <div className="glass-card rounded-xl border border-white/5 p-8 text-center text-slate-500 text-xs italic">
            No dialogue turns logged for this session yet.
          </div>
        ) : (
          <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-950/65 border-b border-white/5 text-slate-400 uppercase tracking-widest text-[9px] font-bold">
                    <th className="p-4 w-10"></th>
                    <th className="p-4 w-28">Convo ID</th>
                    <th className="p-4 max-w-xs">Input</th>
                    <th className="p-4 max-w-xs">Output</th>
                    <th className="p-4 w-40">Rubric Used</th>
                    
                    {/* Rubric criteria headers */}
                    {criteria.map((crit) => (
                      <th key={crit.id} className="p-4 font-bold">{crit.name}</th>
                    ))}
                    
                    <th className="p-4 w-12 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-350">
                  {paginatedTurns.map((turn, tIdx) => {
                    const convoId = getConversationId(turn, turn.turn_number - 1);
                    const isExpanded = !!expandedTurns[turn.id];
                    const isMismatched = hasMismatchedCriteria(turn);
 
                    return (
                      <React.Fragment key={turn.id}>
                        <tr 
                          key={turn.id} 
                          onClick={() => toggleRowExpand(turn.id)}
                          className={`transition-colors cursor-pointer ${
                            isMismatched 
                              ? "bg-red-500/15 hover:bg-red-500/20 text-red-200" 
                              : "hover:bg-white/[0.01] text-slate-350"
                          }`}
                        >
                          <td className="p-4 text-center">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-slate-500" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-500" />
                            )}
                          </td>
                          <td className={`p-4 font-mono font-bold ${isMismatched ? "text-red-400" : "text-slate-300"}`}>
                            {convoId}
                          </td>
                          <td className="p-4 max-w-xs truncate text-slate-400 font-mono text-[11px]" title={turn.prompt}>
                            {turn.prompt}
                          </td>
                          <td className="p-4 max-w-xs truncate text-slate-400 font-mono text-[11px]" title={turn.response}>
                            {turn.response}
                          </td>
                          <td className="p-4 text-slate-400 whitespace-normal break-words min-w-[120px]" title={getRubricUsed(turn)}>
                            {getRubricUsed(turn)}
                          </td>

                          {/* Render matching score values for each dynamic rubric header */}
                          {criteria.map((crit) => {
                            const score = turn.scores?.find(s => s.criterion_id === crit.id || s.criterion?.name === crit.name);
                            const val = score?.value || "";
                            const isPass = val.toUpperCase() === "PASS" || val.toUpperCase() === "TRUE";
                            const isFail = val.toUpperCase() === "FAIL" || val.toUpperCase() === "FALSE";
                            
                            return (
                              <td key={crit.id} className="p-4 font-semibold">
                                {isPass ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 text-[10px] font-bold uppercase tracking-wider">
                                    {val}
                                  </span>
                                ) : isFail ? (
                                  <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-450 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                                    {val}
                                  </span>
                                ) : (
                                  <span className="text-slate-200">{val}</span>
                                )}
                              </td>
                            );
                          })}

                          <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleDeleteTurn(turn.id)}
                              className="text-slate-500 hover:text-rose-450 p-1.5 rounded hover:bg-rose-950/20 transition-all cursor-pointer inline-flex items-center"
                              title="Delete Evaluation Row"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>

                        {/* Collapsible Sub-Row Details */}
                        {isExpanded && (
                          <tr className="bg-slate-950/30">
                            <td colSpan={criteria.length + 6} className="p-5 border-b border-white/5 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <span className="text-[9px] font-bold text-violet-400 uppercase tracking-wider block">Prompt Input</span>
                                  <div className="bg-slate-950/60 rounded-xl p-3 border border-white/5 font-mono text-[11px] text-slate-350 leading-relaxed whitespace-pre-wrap">
                                    {turn.prompt}
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider block">Response Output</span>
                                  <div className="bg-slate-950/60 rounded-xl p-3 border border-white/5 font-mono text-[11px] text-slate-350 leading-relaxed whitespace-pre-wrap">
                                    {turn.response}
                                  </div>
                                </div>
                              </div>

                              {/* URL Source and detail metadata */}
                              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-white/5">
                                <span>Turn Dialogue number: <span className="font-semibold text-slate-400">{turn.turn_number}</span></span>
                                {turn.source_url && (
                                  <a 
                                    href={turn.source_url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="hover:text-violet-400 transition-colors flex items-center gap-1 font-semibold"
                                  >
                                    URL Link Source
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>

                              {/* Sub notes lists */}
                              {turn.scores?.some(s => s.notes) && (
                                <div className="space-y-2 mt-3 pt-3 border-t border-white/5 bg-slate-900/30 rounded-lg p-3">
                                  <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block">Scoring Guidelines Notes</span>
                                  {turn.scores.map(s => {
                                    if (!s.notes) return null;
                                    const critName = criteria.find(c => c.id === s.criterion_id)?.name || "Criterion";
                                    return (
                                      <div key={s.id} className="text-[11px] text-slate-400 leading-normal">
                                        <span className="font-semibold text-slate-350">{critName}:</span> &ldquo;{s.notes}&rdquo;
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
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
      </div>
    </div>
  );
}
