import {
  Bug,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  FileText,
  PlayCircle,
  Scale,
} from "lucide-react";
import { type ComponentType, useState } from "react";
import { cn } from "@/utils/format";

interface TemplateItem {
  label: string;
  description: string;
  query: string;
}

interface TemplateCategory {
  id: string;
  name: string;
  icon: ComponentType<{ className?: string }>;
  templates: TemplateItem[];
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    id: "project_overview",
    name: "Project Overview",
    icon: ClipboardCheck,
    templates: [
      {
        label: "Summarize Project Status",
        description: "Assess overall quality health, pass rates, and release readiness.",
        query: "Summarize the overall quality status, pass rates, and release readiness of this project.",
      },
      {
        label: "Assess Release Readiness",
        description: "Evaluate release criteria and detect blocking quality risks.",
        query: "Assess release readiness for this project and list all blocking quality risks.",
      },
      {
        label: "Highlight Major Risks",
        description: "Surface top risks currently threatening compliance or test success.",
        query: "What are the top 3 risks currently threatening our compliance or test pass rate?",
      },
      {
        label: "Explain QA Journey",
        description: "Review current stage in the 6-stage QA lifecycle and recommended next step.",
        query: "What stage is this project at in the 6-stage QA journey and what is the recommended next step?",
      },
    ],
  },
  {
    id: "requirements_coverage",
    name: "Requirements & Coverage",
    icon: FileText,
    templates: [
      {
        label: "Find Uncovered Requirements",
        description: "Identify requirements lacking test coverage or validation links.",
        query: "Find all uncovered requirements in this project and explain the coverage gaps.",
      },
      {
        label: "Review Acceptance Criteria",
        description: "Audit acceptance criteria completeness and verification status.",
        query: "Review all acceptance criteria across requirements and audit their verification status.",
      },
      {
        label: "Identify Coverage Gaps",
        description: "Detect clause-level coverage gaps and calculate residual risk score.",
        query: "Detect clause-level coverage gaps and calculate residual risk score.",
      },
      {
        label: "Recommend Test Coverage",
        description: "Generate actionable recommendations to close critical requirement gaps.",
        query: "Recommend test coverage improvements for high-risk requirements and edge cases.",
      },
    ],
  },
  {
    id: "test_intelligence",
    name: "Test Intelligence",
    icon: FileCheck2,
    templates: [
      {
        label: "Review Test Suite",
        description: "Assess test suite quality, coverage depth, and approval state.",
        query: "Review the quality, coverage, and approval status of our test cases.",
      },
      {
        label: "Find Missing Tests",
        description: "Draft executable test specifications for uncovered acceptance criteria.",
        query: "Identify uncovered requirements and draft missing test case specifications.",
      },
      {
        label: "Recommend Regression Tests",
        description: "Select targeted regression tests prioritized by requirement risk.",
        query: "Recommend an optimized regression test selection based on high-risk requirements.",
      },
    ],
  },
  {
    id: "execution_intelligence",
    name: "Execution Intelligence",
    icon: PlayCircle,
    templates: [
      {
        label: "Investigate Failed Tests",
        description: "Diagnose test failures and compare expected versus actual outcomes.",
        query: "Why did the latest test run fail? Compare expected versus actual results and diagnose root cause.",
      },
      {
        label: "Compare Recent Runs",
        description: "Analyze pass rates and execution trends across recent test runs.",
        query: "Compare the most recent test execution runs and highlight performance or pass rate trends.",
      },
      {
        label: "Analyze Flaky Tests",
        description: "Detect intermittent or non-deterministic test execution patterns.",
        query: "Analyze test execution history to identify intermittent or non-deterministic test failures.",
      },
    ],
  },
  {
    id: "defect_intelligence",
    name: "Defect Intelligence",
    icon: Bug,
    templates: [
      {
        label: "Review Open Defects",
        description: "Review active defects, severity distribution, and operational impact.",
        query: "Summarize open defects, their severity breakdown, and business impact.",
      },
      {
        label: "Prioritize Critical Defects",
        description: "Surface high-priority bugs blocking release or quality sign-off.",
        query: "Identify critical blocking defects that require immediate remediation.",
      },
      {
        label: "Recommend Remediation",
        description: "Provide actionable guidance to resolve and re-verify open defects.",
        query: "What are the recommended actions to fix and verify these open defect records?",
      },
    ],
  },
  {
    id: "policy_compliance",
    name: "Policy & Compliance",
    icon: Scale,
    templates: [
      {
        label: "Review Compliance Status",
        description: "Evaluate overall regulatory and corporate policy conformance.",
        query: "Review compliance and policy validation status across project evidence.",
      },
      {
        label: "Identify Policy Gaps",
        description: "Detect discrepancies between statutory rules and test verifications.",
        query: "Identify unmapped or unverified policies and calculate compliance risk.",
      },
      {
        label: "Prepare Compliance Summary",
        description: "Generate an audit-ready executive summary with source evidence.",
        query: "Prepare an executive compliance summary with statutory evidence references.",
      },
    ],
  },
];

interface ReasonXTemplateGalleryProps {
  onSelect: (query: string) => void;
  activeCategory?: string;
}

export function ReasonXTemplateGallery({
  onSelect,
  activeCategory,
}: ReasonXTemplateGalleryProps) {
  const [selectedCat, setSelectedCat] = useState(
    activeCategory || "project_overview"
  );

  const currentCat =
    TEMPLATE_CATEGORIES.find((c) => c.id === selectedCat) ||
    TEMPLATE_CATEGORIES[0];

  return (
    <div className="space-y-4">
      {/* Section Heading & Subtitle */}
      <div>
        <h3 className="text-base font-semibold text-slate-900 tracking-tight">
          How can I help?
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
          Choose a task to get started, or ask ReasonX anything about this project.
        </p>
      </div>

      {/* Category Pills Bar (Responsive, wraps cleanly or scrolls smoothly) */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {TEMPLATE_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = cat.id === selectedCat;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCat(cat.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-all cursor-pointer select-none",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                isActive
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/90 hover:text-slate-900"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Suggested Template Action Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {currentCat.templates.map((tpl) => (
          <button
            key={tpl.label}
            type="button"
            onClick={() => onSelect(tpl.query)}
            className={cn(
              "group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 text-left transition-all duration-150 cursor-pointer",
              "hover:border-slate-400 hover:shadow-xs hover:bg-slate-50/50",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
              "active:scale-[0.99]"
            )}
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-xs text-slate-900 group-hover:text-blue-700 transition-colors">
                  {tpl.label}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all mt-0.5" />
              </div>
              <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                {tpl.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
