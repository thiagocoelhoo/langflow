import enum
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Enum as SQLEnum
from sqlmodel import JSON, Column, Field, Relationship, SQLModel

if TYPE_CHECKING:
    from langflow.services.database.models.flow import Flow
    from langflow.services.database.models.user.model import User


class EvaluationAlgorithm(str, enum.Enum):
    """
    EvaluationAlgorithms:
        - Agent as a jugde:
            this algorithms uses other llm to evaluate the target agent

        - Tool Evaluation:
            this algorithm validate if the right tools are been used and
            also check if the arguments passed are apropriated

        - RAG Evaluation:
            this algorithm validate the RAG output based in some custom
            rule defined in the user's prompt
    """

    AGENT_AS_JUDGE = "AGENT_AS_JUDGE"
    TOOL_EVALUATION = "TOOL_EVALUATION"
    RAG_EVALUATION = "RAG_EVALUATION"


class EvaluationMetric(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    algorithm: EvaluationAlgorithm = Field(
        sa_column=Column(
            SQLEnum(
                EvaluationAlgorithm,
                name="evaluation_algorithm_enum",
            ),
            nullable=False,
        )
    )
    data: dict | None = Field(default=None, sa_column=Column(JSON))
    cases: list["EvaluationCase"] = Relationship(back_populates="metric")


class EvaluationMetricCreate(SQLModel):
    name: str
    data: dict | None


class EvaluationCase(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    flow_id: UUID = Field(foreign_key="flow.id")
    flow: "Flow" = Relationship()
    metric_id: UUID = Field(foreign_key="evaluationmetric.id")
    metric: EvaluationMetric = Relationship(back_populates="cases")
    input: str
    expected_output: str
    min_iterations: int
    results: list["EvaluationResult"] = Relationship(back_populates="evaluation_case")


class EvaluationCaseRead(SQLModel):
    id: UUID
    name: str
    flow_id: UUID
    metric_id: UUID
    input: str
    expected_output: str
    min_iterations: int
    # TODO (thiago): Adicionar campo results
    # results: list["EvaluationResultRead"]


class EvaluationCaseCreate(SQLModel):
    name: str
    flow_id: UUID
    metric_id: UUID
    input: str
    expected_output: str
    min_iterations: int


class EvaluationResult(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    evaluation_case_id: UUID = Field(foreign_key="evaluationcase.id")
    evaluation_case: EvaluationCase = Relationship(back_populates="results")
    input_tokens: int
    output_tokens: int
    actual_output: str
    score: float
    time: float


# ===================================================================
# -------------------------- Experimental ---------------------------
# ===================================================================


class BaseModel(SQLModel):
    created_at: str
    updated_at: str


class EvaluationExperimental(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    input: str
    expected_output: str
    prompt: str
    model_name: str

    flow_id: UUID = Field(foreign_key="flow.id")
    flow: "Flow" = Relationship()

    user_id: UUID = Field(foreign_key="user.id")
    user: "User" = Relationship()


class EvaluationExperimentalCreate(SQLModel):
    name: str
    input: str
    prompt: str
    expected_output: str
    model_name: str
    flow_id: UUID


class EvaluationExperimentalRead(SQLModel):
    id: UUID
    name: str
    input: str
    expected_output: str
    model_name: str
    prompt: str

    flow_id: UUID
    user_id: UUID


# ===================================================================


class EvaluationResultExperimental(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    actual_output: str
    score: float
    eval_message: str
    success: bool

    user_id: UUID = Field(foreign_key="user.id")
    user: "User" = Relationship()

    evaluation_case_id: UUID = Field(foreign_key="evaluationexperimental.id")
    evaluation_case: EvaluationExperimental = Relationship()


class EvaluationResultExperimentalCreate(SQLModel):
    actual_output: str
    score: float
    eval_message: str
    user_id: UUID
    evaluation_case_id: UUID
    success: bool


class EvaluationResultExperimentalRead(SQLModel):
    id: UUID
    actual_output: str
    score: float
    eval_message: str
    success: bool

    user_id: UUID
    user: "User"

    evaluation_case_id: UUID
    evaluation_case: EvaluationExperimental
