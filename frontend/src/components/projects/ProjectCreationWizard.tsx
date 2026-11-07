import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileCode,
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Shield,
  Trash2,
  Upload,
  X,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { api } from "@/services/api";
import { cn } from "@/utils/format";
import { AiAssistedOnboardingView } from "./AiAssistedOnboardingView";

export interface ProjectCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface UserRoleDraft {
  id: string;
  role_name: string;
  description: string;
  permissions: string[];
  responsibilities: string;
  restrictions: string;
}

export interface BusinessScenarioDraft {
  id: string;
  title: string;
  description: string;
  actor: string;
  preconditions: string;
  expected_outcome: string;
  business_rules: string;
  module: string;
}

export interface UploadedDocDraft {
  id: number;
  filename: string;
  display_name: string;
  file_type: string;
  document_type: string;
  size_bytes: number;
  description: string;
  version: string;
  owner: string;
  document_date: string;
  related_module: string;
  priority: string;
  processing_instructions: string;
  checksum: string;
  status: string;
}

const REGULATORY_STANDARDS = [
  "SOC 2 Type II",
  "ISO 27001",
  "PCI-DSS Level 1",
  "HIPAA",
  "GDPR",
  "FedRAMP",
  "ISO 20022",
  "CCPA",
  "NIST 800-53",
];

const DOMAIN_OPTIONS = [
  "Fintech & Banking",
  "Healthcare & Telemedicine",
  "HR, Benefits & Payroll",
  "E-Commerce & Retail",
  "Enterprise SaaS",
  "Developer Tools & Infrastructure",
  "Cybersecurity & Identity",
  "Supply Chain & Logistics",
  "EdTech & Learning Platforms",
  "Telecommunications & Media",
  "General Software Platform",
];

const PRODUCT_TYPE_OPTIONS = [
  "Distributed Backend & Core Ledger",
  "Web Application & API",
  "Microservice Mesh",
  "Mobile App & Cloud API",
  "Serverless Architecture",
  "Event-Driven Streaming Service",
  "Embedded / IoT System",
  "Enterprise Software Suite",
];

const DOCUMENT_TYPES = [
  { value: "prd", label: "Product Requirements Document (PRD)" },
  { value: "srs", label: "Software Requirements Specification (SRS)" },
  { value: "brd", label: "Business Requirements Document (BRD)" },
  { value: "functional_spec", label: "Functional Specification" },
  { value: "technical_spec", label: "Technical Specification" },
  { value: "api_doc", label: "API Documentation / OpenAPI Spec" },
  { value: "business_rules", label: "Business Rules & Policies" },
  { value: "user_stories", label: "User Stories & Acceptance Criteria" },
  { value: "architecture", label: "Architecture & Design Spec" },
  { value: "compliance_guidelines", label: "Compliance & Security Guidelines" },
];

const WIZARD_STEPS = [
  { step: 1, title: "Project Info", subtitle: "Keys, names & goals" },
  { step: 2, title: "Product Context", subtitle: "Problem & architecture" },
  { step: 3, title: "Roles & Scenarios", subtitle: "User journeys & rules" },
  { step: 4, title: "Documents Intake", subtitle: "Multi-file upload & specs" },
  { step: 5, title: "Review & Create", subtitle: "Verification & pipeline" },
];

const DRAFT_STORAGE_KEY = "tracetest_project_creation_wizard_draft_v1";

