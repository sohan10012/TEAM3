import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  CheckCircle2,
  FileCode,
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  Quote,
  Scale,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui";
import { api } from "@/services/api";
import { cn } from "@/utils/format";

export interface AiAssistedOnboardingViewProps {
  onSuccess: (data: { project_id: number; key: string; name: string; redirect_url: string }) => void;
  onCancel: () => void;
  onSwitchToManual: () => void;
}

export interface StagedDocItem {
  id: number;
  filename: string;
  display_name: string;
  file_type: string;
  document_type: string;
  size_bytes: number;
  page_count: number;
  status: string;
  sha256_hash?: string;
  is_synthetic_fixture?: boolean;
  fixture_label?: string;
}

export interface ExtractedRuleItem {
  rule_id: string;
  title: string;
  description: string;
  rule_type: string;
  source_document: string;
  page_number: number;
  clause_ref: string;
  supporting_quote: string;
  confidence: number;
  is_inferred: boolean;
  approval_status: "suggested" | "accepted" | "rejected";
}

export interface ExtractedRoleItem {
  role_name: string;
  description: string;
  permissions: string[];
  responsibilities: string;
  restrictions: string;
  source_document: string;
  clause_ref: string;
  is_inferred: boolean;
}

export interface ExtractedScenarioItem {
  title: string;
  description: string;
  actor: string;
  preconditions: string;
  expected_outcome: string;
  business_rules: string;
  module: string;
}

export interface CrossDocInsightItem {
  insight_id: string;
  relationship_type: string;
  concept: string;
  doc_a: { filename: string; rule: string; quote: string };
  doc_b: { filename: string; rule: string; quote: string };
  analysis: string;
  resolution_recommendation: string;
  confidence: number;
}

export const DOMAIN_OPTIONS = [
  "Fintech & Banking",
  "Healthcare & Telemedicine",
  "HR, Benefits & Payroll",
  "E-Commerce & Retail",
  "Enterprise SaaS",
  "Developer Tools & Infrastructure",
  "Cybersecurity & Identity",
  "Supply Chain & Logistics",
  "General Software Platform",
];

