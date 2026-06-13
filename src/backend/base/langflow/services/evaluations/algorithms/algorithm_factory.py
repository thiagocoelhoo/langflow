from langflow.services.database.models.evaluation.model import EvalAlgorithm
from langflow.services.evaluations.algorithms.algorithm import Algorithm
from langflow.services.evaluations.algorithms.llm_as_a_judge import Judge
from langflow.services.evaluations.algorithms.tool_usage import ToolUsage


class AlgorithmFactory:
    def __init__(self):
        pass

    def create(self, name: EvalAlgorithm, params: dict | None = None) -> Algorithm:
        if params is None:
            params = {}

        if name == EvalAlgorithm.AGENT_AS_A_JUDGE:
            return Judge(params)

        if name == EvalAlgorithm.TOOL_EVALUATION:
            return ToolUsage(params)

        # Invalid algorithm name
        err_msg = f'Invalid algorithm name "{name}".'
        raise ValueError(err_msg)


def get_algorithm_factory():
    return AlgorithmFactory()
