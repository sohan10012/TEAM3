import { Check, ChevronDown, Layers, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { cn } from "@/utils/format";

interface ProjectSwitcherProps {
  className?: string;
}

export function ProjectSwitcher({ className }: ProjectSwitcherProps) {
  const { projects, projectId, setProjectId, current } = useProjects();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const currentKey = current ? current.key : "ALL";
  const displayName = current
    ? current.key === "ECHO"
      ? "EchoBox"
      : current.key === "DAYFORCE"
      ? "Dayforce"
      : current.key === "CUREON"
      ? "Cureonix"
      : current.name.includes(" — ")
      ? current.name.split(" — ")[0]
      : current.name
    : "All Project Workspaces";

  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.key.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.project_type && p.project_type.toLowerCase().includes(q))
    );
  }, [projects, search]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Focus search input when popover opens
  useEffect(() => {
    if (open) {
      setSearch("");
      setHighlightedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const selectProject = (id: number | null) => {
    setProjectId(id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  // Keyboard navigation within popover
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    const totalItems = 1 + filteredProjects.length; // 0 is "ALL", 1..N are projects

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex === 0) {
        selectProject(null);
      } else {
        const selected = filteredProjects[highlightedIndex - 1];
        if (selected) selectProject(selected.id);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-flex items-center min-w-0 select-none", className)}
      onKeyDown={handleKeyDown}
    >
      {/* Visual Apple-Style Popover Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Project Workspace Selector"
        className={cn(
          "flex h-9 items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-1 text-xs shadow-2xs",
          "transition-[border-color,background-color,box-shadow,transform] duration-150 motion-reduce:transition-none",
          "hover:border-slate-300 hover:bg-slate-50/70",
          "active:scale-[0.98] select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/20 focus-visible:border-[#1D63ED]",
          "max-w-[260px] sm:max-w-xs md:max-w-sm min-w-0 cursor-pointer",
          open && "border-[#1D63ED] ring-2 ring-[#1D63ED]/15"
        )}
      >
        <span className="shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-tight text-[#1D4ED8] border border-blue-200/70">
          {currentKey}
        </span>
        <span className="text-slate-300 font-light select-none shrink-0">|</span>
        <span
          className="truncate font-semibold text-slate-800 text-xs"
          title={current ? `${current.key} — ${current.name}` : "All Project Workspaces"}
        >
          {displayName}
        </span>
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200",
            open && "rotate-180 text-slate-600"
          )}
          aria-hidden="true"
        />
      </button>

      {/* Apple-Style Translucent Popover Menu */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md p-1.5 shadow-popover animate-apple-popover motion-reduce:animate-none"
          role="menu"
          aria-label="Project Workspaces"
        >
          {/* Quick Filter Input */}
          <div className="relative mb-1.5 px-1 pt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter workspaces..."
              className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/80 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1D63ED] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D63ED]/20 transition-[border-color,background-color,box-shadow] duration-150 motion-reduce:transition-none"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-0.5 overscroll-contain px-0.5">
            {/* All Project Workspaces Option */}
            <button
              type="button"
              onClick={() => selectProject(null)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors",
                highlightedIndex === 0 ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50",
                projectId === null && "font-semibold text-[#1D4ED8] bg-blue-50/60"
              )}
              role="menuitem"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shrink-0">
                  <Layers className="h-3.5 w-3.5" />
                </div>
                <div className="truncate">
                  <div className="font-semibold text-slate-800">All Project Workspaces</div>
                  <div className="text-[10px] text-slate-400">Aggregate cross-project views</div>
                </div>
              </div>
              {projectId === null && <Check className="h-4 w-4 text-[#1D4ED8] shrink-0" />}
            </button>

            <div className="my-1 border-t border-slate-100" />

            {/* Filtered Project List */}
            {filteredProjects.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No projects match “{search}”
              </div>
            ) : (
              filteredProjects.map((p, idx) => {
                const isSelected = p.id === projectId;
                const isHighlighted = highlightedIndex === idx + 1;
                const isReqBased = p.project_type === "requirements_based";

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectProject(p.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors",
                      isHighlighted ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50",
                      isSelected && "font-semibold text-[#1D4ED8] bg-blue-50/60"
                    )}
                    role="menuitem"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="shrink-0 rounded font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 border border-slate-200">
                        {p.key}
                      </span>
                      <div className="truncate">
                        <div className="font-semibold text-slate-800 truncate" title={p.name}>
                          {p.name.includes(" — ") ? p.name.split(" — ")[0] : p.name}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span>{isReqBased ? "Requirements-Based" : "Code-Based"}</span>
                          {p.stats && <span>&bull; {p.stats.requirements} reqs</span>}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-[#1D4ED8] shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Accessible native select preserved for screen readers, assistive tech, and Vitest contract */}
      <select
        value={projectId ? String(projectId) : "ALL"}
        onChange={(e) => setProjectId(e.target.value === "ALL" ? null : Number(e.target.value))}
        aria-label="Project Workspace"
        className="sr-only"
        tabIndex={-1}
      >
        <option value="ALL">All Project Workspaces</option>
        {projects.map((p) => (
          <option key={p.id} value={String(p.id)}>
            {p.key} — {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
