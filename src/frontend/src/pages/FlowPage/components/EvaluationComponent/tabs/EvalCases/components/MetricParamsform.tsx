import React from "react";
import { AgentJudgeMetricFields } from "@/pages/FlowPage/components/EvaluationComponent/tabs/CreateEvalMetric/components/metricsFields";

interface Props {
  metric: { id?: string; algorithm?: string; name?: string };
  params: Record<string, any>;
  setParams: (p: Record<string, any>) => void;
}

export default function MetricParamsForm({ metric, params, setParams }: Props) {
  // Decida campos com base em metric.algorithm
  if (!metric) {
    return <div>Please select a metric first.</div>;
  }

  switch (metric.algorithm) {
    case "AGENT_AS_A_JUDGE":
      return <AgentJudgeMetricFields data={params} setData={setParams} />;
    case "TOOL_EVALUATION":
      // Render fields specific to TOOL_EVALUATION ou fallback
      return (
        <div>
          {/* Exemplo simples: */}
          <label>Tools (comma separated)</label>
          <input
            value={params.tools ?? ""}
            onChange={(e) => setParams({ ...params, tools: e.target.value })}
          />
        </div>
      );
    default:
      return <div>No parameter UI for this metric type.</div>;
  }
}
