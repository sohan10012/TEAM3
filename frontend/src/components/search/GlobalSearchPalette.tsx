import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Bug,
  ClipboardCheck,
  CornerDownLeft,
  FileCode,
  FileText,
  Layers,
  ListChecks,
  Loader2,
  PlayCircle,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { api } from "@/services/api";
import { cn } from "@/utils/format";

export interface SearchResultItem {
  type:
    | "project"
    | "requirement"
    | "acceptance_criterion"
    | "test"
    | "defect"
    | "execution"
    | "document"
    | "business_rule"
    | "suite"
    | "report"
    | "traceability";
  id: number;
  key: string;
  title: string;
  subtitle?: string;
  snippet?: string;
  project_id?: number;
}

interface GlobalSearchPaletteProps {
  open: boolean;
  onClose: () => void;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: any; color: string; badge: string }
> = {
  project: {
    label: "Project",
    icon: Layers,
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    badge: "Project",
  },
  requirement: {
    label: "Requirement",
    icon: FileText,
    color: "bg-blue-50 text-blue-700 border-blue-200",
    badge: "Req",
  },
  acceptance_criterion: {
    label: "Acceptance Criterion",
    icon: ListChecks,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    badge: "AC",
  },
  test: {
    label: "Test Case",
    icon: ClipboardCheck,
    color: "bg-teal-50 text-teal-700 border-teal-200",
    badge: "Test",
  },
  defect: {
    label: "Defect",
    icon: Bug,
    color: "bg-rose-50 text-rose-700 border-rose-200",
    badge: "Defect",
  },
  execution: {
    label: "Execution",
    icon: PlayCircle,
    color: "bg-amber-50 text-amber-700 border-amber-200",
    badge: "Run",
  },
  document: {
    label: "Document",
    icon: FileText,
    color: "bg-orange-50 text-orange-700 border-orange-200",
    badge: "Doc",
  },
  business_rule: {
    label: "Business Rule",
    icon: FileCode,
    color: "bg-purple-50 text-purple-700 border-purple-200",
    badge: "Rule",
  },
  suite: {
    label: "Test Suite",
    icon: Layers,
    color: "bg-cyan-50 text-cyan-700 border-cyan-200",
    badge: "Suite",
  },
  report: {
    label: "Intelligence Report",
    icon: BarChart3,
    color: "bg-violet-50 text-violet-700 border-violet-200",
    badge: "Report",
  },
  traceability: {
    label: "Traceability Matrix",
    icon: ShieldCheck,
    color: "bg-sky-50 text-sky-700 border-sky-200",
    badge: "Trace",
  },
};

type FilterCategory =
  | "all"
  | "project"
  | "requirement"
  | "acceptance_criterion"
  | "test"
  | "defect"
  | "execution"
  | "document"
  | "business_rule"
  | "suite"
  | "report";

