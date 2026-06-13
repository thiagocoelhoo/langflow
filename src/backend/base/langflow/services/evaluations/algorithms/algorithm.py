from abc import ABC, abstractmethod
from typing import TypedDict

from langflow.api.v1.schemas import RunResponse
from langflow.services.database.models.evaluation import EvalCase
from langflow.services.database.models.traces.model import TraceTable


class AlgorithmOutput(TypedDict):
    score: float
    message: str


class Algorithm(ABC):
    @abstractmethod
    def run(
        self,
        eval_case: EvalCase,
        flow_output: RunResponse,
        trace: TraceTable | None = None,
    ) -> AlgorithmOutput:
        pass
