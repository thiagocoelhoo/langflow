import type { EvaluationMetricMetadata } from "@/types/evaluations";

export type MetricMetadataValue = EvaluationMetricMetadata[string];

export type MetricMetadata = EvaluationMetricMetadata;

export type EvalMetricAlgorithm =
  | "AGENT_AS_A_JUDGE"
  | "TOOL_EVALUATION"
  | "RAG_EVALUATION"
  | string;

export interface EvalMetricOption {
  id: string;
  name: string;
  algorithm: EvalMetricAlgorithm;
  params?: Record<string, unknown> | null;
}

export interface SelectedEvalMetric {
  metricId: string;
  metricName: string;
  algorithm: EvalMetricAlgorithm;
  metadata: MetricMetadata;
}

export type MetricMetadataFieldType =
  | "text"
  | "textarea"
  | "number"
  | "checkbox"
  | "select";

export interface MetricMetadataFieldConfig {
  name: string;
  label: string;
  type: MetricMetadataFieldType;
  description?: string;
  placeholder?: string;
  min?: number;
  step?: number;
  optionsSource?: "flowTools";
}
