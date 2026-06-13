export type EvaluationMetricMetadataValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type EvaluationMetricMetadata = Record<
  string,
  EvaluationMetricMetadataValue
>;

export type EvalMetricType = {
  id: string;
  name: string;
  algorithm: string;
  params?: Record<string, unknown> | null;
};

export type EvaluationCaseMetricType = {
  metric_id: string;
  metadata: EvaluationMetricMetadata;
  metric: EvalMetricType;
};

export type EvaluationCaseType = {
  id: string;
  name: string;
  input: {
    messages: string[];
  };
  expected_output: {
    message: string;
    tools: string[];
  };
  model_name: string | null;
  metrics: EvaluationCaseMetricType[];
  flow_id: string;
};

export type EvaluationCasesResponseType = {
  total_count: number;
  eval_cases: EvaluationCaseType[];
};

export type EvaluationRunType = {
  id: string;
  created_at?: string | null;
  score: number;
  message?: string | null;
  err_message?: string | null;
  trace_id?: string | null;
  eval_case_id?: string | null;
  eval_metric_id?: string | null;
  eval_case_execution_id?: string | null;
  eval_case: EvaluationCaseType;
  eval_metric: EvalMetricType;
};

export type FlowEvalResultsResponseType = {
  items: EvaluationRunType[];
};

export type EvaluationBatchMetricSummaryType = {
  metric_id: string;
  metric_name: string;
  algorithm: string;
  average_score: number;
  success_rate: number;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
};

export type EvaluationBatchSummaryType = {
  id: string;
  flow_id: string;
  trigger_mode: string;
  status: string;
  requested_case_count: number;
  completed_case_count: number;
  failed_case_count: number;
  started_at?: string | null;
  finished_at?: string | null;
  created_at?: string | null;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  average_score: number;
  metric_summaries: EvaluationBatchMetricSummaryType[];
};

export type EvaluationBatchType = EvaluationBatchSummaryType & {
  runs: EvaluationRunType[];
};

export type FlowEvaluationBatchesResponseType = {
  items: EvaluationBatchSummaryType[];
};

export type EvaluationBatchCreatePayload = {
  selection_mode: "single_case" | "selected_cases" | "all_cases" | string;
  case_ids: string[];
};

export type EvalMetricsResponseType = {
  items: EvalMetricType[];
};

export type FlowToolType = {
  id: string;
  display_name: string;
  icon_name?: string | null;
  vertex_type?: string;
  data?: Record<string, unknown> | null;
};

export type FlowToolsResponseType = {
  items: FlowToolType[];
};
