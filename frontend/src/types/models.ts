// Response shapes returned by the API (request bodies use the OpenAPI-generated Schemas types).
export interface Page<T> { items: T[]; total: number; page: number; page_size: number }
export interface UserRef { id: number; name: string; email: string }
export interface User { id: number; email: string; full_name: string; title: string | null; is_active: boolean;
  can_login: boolean; roles: string[]; last_login_at: string | null; created_at: string }
export interface Me { user: User; roles: string[]; permissions: string[]; csrf_token: string; project_ids: number[] }
export interface Module { id: number; project_id: number; code: string; name: string; description: string }
export interface Environment { id: number; project_id: number; name: string; kind: string; hcm_version: string | null;
  base_url: string | null; is_default: boolean }
export interface Project { id: number; key: string; name: string; description: string; status: string;
  project_type?: "code_based" | "requirements_based";
  business_domain?: string | null;
  product_type?: string | null;
  regulatory_standard?: string | null;
  default_language?: string | null;
  business_scenarios?: string[];
  functional_expectations?: string[];
  constraints_and_assumptions?: string[];
  simulation_environment?: string | null;
  created_at?: string;
  stats: { requirements: number; tests: number; suites: number; open_defects: number; members: number; coverage_pct: number };
  modules?: Module[]; environments?: Environment[]; members?: { user: User; project_role: string }[] }
export interface Clause { id: number; clause_key: string; position: number; text: string;
  ambiguity_flags: { term: string; reason: string }[]; analysis: Record<string, any> }
export interface RequirementVersion { id: number; version: number; title: string; description: string;
  business_objective: string; change_summary: string; author: UserRef | null; created_at: string; clauses?: Clause[] }
export interface Requirement { id: number; key: string; project_id: number; project_key: string; module: Module | null;
  title: string; category: string; priority: string; status: string; version: number; source_type: string;
  author: UserRef | null; analysed_at: string | null; created_at: string; updated_at: string;
  current?: RequirementVersion; clauses?: Clause[]; test_count?: number }
export interface Criterion { id: number; key: string; clause_keys: string[]; description: string; preconditions: string;
  expected_behaviour: string; validation_conditions: string[]; source_quote: string; quote_verified: boolean;
  confidence: number; rationale: string; assumptions: string[]; review_status: string; provider: string; model: string | null }
export interface TestCase { id: number; key: string; project_id: number; requirement_id: number; requirement_key: string;
  requirement_version: number; clause_keys: string[]; ac_keys: string[]; title: string; priority: string; test_type: string;
  confidence: number; automation: string; status: string; validation_status: string; version: number; provider: string;
  model: string | null; duplicate_of: string | null; quote_verified: boolean; needs_reapproval_reason: string | null;
  updated_at: string; description?: string; preconditions?: string; test_data?: Record<string, any>;
  expected_result?: string; source_quote?: string; rationale?: string; script?: string | null; script_hash?: string | null;
  validation_errors?: string[]; steps?: { position: number; action: string; expected: string }[];
  created_by?: UserRef | null; reviewer?: UserRef | null; reviews?: any[]; versions?: any[]; recent_results?: ExecResult[];
  executable?: boolean; blocked_reason?: string }
export interface Suite { id: number; key: string; project_id: number; module: Module | null; name: string; description: string;
  priority: string; test_count: number | null; tests?: TestCase[]; executions?: Execution[];
  coverage?: { requirements: number; clauses: number; covered: number } }
export interface Execution { id: number; key: string; project_id: number; suite: { id: number; key: string; name: string } | null;
  environment: Environment | null; source: string; runner: string; status: string; isolation_level?: string; hcm_version: string | null; total: number;
  passed: number; failed: number; errored: number; skipped: number; duration_ms: number; commit_sha: string | null;
  branch: string | null; retry_of_id: number | null; run_id: number | null; triggered_by: UserRef | null;
  started_at: string | null; finished_at: string | null; results?: ExecResult[];
  artifacts?: { id: number; kind: string; name: string; size_bytes: number; sha256: string }[] }
export interface ExecResult { id: number; execution_id: number; test_case_id: number; test_key: string; test_title: string;
  test_case_version: number; script_hash: string | null; status: string; duration_ms: number; message: string;
  stack_trace: string; stdout: string; failure_analysis: Record<string, any> | null }
