import { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  EvalMetricFormValues,
  useEvalMetricFormState,
} from "../hooks/useEvalMetricFormState";
import { AgentJudgeMetricFields } from "./metricsFields";

export enum Algorithms {
  AGENT_AS_A_JUDGE = "AGENT_AS_A_JUDGE",
  TOOL_EVALUATION = "TOOL_EVALUATION",
}

export const ALGORITHM_LABEL_MAP: Record<string, string> = {
  AGENT_AS_A_JUDGE: "Agent as a Judge",
  TOOL_EVALUATION: "Tool Evaluation",
};

type EvalMetricFormSubmitPayload = {
  name: string;
  algorithm: string;
  params: Record<string, unknown>;
};

interface EvalMetricFormProps {
  title?: string;
  submitLabel?: string;
  inline?: boolean;
  isSubmitting?: boolean;
  initialValues?: Partial<EvalMetricFormValues>;
  onSubmit: (
    payload: EvalMetricFormSubmitPayload,
    controls: { reset: () => void },
  ) => void;
}

export function EvalMetricForm({
  title = "Create new evaluation metric",
  submitLabel = "Submit",
  inline,
  isSubmitting = false,
  initialValues,
  onSubmit,
}: EvalMetricFormProps) {
  const { name, setName, algorithm, setAlgorithm, params, setParams, reset } =
    useEvalMetricFormState(initialValues);

  const isSubmitDisabled = !name.trim() || !algorithm || isSubmitting;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!algorithm || !name.trim()) {
      return;
    }

    onSubmit(
      {
        name: name.trim(),
        algorithm,
        params: params as Record<string, unknown>,
      },
      {
        reset: () => reset(),
      },
    );
  };

  return (
    <form
      className={
        inline ? "flex flex-col gap-4" : "mx-auto flex w-1/2 flex-col gap-4 p-4"
      }
      onSubmit={handleSubmit}
    >
      <h2 className="font-semibold">{title}</h2>

      <label>Metric name</label>
      <Input
        placeholder="Metric name"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

      <label>Algorithm</label>
      <Select value={algorithm} onValueChange={setAlgorithm}>
        <SelectTrigger>
          {algorithm ? ALGORITHM_LABEL_MAP[algorithm] : "Select algorithm"}
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ALGORITHM_LABEL_MAP).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {algorithm === Algorithms.AGENT_AS_A_JUDGE && (
        <AgentJudgeMetricFields data={params} setData={setParams} />
      )}

      <hr />
      <Button className="mt-8" type="submit" disabled={isSubmitDisabled}>
        {submitLabel}
      </Button>
    </form>
  );
}

export default EvalMetricForm;
