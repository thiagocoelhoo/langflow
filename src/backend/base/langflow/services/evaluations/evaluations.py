import traceback
from typing import Any, cast
from uuid import UUID, uuid4

from fastapi import status
from fastapi.exceptions import HTTPException
from lfx.utils.flow_validation import CustomComponentValidationError
from sqlalchemy.orm import selectinload
from sqlmodel import desc, select
from sqlmodel.ext.asyncio.session import AsyncSession

from langflow.api.v1.endpoints import simple_run_flow
from langflow.api.v1.schemas import RunResponse, SimplifiedAPIRequest
from langflow.exceptions.api import APIException, InvalidChatInputError
from langflow.services.database.models import User
from langflow.services.database.models.evaluation import (
    EvalBatch,
    EvalCase,
    EvalCaseExecution,
    EvalRun,
)
from langflow.services.database.models.evaluation.model import (
    CaseMetricLink,
    EvalBatchMetricSummaryRead,
    EvalBatchRead,
    EvalBatchStatus,
    EvalBatchSummaryRead,
    EvalBatchTriggerMode,
    EvalCaseExecutionStatus,
    EvalCaseMetricRead,
    EvalCaseRead,
    EvalMetricRead,
    EvalRunRead,
    utc_now,
)
from langflow.services.database.models.flow import Flow
from langflow.services.evaluations.algorithms.algorithm_factory import get_algorithm_factory

FLOW_REL = cast("Any", EvalCase.flow)
CASE_METRICS_REL = cast("Any", EvalCase.case_metrics)
CASE_METRIC_EVAL_METRIC_REL = cast("Any", CaseMetricLink.eval_metric)
BATCH_CASE_EXECUTIONS_REL = cast("Any", EvalBatch.case_executions)
CASE_EXECUTION_RUNS_REL = cast("Any", EvalCaseExecution.runs)
CASE_EXECUTION_EVAL_CASE_REL = cast("Any", EvalCaseExecution.eval_case)
RUN_EVAL_CASE_REL = cast("Any", EvalRun.eval_case)
RUN_EVAL_METRIC_REL = cast("Any", EvalRun.eval_metric)


def serialize_eval_metric(metric) -> EvalMetricRead:
    return EvalMetricRead(
        id=metric.id,
        name=metric.name,
        algorithm=metric.algorithm,
        params=metric.params,
    )


def serialize_eval_case(eval_case: EvalCase) -> EvalCaseRead:
    return EvalCaseRead(
        id=eval_case.id,
        name=eval_case.name,
        input=cast("dict[str, Any]", eval_case.input),
        expected_output=cast("dict[str, Any]", eval_case.expected_output),
        model_name=eval_case.model_name,
        metrics=[
            EvalCaseMetricRead(
                metric_id=case_metric.metric_id,
                metadata=case_metric.case_metadata,
                metric=serialize_eval_metric(case_metric.eval_metric),
            )
            for case_metric in eval_case.case_metrics
            if case_metric.metric_id is not None and case_metric.eval_metric is not None
        ],
        flow_id=eval_case.flow_id,
    )


def serialize_eval_run(eval_run: EvalRun) -> EvalRunRead:
    return EvalRunRead(
        id=eval_run.id,
        created_at=eval_run.created_at,
        score=eval_run.score,
        message=eval_run.message,
        err_message=eval_run.err_message,
        trace_id=eval_run.trace_id,
        eval_case_id=eval_run.eval_case_id,
        eval_metric_id=eval_run.eval_metric_id,
        eval_case_execution_id=eval_run.eval_case_execution_id,
        eval_case=serialize_eval_case(eval_run.eval_case),
        eval_metric=serialize_eval_metric(eval_run.eval_metric),
    )


def build_case_snapshot(eval_case: EvalCase) -> dict[str, Any]:
    return {
        "id": str(eval_case.id),
        "name": eval_case.name,
        "input": cast("dict[str, Any]", eval_case.input),
        "expected_output": cast("dict[str, Any]", eval_case.expected_output),
        "model_name": eval_case.model_name,
        "metrics": [
            {
                "metric_id": str(case_metric.metric_id),
                "metadata": case_metric.case_metadata,
                "metric": {
                    "id": str(case_metric.eval_metric.id),
                    "name": case_metric.eval_metric.name,
                    "algorithm": case_metric.eval_metric.algorithm.value,
                    "params": case_metric.eval_metric.params,
                },
            }
            for case_metric in eval_case.case_metrics
            if case_metric.metric_id is not None and case_metric.eval_metric is not None
        ],
    }


