import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useGetEvalMetrics = () => {
  const { query } = UseRequestProcessor();

  const getEvalMetrics = async () => {
    const response = await api.get(getURL("EVAL_METRICS"));
    return response.data;
  };

  const queryResult = query(["EvalMetrics"], getEvalMetrics);
  return queryResult;
};
