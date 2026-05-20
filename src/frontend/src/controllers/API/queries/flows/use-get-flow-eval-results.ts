import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useGetFlowEvalResults = (flow_id: string) => {
  const { query } = UseRequestProcessor();

  const getFlowResults = async () => {
    const response = await api.get(`${getURL("FLOWS")}/${flow_id}/results`);
    return response.data;
  };

  const queryResult = query(["FlowResults"], getFlowResults);
  return queryResult;
};
