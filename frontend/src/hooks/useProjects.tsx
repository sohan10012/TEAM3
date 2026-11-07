import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/services/api";
import type { Page, Project } from "@/types/models";

interface ProjectCtx { projects: Project[]; projectId: number | null; setProjectId: (id: number | null) => void;
  current: Project | null; byId: (id?: number | null) => Project | undefined }
const Ctx = createContext<ProjectCtx | null>(null);
const KEY = "tracetest.project";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const q = useQuery({
    queryKey: ["projects", "switcher"],
    queryFn: async () => {
      try {
        return await api.get<Page<Project>>("/projects", { page_size: 200, sort: "key", order: "asc" });
      } catch {
        // Fallback retry ensuring /auth/me cookie
        await api.get("/auth/me").catch(() => {});
        return await api.get<Page<Project>>("/projects", { page_size: 200, sort: "key", order: "asc" });
      }
    },
    staleTime: 30_000,
    retry: 2,
  });
  const [projectId, setPid] = useState<number | null>(() => {
    try { const v = localStorage.getItem(KEY); return v ? Number(v) : null; } catch { return null; }
  });
  const projects = useMemo(() => q.data?.items ?? [], [q.data]);
  useEffect(() => {
    if (projectId && projects.length && !projects.some((p) => p.id === projectId)) setPid(null);
    if (!projectId && projects.length) {
      const echo = projects.find((p) => p.key === "ECHO");
      if (echo) {
        setPid(echo.id);
        try { localStorage.setItem(KEY, String(echo.id)); } catch { /* ignore */ }
      }
    }
  }, [projects, projectId]);
  const setProjectId = (id: number | null) => {
    setPid(id);
    try { if (id) localStorage.setItem(KEY, String(id)); else localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  };
  return <Ctx.Provider value={{ projects, projectId, setProjectId, current: projects.find((p) => p.id === projectId) ?? null,
    byId: (id) => projects.find((p) => p.id === id) }}>{children}</Ctx.Provider>;
}

export function useProjects() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useProjects outside ProjectProvider");
  return c;
}