export interface Defect { id: number; key: string; project_id: number; title: string; severity: string; priority: string;
  status: string; approval_status: string; evidence_type?: string; source_commit_sha?: string | null; owner: UserRef | null; test_case_id: number | null; requirement_id: number | null;
  execution_id: number | null; github_issue_url: string | null; github_issue_state: string | null; created_at: string;
  updated_at: string; resolved_at: string | null; description?: string; expected_result?: string; actual_result?: string;
  reproduction_steps?: string; error_log?: string; stack_trace?: string; ai_analysis?: Record<string, any> | null;
  reporter?: UserRef | null; execution_result_id?: number | null; test_key?: string | null; requirement_key?: string | null;
  execution_key?: string | null; github_issue_number?: number | null; verified_execution?: { id: number; key: string } | null;
  comments?: { id: number; author: UserRef; body: string; at: string }[];
  links?: { type: string; key: string; id: number; title: string; status: string }[];
  duplicate_candidates?: { key: string; id: number; title: string; status: string; score: number }[];
  allowed_transitions?: string[] }
export interface Run { id: number; kind: string; status: string; progress: number; message: string; result: Record<string, any>;
  error: string | null; steps?: { name: string; status: string; detail: any; at: string }[] }
export interface AuditEntry { id: number; actor: UserRef | null; action: string; entity_type: string; entity_id: number | null;
  entity_key: string | null; project_id: number | null; source: string; details: Record<string, any>; trace_id: string | null;
  created_at: string }

export interface ProjectDashboardData {
  project: {
    id: number;
    key: string;
    name: string;
    description: string;
    status: string;
    health_status: "healthy" | "warning" | "degraded" | "not_tested";
    health_label: string;
    repository: {
      url: string | null;
      repo_name: string | null;
      branch: string;
      latest_commit_sha: string | null;
      latest_commit_short: string | null;
      last_tested_commit_sha: string | null;
      last_tested_commit_short: string | null;
      last_tested_at: string | null;
      connected: boolean;
      status: string;
    };
    current_environment: {
      id: number | null;
      name: string | null;
      kind: string | null;
    };
  };
  summary: {
    total_requirements: number;
    total_clauses: number;
    total_test_cases: number;
    tests_per_requirement: number;
    passed_tests: number;
    passed_pct: number;
    failed_tests: number;
    failed_pct: number;
    skipped_tests: number;
    error_tests: number;
    open_defects: number;
    critical_defects: number;
    high_defects: number;
    medium_defects: number;
    low_defects: number;
    latest_duration_seconds: number | null;
    latest_run_id: number | null;
    latest_run_key: string | null;
  };
  quality_coverage: {
    requirement_coverage_pct: number;
    requirement_covered_count: number;
    requirement_total_count: number;
    clause_coverage_pct: number;
    clause_covered_count: number;
    clause_total_count: number;
    test_pass_rate_pct: number | null;
    pass_rate_passed: number;
    pass_rate_total: number;
  };
  latest_execution: {
    id: number;
    key: string;
    status: string;
    environment_name: string;
    environment_kind: string;
    started_at: string;
    completed_at: string;
    duration_seconds: number;
    total_tests: number;
    passed: number;
    failed: number;
    skipped: number;
    errored: number;
    runner: string;
    isolation_level: string;
    junit_url: string;
    html_url: string;
  } | null;
  recent_runs: {
    id: number;
    run_id: string;
    commit_sha: string;
    commit_short: string;
    environment_name: string;
    environment_kind: string;
    result: string;
    tests_passed: number;
    tests_total: number;
    duration_seconds: number;
    triggered_at: string | null;
  }[];
  requirements_tab: {
    total: number;
    atomic_clauses: number;
    documented: number;
    inferred: number;
    awaiting_confirmation: number;
    approved: number;
    unmapped: number;
    items: {
      id: number;
      key: string;
      title: string;
      status: string;
      category: string;
      confidence: number;
      origin: string;
      module_code: string;
      clauses_count: number;
      test_cases_count: number;
    }[];
  };
  defects_tab: {
    total_open: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    items: {
      id: number;
      key: string;
      title: string;
      severity: string;
      status: string;
      linked_requirement_key: string;
      detection_run_key: string;
      source_commit: string;
      reproduction_evidence: string;
      created_at: string | null;
    }[];
  };
  requirements_status: {
    status: string;
    count: number;
    coverage_pct: number;
  }[];
  recent_activity: {
    id: number;
    action: string;
    title: string;
    subtitle: string;
    timestamp: string | null;
    relative_time: string;
    icon: string;
  }[];
  configuration: {
    repository_url: string | null;
    branch: string;
    commit_sha: string | null;
    environments: {
      id: number;
      name: string;
      kind: string;
      hcm_version: string | null;
      base_url: string | null;
      is_default: boolean;
    }[];
    execution_mode: string;
    test_on_commit: boolean;
  };
}

