import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { extractApiErrorMessage } from "@/controllers/API/helpers/extract-api-error-message";
import { useCreateEvalMetric } from "@/controllers/API/queries/eval-metrics/use-create-eval-metric";
import { StepperModal } from "@/modals/stepperModal/StepperModal";
import EvalMetricForm from "@/pages/FlowPage/components/EvaluationComponent/tabs/CreateEvalMetric/components/EvalMetricForm";
import useAlertStore from "@/stores/alertStore";
import { EvalMetricOption, MetricMetadata, SelectedEvalMetric } from "../types";
import { MetricMetadataForm } from "./MetricMetadataForm";
import {
  getMetricAlgorithmLabel,
  getMetricMetadataFields,
  sanitizeMetricMetadata,
} from "./metricMetadataRegistry";

interface MetricMetadataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowId: string;
  metrics: EvalMetricOption[];
  initialMetric?: SelectedEvalMetric | null;
  disabledMetricIds?: string[];
  onSave: (metric: SelectedEvalMetric) => void;
}

export enum Step {
  CHOICE = 1,
  SELECT_EXISTING = 2,
  CREATE_NEW = 3,
  PARAMS = 4,
}

function normalizeMetric(metric: any): EvalMetricOption | null {
  if (!metric?.id || !metric?.name || !metric?.algorithm) {
    return null;
  }

  return {
    id: String(metric.id),
    name: String(metric.name),
    algorithm: String(metric.algorithm),
    params: metric.params ?? null,
  };
}

