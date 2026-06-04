import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useGetFlowTools = (flowId: string) => {
  const { query } = UseRequestProcessor();

  const getFlowFn = async () => {
    const response = await api.get(`${getURL("FLOWS")}/${flowId}/tools`);
    return response.data;
  };

  const queryResult = query(["useGetFlowTools"], getFlowFn);
  return queryResult;
};