export interface Document {
  id: number;
  project_id: number;
  filename: string;
  original_name: string;
  file_type: string;
  purpose: string;
  description: string | null;
  size_bytes: number;
  status: "uploaded" | "processing" | "completed" | "failed";
  error_message: string | null;
  extracted_text: string | null;
  sections: { title: string; content: string; page?: number; level?: number }[];
  metadata_json: Record<string, any>;
  created_at: string;
  processed_at: string | null;
}

export interface RequirementClarification {
  id: number;
  project_id: number;
  requirement_id: number | null;
  document_id: number | null;
  issue_type: "ambiguity" | "contradiction" | "incomplete_rule" | "missing_boundary" | "unverifiable";
  ambiguous_text: string;
  question: string;
  suggested_resolution: string | null;
  status: "open" | "resolved" | "dismissed";
  user_response: string | null;
  resolved_by: UserRef | null;
  resolved_at: string | null;
  created_at: string;
}

export interface SimulationModel {
  id: number;
  project_id: number;
  model_key: string;
  name: string;
  version: number;
  status: "draft" | "approved" | "deprecated";
  state_machine_schema: Record<string, any>;
  api_contracts_schema: Record<string, any>;
  rule_specifications: Record<string, any>;
  created_at: string;
}

export interface RequirementsDashboardData {
  project: Project;
  documents_summary: {
    total: number;
    completed: number;
    processing: number;
    failed: number;
    by_purpose: Record<string, number>;
    latest_document: Document | null;
  };
  requirements_summary: {
    total: number;
    functional: number;
    non_functional: number;
    business_rules: number;
    awaiting_review: number;
    approved: number;
    inferred: number;
    open_clarifications: number;
  };
  test_design_summary: {
    acceptance_criteria: number;
    total_tests: number;
    positive: number;
    negative: number;
    boundary_value: number;
    edge_case: number;
    approved_tests: number;
    uncovered_requirements: number;
  };
  execution_summary: {
    specification_validation_runs: number;
    simulation_runs: number;
    external_executions: number;
    latest_execution: {
      id: number;
      key: string;
      source: string;
      execution_type: string;
      status: string;
      total: number;
      passed: number;
      failed: number;
      duration_s: number;
      created_at: string | null;
    } | null;
    requirement_coverage_pct: number | null;
    test_pass_rate_pct: number | null;
  };
  recent_runs: {
    id: number;
    run_id: string;
    execution_type: string;
    result: string;
    tests: string;
    duration: string;
    triggered: string;
  }[];
  open_clarifications: RequirementClarification[];
}

export interface TraceabilityRow {
  requirement_id: number;
  requirement_key: string;
  title: string;
  category: string;
  priority: string;
  review_status: string;
  document: { id: number; filename: string; purpose: string } | null;
  source_section: string | null;
  source_page: string | null;
  acceptance_criteria: {
    id: number;
    key: string;
    actor: string;
    action: string;
    review_status: string;
  }[];
  tests: {
    id: number;
    key: string;
    title: string;
    category: string;
    approval_status: string;
    validation_status: string;
  }[];
  latest_execution_status: string;
  defect_count: number;
  covered: boolean;
}

export interface TraceabilityMatrix {
  project_id: number;
  total_requirements: number;
  covered_requirements: number;
  coverage_pct: number;
  traceability_rows: TraceabilityRow[];
}

export interface QualityReport {
  report_metadata: {
    report_id: string;
    generated_at: string;
    generator: string;
    version: string;
  };
  section_1_project_information: Record<string, any>;
  section_2_executive_summary: Record<string, any>;
  section_3_document_provenance_and_inputs: Record<string, any>;
  section_4_grounded_requirements_inventory: Record<string, any>;
  section_5_requirement_ambiguity_and_clarifications: Record<string, any>;
  section_6_acceptance_criteria_architecture: Record<string, any>;
  section_7_ten_category_test_design_matrix: Record<string, any>;
  section_8_specification_validation_verdict: Record<string, any>;
  section_9_simulation_model_definition: Record<string, any>;
  section_10_behaviour_simulation_results: Record<string, any>;
  section_11_code_execution_reconciliation: Record<string, any>;
  section_12_defect_and_risk_analysis: Record<string, any>;
  section_13_traceability_matrix: Record<string, any>;
  section_14_gap_analysis_and_uncovered_paths: Record<string, any>;
  section_15_regression_readiness_assessment: Record<string, any>;
  section_16_performance_and_boundary_analysis: Record<string, any>;
  section_17_compliance_and_governance_posture: Record<string, any>;
  section_18_audit_log_and_human_approvals: Record<string, any>;
  section_19_recommendations: Record<string, any>;
}
