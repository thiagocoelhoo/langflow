import enum
from datetime import datetime, timezone
from typing import TYPE_CHECKING, TypedDict
from uuid import UUID, uuid4

from sqlalchemy import Enum as SQLEnum
from sqlmodel import JSON, Column, Field, Relationship, SQLModel

if TYPE_CHECKING:
    from langflow.services.database.models.flow import Flow
    from langflow.services.database.models.traces.model import TraceTable
    from langflow.services.database.models.user.model import User


def utc_now():
    return datetime.now(timezone.utc)


class EvalCaseInput(TypedDict):
    messages: list[str]


class EvalCaseExpectedOutput(TypedDict):
    message: str
    tools: list[str]


class EvalAlgorithm(str, enum.Enum):
    AGENT_AS_A_JUDGE = "AGENT_AS_A_JUDGE"
    TOOL_EVALUATION = "TOOL_EVALUATION"
    RAG_EVALUATION = "RAG_EVALUATION"


class BaseModel(SQLModel):
    id: UUID = Field(default_factory=uuid4, primary_key=True)

    created_at: datetime | None = Field(default_factory=utc_now)
    updated_at: datetime | None = None
    deleted_at: datetime | None = None


# ===================================================================
# Eval Metric
# ===================================================================


class CaseMetricLink(SQLModel, table=True):
    case_id: UUID | None = Field(
        default=None,
        foreign_key="eval_case.id",
        primary_key=True,
    )
    metric_id: UUID | None = Field(
        default=None,
        foreign_key="eval_metric.id",
        primary_key=True,
    )


class EvalMetric(BaseModel, table=True):
    __tablename__ = "eval_metric"  # type: ignore[assignment]

    name: str
    algorithm: EvalAlgorithm = Field(
        sa_column=Column(
            SQLEnum(
                EvalAlgorithm,
                name="evaluation_algorithm_enum",
            ),
            nullable=False,
        )
    )
    params: dict | None = Field(default=None, sa_column=Column(JSON))


class EvalMetricCreate(SQLModel):
    name: str
    algorithm: EvalAlgorithm
    params: dict | None


# ===================================================================
# Eval Case
# ===================================================================


class EvalCase(BaseModel, table=True):
    __tablename__ = "eval_case"  # type: ignore[assignment]

    name: str
    input: EvalCaseInput = Field(sa_column=Column(JSON))
    expected_output: EvalCaseExpectedOutput = Field(sa_column=Column(JSON))
    model_name: str | None = Field(default=None, nullable=True)
    # min_iterations: int (?)

    flow_id: UUID = Field(foreign_key="flow.id")
    flow: "Flow" = Relationship()
    results: list["EvalRun"] = Relationship(back_populates="eval_case")
    metrics: list[EvalMetric] = Relationship(link_model=CaseMetricLink)


class EvalCaseRead(SQLModel):
    id: UUID
    name: str
    input: dict | str
    expected_output: dict
    model_name: str | None
    # min_iterations: int (?)
    metrics: list[UUID] = []
    flow_id: UUID


class EvalCaseCreate(SQLModel):
    name: str
    input: dict
    expected_output: dict
    model_name: str | None
    # min_iterations: int (?)
    metrics: list[UUID]
    flow_id: UUID
    # metric_id: UUID


# ===================================================================
# Eval Run
# ===================================================================


class EvalRun(BaseModel, table=True):
    __tablename__ = "eval_run"  # type: ignore[assignment]

    eval_case_id: UUID = Field(foreign_key="eval_case.id")
    eval_case: EvalCase = Relationship(back_populates="results")

    eval_metric_id: UUID = Field(foreign_key="eval_metric.id")
    eval_metric: EvalMetric = Relationship()

    trace_id: UUID = Field(foreign_key="trace.id")
    trace: "TraceTable" = Relationship()

    score: float

    message: str | None = Field(default=None)
    err_message: str | None = Field(default=None)

    # TODO: Adicionar os campos abaixo à tabela
    # status: bool
    #
    # input_tokens: int
    # output_tokens: int
    # duration: float
