import type { useMutationFunctionType } from "@/types/api";
import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";
import type { EvaluationCaseCreate } from "./use-create-evaluation-case";

export type UpdateEvaluationCasePayload = {
  eval_case_id: string;
  payload: EvaluationCaseCreate;
};

export const useUpdateEvaluationCase: useMutationFunctionType<
  undefined,
  UpdateEvaluationCasePayload
> = (options) => {
  const { mutate, queryClient } = UseRequestProcessor();

  const updateEvaluationCase = async ({
    eval_case_id,
    payload,
  }: UpdateEvaluationCasePayload): Promise<any> => {
    const response = await api.patch(
      `${getURL("EVAL_CASES")}/${eval_case_id}`,
      payload,
    );

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["FlowEvaluations", payload.flow_id],
      }),
      queryClient.invalidateQueries({
        queryKey: ["EvaluationCase", eval_case_id],
      }),
    ]);

    return response.data;
  };

  return mutate(["useUpdateEvaluationCase"], updateEvaluationCase, options);
};
