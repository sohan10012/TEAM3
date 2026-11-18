import { lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ProjectProvider } from "@/hooks/useProjects";
import { AppShell } from "@/layouts/AppShell";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const ProjectIntelligenceReportPage = lazy(() => import("@/pages/ProjectIntelligenceReportPage"));
const SimulationPage = lazy(() => import("@/pages/SimulationPage"));
const AcceptanceCriteriaPage = lazy(() => import("@/pages/AcceptanceCriteriaPage").then((m) => ({ default: m.AcceptanceCriteriaPage })));

const RequirementsPage = lazy(() => import("@/pages/RequirementsPages").then((m) => ({ default: m.RequirementsPage })));
const RequirementDetailPage = lazy(() => import("@/pages/RequirementsPages").then((m) => ({ default: m.RequirementDetailPage })));

const TestsPage = lazy(() => import("@/pages/TestPages").then((m) => ({ default: m.TestsPage })));
const ConsumerMonitoringPage = lazy(() => import("@/pages/TestPages").then((m) => ({ default: m.ConsumerMonitoringPage })));
const ReviewWorkspacePage = lazy(() => import("@/pages/TestPages").then((m) => ({ default: m.ReviewWorkspacePage })));
const TestDetailPage = lazy(() => import("@/pages/TestPages").then((m) => ({ default: m.TestDetailPage })));
const SuitesPage = lazy(() => import("@/pages/TestPages").then((m) => ({ default: m.SuitesPage })));
const SuiteDetailPage = lazy(() => import("@/pages/TestPages").then((m) => ({ default: m.SuiteDetailPage })));

const ExecutionsPage = lazy(() => import("@/pages/ExecutionDefectPages").then((m) => ({ default: m.ExecutionsPage })));
const ExecutionDetailPage = lazy(() => import("@/pages/ExecutionDefectPages").then((m) => ({ default: m.ExecutionDetailPage })));
const DefectsPage = lazy(() => import("@/pages/ExecutionDefectPages").then((m) => ({ default: m.DefectsPage })));
const DefectDetailPage = lazy(() => import("@/pages/ExecutionDefectPages").then((m) => ({ default: m.DefectDetailPage })));

const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));

const ProjectsPage = lazy(() => import("@/pages/ProjectsPage").then((m) => ({ default: m.ProjectsPage })));
const ProjectDetailPage = lazy(() => import("@/pages/ProjectsPage").then((m) => ({ default: m.ProjectDetailPage })));

const TraceabilityPage = lazy(() => import("@/pages/InsightPages").then((m) => ({ default: m.TraceabilityPage })));
const AnalyticsPage = lazy(() => import("@/pages/InsightPages").then((m) => ({ default: m.AnalyticsPage })));
const EvaluationsPage = lazy(() => import("@/pages/InsightPages").then((m) => ({ default: m.EvaluationsPage })));
const AuditPage = lazy(() => import("@/pages/InsightPages").then((m) => ({ default: m.AuditPage })));
const IntegrationsPage = lazy(() => import("@/pages/InsightPages").then((m) => ({ default: m.IntegrationsPage })));

const TITLES: [RegExp, string][] = [
  [/^\/$/, "Overview"],
  [/^\/intelligence-report/, "Project Intelligence Report"],
  [/^\/(simulation|validation)/, "Policy & Scenario Validation"],
  [/^\/projects/, "Projects"],
  [/^\/requirements/, "Requirements"],
  [/^\/acceptance-criteria/, "Acceptance Criteria"],
  [/^\/tests\/monitoring/, "Consumer Policy Monitoring"],
  [/^\/tests\/review/, "Approval workspace"],
  [/^\/tests/, "Test cases"],
  [/^\/suites/, "Test suites"],
  [/^\/executions/, "Test runs"],
  [/^\/defects/, "Defects"],
  [/^\/traceability/, "Traceability"],
  [/^\/analytics/, "Quality analytics"],
  [/^\/evaluations/, "AI evaluations"],
  [/^\/audit/, "Audit logs"],
  [/^\/integrations/, "Integrations"],
  [/^\/settings/, "Settings"],
];

function useTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = TITLES.find(([r]) => r.test(pathname))?.[1];
    document.title = t ? `${t} | TraceTest AI` : "TraceTest AI";
  }, [pathname]);
}

export default function App() {
  useTitle();
  return (
    <ProjectProvider>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="intelligence-report" element={<ProjectIntelligenceReportPage />} />
          <Route path="simulation" element={<SimulationPage />} />
          <Route path="validation" element={<Navigate to="/simulation" replace />} />
          <Route path="requirements" element={<RequirementsPage />} />
          <Route path="requirements/:id" element={<RequirementDetailPage />} />
          <Route path="acceptance-criteria" element={<AcceptanceCriteriaPage />} />
          <Route path="tests" element={<TestsPage />} />
          <Route path="tests/monitoring" element={<ConsumerMonitoringPage />} />
          <Route path="tests/review" element={<ReviewWorkspacePage />} />
          <Route path="tests/:id" element={<TestDetailPage />} />
          <Route path="executions" element={<ExecutionsPage />} />
          <Route path="executions/:id" element={<ExecutionDetailPage />} />
          <Route path="defects" element={<DefectsPage />} />
          <Route path="defects/:id" element={<DefectDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="suites" element={<SuitesPage />} />
          <Route path="suites/:id" element={<SuiteDetailPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="traceability" element={<TraceabilityPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="evaluations" element={<EvaluationsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route
            path="*"
            element={
              <div className="py-16 text-center">
                <p className="text-lg font-semibold">Page not found</p>
                <p className="text-sm text-slate-600">The address may be mistyped, or the record may have been removed.</p>
              </div>
            }
          />
        </Route>
      </Routes>
    </ProjectProvider>
  );
}
