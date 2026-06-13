import { ColDef } from "ag-grid-community";
import { Pencil, Play, Plus, Rocket, TestTube2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import TableComponent from "@/components/core/parameterRenderComponent/components/tableComponent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { extractApiErrorMessage } from "@/controllers/API/helpers/extract-api-error-message";
import { useGetFlowEvaluationCases } from "@/controllers/API/queries/eval-cases/use-get-flow-evaluation-cases";
import { useRunEvaluationBatch } from "@/controllers/API/queries/flows/use-run-evaluation-batch";
import useAlertStore from "@/stores/alertStore";
import type {
  EvaluationBatchType,
  EvaluationCaseType,
} from "@/types/evaluations";
import EvalCaseModal from "./components/EvalCaseModal";

function extractBatchErrorMessages(batch: EvaluationBatchType): string[] {
  return batch.runs
    .filter(
      (run) => typeof run.err_message === "string" && run.err_message.trim(),
    )
    .map((run) => {
      const caseLabel =
        run.eval_case?.name ?? run.eval_case_id ?? "Unknown case";
      const metricLabel =
        run.eval_metric?.name ?? run.eval_metric_id ?? "Unknown metric";
      return `${caseLabel} · ${metricLabel}: ${run.err_message}`;
    });
}

export default function EvalCasesTable() {
  const { id: routeFlowId } = useParams();
  const flowId = routeFlowId ?? "";
  const evaluationCases = useGetFlowEvaluationCases({ flowId });
  const runEvaluationBatch = useRunEvaluationBatch({ flowId });
  const setSuccessData = useAlertStore((state) => state.setSuccessData);
  const setErrorData = useAlertStore((state) => state.setErrorData);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<EvaluationCaseType | null>(
    null,
  );

  const rows = evaluationCases.data?.eval_cases ?? [];
  const totalMetricAssignments = rows.reduce(
    (accumulator, evaluationCase) =>
      accumulator + evaluationCase.metrics.length,
    0,
  );
  const isBusy = runEvaluationBatch.isPending;

  const executeCase = async (evaluationCase: EvaluationCaseType) => {
    if (isBusy) {
      return;
    }

    setActiveCaseId(evaluationCase.id);

    try {
      const batch = await runEvaluationBatch.mutateAsync({
        selection_mode: "selected_cases",
        case_ids: [evaluationCase.id],
      });
      const batchErrors = extractBatchErrorMessages(batch);

      if (batchErrors.length > 0) {
        setErrorData({
          title: `Evaluation batch for${evaluationCase.name ? ` "${evaluationCase.name}"` : " this case"} finished with errors`,
          list: batchErrors,
        });
        return;
      }

      setSuccessData({
        title: `Evaluation batch for${evaluationCase.name ? ` "${evaluationCase.name}"` : " this case"} executed successfully`,
      });
    } catch (error) {
      setErrorData({
        title: "Error executing evaluation batch",
        list: [
          extractApiErrorMessage(
            error as Parameters<typeof extractApiErrorMessage>[0],
            "An unexpected error occurred while executing the evaluation batch.",
          ),
        ],
      });
    } finally {
      setActiveCaseId(null);
    }
  };

  const executeAllCases = async () => {
    if (isBusy || rows.length === 0) {
      return;
    }

    setIsRunningAll(true);

    try {
      const batch = await runEvaluationBatch.mutateAsync({
        selection_mode: "all_cases",
        case_ids: [],
      });
      const batchErrors = extractBatchErrorMessages(batch);

      if (batchErrors.length > 0) {
        setErrorData({
          title: `Evaluation batch finished with ${batch.completed_case_count} successful case${batch.completed_case_count === 1 ? "" : "s"} and ${batch.failed_case_count} issue${batch.failed_case_count === 1 ? "" : "s"}`,
          list: batchErrors,
        });
        return;
      }

      setSuccessData({
        title: `Evaluation batch recorded successfully for all ${rows.length} case${rows.length === 1 ? "" : "s"}`,
      });
    } catch (error) {
      setErrorData({
        title: "Error executing evaluation batch",
        list: [
          extractApiErrorMessage(
            error as Parameters<typeof extractApiErrorMessage>[0],
            "An unexpected error occurred while executing the evaluation batch.",
          ),
        ],
      });
    } finally {
      setActiveCaseId(null);
      setIsRunningAll(false);
    }
  };

  const columns: ColDef[] = [
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
      headerName: "Description",
      field: "name",
      flex: 1,
      minWidth: 220,
      filter: false,
      sortable: false,
      editable: false,
    },
    {
      headerName: "Input",
      flex: 1,
      minWidth: 220,
      filter: false,
      sortable: false,
      editable: false,
      cellRenderer: (item) => item.data.input?.messages?.join(" ") ?? "",
    },
    {
      headerName: "Expected output",
      field: "expected_output",
      flex: 1,
      minWidth: 220,
      filter: false,
      sortable: false,
      editable: false,
      cellRenderer: (item) => item.data.expected_output?.message ?? "",
    },
    {
      headerName: "Metrics",
      flex: 1,
      minWidth: 220,
      filter: false,
      sortable: false,
      editable: false,
      cellRenderer: (item) => {
        const metricNames = item.data.metrics
          ?.map((metric) => metric.metric?.name)
          .filter(Boolean);

        return metricNames?.length ? metricNames.join(", ") : "No metrics";
      },
    },
    {
      headerName: "Actions",
      minWidth: 240,
      filter: false,
      sortable: false,
      editable: false,
      cellRenderer: (item) => {
        const evaluationCase = item.data as EvaluationCaseType;
        const isCurrentCaseRunning =
          !isRunningAll &&
          runEvaluationBatch.isPending &&
          activeCaseId === evaluationCase.id;

        return (
          <div className="flex items-center gap-2 py-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={isBusy}
              onClick={() => setEditingCase(evaluationCase)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="gap-2"
              disabled={isBusy}
              onClick={() => void executeCase(evaluationCase)}
            >
              <Play className="h-4 w-4" />
              {isCurrentCaseRunning ? "Running..." : "Execute"}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="flex h-full flex-col gap-4 p-4">
        <div className="bg-background border-none">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-base">
              <TestTube2 className="h-4 w-4" />
              Evaluation cases
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondaryStatic" size="tag">
                {rows.length} case{rows.length === 1 ? "" : "s"}
              </Badge>
              <Badge variant="secondaryStatic" size="tag">
                {totalMetricAssignments} metric assignment
                {totalMetricAssignments === 1 ? "" : "s"}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={isBusy}
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus className="h-4 w-4" />
                New eval case
              </Button>
              <Button
                size="sm"
                className="gap-2"
                disabled={rows.length === 0 || isBusy}
                onClick={() => void executeAllCases()}
              >
                <Rocket className="h-4 w-4" />
                {isRunningAll ? "Running batch..." : "Execute all cases"}
              </Button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <TableComponent
            key="EvaluationCases"
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

      <EvalCaseModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        flowId={flowId}
      />

      {/*
        THIAGO: ler isso

        Thiago Coeho - TODO: Remover esse modal duplicado
      */}

      <EvalCaseModal
        open={Boolean(editingCase)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCase(null);
          }
        }}
        flowId={flowId}
        evaluationCase={editingCase}
      />
    </>
  );
}
