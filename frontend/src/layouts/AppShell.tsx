import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Bell,
  Bug,
  ClipboardCheck,
  FileText,
  Layers,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PlayCircle,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useProjects } from "@/hooks/useProjects";
import { api } from "@/services/api";
import { cn, fmtDate } from "@/utils/format";

interface NavSection {
  title: string;
  items: { to: string; label: string; icon: any; end?: boolean }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "WORKSPACE",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/simulation", label: "Agent Simulation", icon: Sparkles },
      { to: "/projects", label: "Projects", icon: Layers },
      { to: "/requirements", label: "Requirements", icon: FileText },
    ],
  },
  {
    title: "TESTING",
    items: [
      { to: "/tests", label: "Test Cases", icon: ClipboardCheck },
      { to: "/executions", label: "Test Runs", icon: PlayCircle },
      { to: "/defects", label: "Defects", icon: Bug },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      { to: "/analytics", label: "Monitoring", icon: Activity },
      { to: "/traceability", label: "Reports", icon: BarChart3 },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Wordmark({ compact, projectName }: { compact?: boolean; projectName?: string }) {
  const badgeLabel = projectName ? (projectName.length > 14 ? projectName.slice(0, 12) + "…" : projectName) : "Platform";
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3067DB] text-white shadow-xs ring-1 ring-[#3067DB]/20">
        <span className="font-mono text-xs font-bold tracking-tight">TT</span>
      </div>
      {!compact && (
        <div className="flex min-w-0 flex-col leading-none">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 text-sm font-semibold tracking-tight text-slate-900">TraceTest<span className="font-normal text-slate-500"> AI</span></span>
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-[#3067DB] border border-blue-100 truncate max-w-[100px]" title={projectName || "Platform"}>
              {badgeLabel}
            </span>
          </div>
          <span className="mt-1 text-[10px] text-slate-400 font-medium truncate">Enterprise Quality Verification</span>
        </div>
      )}
    </div>
  );
}

function Breadcrumbs() {
  const { pathname } = useLocation();
  const { current, projects } = useProjects();
  const parts = pathname.split("/").filter(Boolean);
  const allItems = NAV_SECTIONS.flatMap((s) => s.items);
  const nav = allItems.find((n) => n.to !== "/" && pathname.startsWith(n.to.split("?")[0]));
  if (!parts.length) {
    if (current) {
      return (
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
          <Link to="/projects" className="font-medium text-slate-500 hover:text-slate-900">Projects</Link>
          <span className="text-slate-400">/</span>
          <span className="truncate text-slate-900 font-semibold">{current.name}</span>
        </nav>
      );
    }
    return <span className="text-xs font-medium text-slate-600">Dashboard</span>;
  }
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
      <Link to={nav?.to ?? "/"} className="font-medium text-slate-600 hover:text-slate-900">{nav?.label ?? parts[0]}</Link>
      {parts.slice(1).map((p, i) => {
        let text = p.replace(/-/g, " ");
        if (/^\d+$/.test(p)) {
          const found = projects.find((pr) => pr.id === Number(p));
          if (found) text = found.name;
          else text = `#${p}`;
        }
        return (
          <span key={i} className="flex min-w-0 items-center gap-1.5 text-slate-400">
            /
            <span className="truncate text-slate-900 font-semibold">
              {text}
            </span>
          </span>
        );
      })}
    </nav>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const nav = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 200); return () => clearTimeout(t); }, [q]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Global Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const res = useQuery({
    queryKey: ["search", debounced],
    enabled: debounced.length >= 2,
    queryFn: () => api.get<{ results: { type: string; id: number; key: string; title: string }[] }>("/search", { q: debounced })
  });

  const bases: Record<string, string> = { requirement: "/requirements/", test: "/tests/", defect: "/defects/", execution: "/executions/" };
  const path = (t: string, id: number) => (bases[t] ?? "/") + id;
  const items = res.data?.results ?? [];

  useEffect(() => {
    setSelectedIndex(0);
  }, [debounced]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = items[selectedIndex];
      if (target) {
        setOpen(false);
        setQ("");
        nav(path(target.type, target.id));
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={box} className="relative w-full max-w-lg">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search tests, requirements, defects... (⌘K)"
        aria-label="Global search"
        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#3067DB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3067DB]/20"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 font-mono text-[10px] font-medium text-slate-400 sm:flex">
        ⌘K
      </kbd>
      {open && debounced.length >= 2 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-popover" role="listbox">
          {res.isLoading ? (
            <p className="px-3 py-2 text-xs text-slate-500">Searching...</p>
          ) : !items.length ? (
            <p className="px-3 py-2 text-xs text-slate-500">No matches for “{debounced}”</p>
          ) : (
            items.map((r, idx) => (
              <button
                key={r.type + r.id}
                role="option"
                aria-selected={idx === selectedIndex}
                onClick={() => { setOpen(false); setQ(""); nav(path(r.type, r.id)); }}
                className={cn(
                  "flex w-full items-baseline gap-2 px-3 py-2 text-left text-xs focus:outline-none transition-colors",
                  idx === selectedIndex ? "bg-blue-50 text-slate-900 font-medium" : "hover:bg-slate-50 text-slate-700"
                )}
              >
                <span className="w-20 shrink-0 text-2xs uppercase tracking-wider text-slate-500 font-medium">{r.type}</span>
                <span className="font-mono text-xs text-[#3067DB]">{r.key}</span>
                <span className="truncate text-slate-900">{r.title}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications"], queryFn: () =>
    api.get<{ id: number; title: string; body: string; link: string | null; read: boolean; at: string }[]>("/notifications"),
  refetchInterval: 60_000 });
  const unread = q.data?.filter((n) => !n.read).length ?? 0;
  const nav = useNavigate();
  return (
    <Dropdown.Root>
      <Dropdown.Trigger className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3067DB]"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#3067DB]" />}
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="end" sideOffset={6} className="z-40 w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-slate-200 bg-white p-1 shadow-popover">
          {!q.data?.length ? (
            <div className="px-4 py-4 text-center">
              <Bell className="mx-auto h-5 w-5 text-slate-300 mb-1" />
              <p className="text-xs font-medium text-slate-600">No notifications</p>
              <p className="text-[11px] text-slate-400">Real system alerts will appear here</p>
            </div>
          ) : q.data.map((n) => (
            <Dropdown.Item key={n.id} onSelect={async () => {
              await api.post(`/notifications/${n.id}/read`); qc.invalidateQueries({ queryKey: ["notifications"] });
              if (n.link) nav(n.link);
            }} className="cursor-pointer rounded px-3 py-2 text-xs outline-none data-[highlighted]:bg-slate-50">
              <p className={cn("text-slate-900", !n.read && "font-semibold")}>{n.title}</p>
              <p className="text-slate-600 mt-0.5">{n.body}</p>
              <p className="mt-1 text-2xs text-slate-400">{fmtDate(n.at)}</p>
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

export function AppShell() {
  const { projects, projectId, setProjectId, current } = useProjects();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("tracetest.sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const qc = useQueryClient();

  const cfg = useQuery({ queryKey: ["config"], queryFn: () => api.get<any>("/config"), staleTime: 60_000 });
  const meQuery = useQuery({ queryKey: ["auth_me"], queryFn: () => api.get<any>("/auth/me") });
  const llmReady = cfg.data?.llm?.any_configured;

  const isReviewer = meQuery.data?.persona === "reviewer" || meQuery.data?.role === "reviewer" || meQuery.data?.user?.email?.toLowerCase().includes("reviewer");

  const handleTogglePersona = async () => {
    try {
      setSwitching(true);
      const target = isReviewer ? "operator" : "reviewer";
      await api.post("/auth/switch-operator", { persona: target });
      await qc.invalidateQueries();
    } finally {
      setSwitching(false);
    }
  };

  const projectOptions = [
    { value: "ALL", label: "All Project Workspaces" },
    ...projects.map((p) => ({ value: String(p.id), label: `${p.key} — ${p.name}` })),
  ];

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] min-w-0 overflow-x-clip bg-slate-50 text-slate-900">
      {/* Mobile Slide-Over Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[calc(100vw-3rem)] flex-col bg-white shadow-xl animate-in slide-in-from-left duration-200">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
              <Link to="/" onClick={() => setMobileDrawerOpen(false)} aria-label="TraceTest AI overview">
                <Wordmark projectName={current?.name} />
              </Link>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
              {NAV_SECTIONS.map((section) => (
                <div key={section.title}>
                  <div className="px-3 pb-2 text-[10px] font-semibold tracking-[0.12em] text-slate-400">
                    {section.title}
                  </div>
                  <div className="space-y-1">
                    {section.items.map((n) => (
                      <NavLink
                        key={n.to}
                        to={n.to}
                        end={n.end}
                        onClick={() => setMobileDrawerOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            "group flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3067DB]",
                            isActive
                              ? "bg-blue-50 text-[#3067DB] font-semibold ring-1 ring-inset ring-blue-100"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          )
                        }
                      >
                        <n.icon className="h-[18px] w-[18px] shrink-0 text-slate-400 transition-colors group-hover:text-slate-600" aria-hidden />
                        <span className="truncate">{n.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="p-3 border-t border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span className="font-semibold text-slate-700">TraceTest AI</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  Local beta
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          "hidden min-h-0 shrink-0 flex-col border-r border-slate-200 bg-white xl:flex",
          "transition-[width] duration-200",
          collapsed ? "w-16" : "w-64"
        )}
        aria-label="Primary"
      >
        <div className={cn("flex h-16 items-center border-b border-slate-200", collapsed ? "justify-center px-2" : "px-4")}>
          <Link to="/" aria-label="TraceTest AI overview">
            <Wordmark compact={collapsed} projectName={current?.name} />
          </Link>
        </div>
        <nav className={cn("min-h-0 flex-1 space-y-6 overflow-x-hidden overflow-y-auto overscroll-y-contain py-5", collapsed ? "px-2.5" : "px-3")}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <div className="px-3 pb-2 text-[10px] font-semibold tracking-[0.12em] text-slate-400">
                  {section.title}
                </div>
              )}
              <div className="space-y-1">
                {section.items.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.end}
                    title={collapsed ? n.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "group flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors",
                        collapsed && "justify-center px-0",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3067DB]",
                        isActive ? "bg-blue-50 text-[#3067DB] font-semibold ring-1 ring-inset ring-blue-100" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )
                    }
                  >
                    <n.icon className="h-[18px] w-[18px] shrink-0 text-slate-400 transition-colors group-hover:text-slate-600" aria-hidden />
                    {!collapsed && <span className="truncate">{n.label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-slate-200 bg-white px-2.5 pb-2 pt-3">
          {!collapsed && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-tight text-slate-500">
              <span className="font-semibold text-slate-700">TraceTest AI</span>
              <span className="inline-flex shrink-0 items-center rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                Local beta
              </span>
            </div>
          )}
          <button
            onClick={() => {
              setCollapsed((value) => {
                const next = !value;
                try {
                  localStorage.setItem("tracetest.sidebar-collapsed", String(next));
                } catch {
                  // Sidebar state still updates if browser storage is unavailable.
                }
                return next;
              });
            }}
            aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"}
            title={collapsed ? "Expand sidebar" : "Minimize sidebar"}
            className="flex h-10 w-full items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-20 flex min-h-16 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-5 xl:px-6">
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            {/* Hamburger button for mobile */}
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 xl:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Radix UI Project Workspace Switcher */}
            <CustomSelect
              value={projectId ? String(projectId) : "ALL"}
              onValueChange={(val) => setProjectId(val === "ALL" ? null : Number(val))}
              options={projectOptions}
              ariaLabel="Project Workspace"
              triggerClassName="h-10 w-40 truncate rounded-lg sm:w-56"
            />
          </div>

          <div className="order-3 min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-44 sm:max-w-lg">
            <GlobalSearch />
          </div>

          <div className="ml-auto flex max-w-full shrink-0 items-center gap-1">
            {/* Dual-Control Persona Switcher */}
            {(meQuery.data?.persona || meQuery.data?.roles || meQuery.data?.user || meQuery.isSuccess) && (
              <div
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 pl-2.5 pr-1 text-xs text-slate-700"
                title={isReviewer ? "Riley Chen (Reviewer)" : "Alex Kowalski (Operator)"}
                aria-label={`Current persona: ${isReviewer ? "Riley Chen, Reviewer" : "Alex Kowalski, Operator"}`}
              >
                <span className={cn("h-2 w-2 rounded-full", isReviewer ? "bg-purple-600" : "bg-blue-600")} />
                <span className="hidden font-medium text-slate-500 2xl:inline">Persona:</span>
                <span className="hidden font-semibold text-slate-800 2xl:inline">
                  {isReviewer ? "Riley Chen (Reviewer)" : "Alex Kowalski (Operator)"}
                </span>
                <span className="font-semibold text-slate-800 2xl:hidden">{isReviewer ? "Reviewer" : "Operator"}</span>
                <button
                  onClick={handleTogglePersona}
                  disabled={switching}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 2xl:ml-1 2xl:w-auto 2xl:gap-1 2xl:px-2"
                  title="Switch identity persona between Operator and Reviewer"
                  aria-label="Switch identity persona between Operator and Reviewer"
                >
                  <ArrowLeftRight className={cn("h-3 w-3 text-slate-500", switching && "animate-spin")} />
                  <span className="hidden 2xl:inline">Switch</span>
                </button>
              </div>
            )}

            <div
              className="inline-flex h-9 max-w-24 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 text-2xs text-slate-700 2xl:hidden"
              title={`Environment: ${cfg.data?.environment || "local"}; Sandbox: ${cfg.data?.isolation_level || "netns+rlimits"}`}
              aria-label={`Environment ${cfg.data?.environment || "local"}; sandbox ${cfg.data?.isolation_level || "netns+rlimits"}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="truncate font-semibold uppercase">{cfg.data?.environment || "local"}</span>
            </div>
            <div className="hidden h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-2xs text-slate-700 2xl:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-slate-500">Env:</span>
              <span className="font-semibold uppercase text-slate-800">{cfg.data?.environment || "local"}</span>
              <span className="text-slate-300">|</span>
              <span className="font-medium text-slate-500">Sandbox:</span>
              <span className="font-mono text-slate-800">{cfg.data?.isolation_level || "netns+rlimits"}</span>
            </div>

            {/* 1-Click Multi-Agent Simulation Link */}
            <Link
              to="/simulation"
              className="inline-flex h-9 w-9 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 text-2xs font-semibold text-[#3067DB] shadow-2xs transition-colors hover:border-blue-300 hover:bg-blue-100 2xl:w-auto 2xl:px-2.5"
              title="Interactive Multi-Agent Simulation & Agent Health Monitoring"
            >
              <Sparkles className="h-3 w-3 text-[#3067DB]" />
              <span className="hidden 2xl:inline">Simulation</span>
            </Link>

            <Link
              to="/settings"
              className="inline-flex h-9 w-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 text-2xs text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 2xl:w-auto 2xl:px-2.5"
              title={llmReady ? "AI Provider Active — Click to manage in Settings" : "No Provider Configured — Click to configure"}
              aria-label={llmReady ? `AI ${cfg.data?.llm?.mode === "mock" ? "fixture" : "live"}` : "AI not configured"}
            >
              <Activity className={cn("h-3 w-3", llmReady ? "text-emerald-600" : "text-amber-500")} aria-hidden />
              <span className="hidden font-medium 2xl:inline">
                {llmReady ? `AI ${cfg.data?.llm?.mode === "mock" ? "fixture" : "live"}` : "AI not configured"}
              </span>
            </Link>

            <Notifications />

            <Link
              to="/settings"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3067DB]"
              aria-label="Platform Settings"
              title="Platform Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <div className="flex h-10 min-w-0 shrink-0 items-center border-b border-slate-200 bg-slate-50/80 px-4 sm:px-6">
          <Breadcrumbs />
        </div>

        <main className="mx-auto min-h-0 min-w-0 w-full max-w-[1800px] flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6 sm:py-7 xl:px-8" id="main">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
