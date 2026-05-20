import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useGetFlow = () => {
  const { query } = UseRequestProcessor();

  const getFlowFn = async (payload) => {
    const response = await api.get(`${getURL("FLOWS")}/${payload.id}/tools`);
    return response.data;
  };

  const queryResult = query(["useGetFlowTools"], getFlowFn);
  return queryResult;
};
