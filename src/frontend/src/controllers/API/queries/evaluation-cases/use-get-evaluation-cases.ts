import { EvaluationCaseType } from "@/types/evaluations";
import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useGetEvaluationCases = () => {
  const { query } = UseRequestProcessor();

  const getEvaluationCases = async () => {
    const response = await api.get(getURL("EVALUATIONS"));
    return response.data;
  };

  const queryResult = query(["EvaluationCases"], getEvaluationCases);
  return queryResult;
};
