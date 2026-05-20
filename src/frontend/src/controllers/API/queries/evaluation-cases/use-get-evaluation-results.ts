import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useGetEvaluationResults = (eval_id: string) => {
  const { query } = UseRequestProcessor();

  const getEvalResults = async () => {
    const response = await api.get(`${getURL("EVALUATIONS")}/${eval_id}/runs`);
    return response.data;
  };

  const queryResult = query(["EvaluationResults"], getEvalResults);
  return queryResult;
};