export function ProjectCreationWizard({ open, onOpenChange }: ProjectCreationWizardProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const { me } = useAuth();
  const { setProjectId } = useProjects();

  // Phase 14: Onboarding Mode (Mode A: AI-Assisted vs Mode B: Manual)
  const [wizardMode, setWizardMode] = useState<"ai_assisted" | "manual">("ai_assisted");
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState<"requirements_based" | "code_based">("requirements_based");
  const [businessDomain, setBusinessDomain] = useState("Fintech & Banking");
  const [productType, setProductType] = useState("Distributed Backend & Core Ledger");
  const [businessGoal, setBusinessGoal] = useState("");
  const [ownerName, setOwnerName] = useState(me?.user?.full_name || me?.user?.email || "");
  const [team, setTeam] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [environmentName, setEnvironmentName] = useState("Simulation QA Engine");

  // Step 2 Context State
  const [productOverview, setProductOverview] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [targetUsers, setTargetUsers] = useState<string[]>([]);
  const [userTagInput, setUserTagInput] = useState("");
  const [productModules, setProductModules] = useState<string[]>([]);
  const [moduleTagInput, setModuleTagInput] = useState("");
  const [architectureContext, setArchitectureContext] = useState("");
  const [techStackText, setTechStackText] = useState("");
  const [integrations, setIntegrations] = useState<string[]>([]);
  const [integrationTagInput, setIntegrationTagInput] = useState("");
  const [businessRules, setBusinessRules] = useState<string[]>([]);
  const [newRuleInput, setNewRuleInput] = useState("");
  const [regulatoryStandards, setRegulatoryStandards] = useState<string[]>([]);
  const [securityExpectations, setSecurityExpectations] = useState("");
  const [privacyRequirements, setPrivacyRequirements] = useState("");
  const [performanceExpectations, setPerformanceExpectations] = useState("");
  const [availabilityExpectations, setAvailabilityExpectations] = useState("");
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [dependencies, setDependencies] = useState<string[]>([]);

  // Step 3 Roles and Scenarios State
  const [roles, setRoles] = useState<UserRoleDraft[]>([]);
  const [scenarios, setScenarios] = useState<BusinessScenarioDraft[]>([]);

  // Step 4 Documents State
  const [documents, setDocuments] = useState<UploadedDocDraft[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 5 Options
  const [autoExtract, setAutoExtract] = useState(true);
  const [autoGenerateCriteria, setAutoGenerateCriteria] = useState(true);
  const [autoGenerateTests, setAutoGenerateTests] = useState(true);

  // Key Validation State
  const [keyValidation, setKeyValidation] = useState<{
    status: "idle" | "checking" | "valid" | "invalid";
    message: string;
  }>({ status: "idle", message: "" });

  // Load Draft from Session Storage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.key) setKey(parsed.key);
        if (parsed.name) setName(parsed.name);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.projectType) setProjectType(parsed.projectType);
        if (parsed.businessDomain) setBusinessDomain(parsed.businessDomain);
        if (parsed.productType) setProductType(parsed.productType);
        if (parsed.businessGoal) setBusinessGoal(parsed.businessGoal);
        if (parsed.ownerName) setOwnerName(parsed.ownerName);
        if (parsed.team) setTeam(parsed.team);
        if (parsed.version) setVersion(parsed.version);
        if (parsed.environmentName) setEnvironmentName(parsed.environmentName);
        if (parsed.productOverview) setProductOverview(parsed.productOverview);
        if (parsed.problemStatement) setProblemStatement(parsed.problemStatement);
        if (parsed.targetUsers) setTargetUsers(parsed.targetUsers);
        if (parsed.productModules) setProductModules(parsed.productModules);
        if (parsed.architectureContext) setArchitectureContext(parsed.architectureContext);
        if (parsed.techStackText) setTechStackText(parsed.techStackText);
        if (parsed.integrations) setIntegrations(parsed.integrations);
        if (parsed.businessRules) setBusinessRules(parsed.businessRules);
        if (parsed.regulatoryStandards) setRegulatoryStandards(parsed.regulatoryStandards);
        if (parsed.securityExpectations) setSecurityExpectations(parsed.securityExpectations);
        if (parsed.privacyRequirements) setPrivacyRequirements(parsed.privacyRequirements);
        if (parsed.performanceExpectations) setPerformanceExpectations(parsed.performanceExpectations);
        if (parsed.availabilityExpectations) setAvailabilityExpectations(parsed.availabilityExpectations);
        if (parsed.assumptions) setAssumptions(parsed.assumptions);
        if (parsed.exclusions) setExclusions(parsed.exclusions);
        if (parsed.dependencies) setDependencies(parsed.dependencies);
        if (parsed.roles) setRoles(parsed.roles);
        if (parsed.scenarios) setScenarios(parsed.scenarios);
        if (parsed.documents) setDocuments(parsed.documents);
      }
    } catch {
      // Ignore draft read errors
    }
  }, []);

  // Save Draft to Session Storage
  useEffect(() => {
    if (!open) return;
    try {
      const draft = {
        key,
        name,
        description,
        projectType,
        businessDomain,
        productType,
        businessGoal,
        ownerName,
        team,
        version,
        environmentName,
        productOverview,
        problemStatement,
        targetUsers,
        productModules,
        architectureContext,
        techStackText,
        integrations,
        businessRules,
        regulatoryStandards,
        securityExpectations,
        privacyRequirements,
        performanceExpectations,
        availabilityExpectations,
        assumptions,
        exclusions,
        dependencies,
        roles,
        scenarios,
        documents,
      };
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore draft write errors
    }
  }, [
    open,
    key,
    name,
    description,
    projectType,
    businessDomain,
    productType,
    businessGoal,
    ownerName,
    team,
    version,
    environmentName,
    productOverview,
    problemStatement,
    targetUsers,
    productModules,
    architectureContext,
    techStackText,
    integrations,
    businessRules,
    regulatoryStandards,
    securityExpectations,
    privacyRequirements,
    performanceExpectations,
    availabilityExpectations,
    assumptions,
    exclusions,
    dependencies,
    roles,
    scenarios,
    documents,
  ]);

  // Key Validation Debounce
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

    setKeyValidation({ status: "checking", message: "Checking uniqueness..." });
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
        setKeyValidation({ status: "invalid", message: err?.message || "Failed to validate key" });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [key]);

  // Clear Draft
  const handleClearDraft = () => {
    if (!window.confirm("Reset wizard and clear all draft fields?")) return;
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    setKey("");
    setName("");
    setDescription("");
    setProjectType("requirements_based");
    setBusinessDomain("Fintech & Banking");
    setProductType("Distributed Backend & Core Ledger");
    setBusinessGoal("");
    setOwnerName(me?.user?.full_name || me?.user?.email || "");
    setTeam("");
    setVersion("1.0.0");
    setEnvironmentName("Simulation QA Engine");
    setProductOverview("");
    setProblemStatement("");
    setTargetUsers(["Retail Customer", "Treasury Operator"]);
    setProductModules(["Core Ledger", "Settlement Engine"]);
    setArchitectureContext("");
    setTechStackText("");
    setIntegrations([]);
    setBusinessRules(["Total transaction debits must balance credits with zero floating drift."]);
    setRegulatoryStandards(["SOC 2 Type II", "PCI-DSS Level 1"]);
    setSecurityExpectations("");
    setPrivacyRequirements("");
    setPerformanceExpectations("");
    setAvailabilityExpectations("");
    setAssumptions([]);
    setExclusions([]);
    setDependencies([]);
    setRoles([]);
    setScenarios([]);
    setDocuments([]);
    setCurrentStep(1);
    toast.ok("Draft cleared.");
  };

  // Document Upload Handler
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("display_name", file.name.replace(/\.[^/.]+$/, ""));
      formData.append("purpose", "prd");
      formData.append("document_type", "prd");
      formData.append("description", `Uploaded ${file.name}`);
      formData.append("version", "1.0");
      formData.append("owner", ownerName || "Project Lead");
      formData.append("document_date", new Date().toISOString().split("T")[0]);
      formData.append("priority", "medium");
      formData.append("auto_process", "false");

      try {
        const uploaded = await api.post<any>("/documents", formData);
        setDocuments((prev) => [
          ...prev,
          {
            id: uploaded.id,
            filename: uploaded.filename,
            display_name: uploaded.display_name || uploaded.filename,
            file_type: uploaded.file_type,
            document_type: uploaded.document_type || "prd",
            size_bytes: uploaded.size_bytes || file.size,
            description: uploaded.description || "",
            version: uploaded.version || "1.0",
            owner: uploaded.owner || ownerName,
            document_date: uploaded.document_date || new Date().toISOString().split("T")[0],
            related_module: uploaded.related_module || "",
            priority: uploaded.priority || "medium",
            processing_instructions: uploaded.processing_instructions || "",
            checksum: uploaded.checksum || "",
            status: uploaded.status || "uploaded",
          },
        ]);
        toast.ok(`Document '${file.name}' uploaded and checksum verified.`);
      } catch (err: any) {
        toast.error(`Failed to upload ${file.name}: ${err?.message || "Upload failed"}`);
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpdateDocument = async (id: number, patch: Partial<UploadedDocDraft>) => {
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    try {
      await api.patch(`/documents/${id}`, patch);
    } catch {
      // Local state remains updated
    }
  };

  const handleRemoveDocument = (id: number) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  // Submit Mutation
  const createProjectMutation = useMutation({
    mutationFn: async () => {
      // Build structured payload
      const payload = {
        key: key.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        project_type: projectType,
        business_domain: businessDomain,
        product_type: productType,
        business_goal: businessGoal.trim(),
        owner_name: ownerName.trim(),
        team: team.trim(),
        version: version.trim() || "1.0.0",
        environment_name: environmentName.trim() || "Simulation Engine QA",
        context: {
          product_overview: productOverview.trim(),
          problem_statement: problemStatement.trim(),
          target_users: targetUsers,
          product_modules: productModules,
          architecture_context: architectureContext.trim(),
          technical_stack: techStackText ? { stack: techStackText.trim() } : {},
          external_integrations: integrations,
          business_rules: businessRules,
          security_expectations: securityExpectations.trim(),
          privacy_requirements: privacyRequirements.trim(),
          performance_expectations: performanceExpectations.trim(),
          availability_expectations: availabilityExpectations.trim(),
          regulatory_standards: regulatoryStandards,
          assumptions: assumptions,
          exclusions: exclusions,
          dependencies: dependencies,
        },
        roles: roles.map((r) => ({
          role_name: r.role_name.trim(),
          description: r.description.trim(),
          permissions: r.permissions,
          responsibilities: r.responsibilities.trim(),
          restrictions: r.restrictions.trim(),
        })),
        scenarios: scenarios.map((s) => ({
          title: s.title.trim(),
          description: s.description.trim(),
          actor: s.actor.trim(),
          preconditions: s.preconditions.trim(),
          expected_outcome: s.expected_outcome.trim(),
          business_rules: s.business_rules.trim(),
          module: s.module.trim(),
        })),
        document_ids: documents.map((d) => d.id),
        auto_extract: autoExtract,
      };

      const res = await api.post<any>("/projects", payload);
      const projectId = res.id;

      // Queue document processing if requested
      if (documents.length > 0) {
        for (const doc of documents) {
          try {
            await api.post(`/documents/${doc.id}/process`);
          } catch {
            // Processing will continue in background
          }
        }
      }

      // If requested, run initial requirements extraction
      if (autoExtract) {
        try {
          await api.post(`/projects/${projectId}/analyze-requirements`);
        } catch {
          // Non-fatal
        }
      }

      // If requested, trigger acceptance criteria generation
      if (autoGenerateCriteria) {
        try {
          await api.post(`/projects/${projectId}/generate-acceptance-criteria`);
        } catch {
          // Non-fatal
        }
      }

      // If requested, trigger test scenarios generation
      if (autoGenerateTests) {
        try {
          await api.post(`/projects/${projectId}/generate-tests`);
        } catch {
          // Non-fatal
        }
      }

      return res;
    },
    onSuccess: (data) => {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      qc.invalidateQueries({ queryKey: ["projects"] });
      setProjectId(data.id);
      toast.ok(`Project '${data.name}' created successfully with full requirement context!`);
      onOpenChange(false);
      nav(`/projects/${data.id}`);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create project");
    },
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
    >
      <div className="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header Bar */}
        <header className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#3067DB] px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                CREATE PROJECT
              </span>
              <h2 id="wizard-title" className="text-base font-bold text-slate-900">
                Requirements-Based Quality Platform Wizard
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Collect comprehensive product context, roles, scenarios, and specifications for grounded AI verification.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearDraft}
              title="Reset Wizard and Clear Draft"
              className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Draft
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Mode Switcher Banner */}
        <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setWizardMode("ai_assisted")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                wizardMode === "ai_assisted"
                  ? "bg-[#3067DB] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Mode A: AI-Assisted Setup (Recommended)</span>
            </button>
            <button
              type="button"
              onClick={() => setWizardMode("manual")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                wizardMode === "manual"
                  ? "bg-[#3067DB] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Mode B: Manual Detailed Configuration</span>
            </button>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            {wizardMode === "ai_assisted"
              ? "Upload PRD / circulars for automated context & rule generation"
              : "5-step manual configuration wizard"}
          </span>
        </div>

        {wizardMode === "ai_assisted" ? (
          <AiAssistedOnboardingView
            onSuccess={(data) => {
              sessionStorage.removeItem(DRAFT_STORAGE_KEY);
              qc.invalidateQueries({ queryKey: ["projects"] });
              setProjectId(data.project_id);
              onOpenChange(false);
              nav(data.redirect_url);
            }}
            onCancel={() => onOpenChange(false)}
            onSwitchToManual={() => setWizardMode("manual")}
          />
        ) : (
          <>
            {/* Stepper Navigation */}
            <nav
              aria-label="Wizard Steps"
              className="px-6 py-3 border-b border-slate-200 bg-white grid grid-cols-2 sm:grid-cols-5 gap-2 shrink-0"
            >
          {WIZARD_STEPS.map((s) => {
            const isCurrent = currentStep === s.step;
            const isPast = currentStep > s.step;
            return (
              <button
                key={s.step}
                type="button"
                onClick={() => setCurrentStep(s.step)}
                className={cn(
                  "flex items-center gap-2 text-left p-2 rounded-lg transition-all border",
                  isCurrent
                    ? "bg-blue-50/80 border-[#3067DB] text-slate-900 shadow-2xs"
                    : isPast
                    ? "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/60"
                    : "border-transparent text-slate-400 hover:bg-slate-50"
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
                  <p className="text-xs font-semibold truncate leading-tight">{s.title}</p>
                  <p className="text-2xs text-slate-400 truncate leading-tight">{s.subtitle}</p>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Scrollable Wizard Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* STEP 1: PROJECT INFORMATION */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Project Identifiers & Core Metadata</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Establish unique project keys, domains, and top-level mission objectives.
                </p>
              </div>

              {/* Project Type Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  onClick={() => setProjectType("requirements_based")}
                  className={cn(
                    "cursor-pointer p-4 rounded-lg border-2 transition-all space-y-2",
                    projectType === "requirements_based"
                      ? "border-[#3067DB] bg-blue-50/30 shadow-2xs"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-[#3067DB]" />
                      Requirements-Based Quality
                    </span>
                    <span className="text-2xs font-bold px-2 py-0.5 rounded bg-blue-100 text-[#3067DB]">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Primary product direction. Ingest PRDs, SRS, OpenAPI specs, and user journeys to generate Given/When/Then criteria, 10-category test scenarios, and behavioral simulations without requiring Git code.
                  </p>
                </div>

                <div
                  onClick={() => setProjectType("code_based")}
                  className={cn(
                    "cursor-pointer p-4 rounded-lg border-2 transition-all space-y-2",
                    projectType === "code_based"
                      ? "border-[#3067DB] bg-blue-50/30 shadow-2xs"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-slate-600" />
                      Code-Based Repository
                    </span>
                    <span className="text-2xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      EchoBox / Cureonix
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Legacy mode. Connect a GitHub repository for AST source scanning, route discovery, and sandbox-isolated pytest execution against real code.
                  </p>
                </div>
              </div>

              {/* Key and Name */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      placeholder="e.g. BANKCORE"
                      className="w-full h-9 px-3 font-mono uppercase font-semibold text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3067DB] focus:border-transparent bg-white"
                    />
                    <div className="absolute right-2.5 top-2.5">
                      {keyValidation.status === "checking" && <Loader2 className="h-4 w-4 animate-spin text-[#3067DB]" />}
                      {keyValidation.status === "valid" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                      {keyValidation.status === "invalid" && <AlertCircle className="h-4 w-4 text-red-600" />}
                    </div>
                  </div>
                  {keyValidation.message && (
                    <p
                      className={cn(
                        "mt-1 text-2xs",
                        keyValidation.status === "valid"
                          ? "text-emerald-700"
                          : keyValidation.status === "invalid"
                          ? "text-red-600"
                          : "text-slate-500"
                      )}
                    >
                      {keyValidation.message}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-800 mb-1">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setName(newName);
                      if (!key && newName.length >= 3) {
                        const proposed = newName
                          .replace(/[^A-Za-z0-9]/g, "")
                          .slice(0, 8)
                          .toUpperCase();
                        setKey(proposed);
                      }
                    }}
                    placeholder="e.g. NextGen Core Banking Engine"
                    className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3067DB] focus:border-transparent bg-white"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">Executive Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="High-throughput distributed ledger and payment engine powering retail, commercial, and correspondent bank settlements..."
                  className="w-full p-2.5 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3067DB] focus:border-transparent bg-white leading-relaxed"
                />
              </div>

              {/* Domain & Product Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Business Domain</label>
                  <select
                    value={businessDomain}
                    onChange={(e) => setBusinessDomain(e.target.value)}
                    className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3067DB] bg-white"
                  >
                    {DOMAIN_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Product Type</label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3067DB] bg-white"
                  >
                    {PRODUCT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Business Goal */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">Primary Business Goal / Mission</label>
                <input
                  type="text"
                  value={businessGoal}
                  onChange={(e) => setBusinessGoal(e.target.value)}
                  placeholder="e.g. Settle 50,000 TPS with sub-10ms API response time, zero financial drift, and automated AML compliance."
                  className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3067DB] bg-white"
                />
              </div>

              {/* Owner, Team, Version, Env */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Project Owner</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Sarah Connor"
                    className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Engineering Team</label>
                  <input
                    type="text"
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    placeholder="e.g. Ledger Core Squad"
                    className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Release Version</label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="1.0.0"
                    className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Default Environment</label>
                  <input
                    type="text"
                    value={environmentName}
                    onChange={(e) => setEnvironmentName(e.target.value)}
                    placeholder="Simulation QA Engine"
                    className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PRODUCT & BUSINESS CONTEXT */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Foundational Product Context & Invariants</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Provide rich domain constraints, architectural context, and security requirements to ground LLM reasoning.
                </p>
              </div>

              {/* Product Overview & Problem Statement */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Comprehensive Product Overview</label>
                  <textarea
                    rows={4}
                    value={productOverview}
                    onChange={(e) => setProductOverview(e.target.value)}
                    placeholder="Detailed explanation of what the system does, key workflows, and supported lifecycle operations..."
                    className="w-full p-2.5 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3067DB] bg-white leading-relaxed"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Problem Statement / Motivation</label>
                  <textarea
                    rows={4}
                    value={problemStatement}
                    onChange={(e) => setProblemStatement(e.target.value)}
                    placeholder="Legacy mainframes cannot scale beyond 2,000 TPS or handle real-time cross-border settlements with instant AML checks..."
                    className="w-full p-2.5 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3067DB] bg-white leading-relaxed"
                  />
                </div>
              </div>

              {/* Target Users & Personas Tag Builder */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">Target Users & Personas</label>
                <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-slate-300 bg-white min-h-[40px]">
                  {targetUsers.map((u, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-[#3067DB] border border-blue-200 text-xs font-medium"
                    >
                      {u}
                      <button
                        type="button"
                        onClick={() => setTargetUsers(targetUsers.filter((_, i) => i !== idx))}
                        className="hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={userTagInput}
                    onChange={(e) => setUserTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && userTagInput.trim()) {
                        e.preventDefault();
                        if (!targetUsers.includes(userTagInput.trim())) {
                          setTargetUsers([...targetUsers, userTagInput.trim()]);
                        }
                        setUserTagInput("");
                      }
                    }}
                    placeholder="Type persona and press Enter..."
                    className="flex-1 min-w-[160px] h-6 text-xs border-none outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Product Modules & Integrations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">In-Scope Modules</label>
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-slate-300 bg-white min-h-[40px]">
                    {productModules.map((m, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-xs font-medium"
                      >
                        {m}
                        <button
                          type="button"
                          onClick={() => setProductModules(productModules.filter((_, i) => i !== idx))}
                          className="hover:text-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={moduleTagInput}
                      onChange={(e) => setModuleTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && moduleTagInput.trim()) {
                          e.preventDefault();
                          if (!productModules.includes(moduleTagInput.trim())) {
                            setProductModules([...productModules, moduleTagInput.trim()]);
                          }
                          setModuleTagInput("");
                        }
                      }}
                      placeholder="e.g. Ledger Core, KYC (Enter)..."
                      className="flex-1 min-w-[140px] h-6 text-xs border-none outline-none bg-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">External Integrations</label>
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-slate-300 bg-white min-h-[40px]">
                    {integrations.map((it, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-xs font-medium"
                      >
                        {it}
                        <button
                          type="button"
                          onClick={() => setIntegrations(integrations.filter((_, i) => i !== idx))}
                          className="hover:text-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={integrationTagInput}
                      onChange={(e) => setIntegrationTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && integrationTagInput.trim()) {
                          e.preventDefault();
                          if (!integrations.includes(integrationTagInput.trim())) {
                            setIntegrations([...integrations, integrationTagInput.trim()]);
                          }
                          setIntegrationTagInput("");
                        }
                      }}
                      placeholder="e.g. SWIFT, FedNow, Stripe (Enter)..."
                      className="flex-1 min-w-[140px] h-6 text-xs border-none outline-none bg-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Core Business Rules Builder */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">Core Business Rules & Invariants</label>
                <div className="space-y-2 mb-2">
                  {businessRules.map((r, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2.5 rounded bg-slate-50 border border-slate-200"
                    >
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-2xs font-bold text-slate-400 mt-0.5">#{idx + 1}</span>
                        <span className="text-slate-800 font-medium">{r}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBusinessRules(businessRules.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRuleInput}
                    onChange={(e) => setNewRuleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newRuleInput.trim()) {
                        e.preventDefault();
                        setBusinessRules([...businessRules, newRuleInput.trim()]);
                        setNewRuleInput("");
                      }
                    }}
                    placeholder="e.g. Single-transaction overdrafts are strictly prohibited without pre-authorized credit line."
                    className="flex-1 h-9 px-3 text-xs rounded-md border border-slate-300 bg-white"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (newRuleInput.trim()) {
                        setBusinessRules([...businessRules, newRuleInput.trim()]);
                        setNewRuleInput("");
                      }
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Rule
                  </Button>
                </div>
              </div>

              {/* Regulatory Standards */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1.5">
                  Regulatory & Compliance Standards
                </label>
                <div className="flex flex-wrap gap-2">
                  {REGULATORY_STANDARDS.map((std) => {
                    const isSelected = regulatoryStandards.includes(std);
                    return (
                      <button
                        key={std}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setRegulatoryStandards(regulatoryStandards.filter((s) => s !== std));
                          } else {
                            setRegulatoryStandards([...regulatoryStandards, std]);
                          }
                        }}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5",
                          isSelected
                            ? "bg-blue-50 text-[#3067DB] border-[#3067DB]"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                        {std}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Security, Privacy, and SLAs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Security Expectations</label>
                  <textarea
                    rows={2}
                    value={securityExpectations}
                    onChange={(e) => setSecurityExpectations(e.target.value)}
                    placeholder="e.g. Hardware Security Module (HSM) key generation, TLS 1.3 enforced, mutual mTLS for inter-service communication..."
                    className="w-full p-2.5 text-xs rounded-md border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Privacy & Data Residency</label>
                  <textarea
                    rows={2}
                    value={privacyRequirements}
                    onChange={(e) => setPrivacyRequirements(e.target.value)}
                    placeholder="e.g. Field-level AES-256-GCM encryption for cardholder data, GDPR data retention limits, EU sovereign storage..."
                    className="w-full p-2.5 text-xs rounded-md border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Performance Benchmarks</label>
                  <input
                    type="text"
                    value={performanceExpectations}
                    onChange={(e) => setPerformanceExpectations(e.target.value)}
                    placeholder="e.g. P99 latency < 15ms under 50,000 sustained operations per second."
                    className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Availability & SLA</label>
                  <input
                    type="text"
                    value={availabilityExpectations}
                    onChange={(e) => setAvailabilityExpectations(e.target.value)}
                    placeholder="e.g. 99.999% uptime with active-active dual-region disaster recovery."
                    className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: USERS, ROLES & BUSINESS SCENARIOS */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">User Roles & Primary Business Scenarios</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define user personas with explicit authorization limits and critical end-to-end scenarios.
                </p>
              </div>

              {/* Roles Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Project Roles Matrix</h4>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const id = `role_${Date.now()}`;
                      setRoles([
                        ...roles,
                        {
                          id,
                          role_name: "New Role",
                          description: "Role description",
                          permissions: ["read"],
                          responsibilities: "Core responsibilities",
                          restrictions: "Specific restrictions",
                        },
                      ]);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Role
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {roles.map((r) => (
                    <div key={r.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={r.role_name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRoles(roles.map((item) => (item.id === r.id ? { ...item, role_name: val } : item)));
                          }}
                          placeholder="Role Name"
                          className="font-semibold text-xs text-slate-900 bg-transparent border-b border-slate-300 focus:border-[#3067DB] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setRoles(roles.filter((item) => item.id !== r.id))}
                          className="text-slate-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={r.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRoles(roles.map((item) => (item.id === r.id ? { ...item, description: val } : item)));
                          }}
                          placeholder="Role description"
                          className="w-full text-2xs text-slate-600 bg-transparent border-b border-slate-200 focus:border-[#3067DB] outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-2xs pt-1">
                        <div>
                          <span className="font-semibold text-slate-500 block">Responsibilities:</span>
                          <input
                            type="text"
                            value={r.responsibilities}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRoles(roles.map((item) => (item.id === r.id ? { ...item, responsibilities: val } : item)));
                            }}
                            placeholder="Responsibilities"
                            className="w-full text-slate-700 bg-transparent border-b border-slate-200 focus:border-[#3067DB] outline-none"
                          />
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500 block">Restrictions:</span>
                          <input
                            type="text"
                            value={r.restrictions}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRoles(roles.map((item) => (item.id === r.id ? { ...item, restrictions: val } : item)));
                            }}
                            placeholder="Restrictions"
                            className="w-full text-red-700 bg-transparent border-b border-slate-200 focus:border-[#3067DB] outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scenarios Section */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Primary Business Scenarios</h4>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const id = `sc_${Date.now()}`;
                      setScenarios([
                        ...scenarios,
                        {
                          id,
                          title: "New Business Journey",
                          description: "End-to-end user scenario description",
                          actor: targetUsers[0] || "User",
                          preconditions: "User is authenticated and verified.",
                          expected_outcome: "Operation completes with valid confirmation.",
                          business_rules: "Standard business checks apply.",
                          module: productModules[0] || "General",
                        },
                      ]);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Scenario
                  </Button>
                </div>

                <div className="space-y-3">
                  {scenarios.map((sc, idx) => (
                    <div key={sc.id} className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#3067DB] border border-blue-200">
                            SCENARIO #{idx + 1}
                          </span>
                          <input
                            type="text"
                            value={sc.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              setScenarios(scenarios.map((item) => (item.id === sc.id ? { ...item, title: val } : item)));
                            }}
                            placeholder="Scenario Title"
                            className="font-semibold text-xs text-slate-900 flex-1 bg-transparent border-b border-slate-200 focus:border-[#3067DB] outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setScenarios(scenarios.filter((item) => item.id !== sc.id))}
                          className="text-slate-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div>
                        <textarea
                          rows={2}
                          value={sc.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setScenarios(scenarios.map((item) => (item.id === sc.id ? { ...item, description: val } : item)));
                          }}
                          placeholder="Describe the end-to-end user or system journey..."
                          className="w-full p-2 text-2xs rounded border border-slate-200 bg-slate-50 focus:bg-white outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-2xs">
                        <div>
                          <span className="font-semibold text-slate-500 block">Primary Actor:</span>
                          <input
                            type="text"
                            value={sc.actor}
                            onChange={(e) => {
                              const val = e.target.value;
                              setScenarios(scenarios.map((item) => (item.id === sc.id ? { ...item, actor: val } : item)));
                            }}
                            placeholder="Actor"
                            className="w-full text-slate-800 bg-transparent border-b border-slate-200 focus:border-[#3067DB] outline-none"
                          />
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500 block">Preconditions:</span>
                          <input
                            type="text"
                            value={sc.preconditions}
                            onChange={(e) => {
                              const val = e.target.value;
                              setScenarios(scenarios.map((item) => (item.id === sc.id ? { ...item, preconditions: val } : item)));
                            }}
                            placeholder="Preconditions"
                            className="w-full text-slate-800 bg-transparent border-b border-slate-200 focus:border-[#3067DB] outline-none"
                          />
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500 block">Expected Outcome:</span>
                          <input
                            type="text"
                            value={sc.expected_outcome}
                            onChange={(e) => {
                              const val = e.target.value;
                              setScenarios(scenarios.map((item) => (item.id === sc.id ? { ...item, expected_outcome: val } : item)));
                            }}
                            placeholder="Expected Outcome"
                            className="w-full text-slate-800 bg-transparent border-b border-slate-200 focus:border-[#3067DB] outline-none"
                          />
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500 block">Module:</span>
                          <input
                            type="text"
                            value={sc.module}
                            onChange={(e) => {
                              const val = e.target.value;
                              setScenarios(scenarios.map((item) => (item.id === sc.id ? { ...item, module: val } : item)));
                            }}
                            placeholder="Module"
                            className="w-full text-slate-800 bg-transparent border-b border-slate-200 focus:border-[#3067DB] outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: REQUIREMENTS DOCUMENTS INTAKE */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Multi-Document Upload & Specification Intake</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload PDF, DOCX, XLSX, CSV, TXT, or Markdown PRD and SRS files with individual metadata classification.
                </p>
              </div>

              {/* Upload Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileUpload(e.dataTransfer.files);
                }}
                className={cn(
                  "p-8 border-2 border-dashed rounded-xl text-center space-y-3 transition-colors",
                  isUploading
                    ? "border-[#3067DB] bg-blue-50/50"
                    : "border-slate-300 bg-slate-50 hover:bg-slate-100/60"
                )}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.markdown"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                />

                <div className="h-12 w-12 rounded-full bg-blue-100 text-[#3067DB] flex items-center justify-center mx-auto">
                  {isUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                </div>

                <div>
                  <p className="font-semibold text-sm text-slate-800">
                    {isUploading ? "Uploading and verifying checksums..." : "Drag and drop requirement documents here"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports <span className="font-medium text-slate-700">PDF, Word (.docx), Excel (.xlsx), CSV, Text, Markdown</span> up to 25MB each.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Select Files from Computer
                </Button>
              </div>

              {/* Uploaded Documents List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Attached Documentation ({documents.length})
                  </h4>
                  {documents.length > 0 && (
                    <span className="text-2xs text-slate-500">
                      All files will be verified and queued for clause extraction.
                    </span>
                  )}
                </div>

                {documents.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                    <FileText className="h-6 w-6 mx-auto mb-1 text-slate-300" />
                    No documents attached yet. You can attach PRDs now or upload them later on the project dashboard.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {doc.file_type === "pdf" && <FileText className="h-5 w-5 text-red-500 shrink-0" />}
                            {doc.file_type === "docx" && <FileText className="h-5 w-5 text-blue-500 shrink-0" />}
                            {doc.file_type === "xlsx" && <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />}
                            {doc.file_type === "csv" && <FileSpreadsheet className="h-5 w-5 text-teal-600 shrink-0" />}
                            {(doc.file_type === "md" || doc.file_type === "txt") && (
                              <FileCode className="h-5 w-5 text-slate-500 shrink-0" />
                            )}
                            <input
                              type="text"
                              value={doc.display_name}
                              onChange={(e) => handleUpdateDocument(doc.id, { display_name: e.target.value })}
                              className="font-semibold text-xs text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-[#3067DB] outline-none flex-1 truncate"
                              title="Click to rename display title"
                            />
                            <span className="text-2xs font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {doc.file_type}
                            </span>
                            <span className="text-2xs text-slate-400">
                              {Math.round(doc.size_bytes / 1024)} KB
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDocument(doc.id)}
                            className="text-slate-400 hover:text-red-600 p-1"
                            title="Remove document"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Metadata inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-2xs pt-1">
                          <div>
                            <label className="font-semibold text-slate-600 block mb-0.5">Classification</label>
                            <select
                              value={doc.document_type}
                              onChange={(e) => handleUpdateDocument(doc.id, { document_type: e.target.value })}
                              className="w-full h-7 px-2 text-2xs rounded border border-slate-300 bg-white"
                            >
                              {DOCUMENT_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="font-semibold text-slate-600 block mb-0.5">Version</label>
                            <input
                              type="text"
                              value={doc.version}
                              onChange={(e) => handleUpdateDocument(doc.id, { version: e.target.value })}
                              placeholder="1.0"
                              className="w-full h-7 px-2 text-2xs rounded border border-slate-300 bg-white font-mono"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-600 block mb-0.5">Author / Owner</label>
                            <input
                              type="text"
                              value={doc.owner}
                              onChange={(e) => handleUpdateDocument(doc.id, { owner: e.target.value })}
                              placeholder="Author name"
                              className="w-full h-7 px-2 text-2xs rounded border border-slate-300 bg-white"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-600 block mb-0.5">Priority Authority</label>
                            <select
                              value={doc.priority}
                              onChange={(e) => handleUpdateDocument(doc.id, { priority: e.target.value })}
                              className="w-full h-7 px-2 text-2xs rounded border border-slate-300 bg-white"
                            >
                              <option value="critical">Critical (Primary Source)</option>
                              <option value="high">High Authority</option>
                              <option value="medium">Medium</option>
                              <option value="low">Low / Reference Only</option>
                            </select>
                          </div>
                        </div>

                        {/* Extraction instructions & checksum */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-2xs">
                          <div className="md:col-span-2">
                            <span className="font-semibold text-slate-500 block mb-0.5">Parsing Instructions (Optional):</span>
                            <input
                              type="text"
                              value={doc.processing_instructions}
                              onChange={(e) => handleUpdateDocument(doc.id, { processing_instructions: e.target.value })}
                              placeholder="e.g. Focus on Section 4 API contracts and Section 6 error status codes."
                              className="w-full h-7 px-2 rounded border border-slate-200 bg-slate-50 text-slate-700 outline-none"
                            />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-500 block mb-0.5">SHA-256 Checksum:</span>
                            <div className="font-mono text-2xs text-slate-500 truncate bg-slate-100 p-1.5 rounded" title={doc.checksum}>
                              {doc.checksum || "Pending calculation"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & CREATE */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Review & Pipeline Configuration</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm project setup details and configure automated quality engineering extraction steps.
                </p>
              </div>

              {/* Summary Cards */}
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-white text-[#3067DB] border border-blue-200">
                      {key || "KEY"}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{name || "Untitled Project"}</h4>
                  </div>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-[#3067DB]">
                    {projectType === "requirements_based" ? "Requirements-Based Platform" : "Code-Based"}
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">
                  {description || "No description provided."}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-blue-200/60 text-2xs">
                  <div>
                    <span className="text-slate-500 block font-semibold">Business Domain</span>
                    <span className="font-medium text-slate-800">{businessDomain}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-semibold">Product Type</span>
                    <span className="font-medium text-slate-800">{productType}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-semibold">Release Version</span>
                    <span className="font-medium text-slate-800">{version}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-semibold">Environment</span>
                    <span className="font-medium text-slate-800">{environmentName}</span>
                  </div>
                </div>
              </div>

              {/* Context Summary Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1.5">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Context & Rules</span>
                  <div className="text-lg font-bold text-slate-900">{businessRules.length}</div>
                  <p className="text-2xs text-slate-500">
                    {targetUsers.length} user personas • {productModules.length} modules • {regulatoryStandards.length} regulatory standards
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1.5">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Roles & Scenarios</span>
                  <div className="text-lg font-bold text-slate-900">
                    {roles.length} Roles • {scenarios.length} Scenarios
                  </div>
                  <p className="text-2xs text-slate-500">
                    Structured with explicit authorization boundaries and preconditions
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1.5">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Attached Documents</span>
                  <div className="text-lg font-bold text-slate-900">{documents.length} Files</div>
                  <p className="text-2xs text-slate-500">
                    {documents.filter((d) => d.priority === "critical").length} critical authority specifications
                  </p>
                </div>
              </div>

              {/* Automated Execution Pipeline Options */}
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Initial Quality Pipeline Execution
                </h4>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoExtract}
                      onChange={(e) => setAutoExtract(e.target.checked)}
                      className="mt-0.5 rounded text-[#3067DB] focus:ring-[#3067DB]"
                    />
                    <div>
                      <span className="font-semibold text-xs text-slate-900 block">
                        Extract Grounded Requirements Immediately
                      </span>
                      <span className="text-2xs text-slate-500">
                        Synthesizes requirements from business scenarios, project context, and documents with citation provenance.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoGenerateCriteria}
                      onChange={(e) => setAutoGenerateCriteria(e.target.checked)}
                      className="mt-0.5 rounded text-[#3067DB] focus:ring-[#3067DB]"
                    />
                    <div>
                      <span className="font-semibold text-xs text-slate-900 block">
                        Auto-Generate Given/When/Then Acceptance Criteria
                      </span>
                      <span className="text-2xs text-slate-500">
                        Derives structured acceptance criteria from extracted requirements and business rules.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoGenerateTests}
                      onChange={(e) => setAutoGenerateTests(e.target.checked)}
                      className="mt-0.5 rounded text-[#3067DB] focus:ring-[#3067DB]"
                    />
                    <div>
                      <span className="font-semibold text-xs text-slate-900 block">
                        Synthesize Comprehensive 10-Category Test Scenarios
                      </span>
                      <span className="text-2xs text-slate-500">
                        Produces positive, negative, boundary, security, concurrency, and idempotent test scenarios.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <footer className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div>
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                className="gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Previous Step
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>

            {currentStep < 5 ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={
                  (currentStep === 1 && (keyValidation.status !== "valid" || name.trim().length < 3)) ||
                  isUploading
                }
                onClick={() => setCurrentStep((prev) => Math.min(5, prev + 1))}
                className="gap-1.5"
              >
                Next Step
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={createProjectMutation.isPending}
                disabled={createProjectMutation.isPending || !key || name.trim().length < 3}
                onClick={() => createProjectMutation.mutate()}
                className="gap-1.5 px-4"
              >
                <CheckCircle2 className="h-4 w-4" />
                Create Project & Launch Dashboard
              </Button>
            )}
          </div>
        </footer>
          </>
        )}
      </div>
    </div>
  );
}
