import type { useQueryFunctionType } from "@/types/api";
import type { FlowEvalResultsResponseType } from "@/types/evaluations";
import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useGetFlowEvalResults: useQueryFunctionType<
  { flowId: string },
  FlowEvalResultsResponseType
> = ({ flowId }, options) => {
  const { query } = UseRequestProcessor();

  const getFlowResults = async (): Promise<FlowEvalResultsResponseType> => {
    const response = await api.get<FlowEvalResultsResponseType>(
      `${getURL("FLOWS")}/${flowId}/results`,
    );
    return response.data;
  };

  const queryResult = query(["FlowResults", flowId], getFlowResults, {
    enabled: !!flowId,
    ...options,
  });
  return queryResult;
};
