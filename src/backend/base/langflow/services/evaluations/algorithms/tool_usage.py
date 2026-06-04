import json
from typing import TypedDict
from uuid import UUID

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage
from langflow_sdk import RunResponse
from lfx.base.models.unified_models import get_llm, get_provider_for_model_name
from pydantic import BaseModel
from typing_extensions import override

from langflow.services.database.models.evaluation import EvalCase, EvalRun
from langflow.services.database.models.evaluation.model import EvalCaseExpectedOutput
from langflow.services.evaluations.algorithms.algorithm import Algorithm, AlgorithmOutput


class ToolUsageParams(TypedDict):
    pass


class ToolUsageParamsValidator(BaseModel):
    pass


class ToolUsage(Algorithm):
    def __init__(self, params: ToolUsageParams):
        validated_params = ToolUsageParamsValidator.validate(params)
        _ = validated_params

    @override
    def run(self, eval_case: EvalCase, flow_output: RunResponse) -> AlgorithmOutput:
        # Extrair o texto da resposta do fluxo
        response_text = self.extract_response_text(flow_output)
        messages = [response_text] if response_text else []

        judge_output = self._invoke_judge(
            expected_output=eval_case.expected_output,
            actual_output={
                "message": messages[0] if len(messages) > 0 else " ",
                "tools": [],
            },
        )

        # TODO: implementar uma validação e tratamento mais adequado
        result = self._process_judge_output(judge_output)

        return {
            "score": result.get("score", -1),
            "message": str(result.get("response", "Error")),
        }
