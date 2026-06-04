from uuid import UUID

from fastapi import APIRouter
from fastapi.exceptions import HTTPException
from sqlmodel import select

from langflow.api.utils import DbSession
from langflow.services.database.models.evaluation import EvalMetric
from langflow.services.database.models.evaluation.model import EvalMetricCreate

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
