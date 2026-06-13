import type { useQueryFunctionType } from "@/types/api";
import type { EvalMetricsResponseType } from "@/types/evaluations";
import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useGetEvalMetrics: useQueryFunctionType<
  undefined,
  EvalMetricsResponseType
> = (options) => {
  const { query } = UseRequestProcessor();

  const getEvalMetrics = async (): Promise<EvalMetricsResponseType> => {
    const response = await api.get<EvalMetricsResponseType>(
      getURL("EVAL_METRICS"),
    );
    return response.data;
  };

  const queryResult = query(["EvalMetrics"], getEvalMetrics, options);
  return queryResult;
};
