import type { useMutationFunctionType } from "@/types/api";
import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export type UpdateEvalMetricPayload = {
  metric_id: string;
  payload: {
    name?: string;
    algorithm?: string;
    params?: Record<string, unknown> | null;
  };
};

export const useUpdateEvalMetric: useMutationFunctionType<
  undefined,
  UpdateEvalMetricPayload
> = (options) => {
  const { mutate, queryClient } = UseRequestProcessor();

  const updateEvalMetric = async ({
    metric_id,
    payload,
  }: UpdateEvalMetricPayload): Promise<any> => {
    const response = await api.patch(
      `${getURL("EVAL_METRICS")}/${metric_id}`,
      payload,
    );

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["EvalMetrics"] }),
      queryClient.invalidateQueries({ queryKey: ["FlowEvaluations"] }),
    ]);

    return response.data;
  };

  return mutate(["useUpdateEvalMetric"], updateEvalMetric, options);
};
