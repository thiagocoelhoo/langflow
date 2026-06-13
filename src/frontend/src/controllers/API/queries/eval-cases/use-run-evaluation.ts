import { useQueryClient } from "@tanstack/react-query";
import type { useMutationFunctionType } from "@/types/api";
import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export const useRunEvaluation: useMutationFunctionType<string, string> = (
  flowId,
  options,
) => {
  const { mutate } = UseRequestProcessor();
  const queryClient = useQueryClient();

  const runEvaluation = async (eval_id: string) => {
    const response = await api.post(`${getURL("EVAL_CASES")}/${eval_id}/run`);
    if (flowId) {
      await queryClient.invalidateQueries({
        queryKey: ["FlowResults"],
      });
    }
    return response.data;
  };

  const mutation = mutate(["EvaluationResults"], runEvaluation, options);
  return mutation;
};
