from uuid import UUID

from fastapi import APIRouter
from fastapi.exceptions import HTTPException
from sqlmodel import select

from langflow.api.utils import DbSession
from langflow.services.database.models.evaluation import EvalMetric
from langflow.services.database.models.evaluation.model import (
    CaseMetricLink,
    EvalMetricCreate,
    EvalMetricUpdate,
)

router = APIRouter(prefix="/evaluations/metrics")


@router.get("/")
async def list_metrics(session: DbSession):
    query = select(EvalMetric)

    result = (await session.exec(query)).fetchall()

    return {"items": list(result)}


@router.get("/{metric_id}")
async def get_metric_by_id(metric_id: UUID, session: DbSession) -> EvalMetric:
    result = await session.get(EvalMetric, metric_id)

    if result is None:
        raise HTTPException(status_code=404, detail="Metric not found.")

    return result


@router.post("/")
async def create_metric(payload: EvalMetricCreate, session: DbSession) -> EvalMetric:
    metric = EvalMetric.model_validate(payload, from_attributes=True)

    session.add(metric)
    await session.flush()
    await session.refresh(metric)
    return metric


@router.patch("/{metric_id}")
async def update_metric(
    metric_id: UUID,
    payload: EvalMetricUpdate,
    session: DbSession,
) -> EvalMetric:
    metric = await session.get(EvalMetric, metric_id)

    if metric is None:
        raise HTTPException(status_code=404, detail="Metric not found.")

    update_data = payload.model_dump(exclude_unset=True)
    for field_name, field_value in update_data.items():
        setattr(metric, field_name, field_value)

    session.add(metric)
    await session.flush()
    await session.refresh(metric)
    return metric


@router.delete("/{metric_id}")
async def delete_metric(metric_id: UUID, session: DbSession):
    metric = await session.get(EvalMetric, metric_id)

    if metric is None:
        raise HTTPException(status_code=404, detail="Metric not found.")

    linked_case_metric = (
        await session.exec(select(CaseMetricLink).where(CaseMetricLink.metric_id == metric_id))
    ).first()

    if linked_case_metric is not None:
        raise HTTPException(
            status_code=409,
            detail="Metric is used by at least one evaluation case and cannot be deleted.",
        )

    await session.delete(metric)
    await session.flush()

    return {"id": str(metric_id), "deleted": True}
