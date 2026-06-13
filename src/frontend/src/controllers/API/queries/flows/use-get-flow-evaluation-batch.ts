import type { useQueryFunctionType } from "@/types/api";
import type { EvaluationBatchType } from "@/types/evaluations";
import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useGetFlowEvaluationBatch: useQueryFunctionType<
  { flowId: string; batchId: string },
  EvaluationBatchType
> = ({ flowId, batchId }, options) => {
  const { query } = UseRequestProcessor();

  const getFlowEvaluationBatch = async (): Promise<EvaluationBatchType> => {
    const response = await api.get<EvaluationBatchType>(
      `${getURL("FLOWS")}/${flowId}/evaluation-batches/${batchId}`,
    );
    return response.data;
  };

  return query(
    ["FlowEvaluationBatch", flowId, batchId],
    getFlowEvaluationBatch,
    {
      enabled: !!flowId && !!batchId,
      ...options,
    },
  );
};
