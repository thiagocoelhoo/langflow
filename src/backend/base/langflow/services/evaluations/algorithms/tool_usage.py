from typing import Any, TypedDict

from pydantic import BaseModel
from typing_extensions import NotRequired, override

from langflow.api.v1.schemas import RunResponse
from langflow.services.database.models.evaluation import EvalCase
from langflow.services.database.models.traces import TraceTable
from langflow.services.evaluations.algorithms.algorithm import Algorithm, AlgorithmOutput


class ToolUsageParams(TypedDict, total=False):
    tool: NotRequired[str]


class ToolUsageParamsValidator(BaseModel):
    tool: str | None = None


class ToolUsage(Algorithm):
    def __init__(self, params: dict[str, Any]):
        validated_params = ToolUsageParamsValidator.model_validate(params)
        self._tool = validated_params.tool

    @override
    def run(
        self,
        eval_case: EvalCase,
        flow_output: RunResponse,
        trace: TraceTable | None = None,
    ) -> AlgorithmOutput:
        tool_msg = f" for tool '{self._tool}'" if self._tool else ""
        return {
            "score": 0,
            "message": f"Tool evaluation is not implemented yet{tool_msg}.",
        }
