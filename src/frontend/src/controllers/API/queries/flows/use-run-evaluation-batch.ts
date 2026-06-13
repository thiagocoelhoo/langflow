import type { useMutationFunctionType } from "@/types/api";
import type {
  EvaluationBatchCreatePayload,
  EvaluationBatchType,
} from "@/types/evaluations";
import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useRunEvaluationBatch: useMutationFunctionType<
  { flowId: string },
  EvaluationBatchCreatePayload,
  EvaluationBatchType
> = ({ flowId }, options) => {
  const { mutate, queryClient } = UseRequestProcessor();

  const runEvaluationBatch = async (
    payload: EvaluationBatchCreatePayload,
  ): Promise<EvaluationBatchType> => {
    const response = await api.post<EvaluationBatchType>(
      `${getURL("FLOWS")}/${flowId}/evaluation-batches`,
      payload,
    );

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["FlowEvaluationBatches", flowId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["FlowResults"],
      }),
    ]);

    return response.data;
  };

  return mutate(["useRunEvaluationBatch", flowId], runEvaluationBatch, options);
};
