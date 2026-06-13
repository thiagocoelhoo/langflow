# from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Optional, TypedDict
from uuid import UUID, uuid4

from pydantic import BaseModel as PydanticBaseModel
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm.base import Mapped
from sqlmodel import JSON, Column, Field, Relationship, SQLModel

if TYPE_CHECKING:
    from langflow.services.database.models.flow import Flow
    from langflow.services.database.models.traces.model import TraceTable


MetricMetadata = dict[str, Any]


def utc_now():
    return datetime.now(timezone.utc)


def enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_cls]


class EvalCaseInput(TypedDict):
    messages: list[str]


class EvalCaseExpectedOutput(TypedDict):
    message: str
    tools: list[str]


class EvalAlgorithm(str, enum.Enum):
    AGENT_AS_A_JUDGE = "AGENT_AS_A_JUDGE"
    TOOL_EVALUATION = "TOOL_EVALUATION"
    RAG_EVALUATION = "RAG_EVALUATION"


class EvalBatchTriggerMode(str, enum.Enum):
    SINGLE_CASE = "single_case"
    SELECTED_CASES = "selected_cases"
    ALL_CASES = "all_cases"
    LEGACY = "legacy"


class EvalBatchStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    COMPLETED_WITH_ERRORS = "completed_with_errors"
    FAILED = "failed"
    CANCELLED = "cancelled"


class EvalCaseExecutionStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    COMPLETED_WITH_ERRORS = "completed_with_errors"
    FAILED = "failed"


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
    case_metadata: "MetricMetadata" = Field(
        default_factory=dict,
        sa_column=Column("metadata", JSON, nullable=False),
    )

    eval_case: "EvalCase" = Relationship(back_populates="case_metrics")
    eval_metric: "EvalMetric" = Relationship(back_populates="case_metrics")


class EvalMetric(BaseModel, table=True):
    __tablename__ = "eval_metric"  # type: ignore[assignment]

    name: str
    algorithm: "EvalAlgorithm" = Field(
        sa_column=Column(
            SQLEnum(
                EvalAlgorithm,
                name="evaluation_algorithm_enum",
            ),
            nullable=False,
        )
    )
    params: dict | None = Field(default=None, sa_column=Column(JSON))

    case_metrics: Mapped[list["CaseMetricLink"]] = Relationship(back_populates="eval_metric")


class EvalMetricCreate(PydanticBaseModel):
    name: str
    algorithm: "EvalAlgorithm"
    params: dict | None


class EvalMetricRead(PydanticBaseModel):
    id: UUID
    name: str
    algorithm: "EvalAlgorithm"
    params: dict | None


class EvalMetricUpdate(PydanticBaseModel):
    name: str | None = None
    algorithm: EvalAlgorithm | None = None
    params: dict | None = None


class EvalCaseMetricCreate(PydanticBaseModel):
    metric_id: UUID
    metadata: "MetricMetadata" = Field(default_factory=dict)


class EvalCaseMetricRead(PydanticBaseModel):
    metric_id: UUID
    metadata: "MetricMetadata" = Field(default_factory=dict)
    metric: "EvalMetricRead"


# ===================================================================
# Eval Case
# ===================================================================


class EvalCase(BaseModel, table=True):
    __tablename__ = "eval_case"  # type: ignore[assignment]

    name: str
    input: "EvalCaseInput" = Field(sa_column=Column(JSON))
    expected_output: "EvalCaseExpectedOutput" = Field(sa_column=Column(JSON))
    model_name: str | None = Field(default=None, nullable=True)
    # min_iterations: int (?)

    flow_id: UUID = Field(foreign_key="flow.id")
    flow: "Flow" = Relationship()
    results: list["EvalRun"] = Relationship(back_populates="eval_case")
    case_metrics: Mapped[list["CaseMetricLink"]] = Relationship(
        back_populates="eval_case",
        sa_relationship_kwargs={"cascade": "all, delete, delete-orphan"},
    )


class EvalCaseRead(SQLModel):
    id: UUID
    name: str
    input: dict | str
    expected_output: dict
    model_name: str | None
    # min_iterations: int (?)
    metrics: list["EvalCaseMetricRead"] = []  # Field(default_factory=list)
    flow_id: UUID


class EvalCaseCreate(SQLModel):
    name: str
    input: dict
    expected_output: dict
    model_name: str | None
    # min_iterations: int (?)
    metrics: list["EvalCaseMetricCreate"] = []  # = Field(default_factory=list)
    flow_id: UUID
    # metric_id: UUID


class EvalCaseUpdate(SQLModel):
    name: str
    input: dict
    expected_output: dict
    model_name: str | None
    metrics: list["EvalCaseMetricCreate"] = []  # = Field(default_factory=list)
    flow_id: UUID


