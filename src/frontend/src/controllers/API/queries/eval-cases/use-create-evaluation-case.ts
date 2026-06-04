import { useQueryClient } from "@tanstack/react-query";
import { UseRequestProcessor } from "../../services/request-processor";
import { getURL } from "../../helpers/constants";
import { api } from "../../api";

export type EvaluationCaseCreate = {
  name: string;
  input: string;
  expected_output: string;
  prompt: string;
  model: string;
};

export const useCreateEvaluationCase = (options: any) => {
  const { mutate } = UseRequestProcessor();
  // const queryClient = useQueryClient();

  const createEvaluationCase = async (payload: EvaluationCaseCreate) => {
    // Enviar requisição
    const response = await api.post(`${getURL("EVAL_CASES")}/`, payload);
    // Retornar resposta
    return response.data;
  };

  const mutation = mutate(["EvaluationCases"], createEvaluationCase, options);

  return mutation;
};
