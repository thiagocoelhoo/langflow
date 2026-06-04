from uuid import UUID

from fastapi import APIRouter
from fastapi.exceptions import HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import select

from langflow.api.utils import DbSession
from langflow.services.database.models import EvalCase
from langflow.services.database.models.evaluation.model import (
    EvalCaseCreate,
    EvalCaseRead,
    EvalMetric,
)
from langflow.services.evaluations.evaluations import EvalCaseService

router = APIRouter(prefix="/evaluations/cases")


@router.post("/{eval_case_id}/run")
async def run_eval(
    eval_case_id: UUID,
    session: DbSession,
):
    eval_case = await EvalCaseService.get_eval_case(eval_case_id, session)
    results = await EvalCaseService.evaluate(
        eval_case=eval_case,
        api_key_user=None,
    )

    # Persistir resultados no banco
    for eval_run in results:
        session.add(eval_run)
        await session.flush()
        await session.refresh(eval_run)

    return results


@router.post("/")
async def create_eval_case(payload: EvalCaseCreate, session: DbSession) -> EvalCaseRead:
    try:
        # Separar os UUIDs das métricas do payload
        metrics_ids = payload.metrics
        payload_data = payload.model_dump(exclude={"metrics"})

        # Carregar os objetos EvalMetric do banco para validar que existem
        metrics = []
        if metrics_ids:
            query = select(EvalMetric).where(EvalMetric.id.in_(metrics_ids))
            result = await session.exec(query)
            metrics = result.all()

            # Validar que todas as métricas solicitadas foram encontradas
            if len(metrics) != len(metrics_ids):
                found_ids = {m.id for m in metrics}
                missing_ids = set(metrics_ids) - found_ids
                raise HTTPException(status_code=400, detail=f"Metrics not found: {missing_ids}")

        # Criar o EvalCase sem as métricas
        eval_case = EvalCase(**payload_data)

        # Associar as métricas
        eval_case.metrics = metrics

        session.add(eval_case)
        await session.flush()
        await session.refresh(eval_case, attribute_names=["metrics"])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return EvalCaseRead(
        id=eval_case.id,
        name=eval_case.name,
        input=eval_case.input,
        expected_output=eval_case.expected_output,
        model_name=eval_case.model_name,
        metrics=[m.id for m in eval_case.metrics],
        flow_id=eval_case.flow_id,
    )


@router.get("/{eval_case_id}")
async def retrieve_eval_case(eval_case_id: UUID, session: DbSession) -> EvalCaseRead:
    query = select(EvalCase).where(EvalCase.id == eval_case_id).options(selectinload(EvalCase.metrics))
    eval_case = (await session.exec(query)).first()

    if eval_case is None:
        raise HTTPException(status_code=404, detail="EvalCase not found.")

    return EvalCaseRead(
        id=eval_case.id,
        name=eval_case.name,
        input=eval_case.input,
        expected_output=eval_case.expected_output,
        model_name=eval_case.model_name,
        metrics=[m.id for m in eval_case.metrics],
        flow_id=eval_case.flow_id,
    )


@router.get("/")
async def retrieve_all_eval_cases(session: DbSession) -> list:
    query = select(EvalCase).options(selectinload(EvalCase.metrics))
    items = list((await session.exec(query)).fetchall())
    return [
        EvalCaseRead(
            id=item.id,
            name=item.name,
            input=item.input,
            expected_output=item.expected_output,
            model_name=item.model_name,
            metrics=[m.id for m in item.metrics],
            flow_id=item.flow_id,
        )
        for item in items
    ]
