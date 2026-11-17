import {
  Bug,
  ChevronRight,
  Compass,
  FileCheck2,
  FileText,
  PlayCircle,
  Scale,
} from "lucide-react";
import { type ComponentType, useState } from "react";
import { cn } from "@/utils/format";

interface TemplateItem {
  label: string;
  query: string;
}

interface TemplateCategory {
  id: string;
  name: string;
  icon: ComponentType<{ className?: string }>;
  templates: TemplateItem[];
}

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    id: "project_intel",
    name: "Project Intelligence",
    icon: Compass,
    templates: [
      { label: "Summarize Project Status", query: "Summarize the overall quality status, pass rates, and release readiness of this project." },
      { label: "Assess Release Readiness", query: "Assess release readiness for this project and list all blocking quality risks." },
      { label: "Highlight Major Risks", query: "What are the top 3 risks currently threatening our compliance or test pass rate?" },
      { label: "Explain QA Journey", query: "What stage is this project at in the 6-stage QA journey and what is the recommended next step?" },
    ],
  },
  {
    id: "requirements",
    name: "Requirements & Coverage",
    icon: FileText,
    templates: [
      { label: "Find Uncovered Requirements", query: "Find all uncovered requirements in this project and explain the coverage gaps." },
      { label: "Audit Statutory Evidence", query: "Which source documents, sections, and quotes substantiate these requirements?" },
      { label: "Analyze Requirement Quality", query: "Analyze requirement quality and identify any ambiguity or missing calculation rules." },
      { label: "Detect Traceability Gaps", query: "Detect clause-level coverage gaps and calculate residual risk score." },
    ],
  },
  {
    id: "tests",
    name: "Test Intelligence",
    icon: FileCheck2,
    templates: [
      { label: "Review Test Case Quality", query: "Review the quality, coverage, and approval status of our test cases." },
      { label: "Generate Missing Tests", query: "Draft executable test case specifications for uncovered acceptance criteria." },
      { label: "Prepare Regression Suite", query: "Recommend an optimized regression test selection based on high-risk requirements." },
      { label: "Detect Duplicate Tests", query: "Identify duplicate or overlapping test cases that validate the exact same clause keys." },
    ],
  },
  {
    id: "executions",
    name: "Execution Intelligence",
    icon: PlayCircle,
    templates: [
      { label: "Investigate Failed Runs", query: "Why did the latest test run fail? Compare expected versus actual results and diagnose root cause." },
      { label: "Explain Latest Run", query: "Summarize latest execution results, pass rate, and execution duration." },
      { label: "Create Defects for Failures", query: "Prepare defect proposals with reproduction steps for all confirmed test failures." },
    ],
  },
  {
    id: "defects",
    name: "Defect Management",
    icon: Bug,
    templates: [
      { label: "Summarize Open Defects", query: "Summarize open defects, their severity breakdown, and business impact." },
      { label: "Recommend Remediation", query: "What are the recommended actions to fix and verify these open defect records?" },
      { label: "Root Cause Analysis", query: "Explain the underlying root cause for the highest severity defects." },
    ],
  },
  {
    id: "policy",
    name: "Policy & Compliance",
    icon: Scale,
    templates: [
      { label: "Validate Project Policies", query: "Validate business policy calculation rules against employee payroll or security scenario vectors." },
      { label: "Audit Policy Rules", query: "List active regulatory policies, rules, threshold boundaries, and jurisdiction guidelines." },
      { label: "Explain Compliance Variances", query: "What edge cases or threshold boundaries could cause this policy to fail?" },
    ],
  },
];

interface ReasonXTemplateGalleryProps {
  onSelect: (query: string) => void;
  activeCategory?: string;
}

export function ReasonXTemplateGallery({
  onSelect,
}: ReasonXTemplateGalleryProps) {
  const [selectedCat, setSelectedCat] = useState("project_intel");

  const currentCat = TEMPLATE_CATEGORIES.find((c) => c.id === selectedCat) || TEMPLATE_CATEGORIES[0];

  return (
    <div className="space-y-3 p-1">
      {/* Category Pills Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-2xs">
        {TEMPLATE_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = cat.id === selectedCat;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCat(cat.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-all shrink-0 active:scale-95",
                isActive
                  ? "bg-[#1D4ED8] text-white shadow-xs"
                  : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
              )}
            >
              <Icon className="h-3 w-3" />
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Suggested Template Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {currentCat.templates.map((tpl, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(tpl.query)}
            className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3 text-left transition-all hover:border-blue-400 hover:shadow-md hover:bg-blue-50/20 active:scale-98"
          >
            <div>
              <div className="flex items-center justify-between gap-1 text-xs font-semibold text-slate-800 group-hover:text-[#1D4ED8] transition-colors">
                <span>{tpl.label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#1D4ED8] group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="mt-1 text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                {tpl.query}
              </p>
            </div>
            <span className="mt-2 text-[10px] text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Run Autonomous Action →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
