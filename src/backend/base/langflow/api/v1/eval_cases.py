from typing import Any, cast
from uuid import UUID

from fastapi import APIRouter
from fastapi.exceptions import HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import col, select

from langflow.api.utils import CurrentActiveUser, DbSession
from langflow.services.database.models import EvalCase
from langflow.services.database.models.evaluation.model import (
    CaseMetricLink,
    EvalBatchRead,
    EvalBatchTriggerMode,
    EvalCaseCreate,
    EvalCaseMetricCreate,
    EvalCaseRead,
    EvalCaseUpdate,
    EvalMetric,
)
from langflow.services.evaluations.evaluations import (
    EvalCaseService,
    serialize_eval_batch,
    serialize_eval_case,
)

router = APIRouter(prefix="/evaluations/cases")

CASE_METRICS_REL = cast(Any, EvalCase.case_metrics)
CASE_METRIC_EVAL_METRIC_REL = cast(Any, CaseMetricLink.eval_metric)


async def load_eval_case_with_metrics(eval_case_id: UUID, session: DbSession) -> EvalCase | None:
    query = (
        select(EvalCase)
        .where(EvalCase.id == eval_case_id)
        .options(selectinload(CASE_METRICS_REL).selectinload(CASE_METRIC_EVAL_METRIC_REL))
    )
    return (await session.exec(query)).first()


async def build_case_metric_links(
    case_metrics_payload: list[EvalCaseMetricCreate],
    session: DbSession,
) -> list[CaseMetricLink]:
    metric_ids = [item.metric_id for item in case_metrics_payload]
    if len(metric_ids) != len(set(metric_ids)):
        raise HTTPException(
            status_code=400,
            detail="Duplicate metrics are not allowed in the same evaluation case.",
        )

    metrics_map: dict[UUID, EvalMetric] = {}
    if metric_ids:
        query = select(EvalMetric).where(col(EvalMetric.id).in_(metric_ids))
        result = await session.exec(query)
        metrics = result.all()
        metrics_map = {metric.id: metric for metric in metrics}

        if len(metrics_map) != len(metric_ids):
            missing_ids = [str(metric_id) for metric_id in metric_ids if metric_id not in metrics_map]
            raise HTTPException(status_code=400, detail=f"Metrics not found: {missing_ids}")

    return [
        CaseMetricLink(
            metric_id=item.metric_id,
            case_metadata=item.metadata,
            eval_metric=metrics_map[item.metric_id],
        )
        for item in case_metrics_payload
    ]


@router.post("/{eval_case_id}/run")
async def run_eval(
    eval_case_id: UUID,
    session: DbSession,
    current_user: CurrentActiveUser,
) -> EvalBatchRead:
    eval_case = await EvalCaseService.get_eval_case(eval_case_id, session)
    eval_batch = await EvalCaseService.execute_batch(
        flow_id=eval_case.flow_id,
        eval_cases=[eval_case],
        api_key_user=current_user,
        session=session,
        user_id=current_user.id,
        trigger_mode=EvalBatchTriggerMode.SINGLE_CASE,
        batch_metadata={"source": "eval_case_run"},
    )

    return serialize_eval_batch(eval_batch)


@router.post("/")
async def create_eval_case(payload: EvalCaseCreate, session: DbSession) -> EvalCaseRead:
    try:
        case_metrics_payload = payload.metrics
        payload_data = payload.model_dump(exclude={"metrics"})

        eval_case = EvalCase(**payload_data)
        eval_case.case_metrics = await build_case_metric_links(case_metrics_payload, session)

        session.add(eval_case)
        await session.flush()

        eval_case = await load_eval_case_with_metrics(eval_case.id, session)
        if eval_case is None:
            raise HTTPException(status_code=404, detail="EvalCase not found after creation.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return serialize_eval_case(eval_case)


@router.patch("/{eval_case_id}")
async def update_eval_case(
    eval_case_id: UUID,
    payload: EvalCaseUpdate,
    session: DbSession,
) -> EvalCaseRead:
    try:
        eval_case = await load_eval_case_with_metrics(eval_case_id, session)
        if eval_case is None:
            raise HTTPException(status_code=404, detail="EvalCase not found.")

        payload_data = payload.model_dump(exclude={"metrics"})
        for field_name, field_value in payload_data.items():
            setattr(eval_case, field_name, field_value)

        eval_case.case_metrics = await build_case_metric_links(payload.metrics, session)

        session.add(eval_case)
        await session.flush()

        eval_case = await load_eval_case_with_metrics(eval_case_id, session)
        if eval_case is None:
            raise HTTPException(status_code=404, detail="EvalCase not found after update.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return serialize_eval_case(eval_case)


@router.get("/{eval_case_id}")
async def retrieve_eval_case(eval_case_id: UUID, session: DbSession) -> EvalCaseRead:
    eval_case = await load_eval_case_with_metrics(eval_case_id, session)

    if eval_case is None:
        raise HTTPException(status_code=404, detail="EvalCase not found.")

    return serialize_eval_case(eval_case)


@router.get("/")
async def retrieve_all_eval_cases(session: DbSession) -> list[EvalCaseRead]:
    query = select(EvalCase).options(selectinload(CASE_METRICS_REL).selectinload(CASE_METRIC_EVAL_METRIC_REL))
    items = list((await session.exec(query)).fetchall())
    return [serialize_eval_case(item) for item in items]
