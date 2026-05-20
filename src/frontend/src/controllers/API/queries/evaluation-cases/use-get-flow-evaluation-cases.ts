import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useGetFlowEvaluationCases = (flowId: string) => {
  const { query } = UseRequestProcessor();

  const getFlowEvaluations = async () => {
    const url = `${getURL("FLOWS")}/${flowId}/evaluations`;
    const response = await api.get(url);
    return response.data;
  };

  const queryResult = query(["FlowEvaluations", flowId], getFlowEvaluations);
  return queryResult;
};
