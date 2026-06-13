import { ColDef } from "ag-grid-community";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import TableComponent from "@/components/core/parameterRenderComponent/components/tableComponent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetFlowEvaluationBatch } from "@/controllers/API/queries/flows/use-get-flow-evaluation-batch";
import { useGetFlowEvaluationBatches } from "@/controllers/API/queries/flows/use-get-flow-evaluation-batches";
import EvalResultsTab from "../components/EvalResultsDashboard";

export default function EvalRunsTable() {
  const { id: flowId } = useParams();
  const resolvedFlowId = flowId ?? "";
  const evaluationBatches = useGetFlowEvaluationBatches({
    flowId: resolvedFlowId,
  });
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const batches = evaluationBatches.data?.items ?? [];

  useEffect(() => {
    if (batches.length === 0) {
      setSelectedBatchId(null);
      return;
    }

    const selectedBatchStillExists = batches.some(
      (batch) => batch.id === selectedBatchId,
    );

    if (!selectedBatchId || !selectedBatchStillExists) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);

  const selectedBatchQuery = useGetFlowEvaluationBatch(
    {
      flowId: resolvedFlowId,
      batchId: selectedBatchId ?? "",
    },
    {
      enabled: !!resolvedFlowId && !!selectedBatchId,
    },
  );

  return (
    <div className="flex h-full flex-col gap-4 p-4 mb-40">
      <EvalResultsTab
        batches={batches}
        selectedBatch={selectedBatchQuery.data ?? null}
        selectedBatchId={selectedBatchId}
        onSelectBatch={setSelectedBatchId}
        isLoading={evaluationBatches.isLoading}
        isBatchLoading={selectedBatchQuery.isLoading}
      />
    </div>
  );
}
