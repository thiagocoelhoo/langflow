import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useCreateEvalMetric = (options) => {
  const { mutate } = UseRequestProcessor();

  const createEvalMetric = async (payload) => {
    const response = await api.post(`${getURL("EVAL_METRICS")}`, payload);
    return response.data;
  };

  const mutation = mutate(["EvalMetrics"], createEvalMetric, options);
  return mutation;
};
