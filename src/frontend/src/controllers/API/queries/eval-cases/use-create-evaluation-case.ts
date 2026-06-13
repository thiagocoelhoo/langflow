import type { useMutationFunctionType } from "@/types/api";
import type { EvaluationMetricMetadata } from "@/types/evaluations";
import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export type EvaluationCaseMetricCreate = {
  metric_id: string;
  metadata: EvaluationMetricMetadata;
};

export type EvaluationCaseCreate = {
  name: string;
  input: {
    messages: string[];
  };
  expected_output: {
    message: string;
    tools: string[];
  };
  flow_id: string;
  model_name: string | null;
  metrics: EvaluationCaseMetricCreate[];
};

export const useCreateEvaluationCase: useMutationFunctionType<
  undefined,
  EvaluationCaseCreate
> = (options) => {
  const { mutate, queryClient } = UseRequestProcessor();

  const createEvaluationCase = async (
    payload: EvaluationCaseCreate,
  ): Promise<any> => {
    const response = await api.post(`${getURL("EVAL_CASES")}/`, payload);
    await queryClient.invalidateQueries({
      queryKey: ["FlowEvaluations", payload.flow_id],
    });
    return response.data;
  };

  const mutation = mutate(["EvaluationCases"], createEvaluationCase, options);

  return mutation;
};