export function GlobalSearchPalette({ open, onClose }: GlobalSearchPaletteProps) {
  const navigate = useNavigate();
  const { current } = useProjects();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
  const [scopeCurrentProject, setScopeCurrentProject] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsListRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Debounced search query execution
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params: Record<string, any> = { q: trimmed, limit: 10 };
        if (scopeCurrentProject && current?.id) {
          params.project_id = current.id;
        }
        const data = await api.get<{ results: SearchResultItem[] }>("/search", params);
        setResults(data.results || []);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, scopeCurrentProject, current?.id]);

  // Filter results by selected category
  const filteredResults = activeFilter === "all"
    ? results
    : results.filter((r) => r.type === activeFilter);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredResults.length > 0 ? (prev + 1) % filteredResults.length : 0));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredResults.length > 0 ? (prev - 1 + filteredResults.length) % filteredResults.length : 0));
        return;
      }

      if (e.key === "Enter" && filteredResults[selectedIndex]) {
        e.preventDefault();
        handleSelect(filteredResults[selectedIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, filteredResults, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsListRef.current) {
      const selectedEl = resultsListRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  const handleSelect = (item: SearchResultItem) => {
    onClose();
    switch (item.type) {
      case "project":
        navigate(`/projects/${item.id}`);
        break;
      case "requirement":
        navigate(`/requirements`);
        break;
      case "acceptance_criterion":
        navigate(`/acceptance-criteria`);
        break;
      case "test":
        navigate(`/tests`);
        break;
      case "defect":
        navigate(`/defects`);
        break;
      case "execution":
        navigate(`/executions`);
        break;
      case "document":
        navigate(`/requirements`);
        break;
      case "business_rule":
        navigate(`/simulation`);
        break;
      case "suite":
        navigate(`/suites/${item.id}`);
        break;
      case "report":
        navigate(`/intelligence-report`);
        break;
      case "traceability":
        navigate(`/traceability`);
        break;
      default:
        navigate("/");
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Global Search Palette"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 bg-white">
          <Search className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search requirements, tests, defects, criteria, runs..."
            className="flex-1 bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />}
          {query && !loading && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Clear search query"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-500 border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Filter Bar & Project Scope Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: "all", label: "All" },
                { id: "requirement", label: "Requirements" },
                { id: "acceptance_criterion", label: "Criteria" },
                { id: "test", label: "Tests" },
                { id: "defect", label: "Defects" },
                { id: "execution", label: "Runs" },
                { id: "document", label: "Docs" },
                { id: "business_rule", label: "Rules" },
                { id: "suite", label: "Suites" },
                { id: "report", label: "Reports" },
                { id: "project", label: "Projects" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveFilter(tab.id);
                  setSelectedIndex(0);
                }}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  activeFilter === tab.id
                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200 font-semibold"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {current && (
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600 select-none">
              <input
                type="checkbox"
                checked={scopeCurrentProject}
                onChange={(e) => setScopeCurrentProject(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>In <strong className="font-semibold text-slate-800">{current.key}</strong></span>
            </label>
          )}
        </div>

        {/* Results List */}
        <div
          ref={resultsListRef}
          className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1 min-h-[160px] max-h-[420px]"
        >
          {query.trim().length < 2 ? (
            <div className="py-12 text-center text-slate-400">
              <Search className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-medium text-slate-600">Type at least 2 characters to search</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Instant indexed lookup across requirements, test cases, defects, criteria, and executions.
              </p>
            </div>
          ) : loading && results.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin text-blue-600" />
              <p className="text-xs font-medium text-slate-600">Searching quality database...</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-xs font-medium text-slate-700">No results found for "{query}"</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Try searching for requirement keys (e.g. "REQ"), test keys ("TC"), or defect IDs.
              </p>
            </div>
          ) : (
            filteredResults.map((item, idx) => {
              const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.requirement;
              const Icon = cfg.icon;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  data-index={idx}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors border",
                    isSelected
                      ? "bg-blue-50/70 border-blue-200 text-slate-900"
                      : "border-transparent hover:bg-slate-50 text-slate-700"
                  )}
                >
                  <div className={cn("flex h-7 w-7 items-center justify-center rounded-md border shrink-0 mt-0.5", cfg.color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">{item.key}</span>
                      <span className={cn("px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase tracking-wider border", cfg.color)}>
                        {cfg.badge}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-800 truncate mt-0.5">{item.title}</p>
                    {item.subtitle && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                    )}
                    {item.snippet && (
                      <p className="text-[11px] text-slate-400 italic line-clamp-1 mt-0.5 font-sans">
                        "{item.snippet}"
                      </p>
                    )}
                  </div>

                  <ArrowRight className={cn("h-4 w-4 shrink-0 mt-1 transition-opacity", isSelected ? "opacity-100 text-blue-600" : "opacity-0")} />
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-white px-1 py-0.5 border border-slate-200 font-mono text-[10px]">↑</kbd>
              <kbd className="rounded bg-white px-1 py-0.5 border border-slate-200 font-mono text-[10px]">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-white px-1 py-0.5 border border-slate-200 font-mono text-[10px] flex items-center">
                <CornerDownLeft className="h-2.5 w-2.5 mr-0.5" /> Enter
              </kbd>
              <span>to open</span>
            </span>
          </div>
          <span>
            {filteredResults.length} result{filteredResults.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </div>
  );
}
