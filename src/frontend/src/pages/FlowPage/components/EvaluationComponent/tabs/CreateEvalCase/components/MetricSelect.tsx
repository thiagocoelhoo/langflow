import { useMemo, useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGetEvalMetrics } from "@/controllers/API/queries/eval-metrics/use-get-eval-metrics";
import { EvalMetricOption, SelectedEvalMetric } from "../types";
import { MetricMetadataModal } from "./MetricMetadataModal";
import {
  getMetricAlgorithmLabel,
  hasConfiguredMetadata,
  summarizeMetricMetadata,
} from "./metricMetadataRegistry";

interface MetricSelectProps {
  flowId: string;
  selectedMetrics: SelectedEvalMetric[];
  setSelectedMetrics: (metrics: SelectedEvalMetric[]) => void;
}

type SelectedMetricsListProps = {
  metricsQuery: ReturnType<typeof useGetEvalMetrics>;
  selectedMetrics: SelectedEvalMetric[];
  openEditModal: (metricId: string) => void;
  handleRemoveMetric: (metricId: string) => void;
};

function SelectedMetricsList({
  metricsQuery,
  selectedMetrics,
  openEditModal,
  handleRemoveMetric,
}: SelectedMetricsListProps) {
  if (metricsQuery.isPending) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
        Loading metrics...
      </div>
    );
  }

  if (selectedMetrics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        <ForwardedIconComponent name="ListChecks" className="h-5 w-5" />
        No metrics configured yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {selectedMetrics.map((metric) => {
        const metadataSummary = summarizeMetricMetadata(
          metric.metadata,
          metric.algorithm,
        );

        return (
          <div
            key={metric.metricId}
            className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{metric.metricName}</span>
                  <Badge variant="secondaryStatic" size="tag">
                    {getMetricAlgorithmLabel(metric.algorithm)}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {hasConfiguredMetadata(metric.metadata, metric.algorithm)
                    ? `${metadataSummary.length} metadata field${metadataSummary.length === 1 ? "" : "s"} configured`
                    : "No case-specific metadata configured"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openEditModal(metric.metricId)}
                >
                  <ForwardedIconComponent
                    name="Pencil"
                    className="mr-2 h-4 w-4"
                  />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleRemoveMetric(metric.metricId)}
                >
                  <ForwardedIconComponent
                    name="Trash2"
                    className="mr-2 h-4 w-4"
                  />
                  Remove
                </Button>
              </div>
            </div>

            {metadataSummary.length > 0 && (
              <div className="flex flex-col gap-1 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {metadataSummary.map((item) => (
                  <span key={`${metric.metricId}-${item}`}>{item}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MetricSelect({
  flowId,
  selectedMetrics,
  setSelectedMetrics,
}: MetricSelectProps) {
  const metricsQuery = useGetEvalMetrics();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMetricId, setEditingMetricId] = useState<string | null>(null);

  const availableMetrics = useMemo<EvalMetricOption[]>(() => {
    if (!metricsQuery.data?.items) {
      return [];
    }

    return metricsQuery.data.items.map((metric) => ({
      id: String(metric.id),
      name: metric.name,
      algorithm: metric.algorithm,
      params: metric.params,
    }));
  }, [metricsQuery.data?.items]);

  const editingMetric =
    editingMetricId === null
      ? null
      : (selectedMetrics.find(
          (metric) => metric.metricId === editingMetricId,
        ) ?? null);

  function handleSaveMetric(metric: SelectedEvalMetric) {
    const metricExists = selectedMetrics.some(
      (selectedMetric) => selectedMetric.metricId === metric.metricId,
    );

    if (metricExists) {
      setSelectedMetrics(
        selectedMetrics.map((selectedMetric) =>
          selectedMetric.metricId === metric.metricId ? metric : selectedMetric,
        ),
      );
      setEditingMetricId(null);
      return;
    }

    setSelectedMetrics([...selectedMetrics, metric]);
    setEditingMetricId(null);
  }

  function handleRemoveMetric(metricId: string) {
    setSelectedMetrics(
      selectedMetrics.filter((metric) => metric.metricId !== metricId),
    );

    if (editingMetricId === metricId) {
      setEditingMetricId(null);
    }
  }

  function openCreateModal() {
    setEditingMetricId(null);
    setIsModalOpen(true);
  }

  function openEditModal(metricId: string) {
    setEditingMetricId(metricId);
    setIsModalOpen(true);
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <div>
            <p className="font-medium">Configured metrics</p>
            <p className="text-sm text-muted-foreground">
              Add metrics and configure case-specific metadata for each
              case-metric relationship.
            </p>
          </div>
          <Button type="button" onClick={openCreateModal}>
            <ForwardedIconComponent name="Plus" className="mr-2 h-4 w-4" />
            Add metric
          </Button>
        </div>

        <SelectedMetricsList
          selectedMetrics={selectedMetrics}
          metricsQuery={metricsQuery}
          openEditModal={openEditModal}
          handleRemoveMetric={handleRemoveMetric}
        />
      </div>

      <MetricMetadataModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setEditingMetricId(null);
          }
        }}
        flowId={flowId}
        metrics={availableMetrics}
        initialMetric={editingMetric}
        disabledMetricIds={selectedMetrics.map((metric) => metric.metricId)}
        onSave={handleSaveMetric}
      />
    </>
  );
}
