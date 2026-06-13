import type { useQueryFunctionType } from "@/types/api";
import type { FlowEvaluationBatchesResponseType } from "@/types/evaluations";
import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useGetFlowEvaluationBatches: useQueryFunctionType<
  { flowId: string },
  FlowEvaluationBatchesResponseType
> = ({ flowId }, options) => {
  const { query } = UseRequestProcessor();

  const getFlowEvaluationBatches =
    async (): Promise<FlowEvaluationBatchesResponseType> => {
      const response = await api.get<FlowEvaluationBatchesResponseType>(
        `${getURL("FLOWS")}/${flowId}/evaluation-batches`,
      );
      return response.data;
    };

  return query(["FlowEvaluationBatches", flowId], getFlowEvaluationBatches, {
    enabled: !!flowId,
    ...options,
  });
};
