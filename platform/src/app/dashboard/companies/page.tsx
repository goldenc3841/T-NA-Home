"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Building, 
  Cpu, 
  Plus, 
  Trash2, 
  Briefcase, 
  Activity,
  Layers
} from "lucide-react";

interface Company {
  id: string;
  name: string;
  created_at: string;
}

interface Feature {
  id: string;
  company_id: string;
  name: string;
  description: string;
}

export default function CompaniesPage() {
  const supabase = createClient();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  
  // Creation States
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newFeatureName, setNewFeatureName] = useState("");
  const [newFeatureDesc, setNewFeatureDesc] = useState("");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);



  async function fetchCompanies() {
    setIsLoading(true);
    const { data } = await supabase
      .from("companies")
      .select("*")
      .order("name", { ascending: true });
    
    setCompanies(data || []);
    if (data && data.length > 0 && !selectedCompany) {
      setSelectedCompany(data[0]);
    }
    setIsLoading(false);
  }

  async function fetchFeatures(companyId: string) {
    const { data } = await supabase
      .from("features")
      .select("*")
      .eq("company_id", companyId)
      .order("name", { ascending: true });
    setFeatures(data || []);
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
      alert("Error creating company: " + error.message);
    } else if (data) {
      setNewCompanyName("");
      setCompanies(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCompany(data);
    }
  };

  const handleCreateFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !newFeatureName.trim()) return;

    setIsActionLoading(true);
    const { data, error } = await supabase
      .from("features")
      .insert({
        company_id: selectedCompany.id,
        name: newFeatureName.trim(),
        description: newFeatureDesc.trim() || null,
      })
      .select()
      .single();

    setIsActionLoading(false);
    if (error) {
      alert("Error creating feature: " + error.message);
    } else if (data) {
      setNewFeatureName("");
      setNewFeatureDesc("");
      setFeatures(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!confirm("Are you sure? Deleting a company will delete all its features, rubrics, and evaluation logs.")) return;

    const { error } = await supabase.from("companies").delete().eq("id", companyId);
    if (error) {
      alert("Error: " + error.message);
    } else {
      setCompanies(prev => prev.filter(c => c.id !== companyId));
      if (selectedCompany?.id === companyId) {
        setSelectedCompany(companies.find(c => c.id !== companyId) || null);
      }
    }
  };

  const handleDeleteFeature = async (featureId: string) => {
    if (!confirm("Are you sure you want to delete this feature? Historical evaluation sessions under this feature will be lost.")) return;

    const { error } = await supabase.from("features").delete().eq("id", featureId);
    if (error) {
      alert("Error: " + error.message);
    } else {
      setFeatures(prev => prev.filter(f => f.id !== featureId));
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchFeatures(selectedCompany.id);
    } else {
      setFeatures([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Client Workspace Manager
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Set up client companies and define the AI product features you evaluate.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Companies List */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card rounded-xl border border-white/5 p-5">
            <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Building className="h-4.5 w-4.5 text-violet-400" />
              Client Companies
            </h2>

            {/* Create Company Form */}
            <form onSubmit={handleCreateCompany} className="mb-6 flex gap-2">
              <input
                type="text"
                required
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Company Name (e.g. Acme Inc.)"
                className="flex-1 bg-slate-950/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                disabled={isActionLoading}
              />
              <button
                type="submit"
                disabled={isActionLoading}
                className="bg-violet-600 hover:bg-violet-500 text-white rounded-lg p-2 transition-all shrink-0 cursor-pointer flex items-center justify-center"
              >
                <Plus className="h-4 w-4" />
              </button>
            </form>

            {/* List */}
            {isLoading ? (
              <div className="text-slate-500 text-xs text-center py-8">Loading companies...</div>
            ) : companies.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-8">No companies created yet.</div>
            ) : (
              <div className="space-y-1.5 max-h-[450px] overflow-y-auto pr-1">
                {companies.map((c) => {
                  const isSelected = selectedCompany?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCompany(c)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                        isSelected
                          ? "bg-violet-600/10 text-violet-400 border-violet-500/30"
                          : "bg-slate-900/20 text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5"
                      }`}
                    >
                      <span className="truncate mr-2 font-semibold">{c.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCompany(c.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Features and Workspace */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCompany ? (
            <div className="glass-card rounded-xl border border-white/5 p-6 space-y-6">
              {/* Selected Company Banner */}
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/5 gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 flex items-center gap-1.5 mb-0.5">
                    <Activity className="h-3 w-3 text-violet-400" />
                    Selected Client Workspace
                  </div>
                  <h2 className="text-xl font-bold text-white">{selectedCompany.name}</h2>
                </div>
                <div className="text-xs text-slate-400">
                  Registered: {new Date(selectedCompany.created_at).toLocaleDateString()}
                </div>
              </div>

              {/* Create Feature Form */}
              <div>
                <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-violet-400" />
                  Add AI Feature / Product under Test
                </h3>
                <form onSubmit={handleCreateFeature} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={newFeatureName}
                    onChange={(e) => setNewFeatureName(e.target.value)}
                    placeholder="Feature Name (e.g. Support Chatbot)"
                    className="bg-slate-950/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                    disabled={isActionLoading}
                  />
                  <input
                    type="text"
                    value={newFeatureDesc}
                    onChange={(e) => setNewFeatureDesc(e.target.value)}
                    placeholder="Brief description (optional)"
                    className="bg-slate-950/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                    disabled={isActionLoading}
                  />
                  <button
                    type="submit"
                    disabled={isActionLoading}
                    className="bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg text-xs py-2 px-4 transition-all shrink-0 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Feature
                  </button>
                </form>
              </div>

              {/* Features List */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-violet-400" />
                  Active Features ({features.length})
                </h3>

                {features.length === 0 ? (
                  <div className="text-slate-500 text-xs py-8 text-center bg-slate-950/20 rounded-lg border border-dashed border-white/5">
                    No features configured for {selectedCompany.name} yet. Add a feature to begin logging evaluations.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {features.map((f) => (
                      <div
                        key={f.id}
                        className="bg-slate-900/30 border border-white/5 rounded-lg p-4 flex justify-between items-start"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="font-semibold text-xs text-slate-200 truncate">{f.name}</div>
                          <div className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {f.description || "No description provided."}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteFeature(f.id)}
                          className="text-slate-500 hover:text-rose-400 p-1.5 rounded transition-colors shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-900/20 border border-dashed border-white/5 rounded-xl text-center">
              <Briefcase className="h-8 w-8 text-slate-500 mb-2" />
              <p className="text-slate-400 text-xs">
                Select a client company from the left panel (or create a new one) to manage its testing workspace.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
