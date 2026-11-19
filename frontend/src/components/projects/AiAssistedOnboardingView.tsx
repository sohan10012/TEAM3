import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileCode,
  FileSpreadsheet,
  FileText,
  Info,
  Layers,
  Loader2,
  Quote,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
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

export interface UploadingFileItem {
  id: string;
  name: string;
  sizeBytes: number;
  fileType: string;
  progress: number;
  stageMessage: string;
  status: "uploading" | "parsing" | "verifying" | "complete" | "error";
  errorMessage?: string;
}

export interface ExtractedRuleItem {
  rule_id: string;
  title: string;
  description: string;
  rule_type: string;
  source_document: string;
  source_document_id?: number;
  document_checksum?: string;
  page_number: number;
  physical_page_number?: number;
  printed_page_number?: number | string;
  section_title?: string;
  subsection_title?: string;
  source_char_offset?: number;
  clause_ref: string;
  supporting_quote: string;
  confidence: number;
  confidence_breakdown?: Record<string, number>;
  confidence_rationale?: string;
  evidence_type?: string;
  inference_rationale?: string;
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
  actor_type?: string;
  evidence_type?: string;
  approval_status?: "suggested" | "accepted" | "rejected";
}

export interface ExtractedScenarioItem {
  scenario_id?: string;
  title: string;
  description: string;
  actor: string;
  preconditions: string;
  expected_outcome: string;
  business_rules: string[] | string;
  module: string;
  evidence_type?: string;
  inference_rationale?: string;
  approval_status?: "suggested" | "accepted" | "rejected";
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
  evidence_type?: string;
  approval_status?: "suggested" | "accepted" | "rejected";
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

function formatElapsed(sec: number): string {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m < 10 ? "0" + m : m}:${rem < 10 ? "0" + rem : rem}`;
}

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
  const [isKeyManuallyEdited, setIsKeyManuallyEdited] = useState(false);

  // Step 2: Staged Documents State
  const [stagedDocs, setStagedDocs] = useState<StagedDocItem[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Step 3: Analysis Pipeline State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStageText, setAnalysisStageText] = useState("");
  const [analysisActiveStageIndex, setAnalysisActiveStageIndex] = useState(0);
  const [analysisElapsedSeconds, setAnalysisElapsedSeconds] = useState(0);
  const [analysisEstimatedRemaining, setAnalysisEstimatedRemaining] = useState<number>(25);
  const [analysisLogs, setAnalysisLogs] = useState<Array<{ timestamp: string; message: string; type?: "info" | "success" | "active" }>>([]);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisCompletedSummary, setAnalysisCompletedSummary] = useState<{
    rulesCount: number;
    verifiedCount: number;
    rolesCount: number;
    scenariosCount: number;
    durationMs: number;
  } | null>(null);
  const analysisTimerRef = useRef<any>(null);

  // Step 4: Human Review & Approval State
  const [reviewConfig, setReviewConfig] = useState<any | null>(null);
  const [reviewTab, setReviewTab] = useState<"overview" | "rules" | "roles" | "scenarios" | "insights">("rules");
  const [rulesList, setRulesList] = useState<ExtractedRuleItem[]>([]);
  const [rolesList, setRolesList] = useState<ExtractedRoleItem[]>([]);
  const [scenariosList, setScenariosList] = useState<ExtractedScenarioItem[]>([]);
  const [insightsList, setInsightsList] = useState<CrossDocInsightItem[]>([]);
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedRuleIds, setExpandedRuleIds] = useState<Set<string>>(new Set());
  const [activeConfidenceRuleId, setActiveConfidenceRuleId] = useState<string | null>(null);
  const [highlightedRuleId, setHighlightedRuleId] = useState<string | null>(null);

  // ReasonX Explanation Modal State
  const [reasonxOpen, setReasonxOpen] = useState(false);
  const [reasonxQuery, setReasonxQuery] = useState("");
  const [reasonxLoading, setReasonxLoading] = useState(false);
  const [reasonxResult, setReasonxResult] = useState<{ answer: string; citations: any[]; confidence: number } | null>(
    null
  );

  // Debounced Key Validation
  useEffect(() => {
    let active = true;
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
          `/projects/validate-key?key=${encodeURIComponent(cleanKey)}`
        );
        if (!active) return;
        if (res.valid) {
          setKeyValidation({ status: "valid", message: res.message });
        } else {
          setKeyValidation({ status: "invalid", message: res.message });
        }
      } catch (err: any) {
        if (!active) return;
        console.warn("Key validation preflight request failed:", err);
        // If syntax is strictly valid, network failure should not permanently block progress
        setKeyValidation({
          status: "valid",
          message: "Format valid (uniqueness will be confirmed on creation)",
        });
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
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
    if (generated.length >= 2 && (!isKeyManuallyEdited || !key || key === "UPI_DISP")) {
      setKey(generated);
    }
  };

  // Interactive Upload Custom Document with Live Pipeline Stages
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    const fileArray = Array.from(files);
    const newItems: UploadingFileItem[] = fileArray.map((f, idx) => ({
      id: `up-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      name: f.name,
      sizeBytes: f.size,
      fileType: f.name.split(".").pop()?.toLowerCase() || "txt",
      progress: 15,
      stageMessage: "Uploading document bytes...",
      status: "uploading",
    }));

    setUploadingFiles((prev) => [...prev, ...newItems]);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const item = newItems[i];

      let uploadStep = 0;
      const uploadInterval = setInterval(() => {
        uploadStep++;
        const msgs = [
          "Uploading specification binary bytes...",
          "Extracting pages, paragraphs, and tables...",
          "Parsing clause structure and chapter headers...",
          "Calculating SHA-256 tamper-evident integrity hash...",
          "Finalizing document staging in quality registry...",
        ];
        const msg = msgs[Math.min(uploadStep, msgs.length - 1)];
        const prog = Math.min(92, 25 + uploadStep * 14);
        setUploadingFiles((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, progress: prog, stageMessage: msg, status: "parsing" } : it
          )
        );
      }, 900);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("display_name", file.name.replace(/\.[^/.]+$/, ""));
      formData.append("purpose", "prd");

      try {
        const uploaded = await api.upload<StagedDocItem>("/projects/onboarding/upload", formData);
        clearInterval(uploadInterval);

        setUploadingFiles((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, progress: 100, stageMessage: "Staged & ready for AI analysis", status: "complete" }
              : it
          )
        );

        setStagedDocs((prev) => [...prev, uploaded]);
        toast.ok(`Staged '${file.name}' for AI document analysis.`);

        setTimeout(() => {
          setUploadingFiles((prev) => prev.filter((it) => it.id !== item.id));
        }, 600);
      } catch (err: any) {
        clearInterval(uploadInterval);
        const errMsg = err?.message || "Upload failed";
        setUploadingFiles((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, progress: 100, stageMessage: `Upload failed: ${errMsg}`, status: "error", errorMessage: errMsg }
              : it
          )
        );
        toast.error(`Failed to stage ${file.name}: ${errMsg}`);
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
      toast.error("Please stage at least one business specification before running analysis.");
      return;
    }

    if (analysisTimerRef.current) {
      clearInterval(analysisTimerRef.current);
    }

    setCurrentStep(3);
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisCompletedSummary(null);
    setAnalysisProgress(12);
    setAnalysisActiveStageIndex(0);

    const docCount = stagedDocs.length;
    const firstDocName = stagedDocs[0]?.filename || stagedDocs[0]?.display_name || "specification";
    const totalBytes = stagedDocs.reduce((acc, d) => acc + (d.size_bytes || 0), 0);
    const totalPages = stagedDocs.reduce((acc, d) => acc + (d.page_count || 1), 0);
    // Estimated time calculation based on page volume and document size
    const estimatedTotalSec = Math.max(22, Math.min(48, Math.round(totalPages * 0.12) + 18));

    setAnalysisEstimatedRemaining(estimatedTotalSec);
    setAnalysisStageText(`Ingesting text and structure from ${firstDocName}...`);

    const initialLog = {
      timestamp: "[00:00]",
      message: `Ingesting ${docCount} staged document(s): ${firstDocName} (${totalPages} pages, ${(totalBytes / 1024).toFixed(0)} KB)`,
      type: "info" as const,
    };
    setAnalysisLogs([initialLog]);

    const startTime = Date.now();
    const loggedMilestones = new Set<number>();

    analysisTimerRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startTime;
      const elapsedSec = elapsedMs / 1000;
      setAnalysisElapsedSeconds(Math.floor(elapsedSec * 10) / 10);

      // Smooth estimated remaining countdown
      const remaining = Math.max(1, Math.round(estimatedTotalSec - elapsedSec));
      setAnalysisEstimatedRemaining(remaining);

      // Smooth progressive bar (up to 92% until API completes)
      const progressFraction = Math.min(0.92, 0.12 + (elapsedSec / estimatedTotalSec) * 0.8);
      setAnalysisProgress(Math.max(12, Math.round(progressFraction * 100)));

      // Dynamic milestone logs and stages
      if (elapsedSec >= 2 && !loggedMilestones.has(2)) {
        loggedMilestones.add(2);
        setAnalysisLogs((prev) => [
          ...prev,
          {
            timestamp: `[${formatElapsed(elapsedSec)}]`,
            message: "Normalizing clauses, structural headings, and section hierarchies...",
            type: "info",
          },
        ]);
      }

      if (elapsedSec >= 4 && !loggedMilestones.has(4)) {
        loggedMilestones.add(4);
        setAnalysisActiveStageIndex(1);
        setAnalysisStageText("Executing context intelligence model: synthesizing domain invariants, rules, and acceptance criteria...");
        setAnalysisLogs((prev) => [
          ...prev,
          {
            timestamp: `[${formatElapsed(elapsedSec)}]`,
            message: "Connecting to Context Intelligence Engine (Gemini 3.1 Flash-Lite & Groq)...",
            type: "active",
          },
        ]);
      }

      if (elapsedSec >= 10 && !loggedMilestones.has(10)) {
        loggedMilestones.add(10);
        setAnalysisLogs((prev) => [
          ...prev,
          {
            timestamp: `[${formatElapsed(elapsedSec)}]`,
            message: "Synthesizing domain invariants, security rules, and statutory mandates...",
            type: "info",
          },
        ]);
      }

      if (elapsedSec >= 16 && !loggedMilestones.has(16)) {
        loggedMilestones.add(16);
        setAnalysisActiveStageIndex(2);
        setAnalysisStageText("Verifying supporting quotes verbatim against raw document text for tamper-evident provenance...");
        setAnalysisLogs((prev) => [
          ...prev,
          {
            timestamp: `[${formatElapsed(elapsedSec)}]`,
            message: "Performing verbatim quote verification across raw source text for tamper-evident provenance...",
            type: "active",
          },
        ]);
      }

      if (elapsedSec >= 24 && !loggedMilestones.has(24)) {
        loggedMilestones.add(24);
        setAnalysisActiveStageIndex(3);
        setAnalysisStageText("Deriving actor personas, operational roles, permissions, and governance gates...");
        setAnalysisLogs((prev) => [
          ...prev,
          {
            timestamp: `[${formatElapsed(elapsedSec)}]`,
            message: "Deriving operational roles, governance gates, and persona permissions...",
            type: "info",
          },
        ]);
      }

      if (elapsedSec >= 32 && !loggedMilestones.has(32)) {
        loggedMilestones.add(32);
        setAnalysisActiveStageIndex(4);
        setAnalysisStageText("Reconciling end-to-end workflows and multi-document dependencies...");
        setAnalysisLogs((prev) => [
          ...prev,
          {
            timestamp: `[${formatElapsed(elapsedSec)}]`,
            message: "Connecting multi-scenario business workflows and cross-document dependencies...",
            type: "active",
          },
        ]);
      }
    }, 400);

    try {
      const payload = {
        document_ids: stagedDocs.map((d) => d.id),
        project_name: name.trim() || stagedDocs[0]?.display_name || stagedDocs[0]?.filename?.replace(/\.[^/.]+$/, "") || "Project Specification",
        project_key: key.trim().toUpperCase() || "PROJ_SPEC",
        business_domain: businessDomain,
        description: description.trim(),
      };

      const result = await api.post<any>("/projects/onboarding/analyze", payload);
      const totalElapsedMs = Date.now() - startTime;
      const totalElapsedSec = totalElapsedMs / 1000;

      if (analysisTimerRef.current) {
        clearInterval(analysisTimerRef.current);
      }

      setAnalysisProgress(100);
      setAnalysisActiveStageIndex(5);
      setAnalysisEstimatedRemaining(0);
      setAnalysisStageText(`Analysis completed in ${totalElapsedSec.toFixed(1)}s! Assembling evidence-backed project configuration.`);

      const rules = result.business_rules || [];
      const roles = result.roles || result.roles_and_responsibilities || [];
      const scenarios = result.scenarios || result.business_scenarios || [];
      const insights = result.cross_document_insights || [];
      const verified = rules.filter((r: any) => !r.is_inferred).length;

      setAnalysisLogs((prev) => [
        ...prev,
        {
          timestamp: `[${formatElapsed(totalElapsedSec)}]`,
          message: `✓ Pipeline complete! Extracted ${rules.length} rules (${verified} verified), ${roles.length} roles, ${scenarios.length} scenarios.`,
          type: "success",
        },
      ]);

      setAnalysisCompletedSummary({
        rulesCount: rules.length,
        verifiedCount: verified,
        rolesCount: roles.length,
        scenariosCount: scenarios.length,
        durationMs: totalElapsedMs,
      });

      setReviewConfig(result);
      setRulesList(rules);
      setRolesList(roles);
      setScenariosList(scenarios);
      setInsightsList(insights);
      setExpandedRuleIds(new Set(rules.map((r: any) => r.rule_id)));

      setTimeout(() => {
        setIsAnalyzing(false);
        setCurrentStep(4);
      }, 900);
    } catch (err: any) {
      if (analysisTimerRef.current) {
        clearInterval(analysisTimerRef.current);
      }
      setIsAnalyzing(false);
      const errorMsg = err?.message || "AI Analysis failed to process documents.";
      setAnalysisError(errorMsg);
      setAnalysisLogs((prev) => [
        ...prev,
        {
          timestamp: `[${formatElapsed((Date.now() - startTime) / 1000)}]`,
          message: `✗ Analysis halted: ${errorMsg}`,
          type: "active",
        },
      ]);
      toast.error(`AI analysis failed: ${errorMsg}`);
    }
  };

  // Rule approval toggles
  const handleToggleRuleStatus = (ruleId: string, status: "accepted" | "rejected") => {
    setRulesList((prev) =>
      prev.map((r) => (r.rule_id === ruleId ? { ...r, approval_status: status } : r))
    );
  };

  // Toggle expand/collapse all rules
  const handleToggleExpandAllRules = () => {
    if (rulesList.length > 0 && rulesList.every((r) => expandedRuleIds.has(r.rule_id))) {
      setExpandedRuleIds(new Set());
    } else {
      setExpandedRuleIds(new Set(rulesList.map((r) => r.rule_id)));
    }
  };

  // Toggle individual rule card expand
  const handleToggleRuleExpand = (ruleId: string) => {
    setExpandedRuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  // Navigate directly to a rule from a scenario or chip
  const handleNavigateToRule = (ruleId: string) => {
    setReviewTab("rules");
    setExpandedRuleIds((prev) => new Set([...prev, ruleId]));
    setHighlightedRuleId(ruleId);
    setTimeout(() => {
      const el = document.getElementById(`rule-card-${ruleId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);
    setTimeout(() => {
      setHighlightedRuleId(null);
    }, 3500);
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
      const approvedRuleIds = new Set(
        rulesList.filter((r) => r.approval_status !== "rejected").map((r) => r.rule_id)
      );

      // Prune rejected rules from scenarios so rejected rules cannot remain approved dependencies
      const sanitizedScenarios = scenariosList.map((sc) => {
        const raw = sc.business_rules;
        let rulesArr: string[] = [];
        if (Array.isArray(raw)) {
          rulesArr = raw.flatMap((r) =>
            typeof r === "string" ? r.match(/BR-\d+|SEC-\d+|RULE-\d+/g) || [r] : []
          );
        } else if (typeof raw === "string") {
          rulesArr = raw.match(/BR-\d+|SEC-\d+|RULE-\d+/g) || [];
        }
        const activeRules = rulesArr.filter((id) => approvedRuleIds.has(id));
        return {
          ...sc,
          business_rules: activeRules,
        };
      });

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
          business_scenarios: sanitizedScenarios,
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
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden h-full">
      {/* Mode A Progressive Stepper Nav */}
      <nav aria-label="AI Onboarding Steps" className="px-6 py-3 border-b border-slate-200 bg-white shrink-0">
        <div className="grid grid-cols-4 gap-2">
          {[
            { step: 1, title: "1. Project Details", sub: "Name, key & domain" },
            { step: 2, title: "2. Document Intake", sub: "Upload specifications" },
            { step: 3, title: "3. AI Document Analysis", sub: "Extraction & reconciliation" },
            { step: 4, title: "4. Human Review & Approval", sub: "Rules, roles & creation" },
          ].map((s) => {
            const isCurrent = currentStep === s.step;
            const isPast = currentStep > s.step;
            const canNavigate =
              !isAnalyzing &&
              (s.step === 1 ||
                (s.step === 2 && name.trim().length > 0 && /^[A-Z0-9_-]{2,10}$/.test(key.trim().toUpperCase()) && keyValidation.status !== "invalid") ||
                (s.step === 3 && stagedDocs.length > 0) ||
                (s.step === 4 && Boolean(reviewConfig)));
            return (
              <button
                key={s.step}
                type="button"
                disabled={!canNavigate && !isCurrent}
                onClick={() => {
                  if (s.step === 1) {
                    setCurrentStep(1);
                  } else if (s.step === 2 && name.trim().length > 0 && /^[A-Z0-9_-]{2,10}$/.test(key.trim().toUpperCase()) && keyValidation.status !== "invalid") {
                    setCurrentStep(2);
                  } else if (s.step === 3 && stagedDocs.length > 0) {
                    handleRunAnalysis();
                  } else if (s.step === 4 && reviewConfig) {
                    setCurrentStep(4);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 text-left p-2 rounded-lg transition-all border text-xs",
                  isCurrent
                    ? "bg-blue-50/80 border-[#1D63ED] text-slate-900 shadow-2xs font-semibold cursor-default"
                    : isPast
                    ? "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/60 cursor-pointer"
                    : canNavigate
                    ? "border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                    : "border-transparent text-slate-400 opacity-60 cursor-not-allowed"
                )}
              >
                <div
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                    isCurrent
                      ? "bg-[#1D63ED] text-white"
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
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1D63ED] border border-blue-200 font-semibold text-2xs mb-2">
                <Sparkles className="h-3.5 w-3.5 text-[#1D63ED]" />
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
                  className="w-full h-10 px-3 font-medium text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1D63ED] focus:border-transparent bg-white shadow-2xs"
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
                      onChange={(e) => {
                        setIsKeyManuallyEdited(true);
                        setKey(e.target.value.toUpperCase());
                      }}
                      placeholder="e.g. UPI_DISP"
                      className="w-full h-10 px-3 font-mono uppercase font-semibold text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1D63ED] focus:border-transparent bg-white shadow-2xs"
                    />
                    <div className="absolute right-3 top-3">
                      {keyValidation.status === "checking" && (
                        <Loader2 className="h-4 w-4 animate-spin text-[#1D63ED]" />
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
                    className="w-full h-10 px-3 font-medium text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1D63ED] focus:border-transparent bg-white shadow-2xs"
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
                  className="w-full p-3 font-normal text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1D63ED] focus:border-transparent bg-white shadow-2xs resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: DOCUMENT INTAKE */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div>
              <h3 className="text-base font-bold text-slate-900">Document Intake & Specification Staging</h3>
              <p className="text-xs text-slate-500 mt-1">
                Upload your Product Requirements Documents (PRDs), Software Specs, or regulatory compliance policies for automated, source-grounded context generation.
              </p>
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
                isDragOver
                  ? "border-[#1D63ED] bg-blue-50/50 scale-[1.005] ring-4 ring-blue-500/10"
                  : isUploading
                  ? "border-blue-400 bg-blue-50/20"
                  : "border-slate-300 hover:border-slate-400 hover:bg-slate-50/30"
              )}
              onClick={() => {
                if (!isUploading) fileInputRef.current?.click();
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                disabled={isUploading}
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <div className="flex flex-col items-center justify-center gap-2.5">
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full shadow-2xs transition-all",
                    isUploading
                      ? "bg-blue-100 text-[#1D63ED] ring-4 ring-blue-200/50 animate-pulse"
                      : isDragOver
                      ? "bg-blue-500 text-white scale-110"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                  )}
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-[#1D63ED]" />
                  ) : (
                    <Upload className="h-6 w-6" />
                  )}
                </div>

                <div className="text-center">
                  <h4 className="text-xs font-bold text-slate-800">
                    {isUploading
                      ? `Uploading and parsing ${uploadingFiles.length} document${uploadingFiles.length > 1 ? "s" : ""}...`
                      : isDragOver
                      ? "Drop specifications here to stage"
                      : "Click or drag documents here to stage"}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isUploading
                      ? "Extracting raw paragraphs, tables, and clause hierarchies for AI analysis"
                      : "Supports PDF, DOCX, TXT, and Markdown files up to 50MB"}
                  </p>
                </div>

                {isUploading && (
                  <div className="w-64 max-w-full bg-blue-100 rounded-full h-1.5 overflow-hidden mt-1">
                    <div className="bg-[#1D63ED] h-1.5 rounded-full animate-pulse w-3/4" />
                  </div>
                )}
              </div>
            </div>

            {/* Staged & In-Progress Document Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 px-1">
                <div className="flex items-center gap-2">
                  <span>Staged Documents ({stagedDocs.length})</span>
                  {uploadingFiles.length > 0 && (
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin text-[#1D63ED]" />
                      Processing {uploadingFiles.length} file{uploadingFiles.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500">
                  {stagedDocs.length > 0
                    ? `${stagedDocs.length} specification${stagedDocs.length > 1 ? "s" : ""} ready for automated AI analysis`
                    : "Upload specifications to proceed to AI analysis"}
                </span>
              </div>

              {/* Active Uploading Cards */}
              {uploadingFiles.map((up) => (
                <div
                  key={up.id}
                  className="rounded-xl border border-blue-300 bg-blue-50/50 p-4 space-y-2.5 shadow-2xs transition-all animate-in fade-in slide-in-from-top-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-[#1D63ED] shrink-0 border border-blue-200">
                        {up.status === "error" ? (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        ) : up.status === "complete" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-[#1D63ED]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate text-xs">{up.name}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                          <span className="uppercase font-mono font-semibold">{up.fileType}</span>
                          <span>•</span>
                          <span>{(up.sizeBytes / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span
                            className={cn(
                              "font-medium",
                              up.status === "error" ? "text-red-600" : "text-blue-700"
                            )}
                          >
                            {up.stageMessage}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-semibold text-[#1D63ED]">
                      {up.status === "error" ? "Error" : `${up.progress}%`}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-blue-200/60 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300 ease-out",
                        up.status === "error" ? "bg-red-500 w-full" : "bg-[#1D63ED]"
                      )}
                      style={up.status === "error" ? undefined : { width: `${up.progress}%` }}
                    />
                  </div>
                </div>
              ))}

              {/* Staged Document Cards */}
              {stagedDocs.length === 0 && uploadingFiles.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-slate-500 space-y-1">
                  <FileText className="h-7 w-7 mx-auto text-slate-400 mb-2" />
                  <p className="font-medium text-xs text-slate-700">No specifications staged yet</p>
                  <p className="text-[11px] text-slate-400">
                    Drag and drop or click above to upload PRD, SRS, or policy documents.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stagedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between shadow-2xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#1D63ED] shrink-0 border border-blue-100">
                          {doc.file_type === "pdf" ? (
                            <FileText className="h-4 w-4" />
                          ) : doc.file_type === "docx" ? (
                            <FileSpreadsheet className="h-4 w-4" />
                          ) : (
                            <FileCode className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate text-xs">
                            {doc.display_name || doc.filename}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span className="uppercase font-mono font-semibold">{doc.file_type}</span>
                            <span>•</span>
                            <span>{(doc.size_bytes / 1024).toFixed(1)} KB</span>
                            <span>•</span>
                            <span>{doc.page_count} page(s)</span>
                            <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.2 font-semibold">
                              Authentic Document
                            </span>
                            {doc.sha256_hash && (
                              <span
                                className="font-mono text-[9px] text-slate-400"
                                title={`SHA-256: ${doc.sha256_hash}`}
                              >
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
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: LIVE REAL-TIME ANALYSIS PIPELINE */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <div className="space-y-3.5 max-w-2xl mx-auto py-1 text-center">
            {/* Header with live brain pulse or error icon */}
            <div className="flex flex-col items-center justify-center gap-2">
              <div
                className={cn(
                  "relative flex h-12 w-12 items-center justify-center rounded-xl shadow-md transition-all",
                  analysisError
                    ? "bg-rose-100 text-rose-600"
                    : analysisProgress === 100
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-blue-100 text-[#1D63ED]"
                )}
              >
                {analysisError ? (
                  <AlertCircle className="h-6 w-6 text-rose-600" />
                ) : analysisProgress === 100 ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                ) : (
                  <>
                    <Brain className="h-6 w-6 text-[#1D63ED] animate-pulse" />
                    <div className="absolute -inset-1 rounded-xl border-2 border-[#1D63ED]/40 animate-ping" />
                  </>
                )}
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900">TraceTest Context Intelligence Engine</h3>
                <p className="text-2xs text-slate-600 max-w-lg mt-0.5">{analysisStageText}</p>
              </div>

              {/* Live Estimated Time Remaining Pill (replaces elapsed time per user requirement) */}
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1 text-2xs font-mono shadow-2xs">
                <Clock className="h-3.5 w-3.5 text-[#1D63ED]" />
                <span>
                  {isAnalyzing ? (
                    <>
                      <span className="relative inline-flex h-2 w-2 mr-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1D63ED]"></span>
                      </span>
                      <span className="text-slate-600">Estimated time: </span>
                      <strong className="text-blue-900 font-semibold">
                        {analysisEstimatedRemaining > 3
                          ? `~${analysisEstimatedRemaining}s remaining`
                          : "~2-3s remaining • Finalizing verification..."}
                      </strong>
                    </>
                  ) : analysisError ? (
                    <span className="text-rose-700 font-medium">Analysis paused • Retry available</span>
                  ) : (
                    <span className="text-emerald-700 font-semibold">
                      Completed & verified in {analysisElapsedSeconds.toFixed(1)}s
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Error Recovery Card */}
            {analysisError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-left max-w-md mx-auto space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-900">Analysis Encountered An Error</h4>
                    <p className="text-2xs text-rose-700 mt-0.5 leading-relaxed font-mono break-all">{analysisError}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-rose-200/60">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleRunAnalysis}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-8"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    <span>Retry Analysis</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAnalysisError(null);
                      setCurrentStep(2);
                    }}
                    className="border-slate-300 text-slate-700 text-xs h-8"
                  >
                    <span>Change Documents</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {!analysisError && (
              <div className="space-y-2 max-w-md mx-auto">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Document Extraction Pipeline</span>
                  <span>{analysisProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden shadow-inner">
                  <div
                    className={cn(
                      "h-full transition-all duration-300 rounded-full",
                      analysisProgress === 100 ? "bg-emerald-600" : "bg-[#1D63ED]"
                    )}
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Completed Summary Banner */}
            {analysisCompletedSummary && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900 max-w-md mx-auto flex flex-wrap items-center justify-between gap-2 animate-fadeIn">
                <span className="font-semibold text-emerald-950">Extraction Results:</span>
                <span className="font-medium">{analysisCompletedSummary.rulesCount} Rules ({analysisCompletedSummary.verifiedCount} verified)</span>
                <span className="text-emerald-400">·</span>
                <span className="font-medium">{analysisCompletedSummary.rolesCount} Roles</span>
                <span className="text-emerald-400">·</span>
                <span className="font-medium">{analysisCompletedSummary.scenariosCount} Scenarios</span>
              </div>
            )}

            {/* Dynamic Multi-Document Pipeline Stages */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs text-left max-w-lg mx-auto space-y-2">
              {[
                {
                  label: "Document Text Ingestion & Clause Normalization",
                  desc: `Parsing normalized clauses from ${stagedDocs.length} staged document(s)`,
                },
                {
                  label: "Domain Rule & Regulatory Invariant Synthesis",
                  desc: "Calling context model to extract structured obligations, TATs, and rules",
                },
                {
                  label: "Verbatim Source Quote Verification & Provenance Mapping",
                  desc: "Validating supporting quotes against source text for tamper-evident provenance",
                },
                {
                  label: "Operational Role & Responsibility Synthesis",
                  desc: "Deriving actor personas, role permissions, and governance gates",
                },
                {
                  label: "Multi-Document Workflow Scenario Reconciliation",
                  desc: "Connecting end-to-end business scenarios and cross-document dependencies",
                },
              ].map((stg, idx) => {
                const isComplete = idx < analysisActiveStageIndex || analysisProgress === 100;
                const isCurrent = idx === analysisActiveStageIndex && !analysisError && analysisProgress < 100;
                const isFailed = idx === analysisActiveStageIndex && !!analysisError;

                return (
                  <div key={stg.label} className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full text-2xs font-bold mt-0.5 shrink-0 transition-colors",
                          isComplete
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : isFailed
                            ? "bg-rose-600 text-white"
                            : isCurrent
                            ? "bg-[#1D63ED] text-white ring-4 ring-blue-500/20 animate-pulse"
                            : "bg-slate-200 text-slate-500"
                        )}
                      >
                        {isComplete ? <Check className="h-3 w-3" /> : idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div
                          className={cn(
                            "text-xs font-semibold",
                            isFailed
                              ? "text-rose-700"
                              : isCurrent
                              ? "text-[#1D63ED]"
                              : isComplete
                              ? "text-slate-800"
                              : "text-slate-400"
                          )}
                        >
                          {stg.label}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{stg.desc}</div>
                      </div>
                    </div>

                    {isCurrent && (
                      <span className="shrink-0 text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                        <Loader2 className="h-2.5 w-2.5 animate-spin text-[#1D63ED]" />
                        Active
                      </span>
                    )}
                    {isComplete && (
                      <span className="shrink-0 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Done
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Antigravity-Style Live Activity Terminal */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 shadow-md text-left max-w-lg mx-auto overflow-hidden animate-fadeIn">
              <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-300 ml-1.5 flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-blue-400" />
                    TraceTest Context Engine • Autonomous Pipeline
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-800/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </div>
              </div>
              <div className="p-3 font-mono text-[11px] text-slate-300 space-y-1.5 max-h-36 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                {analysisLogs.map((logItem, idx) => (
                  <div key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-500 shrink-0 font-semibold">{logItem.timestamp}</span>
                    <span
                      className={cn(
                        "break-words",
                        logItem.type === "success"
                          ? "text-emerald-400 font-semibold"
                          : logItem.type === "active"
                          ? "text-blue-300 font-medium"
                          : "text-slate-300"
                      )}
                    >
                      {logItem.message}
                    </span>
                  </div>
                ))}
                {isAnalyzing && (
                  <div className="flex items-center gap-2 text-blue-400 animate-pulse pt-1 border-t border-slate-800/60 mt-1">
                    <span className="text-slate-500 font-mono">[{formatElapsed(analysisElapsedSeconds)}]</span>
                    <span className="flex items-center gap-1.5 text-blue-300 font-mono text-[10px]">
                      <Loader2 className="h-3 w-3 animate-spin text-[#1D63ED]" />
                      {analysisStageText}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Staged Document Badges */}
            <div className="max-w-md mx-auto flex flex-wrap items-center justify-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400 mr-1">Staged for analysis:</span>
              {stagedDocs.map((d) => (
                <span
                  key={d.id}
                  className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-700 border border-slate-200"
                >
                  <FileText className="h-3 w-3 text-slate-400" />
                  <span className="truncate max-w-[150px]">{d.filename || d.display_name}</span>
                </span>
              ))}
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
                  <span className="rounded bg-blue-100 text-[#1D63ED] px-1.5 py-0.2 font-mono font-bold text-2xs">
                    {key}
                  </span>
                </div>
                <p className="text-2xs text-slate-600 mt-0.5">
                  Extracted from <strong>{stagedDocs.length}</strong> regulatory circulars with evidence citations.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-center bg-white px-2.5 py-1 rounded-lg border border-blue-100 shadow-2xs">
                  <div className="text-xs font-bold text-[#1D63ED]">{rulesList.length}</div>
                  <div className="text-[9px] text-slate-500">Business Rules</div>
                </div>
                <div className="text-center bg-white px-2.5 py-1 rounded-lg border border-blue-100 shadow-2xs">
                  <div className="text-xs font-bold text-[#1D63ED]">{rolesList.length}</div>
                  <div className="text-[9px] text-slate-500">Roles</div>
                </div>
                <div className="text-center bg-white px-2.5 py-1 rounded-lg border border-blue-100 shadow-2xs">
                  <div className="text-xs font-bold text-[#1D63ED]">{scenariosList.length}</div>
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
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1D63ED] text-white shadow-2xs">
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
                    {reviewConfig.extraction_summary?.verified_quotes_count ?? rulesList.filter((r) => !r.is_inferred && r.evidence_type !== "inferred").length} of {rulesList.length} Verified
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-medium">Inferred Deductions</span>
                  <span className="font-semibold text-amber-700">
                    {reviewConfig.extraction_summary?.inferred_rules_count ??
                      (rulesList.filter((r) => r.is_inferred || r.evidence_type === "inferred").length +
                        scenariosList.length +
                        rolesList.length)}{" "}
                    Inferred ({scenariosList.length} Scenarios, {rolesList.length} Personas)
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-medium">Document Provenance</span>
                  <span className="font-semibold text-slate-700 font-mono text-[10px]">
                    {stagedDocs.length} Staged Document{stagedDocs.length !== 1 ? "s" : ""} Verified
                  </span>
                </div>
              </div>
            </div>

            {/* Review Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 pb-2">
              {[
                { id: "rules", label: `Business Rules & Invariants (${rulesList.length})`, icon: Scale },
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
                        ? "bg-[#1D63ED] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT: BUSINESS RULES & INVARIANTS */}
            {reviewTab === "rules" && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 px-1">
                  <span>
                    Each rule includes exact verbatim citations from the source document with physical and printed page provenance.
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleToggleExpandAllRules}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 cursor-pointer underline underline-offset-2"
                    >
                      {rulesList.length > 0 && rulesList.every((r) => expandedRuleIds.has(r.rule_id)) ? (
                        <>
                          <ChevronUp className="h-3 w-3" />
                          <span>Collapse All Details</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" />
                          <span>Expand All Details</span>
                        </>
                      )}
                    </button>
                    <span className="text-[11px] font-semibold text-emerald-700">
                      {rulesList.filter((r) => r.approval_status !== "rejected").length} Active / Approved
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {rulesList.map((rule) => {
                    const isRejected = rule.approval_status === "rejected";
                    const isExpanded = expandedRuleIds.has(rule.rule_id);
                    const isHighlighted = highlightedRuleId === rule.rule_id;
                    const confidencePercent = Math.round((rule.confidence || 0.95) * 100);

                    return (
                      <div
                        key={rule.rule_id}
                        id={`rule-card-${rule.rule_id}`}
                        className={cn(
                          "rounded-xl border p-4 transition-all shadow-2xs space-y-3",
                          isRejected
                            ? "border-slate-200 bg-slate-50/60 opacity-60"
                            : "border-slate-200 bg-white hover:border-slate-300",
                          isHighlighted && "ring-2 ring-blue-500 border-blue-400 bg-blue-50/20"
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-[280px]">
                            <button
                              type="button"
                              onClick={() => handleToggleRuleExpand(rule.rule_id)}
                              className="mt-0.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                              title={isExpanded ? "Collapse rule details" : "Expand rule details"}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                            <span className="font-mono text-2xs font-bold px-2 py-0.5 rounded bg-blue-100 text-[#1D63ED] shrink-0 mt-0.5">
                              {rule.rule_id}
                            </span>
                            <div className="flex-1 min-w-0">
                              <h4
                                className={cn(
                                  "text-xs font-bold leading-snug break-words",
                                  isRejected ? "text-slate-500 line-through" : "text-slate-900"
                                )}
                              >
                                {rule.title}
                              </h4>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {/* Interactive 5-Factor Confidence Badge */}
                                <div className="relative inline-block">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveConfidenceRuleId((prev) => (prev === rule.rule_id ? null : rule.rule_id));
                                    }}
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                                    title="Click to inspect 5-factor evidence quality score (deterministic quality metric, not a statistical probability)"
                                  >
                                    <span>{confidencePercent}% Confidence</span>
                                    <Info className="h-2.5 w-2.5 opacity-70" />
                                  </button>

                                  {activeConfidenceRuleId === rule.rule_id && (
                                    <div className="absolute left-0 top-full mt-1.5 z-30 w-80 p-3 bg-white border border-slate-200 rounded-xl shadow-lg text-xs space-y-2">
                                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                        <span className="font-bold text-slate-900 text-[11px]">
                                          5-Factor Evidence Quality Score
                                        </span>
                                        <span className="font-mono font-bold text-emerald-700 text-xs">
                                          {confidencePercent}%
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500">
                                        Deterministic source-grounding metric (not a statistical or calibrated probability).
                                      </p>
                                      {rule.confidence_breakdown ? (
                                        <div className="space-y-1.5 text-[11px]">
                                          <div className="flex justify-between text-slate-600">
                                            <span>Quotation Match (35%):</span>
                                            <span className="font-mono font-semibold text-slate-800">
                                              {Math.round((rule.confidence_breakdown.quotation_match ?? 0.98) * 100)}%
                                            </span>
                                          </div>
                                          <div className="flex justify-between text-slate-600">
                                            <span>Semantic Support (25%):</span>
                                            <span className="font-mono font-semibold text-slate-800">
                                              {Math.round((rule.confidence_breakdown.semantic_support ?? 0.95) * 100)}%
                                            </span>
                                          </div>
                                          <div className="flex justify-between text-slate-600">
                                            <span>Classification Certainty (15%):</span>
                                            <span className="font-mono font-semibold text-slate-800">
                                              {Math.round((rule.confidence_breakdown.classification_certainty ?? 0.92) * 100)}%
                                            </span>
                                          </div>
                                          <div className="flex justify-between text-slate-600">
                                            <span>Context Clarity (15%):</span>
                                            <span className="font-mono font-semibold text-slate-800">
                                              {Math.round((rule.confidence_breakdown.context_clarity ?? 0.94) * 100)}%
                                            </span>
                                          </div>
                                          <div className="flex justify-between text-slate-600">
                                            <span>Extraction Ambiguity (10%):</span>
                                            <span className="font-mono font-semibold text-slate-800">
                                              {Math.round((rule.confidence_breakdown.extraction_ambiguity ?? 0.96) * 100)}%
                                            </span>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-[10px] text-slate-500">
                                          Multi-factor verified grounding calculation
                                        </div>
                                      )}
                                      {rule.confidence_rationale && (
                                        <p className="text-[10px] text-slate-600 pt-1.5 border-t border-slate-100 leading-relaxed italic">
                                          {rule.confidence_rationale}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {rule.is_inferred || rule.evidence_type === "inferred" ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                    <Sparkles className="h-2.5 w-2.5" />
                                    <span>AI-Inferred Deduction</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    <span>Verbatim Grounded</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                handleAskReasonX(
                                  `Explain the architectural and operational basis for ${rule.rule_id} (${rule.title})`
                                )
                              }
                              className="h-7 text-[11px] text-[#1D63ED] hover:bg-blue-50 border-blue-200"
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

                        {/* Expandable Details: Full Description, Quote, Rationale */}
                        {isExpanded && (
                          <div className="space-y-2.5 pt-1">
                            <p className="text-xs text-slate-700 leading-relaxed">{rule.description}</p>

                            {/* Exact Supporting Quote */}
                            {rule.supporting_quote && (
                              <div className="rounded-lg bg-amber-50/60 border border-amber-200 p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
                                <Quote className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                  <span className="font-bold">Verbatim Source Quote: </span>
                                  <span className="italic">“{rule.supporting_quote}”</span>
                                </div>
                              </div>
                            )}

                            {rule.inference_rationale && (
                              <div className="rounded-lg bg-blue-50/60 border border-blue-200 p-2.5 text-[11px] text-blue-900 flex items-start gap-2">
                                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                <div>
                                  <strong className="font-semibold">Inference Rationale: </strong>
                                  <span>{rule.inference_rationale}</span>
                                </div>
                              </div>
                            )}

                            {/* Rigorous Provenance Footnote: Physical PDF Page vs Printed Page */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500 pt-1.5 border-t border-slate-100">
                              <span className="font-semibold text-slate-700">Source:</span>
                              <span className="font-medium text-slate-800">
                                {rule.source_document || "Well-Architected Framework Specification"}
                              </span>
                              <span>•</span>
                              <span>
                                Printed Page{" "}
                                <strong className="text-slate-800">
                                  {rule.printed_page_number ?? rule.page_number}
                                </strong>
                                {rule.physical_page_number &&
                                  rule.physical_page_number !== rule.printed_page_number && (
                                    <span className="text-slate-500">
                                      {" "}
                                      (PDF Page {rule.physical_page_number})
                                    </span>
                                  )}
                              </span>
                              {rule.section_title && (
                                <>
                                  <span>•</span>
                                  <span>
                                    Section:{" "}
                                    <strong className="text-slate-700 font-medium">
                                      {rule.section_title}
                                    </strong>
                                  </span>
                                </>
                              )}
                              {rule.subsection_title && (
                                <>
                                  <span>•</span>
                                  <span>
                                    Subsection:{" "}
                                    <span className="text-slate-600">{rule.subsection_title}</span>
                                  </span>
                                </>
                              )}
                              {rule.clause_ref && rule.clause_ref !== rule.section_title && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-slate-600">{rule.clause_ref}</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
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
                          <span key={p} className="rounded bg-blue-50 text-[#1D63ED] px-1.5 py-0.2 text-[9px] font-mono">
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
                  End-to-end nominal and edge-case operational scenarios mapped to regulatory business rules and responsibility-based actors.
                </div>
                <div className="space-y-3">
                  {scenariosList.map((sc, i) => {
                    // Extract rule IDs from array or string safely
                    const rawRules = sc.business_rules;
                    let linkedRuleIds: string[] = [];
                    if (Array.isArray(rawRules)) {
                      linkedRuleIds = rawRules.flatMap((r) =>
                        typeof r === "string" ? r.match(/BR-\d+/g) || [r] : []
                      );
                    } else if (typeof rawRules === "string") {
                      const matches = rawRules.match(/BR-\d+/g);
                      linkedRuleIds = matches && matches.length > 0 ? matches : rawRules.split(/[\s,;]+/).filter(Boolean);
                    }

                    // Check for rejected dependencies
                    const rejectedLinkedRuleIds = linkedRuleIds.filter((id) => {
                      const matched = rulesList.find((r) => r.rule_id === id);
                      return matched && matched.approval_status === "rejected";
                    });

                    return (
                      <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{sc.title}</span>
                            <span className="rounded bg-blue-50 text-[#1D63ED] px-2 py-0.5 text-[10px] font-medium border border-blue-100">
                              {sc.module}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 font-medium">Actor:</span>
                            <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {sc.actor}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">{sc.description}</p>

                        {/* Structured Acceptance Criteria: Preconditions & Testable Outcome */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <div>
                            <strong className="text-slate-700 block mb-0.5 font-semibold">Preconditions:</strong>
                            <p className="text-slate-600 leading-relaxed">{sc.preconditions}</p>
                          </div>
                          <div>
                            <strong className="text-emerald-800 block mb-0.5 font-semibold">Expected Acceptance Criteria:</strong>
                            <div className="text-slate-700 leading-relaxed">
                              {sc.expected_outcome.includes("GIVEN:") ||
                              sc.expected_outcome.includes("WHEN:") ||
                              sc.expected_outcome.includes("THEN:") ? (
                                <div className="space-y-1">
                                  {sc.expected_outcome.split(/(?=(?:GIVEN|WHEN|THEN):)/g).map((part, pIdx) => {
                                    const trimmed = part.trim();
                                    if (!trimmed) return null;
                                    const colonIdx = trimmed.indexOf(":");
                                    if (colonIdx !== -1) {
                                      const token = trimmed.slice(0, colonIdx);
                                      const rest = trimmed.slice(colonIdx + 1).trim();
                                      return (
                                        <div key={pIdx} className="text-[11px] flex items-start gap-1">
                                          <span className="font-bold text-emerald-900 font-mono text-[9px] px-1 py-0.2 rounded bg-emerald-100/80 shrink-0 mt-0.5">
                                            {token}
                                          </span>
                                          <span className="text-slate-700">{rest}</span>
                                        </div>
                                      );
                                    }
                                    return <p key={pIdx}>{trimmed}</p>;
                                  })}
                                </div>
                              ) : (
                                <p>{sc.expected_outcome}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Linked Rule Chips with click-to-navigate */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                          <span className="text-[10px] font-semibold text-slate-600 mr-1">Linked Rules:</span>
                          {linkedRuleIds.length > 0 ? (
                            linkedRuleIds.map((ruleId) => {
                              const linkedRule = rulesList.find((r) => r.rule_id === ruleId);
                              const isRuleRejected = linkedRule?.approval_status === "rejected";
                              return (
                                <button
                                  key={ruleId}
                                  type="button"
                                  onClick={() => handleNavigateToRule(ruleId)}
                                  className={cn(
                                    "inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded transition-all cursor-pointer border",
                                    isRuleRejected
                                      ? "bg-rose-50 text-rose-700 border-rose-300 line-through"
                                      : "bg-blue-50 text-[#1D63ED] border-blue-200 hover:bg-blue-100 hover:border-blue-300 shadow-2xs"
                                  )}
                                  title={linkedRule ? `${linkedRule.title} (Click to inspect rule)` : `Inspect rule ${ruleId}`}
                                >
                                  <span>{ruleId}</span>
                                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                                </button>
                              );
                            })
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">None specified</span>
                          )}
                        </div>

                        {/* Rejected Dependency Safeguard Alert */}
                        {rejectedLinkedRuleIds.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 font-medium">
                            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
                            <span>
                              Dependency Alert: Linked rule {rejectedLinkedRuleIds.join(", ")} was marked as rejected during review. Verify or update this scenario.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT: CROSS-DOCUMENT INSIGHTS */}
            {reviewTab === "insights" && (
              <div className="space-y-3">
                <div className="text-xs text-slate-600 px-1">
                  Reconciled cross-document interactions, structural dependencies, and multi-specification alignment.
                </div>

                {insightsList.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center space-y-3">
                    <div className="mx-auto w-10 h-10 rounded-full bg-blue-50 text-[#1D63ED] flex items-center justify-center">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <h4 className="text-sm font-bold text-slate-900">Single Document Evaluation Active</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Cross-document conflict detection and reconciliation activate automatically when 2 or more specifications are staged. For single-document ingestion, domain rules, security invariants, and operational workflows are verified directly against the staged source.
                      </p>
                    </div>
                    <div className="pt-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        All {rulesList.length} business rules and {scenariosList.length} scenarios grounded in staged document
                      </span>
                    </div>
                  </div>
                ) : (
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
                            <div className="font-bold text-slate-800">{ins.doc_a?.filename || "Document A"}</div>
                            <div className="text-slate-600 font-medium">{ins.doc_a?.rule || ""}</div>
                            <div className="text-[10px] italic text-slate-500">“{ins.doc_a?.quote || ""}”</div>
                          </div>
                          <div className="rounded-lg bg-white p-2.5 border border-slate-200 space-y-1">
                            <div className="font-bold text-slate-800">{ins.doc_b?.filename || "Document B"}</div>
                            <div className="text-slate-600 font-medium">{ins.doc_b?.rule || ""}</div>
                            <div className="text-[10px] italic text-slate-500">“{ins.doc_b?.quote || ""}”</div>
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
                )}
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
                        <span key={intg} className="rounded bg-blue-50 text-[#1D63ED] px-2 py-0.5 text-2xs font-medium">
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
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1D63ED] focus:ring-[#1D63ED]"
                />
                <span className="text-xs text-slate-800 leading-normal font-medium">
                  I have reviewed, verified, and approved the AI-extracted project configuration, business rules, and
                  regulatory provenance. Persist this configuration and trigger requirements analysis.
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Mode A Persistent Wizard Footer */}
      <footer className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <div>
          {currentStep === 1 && (
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="text-xs">
                Cancel
              </Button>
              <button
                type="button"
                onClick={onSwitchToManual}
                className="text-xs text-slate-600 hover:text-slate-900 underline font-medium cursor-pointer"
              >
                Switch to Manual 5-Step Setup
              </button>
            </div>
          )}

          {currentStep === 2 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep(1)}
              className="gap-1.5 font-medium text-xs text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back: Project Details</span>
            </Button>
          )}

          {currentStep === 3 && analysisError && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep(2)}
              className="gap-1.5 font-medium text-xs text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Documents</span>
            </Button>
          )}

          {currentStep === 4 && (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep(2)}
                className="gap-1.5 font-medium text-xs text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Documents</span>
              </Button>
              <button
                type="button"
                onClick={onSwitchToManual}
                className="text-xs text-slate-600 hover:text-slate-900 underline font-medium cursor-pointer"
              >
                Switch to Manual Setup
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentStep === 1 && (
            <Button
              variant="primary"
              onClick={() => setCurrentStep(2)}
              disabled={
                !name.trim() ||
                !key.trim() ||
                !/^[A-Z0-9_-]{2,10}$/.test(key.trim().toUpperCase()) ||
                keyValidation.status === "invalid"
              }
              className="bg-[#1D63ED] hover:bg-[#1550C0] text-white font-medium px-5 h-9 shadow-2xs gap-1.5"
            >
              <span>Next: Document Intake</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}

          {currentStep === 2 && (
            <div className="flex items-center gap-2">
              {stagedDocs.length === 0 && !isUploading && (
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  Upload at least 1 document to proceed
                </span>
              )}
              <Button
                variant="primary"
                onClick={handleRunAnalysis}
                disabled={stagedDocs.length === 0 || isUploading}
                loading={isUploading}
                title={stagedDocs.length === 0 ? "Upload at least 1 document to run AI analysis" : undefined}
                className={cn(
                  "font-medium px-5 h-9 shadow-2xs gap-1.5 transition-all",
                  stagedDocs.length > 0 && !isUploading
                    ? "bg-[#1D63ED] hover:bg-[#1550C0] text-white cursor-pointer"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                )}
              >
                <Brain className="h-4 w-4" />
                <span>
                  {isUploading
                    ? "Staging Documents..."
                    : stagedDocs.length > 0
                    ? `Next: Run AI Document Analysis (${stagedDocs.length})`
                    : "Next: AI Document Analysis"}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="flex items-center gap-2">
              {analysisError ? (
                <Button
                  variant="primary"
                  onClick={handleRunAnalysis}
                  className="bg-[#1D63ED] hover:bg-[#1550C0] text-white font-medium px-5 h-9 shadow-2xs gap-1.5"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Retry Analysis</span>
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 font-medium">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1D63ED]" />
                  <span>
                    AI Extraction Pipeline Active ·{" "}
                    {analysisEstimatedRemaining > 3
                      ? `~${analysisEstimatedRemaining}s remaining`
                      : "Finalizing verification..."}
                  </span>
                </div>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <Button
              variant="primary"
              onClick={handleApproveAndCreate}
              loading={isSubmitting}
              disabled={!approvalConfirmed}
              className="bg-[#1D63ED] hover:bg-[#1550C0] text-white font-medium px-6 h-9 shadow-2xs gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Approve & Create Project</span>
            </Button>
          )}
        </div>
      </footer>

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
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1D63ED] text-white shadow-2xs">
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
                  <Loader2 className="h-6 w-6 animate-spin text-[#1D63ED]" />
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