export function MetricMetadataModal({
  open,
  onOpenChange,
  flowId,
  metrics,
  initialMetric,
  disabledMetricIds = [],
  onSave,
}: MetricMetadataModalProps) {
  const createEvalMetric = useCreateEvalMetric({});
  const setErrorData = useAlertStore((state) => state.setErrorData);
  const [step, setStep] = useState<Step>(Step.CHOICE);
  const [selectedMetricId, setSelectedMetricId] = useState("");
  const [metadata, setMetadata] = useState<MetricMetadata>({});
  const [createdMetric, setCreatedMetric] = useState<EvalMetricOption | null>(
    null,
  );

  const metricsWithCreated = useMemo(() => {
    if (!createdMetric) {
      return metrics;
    }

    const alreadyPresent = metrics.some(
      (metric) => metric.id === createdMetric.id,
    );
    if (alreadyPresent) {
      return metrics;
    }

    return [createdMetric, ...metrics];
  }, [metrics, createdMetric]);

  const metricMap = useMemo(
    () =>
      metricsWithCreated.reduce<Record<string, EvalMetricOption>>(
        (acc, metric) => {
          acc[metric.id] = metric;
          return acc;
        },
        {},
      ),
    [metricsWithCreated],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    if (initialMetric) {
      setStep(Step.PARAMS);
      setSelectedMetricId(initialMetric.metricId);
      setMetadata(
        sanitizeMetricMetadata(initialMetric.metadata, initialMetric.algorithm),
      );
      setCreatedMetric(null);
      return;
    }

    setStep(Step.CHOICE);
    setSelectedMetricId("");
    setMetadata({});
    setCreatedMetric(null);
  }, [open, initialMetric]);

  const selectedMetric =
    selectedMetricId.length > 0 ? metricMap[selectedMetricId] : undefined;

  const selectedMetricFields = getMetricMetadataFields(
    selectedMetric?.algorithm,
  );

  const disabledIds = new Set(
    initialMetric
      ? disabledMetricIds.filter(
          (metricId) => metricId !== initialMetric.metricId,
        )
      : disabledMetricIds,
  );

  function handleSelectExistingMetric(metricId: string) {
    setSelectedMetricId(metricId);

    if (initialMetric?.metricId === metricId) {
      setMetadata(
        sanitizeMetricMetadata(initialMetric.metadata, initialMetric.algorithm),
      );
    } else {
      setMetadata({});
    }

    setStep(Step.PARAMS);
  }

  function handleCreatedMetric(metric: any) {
    const normalizedMetric = normalizeMetric(metric);
    if (!normalizedMetric) {
      return;
    }

    setCreatedMetric(normalizedMetric);
    setSelectedMetricId(normalizedMetric.id);
    setMetadata({});
    setStep(Step.PARAMS);
  }

  function handleBack() {
    if (step === Step.SELECT_EXISTING || step === Step.CREATE_NEW) {
      setStep(Step.CHOICE);
      return;
    }

    if (step === Step.PARAMS) {
      setStep(Step.CHOICE);
    }
  }

  function handleSave() {
    if (!selectedMetric) {
      return;
    }

    onSave({
      metricId: selectedMetric.id,
      metricName: selectedMetric.name,
      algorithm: selectedMetric.algorithm,
      metadata: sanitizeMetricMetadata(metadata, selectedMetric.algorithm),
    });

    onOpenChange(false);
  }

  function renderFooter() {
    if (step === Step.CHOICE) {
      return (
        <div className="flex w-full items-center justify-end">
          <Button disabled>Next</Button>
        </div>
      );
    }

    if (step === Step.SELECT_EXISTING || step === Step.CREATE_NEW) {
      return (
        <div className="flex w-full items-center justify-end">
          <Button variant="outline" onClick={handleBack}>
            Back
          </Button>
        </div>
      );
    }

    return (
      <div className="flex w-full items-center justify-end gap-3">
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>
        <Button onClick={handleSave} disabled={!selectedMetric}>
          {initialMetric ? "Save changes" : "Add metric"}
        </Button>
      </div>
    );
  }

  return (
    <StepperModal
      open={open}
      onOpenChange={onOpenChange}
      currentStep={step}
      totalSteps={4}
      title={initialMetric ? "Edit metric metadata" : "Add metric"}
      description="Choose how to add the metric, then configure case-specific metadata for this case-metric relationship."
      icon="ListChecks"
      size="medium"
      showProgress
      contentClassName="bg-muted"
      footer={renderFooter()}
    >
      {step === Step.CHOICE && (
        <div className="grid gap-3">
          <button
            type="button"
            className="rounded-lg border border-border bg-background p-4 text-left transition-colors hover:bg-muted/50"
            onClick={() => setStep(Step.SELECT_EXISTING)}
          >
            <p className="font-medium">Select existing metric</p>
            <p className="text-sm text-muted-foreground">
              Pick an existing metric and configure metadata for this eval case.
            </p>
          </button>

          <button
            type="button"
            className="rounded-lg border border-border bg-background p-4 text-left transition-colors hover:bg-muted/50"
            onClick={() => setStep(Step.CREATE_NEW)}
          >
            <p className="font-medium">Create new metric</p>
            <p className="text-sm text-muted-foreground">
              Create a new metric, then configure metadata for this eval case.
            </p>
          </button>
        </div>
      )}

      {step === Step.SELECT_EXISTING && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Metric</label>
            <Select value="" onValueChange={handleSelectExistingMetric}>
              <SelectTrigger>
                <SelectValue placeholder="Select a metric" />
              </SelectTrigger>
              <SelectContent>
                {metricsWithCreated.map((metric) => (
                  <SelectItem
                    key={metric.id}
                    value={metric.id}
                    disabled={disabledIds.has(metric.id)}
                  >
                    {metric.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {metricsWithCreated.length === 0 && (
            <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
              No metrics available yet. Go back and choose "Create new metric".
            </div>
          )}
        </div>
      )}

      {step === Step.CREATE_NEW && (
        <EvalMetricForm
          inline
          title="Create new evaluation metric"
          submitLabel="Create metric"
          onSubmit={async (payload, controls) => {
            try {
              const created = await createEvalMetric.mutateAsync(payload);
              handleCreatedMetric(created);
              controls.reset();
            } catch (error) {
              setErrorData({
                title: "Error creating evaluation metric",
                list: [
                  extractApiErrorMessage(
                    error as Parameters<typeof extractApiErrorMessage>[0],
                    "An unexpected error occurred while creating the evaluation metric.",
                  ),
                ],
              });
            }
          }}
          isSubmitting={createEvalMetric.isPending}
        />
      )}

      {step === Step.PARAMS && (
        <div className="flex flex-col gap-4">
          {selectedMetric ? (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                <span className="text-sm font-medium">
                  {selectedMetric.name}
                </span>
                <Badge variant="secondaryStatic" size="tag">
                  {getMetricAlgorithmLabel(selectedMetric.algorithm)}
                </Badge>
              </div>

              {selectedMetricFields.length > 0 ? (
                <MetricMetadataForm
                  algorithm={selectedMetric.algorithm}
                  flowId={flowId}
                  value={metadata}
                  onChange={setMetadata}
                />
              ) : (
                <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
                  This metric does not require any case-specific metadata. You
                  can add it as-is.
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
              Select or create a metric before configuring metadata.
            </div>
          )}
        </div>
      )}
    </StepperModal>
  );
}

export default MetricMetadataModal;