class EvalCaseExecution(BaseModel, table=True):
    __tablename__ = "eval_case_execution"  # type: ignore[assignment]

    eval_batch_id: UUID = Field(foreign_key="eval_batch.id", index=True)
    eval_case_id: UUID = Field(foreign_key="eval_case.id", index=True)
    trace_id: UUID | None = Field(default=None, foreign_key="trace.id", index=True)
    flow_session_id: str | None = Field(default=None, index=True)
    status: "EvalCaseExecutionStatus" = Field(
        sa_column=Column(
            SQLEnum(
                EvalCaseExecutionStatus,
                name="eval_case_execution_status_enum",
                values_callable=enum_values,
            ),
            nullable=False,
        )
    )
    order_index: int = Field(default=0, nullable=False)
    started_at: datetime | None = Field(default_factory=utc_now)
    finished_at: datetime | None = None
    error_message: str | None = Field(default=None)
    case_snapshot: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))

    eval_batch: "EvalBatch" = Relationship(back_populates="case_executions")
    eval_case: "EvalCase" = Relationship()
    trace: Optional["TraceTable"] = Relationship()
    runs: list["EvalRun"] = Relationship(
        back_populates="eval_case_execution",
        sa_relationship_kwargs={"cascade": "all, delete, delete-orphan"},
    )


# ===================================================================
# Eval Batch
# ===================================================================


class EvalBatch(BaseModel, table=True):
    __tablename__ = "eval_batch"  # type: ignore[assignment]

    flow_id: UUID = Field(foreign_key="flow.id", index=True)
    user_id: UUID | None = Field(default=None, foreign_key="user.id", index=True)
    trigger_mode: "EvalBatchTriggerMode" = Field(
        sa_column=Column(
            SQLEnum(
                EvalBatchTriggerMode,
                name="eval_batch_trigger_mode_enum",
                values_callable=enum_values,
            ),
            nullable=False,
        )
    )
    status: "EvalBatchStatus" = Field(
        sa_column=Column(
            SQLEnum(
                EvalBatchStatus,
                name="eval_batch_status_enum",
                values_callable=enum_values,
            ),
            nullable=False,
        )
    )
    requested_case_count: int = Field(default=0, nullable=False)
    completed_case_count: int = Field(default=0, nullable=False)
    failed_case_count: int = Field(default=0, nullable=False)
    started_at: datetime | None = Field(default_factory=utc_now)
    finished_at: datetime | None = None
    batch_metadata: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column("metadata", JSON, nullable=False),
    )

    case_executions: list["EvalCaseExecution"] = Relationship(
        back_populates="eval_batch",
        sa_relationship_kwargs={"cascade": "all, delete, delete-orphan"},
    )


class EvalBatchCreate(SQLModel):
    selection_mode: "EvalBatchTriggerMode"
    case_ids: list[UUID] = []  # = Field(default_factory=list)


class EvalBatchSummaryRead(SQLModel):
    id: UUID
    flow_id: UUID
    trigger_mode: "EvalBatchTriggerMode"
    status: "EvalBatchStatus"
    requested_case_count: int
    completed_case_count: int
    failed_case_count: int
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime | None = None
    total_runs: int
    successful_runs: int
    failed_runs: int
    average_score: float
    metric_summaries: list["EvalBatchMetricSummaryRead"] = Field(default_factory=list)


class EvalBatchRead(EvalBatchSummaryRead):
    runs: list["EvalRunRead"] = Field(default_factory=list)


class EvalBatchesResponse(SQLModel):
    items: list["EvalBatchSummaryRead"] = Field(default_factory=list)


class EvalBatchMetricSummaryRead(PydanticBaseModel):
    metric_id: UUID
    metric_name: str
    algorithm: "EvalAlgorithm"
    average_score: float
    success_rate: float
    total_runs: int
    successful_runs: int
    failed_runs: int


# ===================================================================
# Eval Run
# ===================================================================


class EvalRun(BaseModel, table=True):
    __tablename__ = "eval_run"  # type: ignore[assignment]

    eval_case_id: UUID = Field(foreign_key="eval_case.id")
    eval_case: "EvalCase" = Relationship(back_populates="results")

    eval_metric_id: UUID = Field(foreign_key="eval_metric.id")
    eval_metric: "EvalMetric" = Relationship()

    eval_case_execution_id: UUID | None = Field(
        default=None,
        foreign_key="eval_case_execution.id",
        index=True,
    )
    eval_case_execution: Optional["EvalCaseExecution"] = Relationship(back_populates="runs")

    trace_id: UUID = Field(foreign_key="trace.id")
    trace: "TraceTable" = Relationship()

    score: float

    message: str | None = Field(default=None)
    err_message: str | None = Field(default=None)

    # Thiago Coelho - TODO: Adicionar os campos abaixo à tabela
    # status: bool
    #
    # input_tokens: int
    # output_tokens: int
    # duration: float


class EvalRunRead(SQLModel):
    id: UUID
    created_at: datetime | None = None
    score: float
    message: str | None = None
    err_message: str | None = None
    trace_id: UUID | None = None
    eval_case_id: UUID | None = None
    eval_metric_id: UUID | None = None
    eval_case_execution_id: UUID | None = None
    eval_case: "EvalCaseRead"
    eval_metric: "EvalMetricRead"
