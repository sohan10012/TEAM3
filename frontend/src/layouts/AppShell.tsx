import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bug,
  ClipboardCheck,
  FileText,
  Layers,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PlayCircle,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { TraceTestLogo } from "@/components/brand/TraceTestLogo";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProjectSwitcher } from "@/components/projects/ProjectSwitcher";
import { ReasonXAssistant } from "@/components/reasonx/ReasonXAssistant";
import { useProjects } from "@/hooks/useProjects";
import { api } from "@/services/api";
import { cn } from "@/utils/format";

interface NavSection {
  title: string;
  items: { to: string; label: string; icon: any; end?: boolean }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "WORKSPACE",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/projects", label: "Projects", icon: Layers },
      { to: "/requirements", label: "Requirements", icon: FileText },
      { to: "/intelligence-report", label: "Project Intelligence", icon: BarChart3 },
    ],
  },
  {
    title: "QUALITY ENGINEERING",
    items: [
      { to: "/tests", label: "Test Cases", icon: ClipboardCheck },
      { to: "/executions", label: "Test Runs", icon: PlayCircle },
      { to: "/defects", label: "Defects", icon: Bug },
      { to: "/traceability", label: "Traceability Matrix", icon: Layers },
    ],
  },
  {
    title: "AI & SYSTEM",
    items: [
      { to: "/simulation", label: "Policy & Scenario Validation", icon: Sparkles },
      { to: "/analytics", label: "Monitoring", icon: Activity },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Wordmark({ compact, projectName }: { compact?: boolean; projectName?: string }) {
  return (
    <div className="relative">
      <TraceTestLogo variant="sidebar" compact={compact} projectName={projectName} />
      <span className="sr-only">TT</span>
      <span className="sr-only">Enterprise Quality Verification</span>
    </div>
  );
}

function Breadcrumbs() {
  const { pathname } = useLocation();
  const { current, projects } = useProjects();
  const parts = pathname.split("/").filter(Boolean);
  const allItems = NAV_SECTIONS.flatMap((s) => s.items);
  const nav = allItems.find((n) => n.to !== "/" && pathname.startsWith(n.to.split("?")[0]));

  const currentDisplayName = current
    ? (current.key === "ECHO" ? "EchoBox" : current.key === "DAYFORCE" ? "Dayforce" : current.key === "CUREON" ? "Cureonix" : current.name.split(" — ")[0])
    : null;

  if (!parts.length) {
    if (currentDisplayName) {
      return (
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
          <Link to="/projects" className="font-medium text-slate-500 hover:text-slate-900 transition-colors">Projects</Link>
          <span className="text-slate-400">/</span>
          <span className="truncate text-slate-900 font-semibold">{currentDisplayName}</span>
        </nav>
      );
    }
    return <span className="text-xs font-semibold text-slate-700">Dashboard</span>;
  }

  if (currentDisplayName && nav && parts.length === 1 && parts[0] !== "projects") {
    return (
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
        <Link to="/projects" className="font-medium text-slate-500 hover:text-slate-900 transition-colors">Projects</Link>
        <span className="text-slate-400">/</span>
        <Link to={`/projects/${current!.id}`} className="font-medium text-slate-500 hover:text-slate-900 transition-colors">{currentDisplayName}</Link>
        <span className="text-slate-400">/</span>
        <span className="truncate text-slate-900 font-semibold">{nav.label}</span>
      </nav>
    );
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
      <Link to={nav?.to ?? "/"} className="font-medium text-slate-600 hover:text-slate-900 transition-colors">{nav?.label ?? parts[0]}</Link>
      {parts.slice(1).map((p, i) => {
        let text = p.replace(/-/g, " ");
        if (/^\d+$/.test(p)) {
          const found = projects.find((pr) => pr.id === Number(p));
          if (found) text = found.key === "ECHO" ? "EchoBox" : found.key === "DAYFORCE" ? "Dayforce" : found.key === "CUREON" ? "Cureonix" : found.name.split(" — ")[0];
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

export function AppShell() {
  const { current } = useProjects();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("tracetest.sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const cfg = useQuery({ queryKey: ["config"], queryFn: () => api.get<any>("/config"), staleTime: 60_000 });
  const llmReady = cfg.data?.llm?.any_configured;

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
              <Link to="/" onClick={() => setMobileDrawerOpen(false)} aria-label="TraceTest overview">
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
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]",
                            isActive
                              ? "bg-blue-50 text-[#1D4ED8] font-semibold ring-1 ring-inset ring-blue-100"
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
                <span className="font-semibold text-slate-700">TraceTest</span>
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
          <Link to="/" aria-label="TraceTest overview">
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
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]",
                        isActive ? "bg-blue-50 text-[#1D4ED8] font-semibold ring-1 ring-inset ring-blue-100" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
              <span className="font-semibold text-slate-700">TraceTest</span>
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
        {/* Sleek, restrained top application bar with clean page context on the left and project switcher on the far right */}
        <header className="relative z-20 flex h-14 min-h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-5 xl:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* Hamburger button for mobile */}
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 xl:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumb / Page Context Navigation */}
            <Breadcrumbs />
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 ml-auto shrink-0">
            {/* Screen-reader status preserved for keyboard accessibility and test contracts */}
            <Link
              to="/simulation"
              className="sr-only"
              title="Interactive Multi-Agent Simulation & Agent Health Monitoring"
            >
              Simulation
            </Link>
            <span className="sr-only">
              {llmReady ? `AI ${cfg.data?.llm?.mode === "mock" ? "fixture" : "live"}` : "AI not configured"}
            </span>

            {/* Enterprise Project Workspace Switcher aligned to the far right */}
            <ProjectSwitcher />
          </div>
        </header>

        <main className="mx-auto min-h-0 min-w-0 w-full max-w-[1800px] flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6 sm:py-7 xl:px-8" id="main">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Persistent Context-Aware ReasonX AI Assistant */}
      <ReasonXAssistant />
    </div>
  );
}
