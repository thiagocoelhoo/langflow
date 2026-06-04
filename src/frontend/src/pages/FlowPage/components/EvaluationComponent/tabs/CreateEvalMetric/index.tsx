import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { AgentJudgeMetricFields } from "./components/metricsFields";
import { useCreateEvalMetric } from "@/controllers/API/queries/eval-metrics/use-create-eval-metric";

enum Algorithms {
  AGENT_AS_A_JUDGE = "AGENT_AS_A_JUDGE",
  TOOL_USAGE = "TOOL_USAGE",
}

export default function CreateEvalMetricForm() {
  const [metricName, setMetricName] = useState<string | undefined>();
  const [algorithm, setAlgorithm] = useState<string | undefined>();

  const algorithmLabelMap = {
    AGENT_AS_A_JUDGE: "Agent as a Judge",
    TOOL_USAGE: "Tool Usage",
  };
  const [metricParams, setMetricParams] = useState<Object>({});

  const createEvalMetric = useCreateEvalMetric({});

  const handleSubmit = (e) => {
    e.preventDefault();

    createEvalMetric.mutate({
      name: metricName,
      algorithm: algorithm,
      params: metricParams,
    });
  };

  return (
    <form className="flex flex-col w-1/2 mx-auto gap-4 p-4">
      <h2 className="font-semibold">Create new evaluation metric</h2>

      <label>Metric name</label>
      <Input
        placeholder="Metric name"
        value={metricName}
        onChange={(e) => setMetricName(e.target.value)}
      />

      <label>Algorithm</label>
      <Select
        onValueChange={(value) => {
          setAlgorithm(value);
        }}
      >
        <SelectTrigger>
          {algorithm ? algorithmLabelMap[algorithm] : "Select algorithm"}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={null}>-</SelectItem>
          {Object.entries(algorithmLabelMap).map(([value, label]) => (
            <SelectItem value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {algorithm === Algorithms.AGENT_AS_A_JUDGE && (
        <AgentJudgeMetricFields data={metricParams} setData={setMetricParams} />
      )}

      <hr />
      <Button className="mt-8" type="button" onClick={handleSubmit}>
        Submit
      </Button>
    </form>
  );
}
