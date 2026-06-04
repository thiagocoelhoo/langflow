from abc import ABC, abstractmethod
from typing import TypedDict

from langflow.api.v1.schemas import RunResponse
from langflow.services.database.models.evaluation import EvalCase


class AlgorithmOutput(TypedDict):
    score: float
    message: str


class Algorithm(ABC):
    @abstractmethod
    def run(self, eval_case: EvalCase, flow_output: RunResponse) -> AlgorithmOutput:
        pass
