import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { extractApiErrorMessage } from "@/controllers/API/helpers/extract-api-error-message";
import {
  type EvaluationCaseCreate,
  useCreateEvaluationCase,
} from "@/controllers/API/queries/eval-cases/use-create-evaluation-case";
import { useUpdateEvaluationCase } from "@/controllers/API/queries/eval-cases/use-patch-evaluation-case";
import useAlertStore from "@/stores/alertStore";
import type { EvaluationCaseType } from "@/types/evaluations";
import { MetricSelect } from "./components/MetricSelect";
import { ModelSelect } from "./components/ModelSelect";
import { ToolsSelect } from "./components/ToolsSelect";
import { type SelectedEvalMetric } from "./types";

type CreateEvalCaseFormProps = {
  flowId?: string;
  initialCase?: EvaluationCaseType | null;
  onSuccess?: () => void;
  onCancel?: () => void;
};

type EvalCaseFormState = {
  name: string;
  evaluationInput: string;
  expectedOutput: string;
  selectedToolIds: string[];
  selectedModelName: string;
  metrics: SelectedEvalMetric[];
};

function getFormState(
  initialCase?: EvaluationCaseType | null,
): EvalCaseFormState {
  return {
    name: initialCase?.name ?? "",
    evaluationInput: Array.isArray(initialCase?.input?.messages)
      ? initialCase.input.messages.join("\n")
      : "",
    expectedOutput:
      typeof initialCase?.expected_output?.message === "string"
        ? initialCase.expected_output.message
        : "",
    selectedToolIds: Array.isArray(initialCase?.expected_output?.tools)
      ? initialCase.expected_output.tools
      : [],
    selectedModelName: initialCase?.model_name ?? "",
    metrics:
      initialCase?.metrics.map((metric) => ({
        metricId: metric.metric_id,
        metricName: metric.metric.name,
        algorithm: metric.metric.algorithm,
        metadata: metric.metadata ?? {},
      })) ?? [],
  };
}

export default function CreateEvalCaseForm({
  flowId,
  initialCase = null,
  onSuccess,
  onCancel,
}: CreateEvalCaseFormProps) {
  const { id: routeFlowId } = useParams();
  const resolvedFlowId = flowId ?? routeFlowId ?? initialCase?.flow_id ?? "";
  const isEditing = Boolean(initialCase);
  const initialState = useMemo(() => getFormState(initialCase), [initialCase]);

  const [name, setName] = useState<string>(initialState.name);
  const [evaluationInput, setEvaluationInput] = useState<string>(
    initialState.evaluationInput,
  );
  const [expectedOutput, setExpectedOutput] = useState<string>(
    initialState.expectedOutput,
  );
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>(
    initialState.selectedToolIds,
  );
  const [selectedModelName, setSelectedModelName] = useState<string>(
    initialState.selectedModelName,
  );
  const [metrics, setMetrics] = useState<SelectedEvalMetric[]>(
    initialState.metrics,
  );

  const setSuccessData = useAlertStore((state) => state.setSuccessData);
  const setErrorData = useAlertStore((state) => state.setErrorData);
  const createEvaluationMutation = useCreateEvaluationCase({});
  const updateEvaluationMutation = useUpdateEvaluationCase({});
  const isSubmitting =
    createEvaluationMutation.isPending || updateEvaluationMutation.isPending;

  useEffect(() => {
    setName(initialState.name);
    setEvaluationInput(initialState.evaluationInput);
    setExpectedOutput(initialState.expectedOutput);
    setSelectedToolIds(initialState.selectedToolIds);
    setSelectedModelName(initialState.selectedModelName);
    setMetrics(initialState.metrics);
  }, [initialState]);

  function resetForm() {
    const emptyState = getFormState();
    setName(emptyState.name);
    setEvaluationInput(emptyState.evaluationInput);
    setExpectedOutput(emptyState.expectedOutput);
    setSelectedToolIds(emptyState.selectedToolIds);
    setSelectedModelName(emptyState.selectedModelName);
    setMetrics(emptyState.metrics);
  }

  function buildPayload(): EvaluationCaseCreate {
    return {
      name,
      input: {
        messages: [evaluationInput],
      },
      flow_id: resolvedFlowId,
      expected_output: {
        message: expectedOutput,
        tools: selectedToolIds,
      },
      model_name: selectedModelName || null,
      metrics: metrics.map((metric) => ({
        metric_id: metric.metricId,
        metadata: metric.metadata,
      })),
    };
  }

  const handleMutationError = (error: unknown) => {
    setErrorData({
      title: `Error ${isEditing ? "updating" : "creating"} evaluation case`,
      list: [
        extractApiErrorMessage(
          error as Parameters<typeof extractApiErrorMessage>[0],
          `An unexpected error occurred while ${isEditing ? "updating" : "creating"} the evaluation case.`,
        ),
      ],
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!resolvedFlowId) {
      return;
    }

    const payload = buildPayload();

    if (isEditing && initialCase) {
      updateEvaluationMutation.mutate(
        {
          eval_case_id: initialCase.id,
          payload,
        },
        {
          onSuccess: () => {
            setSuccessData({
              title: `Evaluation case${name ? ` "${name}"` : ""} updated successfully`,
            });
            onSuccess?.();
          },
          onError: handleMutationError,
        },
      );
      return;
    }

    createEvaluationMutation.mutate(payload, {
      onSuccess: () => {
        setSuccessData({
          title: `Evaluation case${name ? ` "${name}"` : ""} created successfully`,
        });
        resetForm();
        onSuccess?.();
      },
      onError: handleMutationError,
    });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <label>Name</label>
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="Name"
        />
      </div>

      <div className="grid gap-2">
        <label>Input</label>
        <Textarea
          rows={5}
          value={evaluationInput}
          onChange={(event) => {
            setEvaluationInput(event.target.value);
          }}
          placeholder="Input"
        />
      </div>

      <div className="grid gap-2">
        <label>Expected output</label>
        <Textarea
          rows={5}
          value={expectedOutput}
          onChange={(event) => {
            setExpectedOutput(event.target.value);
          }}
          placeholder="Expected output"
        />
      </div>

      <div className="grid gap-2">
        <label>Expected tools</label>
        <ToolsSelect
          flowId={resolvedFlowId}
          selectedToolIds={selectedToolIds}
          setSelectedToolIds={setSelectedToolIds}
        />
      </div>

      <div className="grid gap-2">
        <label>Model</label>
        <ModelSelect
          selectedModelName={selectedModelName}
          setSelectedModelName={setSelectedModelName}
        />
      </div>

      <hr />

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">Metrics</h2>
          <p className="text-sm text-muted-foreground">
            Configure the metrics that should be executed for this eval case.
          </p>
        </div>
        {/* Thiago Coelho - Aqui temos o botão que abre o modal de seleção de métricas */}
        <MetricSelect
          flowId={resolvedFlowId}
          selectedMetrics={metrics}
          setSelectedMetrics={setMetrics}
        />
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button className="px-4 py-2" type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEditing
              ? "Saving..."
              : "Creating..."
            : isEditing
              ? "Save changes"
              : "Create eval case"}
        </Button>
      </div>
    </form>
  );
}
