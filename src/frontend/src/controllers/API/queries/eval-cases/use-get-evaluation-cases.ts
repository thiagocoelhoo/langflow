import type { useQueryFunctionType } from "@/types/api";
import type { EvaluationCaseType } from "@/types/evaluations";
import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useGetEvaluationCases: useQueryFunctionType<
  undefined,
  EvaluationCaseType[]
> = (options) => {
  const { query } = UseRequestProcessor();

  const getEvaluationCases = async (): Promise<EvaluationCaseType[]> => {
    const response = await api.get<EvaluationCaseType[]>(getURL("EVAL_CASES"));
    return response.data;
  };

  const queryResult = query(["EvaluationCases"], getEvaluationCases, options);
  return queryResult;
};
