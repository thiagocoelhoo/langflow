import type { useMutationFunctionType } from "@/types/api";
import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export type DeleteEvalMetricPayload = {
  metric_id: string;
};

export const useDeleteEvalMetric: useMutationFunctionType<
  undefined,
  DeleteEvalMetricPayload
> = (options) => {
  const { mutate, queryClient } = UseRequestProcessor();

  const deleteEvalMetric = async ({
    metric_id,
  }: DeleteEvalMetricPayload): Promise<any> => {
    const response = await api.delete(`${getURL("EVAL_METRICS")}/${metric_id}`);

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["EvalMetrics"] }),
      queryClient.invalidateQueries({ queryKey: ["FlowEvaluations"] }),
    ]);

    return response.data;
  };

  return mutate(["useDeleteEvalMetric"], deleteEvalMetric, options);
};
