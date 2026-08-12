"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  Building, 
  Plus, 
  Trash2, 
  Save, 
  History, 
  CheckCircle,
  FileSpreadsheet,
  Copy
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
  draft_form_state?: {
    critName: string;
    critDesc: string;
    critType: "rating" | "text" | "boolean" | "select";
    critRequired: boolean;
    ratingMin: number;
    ratingMax: number;
    selectOptions: string;
    editingIndex: number | null;
    criteria?: Criterion[];
  } | null;
}

interface Criterion {
  id?: string;
  name: string;
  description: string;
  field_type: "rating" | "text" | "boolean" | "select";
  field_options: { min?: number; max?: number } | string[] | null;
  is_required: boolean;
}

interface RubricVersionLog {
  id: string;
  version_number: number;
  is_active: boolean;
  created_at: string;
}

export default function RubricsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const searchParams = useSearchParams();
  const companyIdFromUrl = searchParams.get("companyId");
  const rubricIdFromUrl = searchParams.get("rubricId");

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  const clientName = selectedCompany ? selectedCompany.name : "Client";
  
  // Rubric info
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [rubricTitle, setRubricTitle] = useState("");
  const [rubricDesc, setRubricDesc] = useState("");
  
  // Rubric criteria builder
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [versionsLog, setVersionsLog] = useState<RubricVersionLog[]>([]);
  const [companyRubrics, setCompanyRubrics] = useState<Rubric[]>([]);

  const handleAddNewRubric = async () => {
    if (isDirty && rubric?.id) {
      await applyDraftSuffix(rubric.id, rubricTitle);
    }
    setRubric(null);
    setRubricTitle("");
    setRubricDesc("");
    setCriteria([]);
    setVersionsLog([]);
    setLastAutosavedState(null);
    setIsDirty(false);
    router.push(`/dashboard/rubrics?companyId=${selectedCompanyId}&rubricId=new`);
  };

  // Add new criterion form inputs
  const [critName, setCritName] = useState("");
  const [critDesc, setCritDesc] = useState("");
  const [critType, setCritType] = useState<"rating" | "text" | "boolean" | "select">("rating");
  const [critRequired, setCritRequired] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // Configuration options depending on type
  const [ratingMin, setRatingMin] = useState(1);
  const [ratingMax, setRatingMax] = useState(5);
  const [selectOptions, setSelectOptions] = useState(""); // Comma separated

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [lastAutosavedState, setLastAutosavedState] = useState<{
    title: string;
    desc: string;
    criteria: Criterion[];
    form: {
      critName: string;
      critDesc: string;
      critType: "rating" | "text" | "boolean" | "select";
      critRequired: boolean;
      ratingMin: number;
      ratingMax: number;
      selectOptions: string;
      editingIndex: number | null;
    };
  } | null>(null);

  const [isDirty, setIsDirty] = useState(false);

  const isDirtyRef = useRef(false);
  const rubricIdRef = useRef<string | null>(null);
  const rubricTitleRef = useRef("");
  const selectedCompanyIdRef = useRef("");

  useEffect(() => {
    isDirtyRef.current = isDirty;
    rubricIdRef.current = rubric?.id || null;
    rubricTitleRef.current = rubricTitle;
    selectedCompanyIdRef.current = selectedCompanyId;
  }, [isDirty, rubric, rubricTitle, selectedCompanyId]);

  const applyDraftSuffix = async (rubricId: string, currentTitle: string) => {
    const cleanTitle = currentTitle.trim();
    if (!cleanTitle) return;
    const draftTitle = cleanTitle.endsWith(" (DRAFT)") ? cleanTitle : `${cleanTitle} (DRAFT)`;

    try {
      await fetch(`/api/rubrics/${rubricId}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draftTitle }),
        keepalive: true
      });
    } catch (err) {
      console.error("Error applying draft suffix:", err);
    }
  };

  // Page exit/unload draft handler
  useEffect(() => {
    const handleUnload = () => {
      if (isDirtyRef.current && rubricIdRef.current) {
        const cleanTitle = rubricTitleRef.current.trim();
        if (!cleanTitle) return;
        const draftTitle = cleanTitle.endsWith(" (DRAFT)") ? cleanTitle : `${cleanTitle} (DRAFT)`;
        
        const url = `/api/rubrics/${rubricIdRef.current}/draft`;
        const payload = JSON.stringify({ title: draftTitle });
        
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true
        });
      }
    };

    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
      
      // Unmount cleanup: trigger draft suffix update if dirty
      if (isDirtyRef.current && rubricIdRef.current) {
        const cleanTitle = rubricTitleRef.current.trim();
        if (cleanTitle) {
          const draftTitle = cleanTitle.endsWith(" (DRAFT)") ? cleanTitle : `${cleanTitle} (DRAFT)`;
          
          fetch(`/api/rubrics/${rubricIdRef.current}/draft`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: draftTitle }),
            keepalive: true
          });
        }
      }
    };
  }, []);

  const fetchHistoricVersion = async (versionId: string) => {
    setSelectedVersionId(versionId);
    setIsLoading(true);
    try {
      const { data: criteriaList, error } = await supabase
        .from("rubric_criteria")
        .select("*")
        .eq("rubric_version_id", versionId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setCriteria(
        (criteriaList || []).map(c => ({
          id: c.id,
          name: c.name,
          description: c.description || "",
          field_type: c.field_type as "rating" | "text" | "boolean" | "select",
          field_options: c.field_options,
          is_required: c.is_required !== false,
        }))
      );
    } catch (err: any) {
      alert("Error loading version criteria: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const activeId = rubric?.id || null;
    const urlId = rubricIdFromUrl || null;
    
    // Only skip fetching if we already have an active rubric loaded that matches the URL param
    if (activeId !== null && activeId === urlId) {
      return;
    }
    fetchRubric(selectedCompanyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId, rubricIdFromUrl]);

  // Autosave useEffect
  useEffect(() => {
    if (isLoading || isSaving || !selectedCompanyId) return;

    const currentFormState = {
      critName,
      critDesc,
      critType,
      critRequired,
      ratingMin,
      ratingMax,
      selectOptions,
      editingIndex
    };

    const isFirstLoad = !lastAutosavedState;
    if (isFirstLoad) {
      setLastAutosavedState({
        title: rubricTitle,
        desc: rubricDesc,
        criteria: [...criteria],
        form: currentFormState
      });
      return;
    }

    const hasChanged = 
      rubricTitle !== lastAutosavedState.title ||
      rubricDesc !== lastAutosavedState.desc ||
      JSON.stringify(criteria) !== JSON.stringify(lastAutosavedState.criteria) ||
      critName !== lastAutosavedState.form.critName ||
      critDesc !== lastAutosavedState.form.critDesc ||
      critType !== lastAutosavedState.form.critType ||
      critRequired !== lastAutosavedState.form.critRequired ||
      ratingMin !== lastAutosavedState.form.ratingMin ||
      ratingMax !== lastAutosavedState.form.ratingMax ||
      selectOptions !== lastAutosavedState.form.selectOptions ||
      editingIndex !== lastAutosavedState.form.editingIndex;

    if (!hasChanged) return;

    const timer = setTimeout(() => {
      setLastAutosavedState({
        title: rubricTitle,
        desc: rubricDesc,
        criteria: [...criteria],
        form: currentFormState
      });
      performAutosave(rubricTitle, rubricDesc, criteria, rubric, currentFormState);
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    rubricTitle,
    rubricDesc,
    criteria,
    selectedCompanyId,
    isLoading,
    isSaving,
    lastAutosavedState,
    critName,
    critDesc,
    critType,
    critRequired,
    ratingMin,
    ratingMax,
    selectOptions,
    editingIndex
  ]);

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
    if (isDirty && rubric?.id) {
      await applyDraftSuffix(rubric.id, rubricTitle);
    }
    setIsDirty(false);
    setSelectedVersionId(null);

    if (!companyId) {
      setRubric(null);
      setRubricTitle("");
      setRubricDesc("");
      setCriteria([]);
      setVersionsLog([]);
      setCompanyRubrics([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLastAutosavedState(null);
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
      setCompanyRubrics([]);
      setIsLoading(false);
      return;
    }

    setCompanyRubrics(rubrics);

    const rubricIdFromUrl = searchParams.get("rubricId");

    // Check if we want a new rubric blank form
    if (rubricIdFromUrl === "new") {
      setRubric(null);
      setRubricTitle("");
      setRubricDesc("");
      setCriteria([]);
      setVersionsLog([]);
      
      setCritName("");
      setCritDesc("");
      setCritType("rating");
      setCritRequired(true);
      setRatingMin(1);
      setRatingMax(5);
      setSelectOptions("");
      setEditingIndex(null);

      setIsLoading(false);
      return;
    }

    let activeRubric = rubrics[0];
    if (rubricIdFromUrl) {
      const found = rubrics.find(r => r.id === rubricIdFromUrl);
      if (found) {
        activeRubric = found;
      }
    }
    setRubric(activeRubric);
    setRubricTitle(activeRubric.title);
    setRubricDesc(activeRubric.description || "");

    // Restore draft form input states if present
    if (activeRubric.draft_form_state) {
      const dfs = activeRubric.draft_form_state;
      setCritName(dfs.critName || "");
      setCritDesc(dfs.critDesc || "");
      setCritType(dfs.critType || "rating");
      setCritRequired(dfs.critRequired !== false);
      setRatingMin(dfs.ratingMin ?? 1);
      setRatingMax(dfs.ratingMax ?? 5);
      setSelectOptions(dfs.selectOptions || "");
      setEditingIndex(dfs.editingIndex ?? null);
    } else {
      setCritName("");
      setCritDesc("");
      setCritType("rating");
      setCritRequired(true);
      setRatingMin(1);
      setRatingMax(5);
      setSelectOptions("");
      setEditingIndex(null);
    }

    // 2. Fetch versions log
    const { data: versions } = await supabase
      .from("rubric_versions")
      .select("id, version_number, is_active, created_at")
      .eq("rubric_id", activeRubric.id)
      .order("version_number", { ascending: false });
    
    setVersionsLog(versions || []);

    // 3. Restore draft criteria if present, otherwise fetch active version criteria
    const activeVersion = versions?.find(v => v.is_active);
    if (activeRubric.draft_form_state?.criteria) {
      setCriteria(activeRubric.draft_form_state.criteria);
    } else if (activeVersion) {
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
          is_required: c.is_required !== false,
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
      is_required: critRequired,
    };

    setCriteria(prev => [...prev, newCrit]);
    setIsDirty(true);
    
    // Clear inputs
    setCritName("");
    setCritDesc("");
    setCritType("rating");
    setRatingMin(1);
    setRatingMax(5);
    setSelectOptions("");
    setCritRequired(true);
  };

  const handleEditCriterion = (index: number) => {
    const c = criteria[index];
    setEditingIndex(index);
    setCritName(c.name);
    setCritDesc(c.description || "");
    setCritType(c.field_type);
    setCritRequired(c.is_required);
    if (c.field_type === "rating" && c.field_options && !Array.isArray(c.field_options)) {
      setRatingMin(c.field_options.min || 1);
      setRatingMax(c.field_options.max || 5);
    } else if (c.field_type === "select" && Array.isArray(c.field_options)) {
      setSelectOptions(c.field_options.join(", "));
    }
  };

  const handleUpdateCriterion = () => {
    if (editingIndex === null || !critName.trim()) return;

    let options = null;
    if (critType === "rating") {
      options = { min: ratingMin, max: ratingMax };
    } else if (critType === "select") {
      options = selectOptions
        .split(",")
        .map(opt => opt.trim())
        .filter(opt => opt.length > 0);
    }

    setCriteria(prev => prev.map((c, i) => i === editingIndex ? {
      ...c,
      name: critName.trim(),
      description: critDesc.trim(),
      field_type: critType,
      field_options: options,
      is_required: critRequired
    } : c));
    setIsDirty(true);

    // Reset edit state
    setEditingIndex(null);
    setCritName("");
    setCritDesc("");
    setCritType("rating");
    setRatingMin(1);
    setRatingMax(5);
    setSelectOptions("");
    setCritRequired(true);
  };

  const handleRemoveCriterion = (index: number) => {
    setCriteria(prev => prev.filter((_, i) => i !== index));
    setIsDirty(true);
    if (editingIndex === index) {
      setEditingIndex(null);
      setCritName("");
      setCritDesc("");
      setCritType("rating");
      setRatingMin(1);
      setRatingMax(5);
      setSelectOptions("");
      setCritRequired(true);
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
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

      // Clean the title by removing "(DRAFT)" if present
      let cleanTitle = rubricTitle.trim().replace(/\s*\(DRAFT\)\s*/gi, "").trim();

      // 1. Create or update the rubric record
      if (!activeRubricId) {
        const { data: newRubric, error } = await supabase
          .from("rubrics")
          .insert({
            company_id: selectedCompanyId,
            title: cleanTitle,
            description: rubricDesc.trim() || null,
            draft_form_state: null,
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
            title: cleanTitle,
            description: rubricDesc.trim() || null,
            draft_form_state: null,
          })
          .eq("id", activeRubricId);
      }

      // 2. Fetch all versions to calculate the next version number
      const { data: oldVersions } = await supabase
        .from("rubric_versions")
        .select("id, version_number")
        .eq("rubric_id", activeRubricId)
        .order("version_number", { ascending: false });

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
        is_required: c.is_required ?? true,
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

      // Reset baseline state and update title
      setIsDirty(false);
      setRubricTitle(cleanTitle);
      setLastAutosavedState({
        title: cleanTitle,
        desc: rubricDesc,
        criteria: [...criteria],
        form: {
          critName,
          critDesc,
          critType,
          critRequired,
          ratingMin,
          ratingMax,
          selectOptions,
          editingIndex
        }
      });
      router.replace(`/dashboard/rubrics?companyId=${selectedCompanyId}&rubricId=${activeRubricId}`);

      // Reload everything
      await fetchRubric(selectedCompanyId);
    } catch (err: unknown) {
      const error = err as Error;
      alert("Error saving rubric: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const performAutosave = async (
    title: string,
    desc: string,
    currentCriteria: Criterion[],
    activeRubric: Rubric | null,
    formState: any
  ) => {
    if (!selectedCompanyId) return;

    try {
      let rubricId = activeRubric?.id;
      let finalTitle = title.trim();

      if (!rubricId) {
        // If it's a new unsaved rubric
        if (!finalTitle) {
          const untitledCount = companyRubrics.filter(r => r.title.startsWith("Untitled Rubric")).length;
          finalTitle = `Untitled Rubric ${untitledCount + 1}`;
        }

        const draftStatePayload = {
          ...formState,
          criteria: currentCriteria,
        };

        const { data: newRubric, error: rubricErr } = await supabase
          .from("rubrics")
          .insert({
            company_id: selectedCompanyId,
            title: finalTitle,
            description: desc.trim() || null,
            draft_form_state: draftStatePayload,
          })
          .select()
          .single();

        if (rubricErr) throw rubricErr;

        rubricId = newRubric.id;

        const { data: newVersion, error: versionErr } = await supabase
          .from("rubric_versions")
          .insert({
            rubric_id: rubricId,
            version_number: 1,
            is_active: true,
          })
          .select()
          .single();

        if (versionErr) throw versionErr;

        if (currentCriteria.length > 0) {
          const criteriaPayload = currentCriteria.map(c => ({
            rubric_version_id: newVersion.id,
            name: c.name,
            description: c.description || null,
            field_type: c.field_type,
            field_options: c.field_options,
            is_required: c.is_required ?? true,
          }));

          const { error: criteriaErr } = await supabase
            .from("rubric_criteria")
            .insert(criteriaPayload);

          if (criteriaErr) throw criteriaErr;
        }

        const { data: list } = await supabase
          .from("rubrics")
          .select("id, title, description, company_id")
          .eq("company_id", selectedCompanyId)
          .order("created_at", { ascending: false });
        setCompanyRubrics(list || []);

        setRubric(newRubric);
        if (!title.trim()) {
          setRubricTitle(finalTitle);
        }
        setLastAutosavedState({
          title: finalTitle,
          desc: desc,
          criteria: [...currentCriteria],
          form: formState
        });
        router.replace(`/dashboard/rubrics?companyId=${selectedCompanyId}&rubricId=${rubricId}`);
      } else {
        // Existing rubric
        if (!activeRubric) return;

        const draftStatePayload = {
          ...formState,
          criteria: currentCriteria,
        };

        const { data: updatedRubric, error: rubricErr } = await supabase
          .from("rubrics")
          .update({
            title: finalTitle || activeRubric.title,
            description: desc.trim() || null,
            draft_form_state: draftStatePayload,
          })
          .eq("id", rubricId)
          .select()
          .single();

        if (rubricErr) throw rubricErr;

        const { data: list } = await supabase
          .from("rubrics")
          .select("id, title, description, company_id")
          .eq("company_id", selectedCompanyId)
          .order("created_at", { ascending: false });
        setCompanyRubrics(list || []);

        setRubric(updatedRubric);
        if (title.trim() && rubricTitle !== finalTitle) {
          setRubricTitle(finalTitle);
        }
        setLastAutosavedState({
          title: finalTitle,
          desc: desc,
          criteria: [...currentCriteria],
          form: formState
        });
      }
    } catch (err) {
      console.error("Autosave error:", err);
    }
  };

  const handleDuplicateCurrent = async () => {
    if (!rubricTitle.trim()) {
      alert("Please enter a Rubric Title to duplicate.");
      return;
    }
    await performDuplication(rubricTitle, rubricDesc, criteria);
  };

  const handleDuplicateRubric = async (r: Rubric) => {
    setIsSaving(true);
    try {
      // 1. Fetch versions for this rubric
      const { data: versions } = await supabase
        .from("rubric_versions")
        .select("id, version_number, is_active")
        .eq("rubric_id", r.id)
        .order("version_number", { ascending: false });

      const activeVersion = versions?.find(v => v.is_active);
      let targetCriteria: Criterion[] = [];
      if (activeVersion) {
        const { data: criteriaList } = await supabase
          .from("rubric_criteria")
          .select("*")
          .eq("rubric_version_id", activeVersion.id)
          .order("created_at", { ascending: true });

        targetCriteria = (criteriaList || []).map(c => ({
          name: c.name,
          description: c.description || "",
          field_type: c.field_type as "rating" | "text" | "boolean" | "select",
          field_options: c.field_options,
          is_required: c.is_required !== false,
        }));
      }

      await performDuplication(r.title, r.description || "", targetCriteria);
    } catch (err: unknown) {
      const error = err as Error;
      alert("Error duplicating rubric: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const performDuplication = async (title: string, description: string, criteriaList: Criterion[]) => {
    setIsSaving(true);
    try {
      const copyTitle = `${title} (COPY)`;

      // 1. Create a new rubric record in DB
      const { data: newRubric, error: rubricErr } = await supabase
        .from("rubrics")
        .insert({
          company_id: selectedCompanyId,
          title: copyTitle,
          description: description || null,
        })
        .select()
        .single();

      if (rubricErr) throw rubricErr;

      // 2. Create the first rubric version (v1)
      const { data: newVersion, error: versionErr } = await supabase
        .from("rubric_versions")
        .insert({
          rubric_id: newRubric.id,
          version_number: 1,
          is_active: true,
        })
        .select()
        .single();

      if (versionErr) throw versionErr;

      // 3. Insert criteria copies linked to the new version
      if (criteriaList.length > 0) {
        const criteriaPayload = criteriaList.map(c => ({
          rubric_version_id: newVersion.id,
          name: c.name,
          description: c.description || null,
          field_type: c.field_type,
          field_options: c.field_options,
          is_required: c.is_required ?? true,
        }));

        const { error: criteriaErr } = await supabase
          .from("rubric_criteria")
          .insert(criteriaPayload);

        if (criteriaErr) throw criteriaErr;
      }

      // 4. Reload rubrics and select the newly duplicated rubric copy
      router.push(`/dashboard/rubrics?companyId=${selectedCompanyId}&rubricId=${newRubric.id}`);
    } catch (err: unknown) {
      const error = err as Error;
      alert("Error duplicating rubric: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRubric = async (rubricId: string) => {
    if (!confirm("Are you sure you want to delete this rubric? This action cannot be undone.")) {
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("rubrics")
        .delete()
        .eq("id", rubricId);

      if (error) throw error;

      // If we deleted the currently selected rubric, reset the builder editor state!
      if (rubric?.id === rubricId) {
        setRubric(null);
        setRubricTitle("");
        setRubricDesc("");
        setCriteria([]);
        setVersionsLog([]);
        router.push(`/dashboard/rubrics?companyId=${selectedCompanyId}`);
      } else {
        // Just reload the list of rubrics
        await fetchRubric(selectedCompanyId);
      }
    } catch (err: unknown) {
      const error = err as Error;
      alert("Error deleting rubric: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          Rubrics Builder
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Design custom evaluation criteria and input fields.
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

      </div>

      {!selectedCompanyId ? (
        <div className="p-8 text-center bg-white border border-dashed border-[#E3DBCF] rounded-xl text-[#7A6C62] text-xs">
          Please select a client company to display or create a rubric.
        </div>
      ) : isLoading ? (
        <div className="p-8 text-center text-[#7A6C62] text-xs">
          Loading rubric configuration...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 font-sans">
          {/* Left Column: Details & Criteria Setup */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card rounded-xl border border-[#E3DBCF] p-6 space-y-6 shadow-sm">
              <h2 className="text-base font-bold text-[#E05D38] flex items-center gap-2 border-b border-[#E3DBCF] pb-3 font-serif">
                <FileSpreadsheet className="h-4.5 w-4.5 text-[#E05D38]" />
                Rubric Details & Structure
              </h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A6C62]">
                    Rubric Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={rubricTitle}
                    onChange={(e) => {
                      setRubricTitle(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g. Standard Text Quality Rubric"
                    className="w-full bg-white border border-[#E3DBCF] rounded-lg px-3 py-2 text-xs text-[#2B231F] placeholder-[#7A6C62] focus:outline-none focus:border-[#E05D38]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A6C62]">
                    Description
                  </label>
                  <textarea
                    value={rubricDesc}
                    onChange={(e) => {
                      setRubricDesc(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="Describe how evaluators should calibrate these scores..."
                    rows={2}
                    className="w-full bg-white border border-[#E3DBCF] rounded-lg px-3 py-2 text-xs text-[#2B231F] placeholder-[#7A6C62] focus:outline-none focus:border-[#E05D38]"
                  />
                </div>
              </div>

              {/* Criterion Inserter */}
              <div className="p-4 bg-[#FAF6EE] rounded-xl border border-[#E3DBCF] space-y-4">
                <h3 className="text-xs font-bold text-[#2B231F]">
                  {editingIndex !== null ? "Edit Evaluation Field / Criterion" : "Add Evaluation Field / Criterion"}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-wider font-semibold text-[#7A6C62]">Field Name</label>
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

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="crit-required-checkbox"
                      checked={critRequired}
                      onChange={(e) => setCritRequired(e.target.checked)}
                      className="h-4 w-4 rounded border-white/10 bg-slate-950 text-violet-600 focus:ring-violet-550 focus:ring-offset-slate-950 focus:ring-2 cursor-pointer"
                    />
                    <label htmlFor="crit-required-checkbox" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
                      Required
                    </label>
                  </div>

                  {editingIndex !== null ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingIndex(null);
                          setCritName("");
                          setCritDesc("");
                          setCritType("rating");
                          setRatingMin(1);
                          setRatingMax(5);
                          setSelectOptions("");
                          setCritRequired(true);
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-350 border border-slate-700 font-semibold rounded-lg text-xs py-2 px-4 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleUpdateCriterion}
                        className="bg-violet-600 hover:bg-violet-550 text-white font-semibold rounded-lg text-xs py-2 px-4 transition-all shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        Update Field
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAddCriterion}
                      className="bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 border border-violet-500/20 font-semibold rounded-lg text-xs py-2 px-4 transition-all shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Field to Rubric
                    </button>
                  )}
                </div>
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
                        onClick={() => handleEditCriterion(idx)}
                        className={`border rounded-lg p-4 flex justify-between items-center text-xs cursor-pointer transition-all ${
                          editingIndex === idx
                            ? "bg-violet-600/10 border-violet-500/40"
                            : "bg-slate-900/30 border-white/5 hover:border-white/10"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-200">{c.name}</span>
                            <span className="px-2 py-0.5 rounded bg-violet-600/10 border border-violet-500/20 text-[9px] text-violet-400 uppercase font-bold">
                              {c.field_type}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                              c.is_required
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-slate-800 text-slate-450 border border-slate-700/50"
                            }`}>
                              {c.is_required ? "Required" : "Optional"}
                            </span>
                          </div>
                          {c.description && <div className="text-[10px] text-slate-400">{c.description}</div>}
                          {c.field_type === "rating" && c.field_options && !Array.isArray(c.field_options) && (
                            <div className="text-[9px] text-slate-500">Range: {c.field_options.min || 1} to {c.field_options.max || 5}</div>
                          )}
                          {c.field_type === "select" && (
                            <div className="text-[9px] text-slate-500">Options: {Array.isArray(c.field_options) ? c.field_options.join(", ") : "None"}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCriterion(idx);
                          }}
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
              <div className="flex justify-between pt-4 border-t border-white/5 gap-4 flex-wrap">
                <div>
                  {rubric && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRubric(rubric.id)}
                      disabled={isSaving}
                      className="bg-rose-950/20 hover:bg-rose-900/30 disabled:bg-slate-800/20 text-rose-450 border border-rose-900/35 hover:border-rose-800/40 font-semibold rounded-lg text-xs py-2.5 px-6 transition-all cursor-pointer flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Rubric
                    </button>
                  )}
                </div>

                <div className="flex gap-3">
                  {rubric && (
                    <button
                      type="button"
                      onClick={handleDuplicateCurrent}
                      disabled={isSaving}
                      className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/40 text-slate-350 border border-slate-700 hover:border-slate-600 font-semibold rounded-lg text-xs py-2.5 px-6 transition-all cursor-pointer flex items-center gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      Duplicate
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveRubric}
                    disabled={isSaving || criteria.length === 0}
                    className="bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/40 text-white font-semibold rounded-lg text-xs py-2.5 px-6 shadow-lg shadow-violet-500/20 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? "Saving..." : "Save Rubric"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Available Rubrics */}
          <div className="space-y-6">
            <div className="glass-card rounded-xl border border-white/5 p-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="h-4.5 w-4.5 text-violet-400" />
                  {clientName} Rubrics
                </h2>
                <button
                  type="button"
                  onClick={handleAddNewRubric}
                  className="text-[10px] font-extrabold text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
                >
                  + New
                </button>
              </div>

              {companyRubrics.length === 0 ? (
                <div className="text-slate-500 text-xs py-8 text-center">
                  No rubrics registered. Click "+ New" to add one.
                </div>
              ) : (
                <div className="space-y-2">
                  {companyRubrics.map((r) => {
                    const isSelected = rubric?.id === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => router.push(`/dashboard/rubrics?companyId=${selectedCompanyId}&rubricId=${r.id}`)}
                        className={`w-full text-left p-3.5 rounded-lg border text-xs transition-all flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] ${
                          isSelected
                            ? "bg-violet-600/10 border-violet-500/30 text-violet-400 font-bold"
                            : "bg-slate-900/10 border-white/5 text-slate-300"
                        }`}
                      >
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <span className="truncate">{r.title}</span>
                          {r.description && (
                            <span className="text-[10px] text-slate-500 font-normal truncate" title={r.description}>
                              {r.description}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateRubric(r);
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-350 border border-slate-700 hover:border-slate-600 rounded p-1.5 transition-all shrink-0 cursor-pointer"
                            title="Duplicate Rubric"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRubric(r.id);
                            }}
                            className="bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 border border-rose-900/35 hover:border-rose-800/40 rounded p-1.5 transition-all shrink-0 cursor-pointer"
                            title="Delete Rubric"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Version History Card */}
            {rubric && (
              <div className="glass-card rounded-xl border border-white/5 p-6">
                <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3 mb-4">
                  <History className="h-4.5 w-4.5 text-violet-400" />
                  Version History
                </h2>
                {versionsLog.length === 0 ? (
                  <div className="text-slate-500 text-xs py-8 text-center">
                    No version history found.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {versionsLog.map((v) => {
                      const isCurrentLoaded = selectedVersionId === v.id || (selectedVersionId === null && v.is_active);
                      const cleanTitle = rubricTitle.endsWith(" (DRAFT)")
                        ? rubricTitle.substring(0, rubricTitle.length - 8)
                        : rubricTitle;
                      
                      return (
                        <div
                          key={v.id}
                          onClick={() => fetchHistoricVersion(v.id)}
                          className={`w-full text-left p-3.5 rounded-lg border text-xs transition-all flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] ${
                            isCurrentLoaded
                              ? "bg-violet-600/10 border-violet-500/30 text-violet-400 font-bold"
                              : "bg-slate-900/10 border-white/5 text-slate-300"
                          }`}
                        >
                          <div className="flex flex-col gap-1 min-w-0 flex-1">
                            <span className="truncate">{`${cleanTitle} (v${v.version_number})`}</span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              {new Date(v.created_at).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>
                          </div>
                          {v.is_active && (
                            <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 font-medium px-2 py-0.5 rounded-full shrink-0">
                              Active
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
