import { ColDef } from "ag-grid-community";
import { Pencil, Plus, Ruler, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import TableComponent from "@/components/core/parameterRenderComponent/components/tableComponent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { extractApiErrorMessage } from "@/controllers/API/helpers/extract-api-error-message";
import { useCreateEvalMetric } from "@/controllers/API/queries/eval-metrics/use-create-eval-metric";
import { useDeleteEvalMetric } from "@/controllers/API/queries/eval-metrics/use-delete-eval-metric";
import { useGetEvalMetrics } from "@/controllers/API/queries/eval-metrics/use-get-eval-metrics";
import { useUpdateEvalMetric } from "@/controllers/API/queries/eval-metrics/use-patch-eval-metric";
import useAlertStore from "@/stores/alertStore";
import type { EvalMetricType } from "@/types/evaluations";
import EvalMetricForm, {
  ALGORITHM_LABEL_MAP,
} from "./components/EvalMetricForm";

type FormPayload = {
  name: string;
  algorithm: string;
  params: Record<string, unknown>;
};

function getAlgorithmLabel(algorithm: string): string {
  return ALGORITHM_LABEL_MAP[algorithm] ?? algorithm;
}

export default function EvalMetricsTab() {
  const metricsQuery = useGetEvalMetrics();
  const createEvalMetric = useCreateEvalMetric({});
  const updateEvalMetric = useUpdateEvalMetric({});
  const deleteEvalMetric = useDeleteEvalMetric({});

  const setSuccessData = useAlertStore((state) => state.setSuccessData);
  const setErrorData = useAlertStore((state) => state.setErrorData);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<EvalMetricType | null>(
    null,
  );
  const [deletingMetric, setDeletingMetric] = useState<EvalMetricType | null>(
    null,
  );

  const rows = metricsQuery.data?.items ?? [];
  const isBusy =
    createEvalMetric.isPending ||
    updateEvalMetric.isPending ||
    deleteEvalMetric.isPending;

  const columns: ColDef[] = useMemo(
    () => [
      {
        headerName: "ID",
        field: "id",
        flex: 1,
        minWidth: 220,
        filter: false,
        sortable: false,
        editable: false,
      },
      {
        headerName: "Name",
        field: "name",
        flex: 1,
        minWidth: 220,
        filter: false,
        sortable: false,
        editable: false,
      },
      {
        headerName: "Algorithm",
        field: "algorithm",
        flex: 1,
        minWidth: 220,
        filter: false,
        sortable: false,
        editable: false,
        cellRenderer: (item) => getAlgorithmLabel(item.data.algorithm),
      },
      {
        headerName: "Params",
        flex: 1,
        minWidth: 160,
        filter: false,
        sortable: false,
        editable: false,
        cellRenderer: (item) => {
          const params = item.data.params;
          const count =
            params && typeof params === "object"
              ? Object.keys(params).length
              : 0;
          return count === 0
            ? "No params"
            : `${count} param${count === 1 ? "" : "s"}`;
        },
      },
      {
        headerName: "Actions",
        minWidth: 220,
        filter: false,
        sortable: false,
        editable: false,
        cellRenderer: (item) => {
          const metric = item.data as EvalMetricType;

          return (
            <div className="flex items-center gap-2 py-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={isBusy}
                onClick={() => setEditingMetric(metric)}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={isBusy}
                onClick={() => setDeletingMetric(metric)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          );
        },
      },
    ],
    [isBusy],
  );

  async function handleCreateMetric(
    payload: FormPayload,
    controls: { reset: () => void },
  ) {
    try {
      const created = await createEvalMetric.mutateAsync(payload);
      setSuccessData({
        title: `Evaluation metric${created?.name ? ` "${created.name}"` : ""} created successfully`,
      });
      controls.reset();
      setIsCreateModalOpen(false);
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
  }

  async function handleEditMetric(payload: FormPayload) {
    if (!editingMetric) {
      return;
    }

    try {
      const updated = await updateEvalMetric.mutateAsync({
        metric_id: editingMetric.id,
        payload,
      });

      setSuccessData({
        title: `Evaluation metric${updated?.name ? ` "${updated.name}"` : ""} updated successfully`,
      });
      setEditingMetric(null);
    } catch (error) {
      setErrorData({
        title: "Error updating evaluation metric",
        list: [
          extractApiErrorMessage(
            error as Parameters<typeof extractApiErrorMessage>[0],
            "An unexpected error occurred while updating the evaluation metric.",
          ),
        ],
      });
    }
  }

  async function handleDeleteMetric() {
    if (!deletingMetric) {
      return;
    }

    try {
      await deleteEvalMetric.mutateAsync({
        metric_id: deletingMetric.id,
      });

      setSuccessData({
        title: `Evaluation metric${deletingMetric.name ? ` "${deletingMetric.name}"` : ""} deleted successfully`,
      });
      setDeletingMetric(null);
    } catch (error) {
      setErrorData({
        title: "Error deleting evaluation metric",
        list: [
          extractApiErrorMessage(
            error as Parameters<typeof extractApiErrorMessage>[0],
            "An unexpected error occurred while deleting the evaluation metric.",
          ),
        ],
      });
    }
  }

  return (
    <>
      <div className="flex h-full flex-col gap-4 p-4">
        <div className="bg-background border-none">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-base">
              <Ruler className="h-4 w-4" />
              Evaluation metrics
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondaryStatic" size="tag">
                {rows.length} metric{rows.length === 1 ? "" : "s"}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={isBusy}
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus className="h-4 w-4" />
                New metric
              </Button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <TableComponent
            key="EvaluationMetrics"
            readOnlyEdit
            className="h-full w-full"
            pagination={false}
            columnDefs={columns}
            rowData={rows}
            autoSizeStrategy={{ type: "fitGridWidth" }}
            headerHeight={40}
          />
        </div>
      </div>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create evaluation metric</DialogTitle>
            <DialogDescription>
              Define the metric name, algorithm, and parameters.
            </DialogDescription>
          </DialogHeader>

          <EvalMetricForm
            inline
            title="Create new evaluation metric"
            submitLabel="Create metric"
            isSubmitting={createEvalMetric.isPending}
            onSubmit={handleCreateMetric}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingMetric)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingMetric(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit evaluation metric</DialogTitle>
            <DialogDescription>
              Update metric name, algorithm, and parameters.
            </DialogDescription>
          </DialogHeader>

          {editingMetric && (
            <EvalMetricForm
              inline
              title="Edit evaluation metric"
              submitLabel="Save changes"
              isSubmitting={updateEvalMetric.isPending}
              initialValues={{
                name: editingMetric.name,
                algorithm: editingMetric.algorithm,
                params: (editingMetric.params ?? {}) as {
                  prompt?: string;
                  tools?: string;
                },
              }}
              onSubmit={(payload) => {
                void handleEditMetric(payload);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingMetric)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingMetric(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete evaluation metric</DialogTitle>
            <DialogDescription>
              {deletingMetric?.name
                ? `Are you sure you want to delete "${deletingMetric.name}"?`
                : "Are you sure you want to delete this metric?"}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setDeletingMetric(null)}
              disabled={deleteEvalMetric.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteMetric()}
              disabled={deleteEvalMetric.isPending}
            >
              Delete metric
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
