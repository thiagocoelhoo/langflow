import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { ModelOption } from "@/components/core/parameterRenderComponent/components/modelInputComponent/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useCreateEvaluationCase } from "@/controllers/API/queries/eval-cases/use-create-evaluation-case";
import { useGetEvalMetrics } from "@/controllers/API/queries/eval-metrics/use-get-eval-metrics";
import { useGetFlowTools } from "@/controllers/API/queries/flows/use-get-flow-tools";
import { useGetEnabledModels } from "@/controllers/API/queries/models/use-get-enabled-models";
import { useGetModelProviders } from "@/controllers/API/queries/models/use-get-model-providers";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { MetricSelect } from "./components/MetricSelect";
import { ToolsSelect } from "./components/ToolsSelect";
import { ModelSelect } from "./components/ModelSelect";
import { Textarea } from "@/components/ui/textarea";

export default function CreateEvalCaseForm() {
  const { id: flow_id } = useParams();

  const [name, setName] = useState<string>("");
  const [evaluationInput, setEvaluationInput] = useState<string>("");
  const [expectedOutput, setExpectedOutput] = useState<string>("");
  const [threshold, setThreshold] = useState<number>(0.5);
  const [selectedModelName, setSelectedModelName] = useState<string>("");
  const [metrics, setMetrics] = useState<string[]>([]);

  const createEvaluationMutation = useCreateEvaluationCase({});
  const handleSubmit = (e) => {
    e.preventDefault();
    createEvaluationMutation.mutate({
      name: name,
      input: {
        messages: [evaluationInput],
      },
      flow_id: flow_id,
      expected_output: {
        messages: [expectedOutput],
      },
      model_name: selectedModelName,
      metrics: metrics,
    });
  };

  return (
    <form
      className="flex flex-col w-1/2 mx-auto gap-4 p-4"
      onSubmit={handleSubmit}
    >
      <h2 className="font-semibold text-center mt-4">Evaluation cases</h2>

      <label>Name</label>
      <Input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
        }}
        placeholder="Name"
      />
      <label>Input</label>
      <Textarea
        rows={5}
        value={evaluationInput}
        onChange={(e) => {
          setEvaluationInput(e.target.value);
        }}
        placeholder="Input"
      />
      <label>Expected output</label>
      <Textarea
        rows={5}
        value={expectedOutput}
        onChange={(e) => {
          setExpectedOutput(e.target.value);
        }}
        placeholder="Expected output"
      />

      <label>Expected tools</label>
      <ToolsSelect flowId={flow_id} />

      <label>Model</label>
      <ModelSelect
        selectedModelName={selectedModelName}
        setSelectedModelName={setSelectedModelName}
      />

      <hr />
      <h2 className="font-semibold text-center mt-4">Select the metrics</h2>
      <MetricSelect selectedMetrics={metrics} setSelectedMetrics={setMetrics} />

      <hr />
      <Button className="mt-4 px-4 py-2" type="submit">
        Save
      </Button>
    </form>
  );
}