def flatten_batch_runs(eval_batch: EvalBatch) -> list[EvalRun]:
    ordered_case_executions = sorted(
        eval_batch.case_executions,
        key=lambda case_execution: (
            case_execution.order_index,
            case_execution.created_at or utc_now(),
        ),
    )
    runs: list[EvalRun] = []
    for case_execution in ordered_case_executions:
        runs.extend(
            sorted(
                case_execution.runs,
                key=lambda run: run.created_at or utc_now(),
            )
        )
    return runs


def build_metric_summaries(runs: list[EvalRun]) -> list[EvalBatchMetricSummaryRead]:
    groups: dict[str, dict[str, Any]] = {}

    for run in runs:
        if run.eval_metric is None:
            continue

        metric_key = str(run.eval_metric.id)
        current_group = groups.get(metric_key)
        if current_group is None:
            current_group = {
                "metric_id": run.eval_metric.id,
                "metric_name": run.eval_metric.name,
                "algorithm": run.eval_metric.algorithm,
                "total_runs": 0,
                "successful_runs": 0,
                "failed_runs": 0,
                "total_score": 0.0,
            }
            groups[metric_key] = current_group

        current_group["total_runs"] += 1
        current_group["total_score"] += run.score
        if run.err_message:
            current_group["failed_runs"] += 1
        else:
            current_group["successful_runs"] += 1

    summaries = [
        EvalBatchMetricSummaryRead(
            metric_id=group["metric_id"],
            metric_name=group["metric_name"],
            algorithm=group["algorithm"],
            average_score=(group["total_score"] / group["total_runs"]) if group["total_runs"] else 0.0,
            success_rate=(group["successful_runs"] / group["total_runs"]) if group["total_runs"] else 0.0,
            total_runs=group["total_runs"],
            successful_runs=group["successful_runs"],
            failed_runs=group["failed_runs"],
        )
        for group in groups.values()
    ]

    return sorted(summaries, key=lambda item: item.metric_name.lower())


def serialize_eval_batch_summary(eval_batch: EvalBatch) -> EvalBatchSummaryRead:
    runs = flatten_batch_runs(eval_batch)
    total_runs = len(runs)
    successful_runs = sum(1 for run in runs if not run.err_message)
    failed_runs = total_runs - successful_runs
    average_score = sum(run.score for run in runs) / total_runs if total_runs > 0 else 0.0

    return EvalBatchSummaryRead(
        id=eval_batch.id,
        flow_id=eval_batch.flow_id,
        trigger_mode=eval_batch.trigger_mode,
        status=eval_batch.status,
        requested_case_count=eval_batch.requested_case_count,
        completed_case_count=eval_batch.completed_case_count,
        failed_case_count=eval_batch.failed_case_count,
        started_at=eval_batch.started_at,
        finished_at=eval_batch.finished_at,
        created_at=eval_batch.created_at,
        total_runs=total_runs,
        successful_runs=successful_runs,
        failed_runs=failed_runs,
        average_score=average_score,
        metric_summaries=build_metric_summaries(runs),
    )


def serialize_eval_batch(eval_batch: EvalBatch) -> EvalBatchRead:
    runs = flatten_batch_runs(eval_batch)
    summary = serialize_eval_batch_summary(eval_batch)
    return EvalBatchRead(
        **summary.model_dump(),
        runs=[serialize_eval_run(run) for run in runs],
    )


