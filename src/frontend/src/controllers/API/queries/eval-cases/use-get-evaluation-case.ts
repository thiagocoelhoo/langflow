import type { useQueryFunctionType } from "@/types/api";
import type { EvaluationCaseType } from "@/types/evaluations";
import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useGetEvaluationCase: useQueryFunctionType<
  { id: string },
  EvaluationCaseType
> = ({ id }, options) => {
  const { query } = UseRequestProcessor();

  const getEvaluationsCase = async (): Promise<EvaluationCaseType> => {
    const url = `${getURL("EVAL_CASES")}/${id}`;
    const response = await api.get<EvaluationCaseType>(url);
    return response.data;
  };

  const queryResult = query(["EvaluationCase", id], getEvaluationsCase, {
    enabled: !!id,
    ...options,
  });
  return queryResult;
};
