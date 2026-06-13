import type { FlowToolsResponseType } from "@/types/evaluations";
import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useGetFlowTools = (flowId: string, options = {}) => {
  const { query } = UseRequestProcessor();

  const getFlowFn = async (): Promise<FlowToolsResponseType> => {
    const response = await api.get<FlowToolsResponseType>(
      `${getURL("FLOWS")}/${flowId}/tools`,
    );
    return response.data;
  };

  const queryResult = query(["useGetFlowTools", flowId], getFlowFn, {
    enabled: !!flowId,
    ...options,
  });
  return queryResult;
};