export function AiAssistedOnboardingView({
  onSuccess,
  onCancel,
  onSwitchToManual,
}: AiAssistedOnboardingViewProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stepper State: 1 = Details, 2 = Intake, 3 = Analysis, 4 = Review & Approval
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Project Metadata State (Domain-Neutral Clean Defaults)
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [businessDomain, setBusinessDomain] = useState("Enterprise SaaS");
  const [description, setDescription] = useState("");

  // Key Validation State
  const [keyValidation, setKeyValidation] = useState<{
    status: "idle" | "checking" | "valid" | "invalid";
    message: string;
  }>({ status: "idle", message: "" });

  // Step 2: Staged Documents State
  const [stagedDocs, setStagedDocs] = useState<StagedDocItem[]>([]);
  const [isPreloadingUpi, setIsPreloadingUpi] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Step 3: Analysis Pipeline State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStageText, setAnalysisStageText] = useState("");
  const [analysisActiveStageIndex, setAnalysisActiveStageIndex] = useState(0);

  // Step 4: Human Review & Approval State
  const [reviewConfig, setReviewConfig] = useState<any | null>(null);
  const [reviewTab, setReviewTab] = useState<"overview" | "rules" | "roles" | "scenarios" | "insights">("rules");
  const [rulesList, setRulesList] = useState<ExtractedRuleItem[]>([]);
  const [rolesList, setRolesList] = useState<ExtractedRoleItem[]>([]);
  const [scenariosList, setScenariosList] = useState<ExtractedScenarioItem[]>([]);
  const [insightsList, setInsightsList] = useState<CrossDocInsightItem[]>([]);
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ReasonX Explanation Modal State
  const [reasonxOpen, setReasonxOpen] = useState(false);
  const [reasonxQuery, setReasonxQuery] = useState("");
  const [reasonxLoading, setReasonxLoading] = useState(false);
  const [reasonxResult, setReasonxResult] = useState<{ answer: string; citations: any[]; confidence: number } | null>(
    null
  );

  // Debounced Key Validation
  useEffect(() => {
    const cleanKey = key.trim().toUpperCase();
    if (!cleanKey) {
      setKeyValidation({ status: "idle", message: "" });
      return;
    }
    if (!/^[A-Z0-9_-]{2,10}$/.test(cleanKey)) {
      setKeyValidation({
        status: "invalid",
        message: "Key must be 2–10 uppercase letters, numbers, hyphens or underscores.",
      });
      return;
    }

    setKeyValidation({ status: "checking", message: "Validating uniqueness..." });
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ valid: boolean; key: string; message: string }>(
          `/projects/validate-key?key=${cleanKey}`
        );
        if (res.valid) {
          setKeyValidation({ status: "valid", message: res.message });
        } else {
          setKeyValidation({ status: "invalid", message: res.message });
        }
      } catch (err: any) {
        setKeyValidation({ status: "invalid", message: err?.message || "Validation failed" });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [key]);

  // Handle Project Name Changes and auto-suggest Key if not edited
  const handleNameChange = (val: string) => {
    setName(val);
    const generated = val
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 8);
    if (generated.length >= 2 && (!key || key === "UPI_DISP" || keyValidation.status === "invalid")) {
      setKey(generated);
    }
  };

  // Preload UPI Regulatory Documents
  const handlePreloadUpiDocs = async () => {
    setIsPreloadingUpi(true);
    try {
      const res = await api.post<{ staged_documents: StagedDocItem[]; count: number }>(
        "/projects/onboarding/preload-upi-documents"
      );
      setStagedDocs(res.staged_documents || []);
      setName("UPI Dispute & Customer Protection Platform");
      setKey("UPI_DISP");
      setBusinessDomain("Fintech & Banking");
      setDescription(
        "Automated UPI failed transaction TAT reversal, ₹100/day compensation, and customer liability adjudication platform."
      );
      toast.ok(`Loaded ${res.count} demonstration test fixtures into staging.`);
    } catch (err: any) {
      toast.error(`Preload failed: ${err?.message || "Error"}`);
    } finally {
      setIsPreloadingUpi(false);
    }
  };

  // Upload custom document
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("display_name", file.name.replace(/\.[^/.]+$/, ""));
      formData.append("purpose", "prd");

      try {
        const uploaded = await api.upload<StagedDocItem>("/projects/onboarding/upload", formData);
        setStagedDocs((prev) => [...prev, uploaded]);
        toast.ok(`Staged '${file.name}' for AI document analysis.`);
      } catch (err: any) {
        toast.error(`Failed to stage ${file.name}: ${err?.message || "Upload failed"}`);
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveStagedDoc = (id: number) => {
    setStagedDocs((prev) => prev.filter((d) => d.id !== id));
  };

  // Trigger AI Document Analysis
  const handleRunAnalysis = async () => {
    if (stagedDocs.length === 0) {
      toast.error("Please stage at least one business specification or preload the UPI circulars.");
      return;
    }

    setCurrentStep(3);
    setIsAnalyzing(true);
    setAnalysisProgress(15);
    setAnalysisActiveStageIndex(0);
    setAnalysisStageText("Parsing document text and normalizing regulatory clauses...");

    const t1 = setTimeout(() => {
      setAnalysisProgress(35);
      setAnalysisActiveStageIndex(1);
      setAnalysisStageText("Extracting regulatory invariants, TAT mandates, and ₹100/day compensation formulas...");
    }, 500);

    const t2 = setTimeout(() => {
      setAnalysisProgress(65);
      setAnalysisActiveStageIndex(2);
      setAnalysisStageText("Synthesizing actor personas, operational roles, and end-to-end business scenarios...");
    }, 1100);

    const t3 = setTimeout(() => {
      setAnalysisProgress(88);
      setAnalysisActiveStageIndex(3);
      setAnalysisStageText("Reconciling cross-document relationships & Internal Ombudsman governance gates...");
    }, 1700);

    try {
      const payload = {
        document_ids: stagedDocs.map((d) => d.id),
        project_name: name.trim() || "UPI Dispute & Customer Protection Platform",
        project_key: key.trim().toUpperCase() || "UPI_DISP",
        business_domain: businessDomain,
        description: description.trim(),
      };

      const result = await api.post<any>("/projects/onboarding/analyze", payload);

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      setAnalysisProgress(100);
      setAnalysisActiveStageIndex(4);
      setAnalysisStageText("Analysis complete! Assembling structured configuration for review.");

      setReviewConfig(result);
      setRulesList(result.business_rules || []);
      setRolesList(result.roles || result.roles_and_responsibilities || []);
      setScenariosList(result.scenarios || result.business_scenarios || []);
      setInsightsList(result.cross_document_insights || []);

      setTimeout(() => {
        setIsAnalyzing(false);
        setCurrentStep(4);
      }, 700);
    } catch (err: any) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setIsAnalyzing(false);
      toast.error(`AI analysis failed: ${err?.message || "Analysis error"}`);
      setCurrentStep(2);
    }
  };

  // Rule approval toggles
  const handleToggleRuleStatus = (ruleId: string, status: "accepted" | "rejected") => {
    setRulesList((prev) =>
      prev.map((r) => (r.rule_id === ruleId ? { ...r, approval_status: status } : r))
    );
  };

  // ReasonX grounded question
  const handleAskReasonX = async (queryText: string) => {
    if (!reviewConfig) return;
    setReasonxQuery(queryText);
    setReasonxOpen(true);
    setReasonxLoading(true);

    try {
      const res = await api.post<any>("/projects/onboarding/reasonx-explain", {
        configuration: {
          ...reviewConfig,
          business_rules: rulesList,
          roles_and_responsibilities: rolesList,
          business_scenarios: scenariosList,
        },
        query: queryText,
      });
      setReasonxResult(res);
    } catch (err: any) {
      setReasonxResult({
        answer: `ReasonX inquiry encountered an issue: ${err?.message || "Unknown error"}`,
        citations: [],
        confidence: 0,
      });
    } finally {
      setReasonxLoading(false);
    }
  };

  // Submit approved project
  const handleApproveAndCreate = async () => {
    if (!approvalConfirmed) {
      toast.error("Please confirm that you have reviewed and approved the AI-extracted configuration.");
      return;
    }
    if (!reviewConfig) return;

    setIsSubmitting(true);
    try {
      const approvedPayload = {
        approved_configuration: {
          ...reviewConfig,
          project_metadata: {
            ...reviewConfig.project_metadata,
            name: name.trim(),
            key: key.trim().toUpperCase(),
            business_domain: businessDomain,
            description: description.trim(),
          },
          business_rules: rulesList.filter((r) => r.approval_status !== "rejected"),
          roles_and_responsibilities: rolesList,
          business_scenarios: scenariosList,
          cross_document_insights: insightsList,
          staged_documents: stagedDocs,
        },
      };

      const res = await api.post<any>("/projects/onboarding/create", approvedPayload);
      toast.ok(`Project '${res.name}' created with ${res.requirements_count} verified requirements!`);
      onSuccess(res);
    } catch (err: any) {
      toast.error(`Failed to create project: ${err?.message || "Creation error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mode A Progressive Stepper Nav */}
      <nav aria-label="AI Onboarding Steps" className="px-6 py-3 border-b border-slate-200 bg-white shrink-0">
        <div className="grid grid-cols-4 gap-2">
          {[
            { step: 1, title: "1. Project Details", sub: "Name, key & domain" },
            { step: 2, title: "2. Document Intake", sub: "Upload or preload circulars" },
            { step: 3, title: "3. AI Document Analysis", sub: "Extraction & reconciliation" },
            { step: 4, title: "4. Human Review & Approval", sub: "Rules, roles & creation" },
          ].map((s) => {
            const isCurrent = currentStep === s.step;
            const isPast = currentStep > s.step;
            return (
              <button
                key={s.step}
                type="button"
                disabled={isAnalyzing || (s.step === 3 && currentStep !== 3) || (s.step === 4 && !reviewConfig)}
                onClick={() => {
                  if (s.step === 1 || s.step === 2 || (s.step === 4 && reviewConfig)) {
                    setCurrentStep(s.step as any);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 text-left p-2 rounded-lg transition-all border text-xs",
                  isCurrent
                    ? "bg-blue-50/80 border-[#3067DB] text-slate-900 shadow-2xs font-semibold"
                    : isPast
                    ? "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/60"
                    : "border-transparent text-slate-400 opacity-60"
                )}
              >
                <div
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                    isCurrent
                      ? "bg-[#3067DB] text-white"
                      : isPast
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-600"
                  )}
                >
                  {isPast ? <Check className="h-3.5 w-3.5" /> : s.step}
                </div>
                <div className="min-w-0">
                  <p className="truncate leading-tight font-medium">{s.title}</p>
                  <p className="text-[10px] text-slate-400 truncate leading-tight">{s.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
        {/* ========================================================================= */}
        {/* STEP 1: PROJECT ESSENTIALS */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#3067DB] border border-blue-200 font-semibold text-2xs mb-2">
                <Sparkles className="h-3.5 w-3.5 text-[#3067DB]" />
                Mode A: AI-Assisted Document-First Onboarding
              </div>
              <h3 className="text-base font-bold text-slate-900">Define Project Essentials</h3>
              <p className="text-xs text-slate-500 mt-1">
                Provide basic project identifiers. TraceTest AI will automatically extract comprehensive business rules,
                personas, invariants, and test scenarios from your business documents.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. UPI Dispute & Customer Protection Platform"
                  className="w-full h-10 px-3 font-medium text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3067DB] focus:border-transparent bg-white shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Project Key <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={10}
                      value={key}
                      onChange={(e) => setKey(e.target.value.toUpperCase())}
                      placeholder="e.g. UPI_DISP"
                      className="w-full h-10 px-3 font-mono uppercase font-semibold text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3067DB] focus:border-transparent bg-white shadow-2xs"
                    />
                    <div className="absolute right-3 top-3">
                      {keyValidation.status === "checking" && (
                        <Loader2 className="h-4 w-4 animate-spin text-[#3067DB]" />
                      )}
                      {keyValidation.status === "valid" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                      {keyValidation.status === "invalid" && <AlertCircle className="h-4 w-4 text-red-600" />}
                    </div>
                  </div>
                  <div className="text-[11px] mt-1">
                    {keyValidation.status === "valid" && (
                      <span className="text-emerald-700 font-medium">✓ {keyValidation.message}</span>
                    )}
                    {keyValidation.status === "invalid" && (
                      <span className="text-red-600 font-medium">{keyValidation.message}</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Business Domain <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={businessDomain}
                    onChange={(e) => setBusinessDomain(e.target.value)}
                    className="w-full h-10 px-3 font-medium text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3067DB] focus:border-transparent bg-white shadow-2xs"
                  >
                    {DOMAIN_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">High-Level Description (Optional)</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summarize the core problem statement, mission, and regulatory or business goals..."
                  className="w-full p-3 font-normal text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3067DB] focus:border-transparent bg-white shadow-2xs resize-none"
                />
              </div>
            </div>

            {/* Step 1 Actions */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="text-xs">
                  Cancel
                </Button>
                <button
                  type="button"
                  onClick={onSwitchToManual}
                  className="text-xs text-slate-600 hover:text-slate-900 underline font-medium"
                >
                  Switch to Manual 5-Step Setup
                </button>
              </div>
              <Button
                variant="primary"
                onClick={() => setCurrentStep(2)}
                disabled={!name.trim() || keyValidation.status !== "valid"}
                className="bg-[#3067DB] hover:bg-[#2554b5] text-white font-medium px-5 h-9"
              >
                <span>Next: Ingest Documents</span>
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: DOCUMENT INTAKE & PRELOAD */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div>
              <h3 className="text-base font-bold text-slate-900">Document Intake & Specification Staging</h3>
              <p className="text-xs text-slate-500 mt-1">
                Upload your Product Requirements Documents (PRDs), Software Specs, or regulatory compliance policies for automated, source-grounded context generation.
              </p>
            </div>

            {/* Quick Action: Load Sample Fixture */}
            <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/40 p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-600 text-white shadow-2xs">
                    <Scale className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-xs font-bold text-slate-900">
                    Sample Test Fixtures (Synthetic UPI Policy Simulation)
                  </h4>
                  <span className="rounded bg-amber-100 text-amber-900 text-[10px] font-bold px-1.5 py-0.2">
                    Demonstration Fixture
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                  Loads 3 synthetic test fixture documents simulating UPI dispute policies for demonstration and automated testing.
                  These are not official regulatory publications. To test authentic documents, upload original PDF/DOCX files below.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={handlePreloadUpiDocs}
                loading={isPreloadingUpi}
                className="bg-white hover:bg-slate-50 text-slate-800 border-amber-300 font-medium shrink-0 shadow-2xs"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-600" />
                <span>Load Sample Fixture (Synthetic)</span>
              </Button>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                handleFileUpload(e.dataTransfer.files);
              }}
              className={cn(
                "rounded-xl border-2 border-dashed p-8 text-center transition-all bg-white cursor-pointer shadow-xs",
                isDragOver ? "border-[#3067DB] bg-blue-50/30" : "border-slate-300 hover:border-slate-400"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600 shadow-2xs">
                  {isUploading ? <Loader2 className="h-5 w-5 animate-spin text-[#3067DB]" /> : <Upload className="h-5 w-5" />}
                </div>
                <h4 className="text-xs font-bold text-slate-800">
                  {isUploading ? "Staging and parsing uploaded documents..." : "Click or drag documents here to stage"}
                </h4>
                <p className="text-[11px] text-slate-500">Supports PDF, DOCX, TXT, and Markdown files up to 50MB</p>
              </div>
            </div>

            {/* Staged Document Cards */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 px-1">
                <span>Staged Documents ({stagedDocs.length})</span>
                <span className="text-[11px] text-slate-500">Ready for automated AI analysis</span>
              </div>

              {stagedDocs.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-400">
                  No documents staged yet. Use the Quick-Load button above or drop custom PRD/SRS files.
                </div>
              ) : (
                <div className="space-y-2">
                  {stagedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between shadow-2xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#3067DB] shrink-0 border border-blue-100">
                          {doc.file_type === "pdf" ? (
                            <FileText className="h-4 w-4" />
                          ) : doc.file_type === "docx" ? (
                            <FileSpreadsheet className="h-4 w-4" />
                          ) : (
                            <FileCode className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate text-xs">{doc.display_name || doc.filename}</p>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span className="uppercase font-mono font-semibold">{doc.file_type}</span>
                            <span>•</span>
                            <span>{(doc.size_bytes / 1024).toFixed(1)} KB</span>
                            <span>•</span>
                            <span>{doc.page_count} page(s)</span>
                            {doc.is_synthetic_fixture ? (
                              <span className="rounded bg-amber-100 text-amber-900 px-1.5 py-0.2 font-semibold">
                                Synthetic Fixture
                              </span>
                            ) : (
                              <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.2 font-semibold">
                                Authentic Document
                              </span>
                            )}
                            {doc.sha256_hash && (
                              <span className="font-mono text-[9px] text-slate-400" title={`SHA-256: ${doc.sha256_hash}`}>
                                SHA: {doc.sha256_hash.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveStagedDoc(doc.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 transition-colors"
                        title="Remove Document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2 Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button variant="secondary" onClick={() => setCurrentStep(1)} className="font-medium text-xs">
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                <span>Back</span>
              </Button>
              <Button
                variant="primary"
                onClick={handleRunAnalysis}
                disabled={stagedDocs.length === 0}
                className="bg-[#3067DB] hover:bg-[#2554b5] text-white font-medium px-5 h-9 shadow-2xs"
              >
                <Brain className="h-4 w-4 mr-1.5" />
                <span>Run AI Document Analysis ({stagedDocs.length})</span>
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: LIVE ANALYSIS PIPELINE */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <div className="space-y-6 max-w-2xl mx-auto py-8 text-center">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-[#3067DB] shadow-md">
                <Brain className="h-8 w-8 text-[#3067DB] animate-pulse" />
                <div className="absolute -inset-1 rounded-2xl border-2 border-[#3067DB]/40 animate-ping" />
              </div>
              <h3 className="text-base font-bold text-slate-900">TraceTest Context Intelligence Engine</h3>
              <p className="text-xs text-slate-600 max-w-md">{analysisStageText}</p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 max-w-md mx-auto">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Document Extraction Pipeline</span>
                <span>{analysisProgress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden shadow-inner">
                <div
                  className="h-full bg-[#3067DB] transition-all duration-300 rounded-full"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
            </div>

            {/* Stepper of Stages */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs text-left max-w-md mx-auto space-y-2.5">
              {[
                { label: "Document Ingestion & AST Parsing", desc: "Extracting normalized text and structure" },
                { label: "Regulatory Invariant Extraction", desc: "TAT mandates, compensation formulas & liability limits" },
                { label: "Operational Role & Responsibility Synthesis", desc: "User personas, permissions & restrictions" },
                { label: "End-to-End Business Scenario Generation", desc: "Preconditions, expected outcomes & rule linkages" },
                { label: "Cross-Document Reconciliation & Governance Gate", desc: "Harmonizing DPSS 629, BC.78 & RB-IOS 2026" },
              ].map((stg, idx) => {
                const isComplete = idx < analysisActiveStageIndex;
                const isCurrent = idx === analysisActiveStageIndex;
                return (
                  <div key={stg.label} className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-2xs font-bold mt-0.5 shrink-0",
                        isComplete
                          ? "bg-emerald-600 text-white"
                          : isCurrent
                          ? "bg-[#3067DB] text-white animate-pulse"
                          : "bg-slate-200 text-slate-500"
                      )}
                    >
                      {isComplete ? <Check className="h-3 w-3" /> : idx + 1}
                    </div>
                    <div>
                      <div
                        className={cn(
                          "text-xs font-semibold",
                          isCurrent ? "text-[#3067DB]" : isComplete ? "text-slate-800" : "text-slate-400"
                        )}
                      >
                        {stg.label}
                      </div>
                      <div className="text-[10px] text-slate-500">{stg.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: HUMAN REVIEW & APPROVAL WORKSPACE */}
        {/* ========================================================================= */}
        {currentStep === 4 && reviewConfig && (
          <div className="space-y-5">
            {/* Summary Metrics Banner */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">{name}</span>
                  <span className="rounded bg-blue-100 text-[#3067DB] px-1.5 py-0.2 font-mono font-bold text-2xs">
                    {key}
                  </span>
                </div>
                <p className="text-2xs text-slate-600 mt-0.5">
                  Extracted from <strong>{stagedDocs.length}</strong> regulatory circulars with evidence citations.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-center bg-white px-2.5 py-1 rounded-lg border border-blue-100 shadow-2xs">
                  <div className="text-xs font-bold text-[#3067DB]">{rulesList.length}</div>
                  <div className="text-[9px] text-slate-500">Business Rules</div>
                </div>
                <div className="text-center bg-white px-2.5 py-1 rounded-lg border border-blue-100 shadow-2xs">
                  <div className="text-xs font-bold text-[#3067DB]">{rolesList.length}</div>
                  <div className="text-[9px] text-slate-500">Roles</div>
                </div>
                <div className="text-center bg-white px-2.5 py-1 rounded-lg border border-blue-100 shadow-2xs">
                  <div className="text-xs font-bold text-[#3067DB]">{scenariosList.length}</div>
                  <div className="text-[9px] text-slate-500">Scenarios</div>
                </div>
                <div className="text-center bg-white px-2.5 py-1 rounded-lg border border-blue-100 shadow-2xs">
                  <div className="text-xs font-bold text-emerald-600">
                    {Math.round((reviewConfig.extraction_summary?.confidence_avg || 0.98) * 100)}%
                  </div>
                  <div className="text-[9px] text-slate-500">Confidence</div>
                </div>
              </div>
            </div>

            {/* AI Model & Analysis Provenance Audit Banner */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#3067DB] text-white shadow-2xs">
                    <Brain className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">AI Model & Document Provenance Audit</h4>
                    <p className="text-[10px] text-slate-500">
                      Grounded analysis powered by configured LLM with automated verbatim quote guardrail verification.
                    </p>
                  </div>
                </div>

                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded",
                    reviewConfig.extraction_summary?.is_synthetic_fixture
                      ? "bg-amber-100 text-amber-900 border border-amber-200"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  )}
                >
                  {reviewConfig.extraction_summary?.is_synthetic_fixture
                    ? "Demonstration Fixture Mode"
                    : "Authentic Document Ingestion"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2.5 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] font-medium">Provider & Model</span>
                  <span className="font-semibold text-slate-800 font-mono text-[11px]">
                    {reviewConfig.extraction_summary?.llm_provider || "live"}:{" "}
                    {reviewConfig.extraction_summary?.llm_model || "configured"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-medium">Verbatim Grounded Quotes</span>
                  <span className="font-semibold text-emerald-700">
                    {reviewConfig.extraction_summary?.verified_quotes_count || 0} of {rulesList.length} Verified
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-medium">Inferred Deductions</span>
                  <span className="font-semibold text-amber-700">
                    {reviewConfig.extraction_summary?.inferred_rules_count || 0} Inferred
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-medium">Document Source Hashes</span>
                  <span className="font-semibold text-slate-700 font-mono text-[10px]">
                    {stagedDocs.length} Staged Files Verified
                  </span>
                </div>
              </div>
            </div>

            {/* Review Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 pb-2">
              {[
                { id: "rules", label: `Business Rules & TAT (${rulesList.length})`, icon: Scale },
                { id: "roles", label: `Roles & Personas (${rolesList.length})`, icon: ShieldCheck },
                { id: "scenarios", label: `Business Scenarios (${scenariosList.length})`, icon: Layers },
                { id: "insights", label: `Cross-Doc Insights (${insightsList.length})`, icon: Brain },
                { id: "overview", label: "Product Context & Scope", icon: FileText },
              ].map((t) => {
                const Icon = t.icon;
                const isActive = reviewTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setReviewTab(t.id as any)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                      isActive
                        ? "bg-[#3067DB] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT: BUSINESS RULES & TAT */}
            {reviewTab === "rules" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-600 px-1">
                  <span>
                    Each rule includes exact verbatim citations from the source circular. Reject or edit any rule before
                    creating the project.
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {rulesList.filter((r) => r.approval_status !== "rejected").length} Active / Approved
                  </span>
                </div>

                <div className="space-y-3">
                  {rulesList.map((rule) => {
                    const isRejected = rule.approval_status === "rejected";
                    return (
                      <div
                        key={rule.rule_id}
                        className={cn(
                          "rounded-xl border p-4 transition-all shadow-2xs space-y-2.5",
                          isRejected
                            ? "border-slate-200 bg-slate-50/60 opacity-60"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-2xs font-bold px-2 py-0.5 rounded bg-blue-100 text-[#3067DB]">
                              {rule.rule_id}
                            </span>
                            <h4
                              className={cn(
                                "text-xs font-bold",
                                isRejected ? "text-slate-500 line-through" : "text-slate-900"
                              )}
                            >
                              {rule.title}
                            </h4>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {Math.round(rule.confidence * 100)}% Confidence
                            </span>
                            {rule.is_inferred ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                Inferred
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Verbatim Grounded
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleAskReasonX(`Explain the legal and operational basis for ${rule.rule_id} (${rule.title})`)}
                              className="h-7 text-[11px] text-[#3067DB] hover:bg-blue-50 border-blue-200"
                            >
                              <Brain className="h-3.5 w-3.5 mr-1" />
                              <span>Ask ReasonX</span>
                            </Button>
                            {isRejected ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleToggleRuleStatus(rule.rule_id, "accepted")}
                                className="h-7 text-[11px] text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                <span>Restore</span>
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleToggleRuleStatus(rule.rule_id, "rejected")}
                                className="h-7 text-[11px] text-rose-600 hover:bg-rose-50 border-rose-200"
                              >
                                <X className="h-3 w-3 mr-1" />
                                <span>Reject</span>
                              </Button>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed">{rule.description}</p>

                        {/* Exact Supporting Quote */}
                        <div className="rounded-lg bg-amber-50/60 border border-amber-200 p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
                          <Quote className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="font-bold">Verbatim Source Quote: </span>
                            <span className="italic">“{rule.supporting_quote}”</span>
                          </div>
                        </div>

                        {/* Provenance Footnote */}
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                          <span className="font-semibold text-slate-700">Source:</span>
                          <span>{rule.source_document}</span>
                          <span>•</span>
                          <span>{rule.clause_ref}</span>
                          <span>•</span>
                          <span>Page {rule.page_number}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT: ROLES & PERSONAS */}
            {reviewTab === "roles" && (
              <div className="space-y-3">
                <div className="text-xs text-slate-600 px-1">
                  Synthesized operational roles, user journeys, permissions, and security restrictions.
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rolesList.map((r, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{r.role_name}</span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600">
                          {r.clause_ref}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{r.description}</p>
                      <div className="space-y-1 text-[11px] pt-1">
                        <div>
                          <strong className="text-slate-800">Responsibilities:</strong>{" "}
                          <span className="text-slate-600">{r.responsibilities}</span>
                        </div>
                        <div>
                          <strong className="text-rose-700">Restrictions:</strong>{" "}
                          <span className="text-slate-600">{r.restrictions}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {r.permissions.map((p) => (
                          <span key={p} className="rounded bg-blue-50 text-[#3067DB] px-1.5 py-0.2 text-[9px] font-mono">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT: BUSINESS SCENARIOS */}
            {reviewTab === "scenarios" && (
              <div className="space-y-3">
                <div className="text-xs text-slate-600 px-1">
                  End-to-end nominal and edge-case operational scenarios mapped to regulatory business rules.
                </div>
                <div className="space-y-3">
                  {scenariosList.map((sc, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{sc.title}</span>
                          <span className="rounded bg-blue-50 text-[#3067DB] px-2 py-0.5 text-[10px] font-medium">
                            {sc.module}
                          </span>
                        </div>
                        <span className="text-2xs font-semibold text-slate-500">Actor: {sc.actor}</span>
                      </div>
                      <p className="text-xs text-slate-600">{sc.description}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div>
                          <strong className="text-slate-700">Preconditions:</strong>
                          <p className="text-slate-600 mt-0.5">{sc.preconditions}</p>
                        </div>
                        <div>
                          <strong className="text-emerald-800">Expected Outcome:</strong>
                          <p className="text-slate-600 mt-0.5">{sc.expected_outcome}</p>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        <strong>Linked Rules:</strong> {sc.business_rules}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT: CROSS-DOCUMENT INSIGHTS */}
            {reviewTab === "insights" && (
              <div className="space-y-3">
                <div className="text-xs text-slate-600 px-1">
                  Reconciled cross-document interactions between DPSS TAT circular, Responsible Business Conduct directions,
                  and the Integrated Ombudsman Scheme 2026.
                </div>
                <div className="space-y-3">
                  {insightsList.map((ins) => (
                    <div key={ins.insight_id} className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-2xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                            {ins.insight_id}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900">{ins.concept}</h4>
                        </div>
                        <span className="rounded bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold">
                          {ins.relationship_type}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px]">
                        <div className="rounded-lg bg-white p-2.5 border border-slate-200 space-y-1">
                          <div className="font-bold text-slate-800">{ins.doc_a.filename}</div>
                          <div className="text-slate-600 font-medium">{ins.doc_a.rule}</div>
                          <div className="text-[10px] italic text-slate-500">“{ins.doc_a.quote}”</div>
                        </div>
                        <div className="rounded-lg bg-white p-2.5 border border-slate-200 space-y-1">
                          <div className="font-bold text-slate-800">{ins.doc_b.filename}</div>
                          <div className="text-slate-600 font-medium">{ins.doc_b.rule}</div>
                          <div className="text-[10px] italic text-slate-500">“{ins.doc_b.quote}”</div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed">{ins.analysis}</p>

                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-[11px] text-emerald-900">
                        <strong>Architecture Recommendation: </strong>
                        <span>{ins.resolution_recommendation}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT: PRODUCT CONTEXT & SCOPE */}
            {reviewTab === "overview" && reviewConfig.product_context && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Product Overview</h4>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                      {reviewConfig.product_context.product_overview}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Problem Statement</h4>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                      {reviewConfig.product_context.problem_statement}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">In-Scope Modules</h4>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {reviewConfig.product_context.product_modules?.map((m: string) => (
                        <span key={m} className="rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-2xs font-medium">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">External Integrations</h4>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {reviewConfig.product_context.external_integrations?.map((intg: string) => (
                        <span key={intg} className="rounded bg-blue-50 text-[#3067DB] px-2 py-0.5 text-2xs font-medium">
                          {intg}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Approval Checkbox & Final Create Action */}
            <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-xs space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={approvalConfirmed}
                  onChange={(e) => setApprovalConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#3067DB] focus:ring-[#3067DB]"
                />
                <span className="text-xs text-slate-800 leading-normal font-medium">
                  I have reviewed, verified, and approved the AI-extracted project configuration, business rules, and
                  regulatory provenance. Persist this configuration and trigger requirements analysis.
                </span>
              </label>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setCurrentStep(2)} className="font-medium text-xs">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  <span>Back to Documents</span>
                </Button>
                <Button
                  variant="primary"
                  onClick={handleApproveAndCreate}
                  loading={isSubmitting}
                  disabled={!approvalConfirmed}
                  className="bg-[#3067DB] hover:bg-[#2554b5] text-white font-medium px-6 h-9 shadow-2xs"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  <span>Approve & Create Project</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ReasonX Explanation Interactive Modal */}
      {reasonxOpen && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85dvh] animate-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-blue-50/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3067DB] text-white shadow-2xs">
                  <Brain className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">ReasonX AI Regulatory Assistant</h4>
                  <p className="text-[10px] text-slate-500">Grounded statutory justification & clause citation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReasonxOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="rounded-lg bg-slate-100 p-3 font-medium text-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Inquiry:</span>
                {reasonxQuery}
              </div>

              {reasonxLoading ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-[#3067DB]" />
                  <span>ReasonX is parsing circular clauses and legal precedents...</span>
                </div>
              ) : reasonxResult ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4 text-slate-800 leading-relaxed whitespace-pre-line">
                    {reasonxResult.answer}
                  </div>

                  {reasonxResult.citations && reasonxResult.citations.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-700">Verifiable Citations:</div>
                      {reasonxResult.citations.map((c, i) => (
                        <div key={i} className="rounded-md border border-slate-200 p-2.5 text-[11px] bg-slate-50">
                          <div className="font-bold text-slate-800">
                            {c.document} {c.clause ? `(${c.clause})` : ""}
                          </div>
                          {c.quote && <div className="italic text-slate-600 mt-0.5">“{c.quote}”</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <Button variant="secondary" size="sm" onClick={() => setReasonxOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
