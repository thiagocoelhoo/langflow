import { UseRequestProcessor } from "../../services/request-processor";
import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { EvaluationCaseType } from "@/types/evaluations";

export const useGetEvaluationCase = (id: string) => {
  const { query } = UseRequestProcessor();

  const getEvaluationsCase = async () => {
    const url = `${getURL("EVAL_CASES")}/${id}`;
    const response = await api.get<EvaluationCaseType>(url);
    return response.data;
  };

  const queryResult = query(["EvaluationCase"], getEvaluationsCase);
  return queryResult;
};