class EvalCaseService:
    @staticmethod
    async def get_eval_case(eval_id: UUID, session: AsyncSession) -> EvalCase:
        stmt = (
            select(EvalCase)
            .where(EvalCase.id == eval_id)
            .options(
                selectinload(FLOW_REL),
                selectinload(CASE_METRICS_REL).selectinload(CASE_METRIC_EVAL_METRIC_REL),
            )
        )
        result = await session.exec(stmt)
        eval_case = result.first()
        if eval_case is None:
            raise HTTPException(status_code=404, detail="Eval case no found.")
        return eval_case

    @staticmethod
    async def get_eval_cases_for_flow(
        flow_id: UUID,
        session: AsyncSession,
        case_ids: list[UUID] | None = None,
    ) -> list[EvalCase]:
        stmt = (
            select(EvalCase)
            .where(EvalCase.flow_id == flow_id)
            .options(
                selectinload(FLOW_REL),
                selectinload(CASE_METRICS_REL).selectinload(CASE_METRIC_EVAL_METRIC_REL),
            )
        )

        result = await session.exec(stmt)
        eval_cases = list(result.all())

        if case_ids is None:
            return sorted(eval_cases, key=lambda eval_case: (eval_case.name or "").lower())

        requested_case_ids = set(case_ids)
        cases_by_id = {eval_case.id: eval_case for eval_case in eval_cases}
        missing_case_ids = requested_case_ids - set(cases_by_id.keys())
        if missing_case_ids:
            raise HTTPException(
                status_code=404,
                detail=f"Eval cases not found for flow: {[str(case_id) for case_id in missing_case_ids]}",
            )

        return [cases_by_id[case_id] for case_id in case_ids if case_id in cases_by_id]

    @staticmethod
    async def get_eval_batch(
        batch_id: UUID,
        flow_id: UUID,
        session: AsyncSession,
    ) -> EvalBatch:
        stmt = (
            select(EvalBatch)
            .where(EvalBatch.id == batch_id)
            .where(EvalBatch.flow_id == flow_id)
            .options(
                selectinload(BATCH_CASE_EXECUTIONS_REL)
                .selectinload(CASE_EXECUTION_RUNS_REL)
                .selectinload(RUN_EVAL_CASE_REL),
                selectinload(BATCH_CASE_EXECUTIONS_REL)
                .selectinload(CASE_EXECUTION_RUNS_REL)
                .selectinload(RUN_EVAL_METRIC_REL),
                selectinload(BATCH_CASE_EXECUTIONS_REL)
                .selectinload(CASE_EXECUTION_EVAL_CASE_REL)
                .selectinload(CASE_METRICS_REL)
                .selectinload(CASE_METRIC_EVAL_METRIC_REL),
            )
        )
        result = await session.exec(stmt)
        eval_batch = result.first()
        if eval_batch is None:
            raise HTTPException(status_code=404, detail="Eval batch not found.")
        return eval_batch

    @staticmethod
    async def list_eval_batches_for_flow(
        flow_id: UUID,
        session: AsyncSession,
    ) -> list[EvalBatch]:
        stmt = (
            select(EvalBatch)
            .where(EvalBatch.flow_id == flow_id)
            .order_by(desc(cast("Any", EvalBatch.created_at)))
            .options(
                selectinload(BATCH_CASE_EXECUTIONS_REL)
                .selectinload(CASE_EXECUTION_RUNS_REL)
                .selectinload(RUN_EVAL_CASE_REL),
                selectinload(BATCH_CASE_EXECUTIONS_REL)
                .selectinload(CASE_EXECUTION_RUNS_REL)
                .selectinload(RUN_EVAL_METRIC_REL),
            )
        )
        result = await session.exec(stmt)
        return list(result.all())

    @staticmethod
    def get_strategy(eval_case: EvalCase):
        pass

    @staticmethod
    async def _run_flow(
        flow: Flow,
        api_key_user: User | None,
        messages: list[str],
        flow_session_id: str | None = None,
    ) -> tuple[list[tuple[RunResponse, str]], str]:
        session_id = flow_session_id or str(uuid4())
        outputs = []

        for message in messages:
            flow_output, run_id = await run_flow_internal(
                flow=flow,
                input_request=SimplifiedAPIRequest(
                    input_value=message,
                    session_id=session_id,
                ),
                api_key_user=api_key_user,
            )
            outputs.append((flow_output, run_id))
        return outputs, session_id

    @staticmethod
    async def evaluate(
        eval_case: EvalCase,
        api_key_user: User | None,
        flow_session_id: str | None = None,
    ) -> tuple[list[EvalRun], UUID, str]:
        messages = eval_case.input.get("messages")
        responses, resolved_session_id = await EvalCaseService._run_flow(
            eval_case.flow,
            api_key_user,
            messages,
            flow_session_id,
        )

        flow_output, run_id = responses[-1]
        trace_id = UUID(run_id)

        eval_runs = []
        for case_metric in eval_case.case_metrics:
            metric = case_metric.eval_metric
            if metric is None:
                continue

            err_message = None
            result = {}
            try:
                alg = get_algorithm_factory().create(
                    metric.algorithm,
                    params={
                        **(metric.params or {}),
                        **(case_metric.case_metadata or {}),
                        "model_name": eval_case.model_name,
                        "user_id": str(eval_case.flow_id),
                    },
                )
                result = alg.run(eval_case, flow_output)
            except Exception:
                err_message = traceback.format_exc()
            finally:
                eval_runs.append(
                    EvalRun(
                        eval_case_id=eval_case.id,
                        eval_metric_id=metric.id,
                        trace_id=trace_id,
                        score=result.get("score", 0),
                        message=result.get("message", None),
                        err_message=err_message,
                    )
                )

        return eval_runs, trace_id, resolved_session_id

    @staticmethod
    async def execute_batch(
        *,
        flow_id: UUID,
        eval_cases: list[EvalCase],
        api_key_user: User | None,
        session: AsyncSession,
        user_id: UUID | None,
        trigger_mode: EvalBatchTriggerMode,
        batch_metadata: dict[str, Any] | None = None,
    ) -> EvalBatch:
        eval_batch = EvalBatch(
            flow_id=flow_id,
            user_id=user_id,
            trigger_mode=trigger_mode,
            status=EvalBatchStatus.RUNNING,
            requested_case_count=len(eval_cases),
            completed_case_count=0,
            failed_case_count=0,
            started_at=utc_now(),
            batch_metadata=batch_metadata or {},
        )
        session.add(eval_batch)
        await session.flush()

        completed_case_count = 0
        failed_case_count = 0

        for index, eval_case in enumerate(eval_cases):
            case_execution = EvalCaseExecution(
                eval_batch_id=eval_batch.id,
                eval_case_id=eval_case.id,
                flow_session_id=str(uuid4()),
                status=EvalCaseExecutionStatus.RUNNING,
                order_index=index,
                started_at=utc_now(),
                case_snapshot=build_case_snapshot(eval_case),
            )
            session.add(case_execution)
            await session.flush()
            await session.commit()

            try:
                eval_runs, trace_id, resolved_session_id = await EvalCaseService.evaluate(
                    eval_case,
                    api_key_user,
                    case_execution.flow_session_id,
                )
                case_execution.trace_id = trace_id
                case_execution.flow_session_id = resolved_session_id

                for eval_run in eval_runs:
                    eval_run.eval_case_execution_id = case_execution.id
                    session.add(eval_run)

                await session.flush()

                has_errors = any(run.err_message for run in eval_runs)
                case_execution.status = (
                    EvalCaseExecutionStatus.COMPLETED_WITH_ERRORS if has_errors else EvalCaseExecutionStatus.COMPLETED
                )
                if has_errors:
                    failed_case_count += 1
                else:
                    completed_case_count += 1
            except Exception:
                case_execution.status = EvalCaseExecutionStatus.FAILED
                case_execution.error_message = traceback.format_exc()
                failed_case_count += 1
            finally:
                case_execution.finished_at = utc_now()
                session.add(case_execution)
                await session.flush()

        eval_batch.completed_case_count = completed_case_count
        eval_batch.failed_case_count = failed_case_count
        eval_batch.finished_at = utc_now()
        if failed_case_count == 0:
            eval_batch.status = EvalBatchStatus.COMPLETED
        elif completed_case_count == 0:
            eval_batch.status = EvalBatchStatus.FAILED
        else:
            eval_batch.status = EvalBatchStatus.COMPLETED_WITH_ERRORS

        session.add(eval_batch)
        await session.flush()

        return await EvalCaseService.get_eval_batch(eval_batch.id, flow_id, session)


# =============================================================================
#                                  Helpers
# =============================================================================


async def run_flow_internal(
    flow: Flow,
    input_request: SimplifiedAPIRequest,
    api_key_user: User | None,
) -> tuple[RunResponse, str]:
    """Internal function containing the core business logic for running a flow.

    Args:
        flow (FlowRead | None): The flow to execute, loaded via dependency
        input_request (SimplifiedAPIRequest | None): Input parameters for the flow
        api_key_user (User | None): Authenticated user (either from session or API key)

    Returns:
        RunResponse: run response with the complete execution results

    Raises:
        HTTPException: For flow not found (404) or invalid input (400)
        APIException: For internal execution errors (500)
    """
    run_id = str(uuid4())

    try:
        result = await simple_run_flow(
            flow=flow,
            input_request=input_request,
            run_id=run_id,
            api_key_user=api_key_user,
        )
    except ValueError as exc:
        if "badly formed hexadecimal UUID string" in str(exc):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        if isinstance(exc, CustomComponentValidationError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        if "not found" in str(exc):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        raise APIException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, exception=exc, flow=flow) from exc
    except InvalidChatInputError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise APIException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, exception=exc, flow=flow) from exc

    return result, run_id
