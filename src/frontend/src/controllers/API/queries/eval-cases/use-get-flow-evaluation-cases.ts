import type { useQueryFunctionType } from "@/types/api";
import type { EvaluationCasesResponseType } from "@/types/evaluations";
import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useGetFlowEvaluationCases: useQueryFunctionType<
  { flowId: string },
  EvaluationCasesResponseType
> = ({ flowId }, options) => {
  const { query } = UseRequestProcessor();

  const getFlowEvaluations = async (): Promise<EvaluationCasesResponseType> => {
    const url = `${getURL("FLOWS")}/${flowId}/evaluations`;
    const response = await api.get<EvaluationCasesResponseType>(url);
    return response.data;
  };

  const queryResult = query(["FlowEvaluations", flowId], getFlowEvaluations, {
    enabled: !!flowId,
    ...options,
  });
  return queryResult;
};
