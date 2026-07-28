"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  Building, 
  Plus, 
  Trash2, 
  Save, 
  History, 
  CheckCircle,
  FileSpreadsheet
} from "lucide-react";

interface Company {
  id: string;
  name: string;
}

interface Rubric {
  id: string;
  company_id: string;
  title: string;
  description: string;
}

interface Criterion {
  id?: string;
  name: string;
  description: string;
  field_type: "rating" | "text" | "boolean" | "select";
  field_options: { min?: number; max?: number } | string[] | null;
}

interface RubricVersionLog {
  id: string;
  version_number: number;
  is_active: boolean;
  created_at: string;
}

export default function RubricsPage() {
  const supabase = createClient();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const searchParams = useSearchParams();
const companyIdFromUrl = searchParams.get("companyId");
  
  // Rubric info
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [rubricTitle, setRubricTitle] = useState("");
  const [rubricDesc, setRubricDesc] = useState("");
  
  // Rubric criteria builder
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [versionsLog, setVersionsLog] = useState<RubricVersionLog[]>([]);

  // Add new criterion form inputs
  const [critName, setCritName] = useState("");
  const [critDesc, setCritDesc] = useState("");
  const [critType, setCritType] = useState<"rating" | "text" | "boolean" | "select">("rating");
  // Configuration options depending on type
  const [ratingMin, setRatingMin] = useState(1);
  const [ratingMax, setRatingMax] = useState(5);
  const [selectOptions, setSelectOptions] = useState(""); // Comma separated

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchRubric(selectedCompanyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId]);

  async function fetchCompanies() {
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .order("name", { ascending: true });
  setCompanies(data || []);
    if (data && data.length > 0) {
      if (companyIdFromUrl && data.some(c => c.id === companyIdFromUrl)) {
        setSelectedCompanyId(companyIdFromUrl);
      } else {
        setSelectedCompanyId(data[0].id);
      }
    }
    setIsLoading(false);
  }

  async function fetchRubric(companyId: string) {
    if (!companyId) {
      setRubric(null);
      setRubricTitle("");
      setRubricDesc("");
      setCriteria([]);
      setVersionsLog([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    // 1. Fetch rubric details
    const { data: rubrics, error } = await supabase
      .from("rubrics")
      .select("*")
      .eq("company_id", companyId);

    if (error || !rubrics || rubrics.length === 0) {
      // No rubric exists for this company
      setRubric(null);
      setRubricTitle("");
      setRubricDesc("");
      setCriteria([]);
      setVersionsLog([]);
      setIsLoading(false);
      return;
    }

    const activeRubric = rubrics[0];
    setRubric(activeRubric);
    setRubricTitle(activeRubric.title);
    setRubricDesc(activeRubric.description || "");

    // 2. Fetch versions log
    const { data: versions } = await supabase
      .from("rubric_versions")
      .select("id, version_number, is_active, created_at")
      .eq("rubric_id", activeRubric.id)
      .order("version_number", { ascending: false });
    
    setVersionsLog(versions || []);

    // 3. Fetch active version criteria
    const activeVersion = versions?.find(v => v.is_active);
    if (activeVersion) {
      const { data: criteriaList } = await supabase
        .from("rubric_criteria")
        .select("*")
        .eq("rubric_version_id", activeVersion.id)
        .order("created_at", { ascending: true });
      
      setCriteria(
        (criteriaList || []).map(c => ({
          id: c.id,
          name: c.name,
          description: c.description || "",
          field_type: c.field_type as "rating" | "text" | "boolean" | "select",
          field_options: c.field_options,
        }))
      );
    } else {
      setCriteria([]);
    }
    setIsLoading(false);
  };

  const handleAddCriterion = () => {
    if (!critName.trim()) return;

    let options = null;
    if (critType === "rating") {
      options = { min: ratingMin, max: ratingMax };
    } else if (critType === "select") {
      options = selectOptions
        .split(",")
        .map(opt => opt.trim())
        .filter(opt => opt.length > 0);
    }

    const newCrit: Criterion = {
      name: critName.trim(),
      description: critDesc.trim(),
      field_type: critType,
      field_options: options,
    };

    setCriteria(prev => [...prev, newCrit]);
    
    // Clear inputs
    setCritName("");
    setCritDesc("");
    setCritType("rating");
    setRatingMin(1);
    setRatingMax(5);
    setSelectOptions("");
  };

  const handleRemoveCriterion = (index: number) => {
    setCriteria(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveRubric = async () => {
    if (!selectedCompanyId || !rubricTitle.trim()) {
      alert("Please enter a Rubric Title.");
      return;
    }

    if (criteria.length === 0) {
      alert("Please add at least one criterion before saving.");
      return;
    }

    setIsSaving(true);
    try {
      let activeRubricId = rubric?.id;

      // 1. Create rubric record if it doesn't exist
      if (!activeRubricId) {
        const { data: newRubric, error } = await supabase
          .from("rubrics")
          .insert({
            company_id: selectedCompanyId,
            title: rubricTitle.trim(),
            description: rubricDesc.trim() || null,
          })
          .select()
          .single();

        if (error) throw error;
        activeRubricId = newRubric.id;
        setRubric(newRubric);
      } else {
        // Update rubric details
        await supabase
          .from("rubrics")
          .update({
            title: rubricTitle.trim(),
            description: rubricDesc.trim() || null,
          })
          .eq("id", activeRubricId);
      }

      // 2. Fetch currently active version
      const { data: oldVersions } = await supabase
        .from("rubric_versions")
        .select("id, version_number")
        .eq("rubric_id", activeRubricId)
        .eq("is_active", true);

      const nextVersionNumber = oldVersions && oldVersions.length > 0
        ? oldVersions[0].version_number + 1
        : 1;

      // 3. Create a new rubric version
      const { data: newVersion, error: versionErr } = await supabase
        .from("rubric_versions")
        .insert({
          rubric_id: activeRubricId,
          version_number: nextVersionNumber,
          is_active: true,
        })
        .select()
        .single();

      if (versionErr) throw versionErr;

      // 4. Insert criteria linked to the new version
      const criteriaPayload = criteria.map(c => ({
        rubric_version_id: newVersion.id,
        name: c.name,
        description: c.description || null,
        field_type: c.field_type,
        field_options: c.field_options,
      }));

      const { error: criteriaErr } = await supabase
        .from("rubric_criteria")
        .insert(criteriaPayload);

      if (criteriaErr) throw criteriaErr;

      // 5. Mark older versions as inactive
      if (oldVersions && oldVersions.length > 0) {
        await supabase
          .from("rubric_versions")
          .update({ is_active: false })
          .eq("rubric_id", activeRubricId)
          .neq("id", newVersion.id);
      }

      alert(`Rubric saved successfully! Promoted to Version ${nextVersionNumber}.`);
      
      // Reload everything
      await fetchRubric(selectedCompanyId);
    } catch (err: unknown) {
      const error = err as Error;
      alert("Error saving rubric: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          Rubrics & Calibration Builder
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Design custom evaluation criteria and input fields. Changes automatically prompt version increments, preserving historical calibrations.
        </p>
      </div>

      {/* Select Company Filter */}
      <div className="glass-card rounded-xl border border-white/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building className="h-5 w-5 text-violet-400" />
          <span className="text-sm font-semibold text-slate-200">Manage Workspace For:</span>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="bg-slate-900/60 border border-white/5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-violet-500"
          >
            <option value="">Select Company...</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {rubric && versionsLog.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-violet-400 font-semibold bg-violet-600/10 px-3 py-1.5 rounded-full border border-violet-500/20">
            <CheckCircle className="h-4 w-4" />
            Active Rubric Version: {versionsLog.find(v => v.is_active)?.version_number || "None"}
          </div>
        )}
      </div>

      {!selectedCompanyId ? (
        <div className="p-8 text-center bg-slate-900/20 border border-dashed border-white/5 rounded-xl text-slate-500 text-xs">
          Please select a client company to display or create a rubric.
        </div>
      ) : isLoading ? (
        <div className="p-8 text-center text-slate-500 text-xs">
          Loading rubric configuration...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Details & Criteria Setup */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card rounded-xl border border-white/5 p-6 space-y-6">
              <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
                <FileSpreadsheet className="h-4.5 w-4.5 text-violet-400" />
                Rubric Details & Structure
              </h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Rubric Title
                  </label>
                  <input
                    type="text"
                    required
                    value={rubricTitle}
                    onChange={(e) => setRubricTitle(e.target.value)}
                    placeholder="e.g. Standard Text Quality Rubric"
                    className="w-full bg-slate-950/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Description
                  </label>
                  <textarea
                    value={rubricDesc}
                    onChange={(e) => setRubricDesc(e.target.value)}
                    placeholder="Describe how evaluators should calibrate these scores..."
                    rows={2}
                    className="w-full bg-slate-950/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Criterion Inserter */}
              <div className="p-4 bg-slate-900/40 rounded-xl border border-white/5 space-y-4">
                <h3 className="text-xs font-bold text-slate-200">Add Evaluation Field / Criterion</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Field Name</label>
                    <input
                      type="text"
                      value={critName}
                      onChange={(e) => setCritName(e.target.value)}
                      placeholder="e.g. Factuality"
                      className="w-full bg-slate-950/60 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Input Type</label>
                    <select
                      value={critType}
                      onChange={(e) => setCritType(e.target.value as "rating" | "text" | "boolean" | "select")}
                      className="w-full bg-slate-950/60 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-violet-500"
                    >
                      <option value="rating">Rating (1-5 Slider)</option>
                      <option value="boolean">Boolean Toggle (Pass/Fail)</option>
                      <option value="select">Dropdown Choice list</option>
                      <option value="text">Long text feedback</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Description / Guidelines</label>
                  <input
                    type="text"
                    value={critDesc}
                    onChange={(e) => setCritDesc(e.target.value)}
                    placeholder="Provide evaluation calibration guidelines for this field..."
                    className="w-full bg-slate-950/60 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  />
                </div>

                {/* Conditional configuration blocks */}
                {critType === "rating" && (
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Min Rating</label>
                      <input
                        type="number"
                        value={ratingMin}
                        onChange={(e) => setRatingMin(parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-950/60 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-violet-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Max Rating</label>
                      <input
                        type="number"
                        value={ratingMax}
                        onChange={(e) => setRatingMax(parseInt(e.target.value) || 5)}
                        className="w-full bg-slate-950/60 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>
                )}

                {critType === "select" && (
                  <div className="space-y-1 pt-1">
                    <label className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Choices (Comma-Separated)</label>
                    <input
                      type="text"
                      value={selectOptions}
                      onChange={(e) => setSelectOptions(e.target.value)}
                      placeholder="e.g. Excellent, Good, Poor, Deficient"
                      className="w-full bg-slate-950/60 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddCriterion}
                  className="bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 border border-violet-500/20 font-semibold rounded-lg text-xs py-2 px-4 transition-all shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Field to Rubric
                </button>
              </div>

              {/* Display Builder Criteria List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-200">Rubric Structure Preview ({criteria.length} Fields)</h3>
                
                {criteria.length === 0 ? (
                  <div className="text-slate-500 text-xs py-8 text-center bg-slate-950/20 rounded-lg border border-dashed border-white/5">
                    No criteria fields defined. Add a field above to build the rubric.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {criteria.map((c, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-900/30 border border-white/5 rounded-lg p-4 flex justify-between items-center text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-200">{c.name}</span>
                            <span className="px-2 py-0.5 rounded bg-violet-600/10 border border-violet-500/20 text-[9px] text-violet-400 uppercase font-bold">
                              {c.field_type}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">{c.description || "No guidelines."}</div>
                          {c.field_type === "rating" && c.field_options && !Array.isArray(c.field_options) && (
                            <div className="text-[9px] text-slate-500">Range: {c.field_options.min || 1} to {c.field_options.max || 5}</div>
                          )}
                          {c.field_type === "select" && (
                            <div className="text-[9px] text-slate-500">Options: {Array.isArray(c.field_options) ? c.field_options.join(", ") : "None"}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCriterion(idx)}
                          className="text-slate-500 hover:text-rose-400 p-1.5 rounded transition-colors shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Save Panel */}
              <div className="flex justify-end pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={handleSaveRubric}
                  disabled={isSaving || criteria.length === 0}
                  className="bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/40 text-white font-semibold rounded-lg text-xs py-2.5 px-6 shadow-lg shadow-violet-500/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save & Publish Version"}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Version History Log */}
          <div className="space-y-6">
            <div className="glass-card rounded-xl border border-white/5 p-6">
              <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3 mb-4">
                <History className="h-4.5 w-4.5 text-violet-400" />
                Version History Log
              </h2>

              {versionsLog.length === 0 ? (
                <div className="text-slate-500 text-xs py-8 text-center">
                  No versions saved yet. Saving updates creates incremental versions.
                </div>
              ) : (
                <div className="space-y-3">
                  {versionsLog.map((v) => (
                    <div
                      key={v.id}
                      className={`p-3.5 rounded-lg border flex flex-col gap-2 ${
                        v.is_active
                          ? "bg-violet-600/10 border-violet-500/30"
                          : "bg-slate-900/10 border-white/5"
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-200">Version {v.version_number}</span>
                        {v.is_active ? (
                          <span className="bg-emerald-500/15 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                            Active
                          </span>
                        ) : (
                          <span className="bg-slate-800 text-slate-500 text-[9px] font-bold px-2 py-0.5 rounded-full">
                            Archived
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Published: {new Date(v.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
