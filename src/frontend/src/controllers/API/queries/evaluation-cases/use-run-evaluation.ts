import { useQueryClient } from "@tanstack/react-query";
import { UseRequestProcessor } from "../../services/request-processor";
import { getURL } from "../../helpers/constants";
import { api } from "../../api";

export const useRunEvaluation = () => {
  const { mutate } = UseRequestProcessor();
  const queryClient = useQueryClient();

  const runEvaluation = async (eval_id: string) => {
    const response = await api.post(`${getURL("EVALUATIONS")}/${eval_id}/run`);
    return response.data;
  };

  const mutation = mutate(["EvaluationResults"], runEvaluation);
  return mutation;
};
