from typing import Annotated
from uuid import UUID, uuid4

import orjson
import sqlalchemy as sa
from fastapi import APIRouter, Depends, Request, status
from fastapi.exceptions import HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage
from lfx.base.models.unified_models import get_provider_for_model_name
from lfx.base.models.unified_models.instantiation import get_llm
from lfx.graph.graph.base import Graph
from lfx.graph.schema import RunOutputs
from lfx.log.logger import logger
from lfx.schema.schema import InputValueRequest
from lfx.utils.flow_validation import CustomComponentValidationError
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.functions import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.expression import SelectOfScalar

from langflow.api.utils import DbSession
from langflow.api.utils.core import CurrentActiveUser
from langflow.api.v1.flows_helpers import _read_flow
from langflow.api.v1.schemas import (
    # EvaluationCasesResponse,
    EvaluationExperimentalResponse,
    # EvaluationMetricsResponse,
    # EvaluationResultsResponse,
    RunResponse,
    SimplifiedAPIRequest,
)
from langflow.events.event_manager import EventManager
from langflow.exceptions.api import APIException, InvalidChatInputError
from langflow.processing.process import process_tweaks, run_graph_internal
from langflow.services.database.models.evaluation.model import (
    EvaluationExperimental,
    EvaluationExperimentalCreate,
    EvaluationExperimentalRead,
    EvaluationResultExperimental,
    EvaluationResultExperimentalRead,
)
from langflow.services.database.models.flow.model import Flow, FlowRead
from langflow.services.database.models.user.model import User, UserRead
from langflow.services.deps import get_auth_service

# from langflow.services.database.models.evaluation import EvaluationCase, EvaluationMetric, EvaluationResult
# from langflow.services.database.models.evaluation.model import (
#     EvaluationCaseCreate,
#     EvaluationCaseRead,
#     EvaluationMetricCreate,
#     EvaluationSchemaExperimental,
# )

router = APIRouter(prefix="/evaluations", tags=["Evaluations"])


class EvalMiscServices:
    @staticmethod
    def extract_text_from_content(content: str | list | dict | None) -> str:
        """Extract plain text from various content formats.

        Handles:
        - Plain strings (return as-is)
        - Lists of content blocks from modern LLMs (Gemini 3, etc.)
        - Dicts with 'text' or 'content' fields
        """
        if isinstance(content, str):
            return content

        if isinstance(content, list):
            # Handle list of content blocks (e.g., Gemini 3 format)
            parts = []
            for block in content:
                if isinstance(block, str):
                    parts.append(block)
                elif isinstance(block, dict) and block.get("type") == "text":
                    text = block.get("text")
                    if isinstance(text, str):
                        parts.append(text)
            return "".join(parts)

        if isinstance(content, dict):
            # Try common dict keys for text
            for key in ["text", "content", "message"]:
                value = content.get(key)
                if isinstance(value, str):
                    return value

        return str(content) if content is not None else ""

    @staticmethod
    def extract_judge_response_text(judge_result: BaseMessage) -> str:
        """Extract text from judge LLM response.

        Handles AIMessage and other LangChain message types that may have
        .content as string or list of content blocks.
        """
        if not judge_result:
            return ""

        # Try to get .content attribute (works for AIMessage, BaseMessage)
        content = getattr(judge_result, "content", None)
        if content is not None:
            return EvalMiscServices.extract_text_from_content(content)

        # Fallback: convert to string
        return str(judge_result)

    @staticmethod
    async def parse_input_request_from_body(http_request: Request) -> SimplifiedAPIRequest:
        """Parse SimplifiedAPIRequest from HTTP request body.

        This function handles the case where FastAPI can't automatically parse the request body
        due to the presence of a Request parameter in the endpoint signature.

        Args:
            http_request: The FastAPI Request object

        Returns:
            SimplifiedAPIRequest: Parsed request or default instance if parsing fails
        """
        try:
            body = await http_request.body()
            if body:
                body_data = orjson.loads(body)
                return SimplifiedAPIRequest(**body_data)
            return SimplifiedAPIRequest()
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"Failed to parse request body: {exc}")
            return SimplifiedAPIRequest()

    @staticmethod
    def get_graph_from_flow(
        flow: Flow,
        input_request: SimplifiedAPIRequest,
        api_key_user: User | None = None,
        # context: dict | None,
    ):
        user_id = api_key_user.id if api_key_user else None
        flow_id_str = str(flow.id)
        graph_data = flow.data.copy()
        graph_data = process_tweaks(graph_data, input_request.tweaks or {})

        return Graph.from_payload(
            graph_data,
            flow_id=flow_id_str,
            flow_name=flow.name,
            user_id=str(user_id),
            # context=context,
        )

    @staticmethod
    def validate_input_and_tweaks(input_request: SimplifiedAPIRequest) -> None:
        # If the input_value is not None and the input_type is "chat"
        # then we need to check the tweaks if the ChatInput component is present
        # and if its input_value is not None
        # if so, we raise an error
        if not input_request.tweaks:
            return

        for key, value in input_request.tweaks.items():
            if not isinstance(value, dict):
                continue

            input_value = value.get("input_value")
            if input_value is None:
                continue

            request_has_input = input_request.input_value is not None

            if any(chat_key in key for chat_key in ("ChatInput", "Chat Input")):
                if request_has_input and input_request.input_type == "chat":
                    msg = "If you pass an input_value to the chat input, you cannot pass a tweak with the same name."
                    raise InvalidChatInputError(msg)

            elif (
                any(text_key in key for text_key in ("TextInput", "Text Input"))
                and request_has_input
                and input_request.input_type == "text"
            ):
                msg = "If you pass an input_value to the text input, you cannot pass a tweak with the same name."
                raise InvalidChatInputError(msg)

    @staticmethod
    async def simple_run_flow(
        flow: Flow,
        input_request: SimplifiedAPIRequest,
        *,
        stream: bool = False,
        event_manager: EventManager | None = None,
        run_id: str | None = None,
        api_key_user: User | None = None,
        # context: dict | None = None,
    ):
        EvalMiscServices.validate_input_and_tweaks(input_request)
        try:
            task_result: list[RunOutputs] = []
            flow_id_str = str(flow.id)

            if flow.data is None:
                msg = f"Flow {flow_id_str} has no data"
                raise ValueError(msg)

            # Create graph from data
            graph = EvalMiscServices.get_graph_from_flow(
                flow=flow,
                input_request=input_request,
                api_key_user=api_key_user,
                # context=context,
            )

            # Create run id
            if run_id is None:
                run_id = str(uuid4())
            graph.set_run_id(run_id)

            inputs = None
            if input_request.input_value is not None:
                inputs = [
                    InputValueRequest(
                        components=[],
                        input_value=input_request.input_value,
                        type=input_request.input_type,
                    )
                ]

            if input_request.output_component:
                outputs = [input_request.output_component]
            else:
                outputs = [
                    vertex.id
                    for vertex in graph.vertices
                    if input_request.output_type == "debug"
                    or (
                        vertex.is_output
                        and (input_request.output_type == "any" or input_request.output_type in vertex.id.lower())  # type: ignore[operator]
                    )
                ]

            task_result, session_id = await run_graph_internal(
                graph=graph,
                flow_id=flow_id_str,
                session_id=input_request.session_id,
                inputs=inputs,
                outputs=outputs,
                stream=stream,
                event_manager=event_manager,
            )

            return RunResponse(outputs=task_result, session_id=session_id)

        except sa.exc.StatementError as exc:
            raise ValueError(str(exc)) from exc

    @staticmethod
    async def run_flow_internal(
        *,
        flow: FlowRead | None,
        input_request: SimplifiedAPIRequest,  # | None,
        api_key_user: User | UserRead,
        # http_request: Request,
        # context: dict | None,
    ) -> StreamingResponse | RunResponse:
        """Internal function containing the core business logic for running a flow.

        Args:
            background_tasks (BackgroundTasks): FastAPI background task manager
            flow (FlowRead | None): The flow to execute, loaded via dependency
            input_request (SimplifiedAPIRequest | None): Input parameters for the flow
            api_key_user (User | UserRead): Authenticated user (either from session or API key)
            context (dict | None): Optional context to pass to the flow
            http_request (Request): The incoming HTTP request for extracting global variables

        Returns:
            Union[StreamingResponse, RunResponse]: Either a streaming response for real-time results
            or a RunResponse with the complete execution results

        Raises:
            HTTPException: For flow not found (404) or invalid input (400)
            APIException: For internal execution errors (500)
        """
        # If input_request is None, manually parse the request body
        # This happens when FastAPI can't automatically parse it due to the Request parameter
        # if input_request is None:
        #     input_request = await EvalMiscServices.parse_input_request_from_body(http_request)

        if flow is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Flow not found",
            )

        run_id = str(uuid4())
        try:
            result = await EvalMiscServices.simple_run_flow(
                flow=flow,
                input_request=input_request,
                run_id=run_id,
                api_key_user=api_key_user,
                # context=context,
            )
        except ValueError as exc:
            if "badly formed hexadecimal UUID string" in str(exc):
                # This means the Flow ID is not a valid UUID which means it can't find the flow
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

        return result

    @staticmethod
    async def get_user_api_key():
        """
        Essa função é apenas temporária, é mandatório que você apague a APIKEY hardcoded abaixo
        em detrimento do uso de argumentos
        """
        return await get_auth_service().api_key_security(None, "sk-C8IKGcT8yCpAVoTJWQ5zNSqLPetITo946G4K7srltO0")

    @staticmethod
    async def get_flow_for_evaluation(evaluation_id: UUID, session: DbSession) -> Flow:
        flow = await session.get(Flow, evaluation_id)
        if flow is None:
            raise HTTPException(status_code=404)
        return flow

    # @staticmethod
    # async def get_evaluation_case(evaluation_id: UUID, session: DbSession) -> EvaluationCase:
    #     evaluation_case = await session.get(EvaluationCase, evaluation_id)
    #     if evaluation_case is None:
    #         raise HTTPException(status_code=404)
    #     return evaluation_case


class Judge:
    def __init__(
        self,
        provider: str,
        model_name: str,
        user_id: UUID,
        prompt: str | None = None,
    ):
        self._provider = provider
        self._model_name = model_name
        self._user_id = user_id
        self._prompt = prompt or (
            "Você deve atuar como um juíz que definirá quando a resposta está aceitável ou não.\n"
            "Além disso você deve atribuir também um score entre 0 e 1, que define o quão boa é a resposta.\n"
            "Você não deve tentar realizar uma comparação exata, apenas verifique se o resultado segue a mesma linnha.\n"
            "Analise a seguinte resposta e compare com a resposta esperada.\n"
        )

    @staticmethod
    def extract_response_text(response: RunResponse) -> str | None:
        """Extract text from RunResponse outputs.

        Traverses the nested output structure looking for text content.
        Handles ResultData objects from RunOutputs.outputs.
        """
        if response.outputs is None or not response.outputs:
            return None

        for run_output in response.outputs:
            # run_output is a RunOutputs object
            if not hasattr(run_output, "outputs") or run_output.outputs is None:
                continue

            # run_output.outputs is a list of ResultData | None
            for result_data in run_output.outputs:
                if result_data is None:
                    continue

                # Try to get message from results
                if hasattr(result_data, "results") and isinstance(result_data.results, dict):
                    msg = result_data.results.get("message")
                    if msg is not None:
                        # msg might be a Message object with .text or a dict
                        if isinstance(msg, str):
                            return msg
                        if isinstance(msg, dict):
                            text = msg.get("text")
                            if text is not None:
                                return str(text)
                        # Try to get .text attribute if it's a Message object
                        if hasattr(msg, "text"):
                            text_attr = getattr(msg, "text", None)
                            if text_attr:
                                return str(text_attr)
                        if hasattr(msg, "content"):
                            content_attr = getattr(msg, "content", None)
                            if content_attr:
                                return str(content_attr)

                # Try messages field (list of ChatOutputResponse)
                if hasattr(result_data, "messages") and result_data.messages:
                    for msg in result_data.messages:
                        # ChatOutputResponse has 'message' field, not 'text'
                        if hasattr(msg, "message") and msg.message:
                            message_content = msg.message
                            if isinstance(message_content, str):
                                return message_content
                            if isinstance(message_content, list):
                                # Join list of strings
                                for item in message_content:
                                    if isinstance(item, str):
                                        return item
                        if isinstance(msg, dict):
                            text = msg.get("message") or msg.get("text") or msg.get("content")
                            if text:
                                return str(text)

                # Try artifacts as fallback
                if hasattr(result_data, "artifacts") and isinstance(result_data.artifacts, dict):
                    for value in result_data.artifacts.values():
                        if isinstance(value, dict):
                            text = value.get("text") or value.get("content") or value.get("message")
                            if text:
                                return str(text)
                        if isinstance(value, str):
                            return value

        return None

    def eval(self, expected_output: str, actual_output: str) -> BaseMessage:
        llm: BaseChatModel = get_llm(
            model=[
                {
                    "provider": self._provider,
                    "name": self._model_name,
                }
            ],
            # api_key=api_key_user,
            user_id=self._user_id,
        )

        eval_result = llm.invoke(
            input=(
                "# instruction:\n"
                f"{self._prompt}\n"
                "# spected_output\n"
                f"{expected_output}\n\n"
                "# actual output\n"
                f"{actual_output}\n\n"
                "# formato de resposta\n"
                '{\n\t"score": 0.5,\n\t"response": "The actual response is m..."}\n'
            )
        )

        return eval_result


# @router.post("/{evaluation_id}/run")
# async def execute_evaluation(
#     *,
#     evaluation_case: Annotated[EvaluationCase, Depends(EvalMiscServices.get_evaluation_case)],
# ):
#     # TODO: criar campos para configuracao do LLM da evaluation
#     model = {
#         "provider": "Google generative AI",
#         "name": "gemini-3.1-flash-lite",
#     }
#     user_id = "a45ef866-a513-4642-b029-2b59aff3d06f"

#     input_request = SimplifiedAPIRequest(
#         input_value=evaluation_case.input,
#         input_type="chat",
#         output_type="chat",
#         session_id=str(uuid4()),
#     )
#     api_key_user = await EvalMiscServices.get_user_api_key()

#     metric_data = evaluation_case.metric.data

#     judge = Judge(
#         provider=model["provider"],
#         model_name=model["name"],
#         user_id=user_id,
#         prompt=metric_data.get("prompt") if metric_data else None,
#     )

#     actual_output: RunResponse = await EvalMiscServices.run_flow_internal(
#         flow=evaluation_case.flow,
#         input_request=input_request,
#         api_key_user=api_key_user,
#     )

#     eval_result = judge.eval(
#         expected_output=evaluation_case.expected_output,
#         actual_output=actual_output,
#     )

#     """
#     Parametros necessários para cada tipo de algoritmo

#     # LLM-AS-A-JUDGE:
#         - input_value
#         - expected_output
#         - model_provider
#         - model_name
#         - user_id
#         - evaluation_prompt
#         - [?] min_iterations

#     """
#     return eval_result


@router.get("/")
async def read_all_evaluation_cases(
    *,
    skip: int = 0,
    limit: int = 10,
    session: DbSession,
) -> EvaluationExperimentalResponse:
    """Retrieve a list of evaluation cases from the database with pagination."""

    query: SelectOfScalar = select(EvaluationExperimental).offset(skip).limit(limit)
    count_query = select(func.count()).select_from(EvaluationExperimental)

    evaluation_cases = (await session.exec(query)).fetchall()
    total_count = (await session.exec(count_query)).first()

    return EvaluationExperimentalResponse(
        total_count=total_count,
        evaluation_cases=[EvaluationExperimentalRead(**case.model_dump()) for case in evaluation_cases],
    )


async def _get_eval_case(id: UUID, session: AsyncSession):
    statement = (
        select(EvaluationExperimental)
        .where(EvaluationExperimental.id == id)
        .options(selectinload(EvaluationExperimental.flow))
    )

    result = await session.exec(statement)
    eval_case = result.first()

    if eval_case is None:
        raise HTTPException(status_code=404)

    return eval_case


@router.post("/")
async def create_evaluation_case(
    *,
    payload: EvaluationExperimentalCreate,
    current_user: CurrentActiveUser,
    session: DbSession,
) -> EvaluationExperimentalRead:
    """Add a new evaluation case to the database"""
    try:
        new_evaluation = EvaluationExperimental(
            user_id=current_user.id,
            **payload.model_dump(),
        )
        session.add(new_evaluation)
        await session.flush()
        await session.refresh(new_evaluation)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return EvaluationExperimentalRead(**new_evaluation.model_dump())


@router.post("/{evaluation_id}/run")
async def execute_evaluation(
    *,
    evaluation_id: str,
    session: DbSession,
    current_user: CurrentActiveUser,
    # payload: EvaluationExperimentalCreate,
) -> EvaluationResultExperimental:
    eval_case = await _get_eval_case(UUID(evaluation_id), session)

    input_request = SimplifiedAPIRequest(
        input_value=eval_case.input,
        input_type="chat",
        output_type="chat",
        session_id=str(uuid4()),
    )

    api_key_user = await EvalMiscServices.get_user_api_key()

    judge = Judge(
        provider=get_provider_for_model_name(eval_case.model_name),
        model_name=eval_case.model_name,
        user_id=current_user.id,
    )

    # Run the flow and get the actual output
    actual_output: RunResponse = await EvalMiscServices.run_flow_internal(
        flow=eval_case.flow,
        input_request=input_request,
        api_key_user=api_key_user,
    )

    if actual_output is None:
        raise HTTPException(status_code=500)

    # Extract text from the flow output
    actual_output_text = judge.extract_response_text(actual_output)
    if actual_output_text is None:
        actual_output_text = ""

    # Get the judge evaluation result
    judge_response = judge.eval(
        expected_output=eval_case.expected_output,
        actual_output=actual_output_text,  # Pass extracted string, not RunResponse
    )

    # Extract text from judge response (handles AIMessage and other formats)
    judge_response_text = EvalMiscServices.extract_judge_response_text(judge_response)

    # Parse judge response JSON to extract score and message
    score = 0.5  # Default score
    eval_message = judge_response_text

    try:
        judge_data = orjson.loads(judge_response_text)
        if isinstance(judge_data, dict):
            # Extract score (default 0.5 if not present or invalid)
            if "score" in judge_data:
                score_value = judge_data["score"]
                if isinstance(score_value, (int, float)):
                    score = max(0.0, min(1.0, float(score_value)))  # Clamp to [0, 1]

            # Extract response message
            if "response" in judge_data and isinstance(judge_data["response"], str):
                eval_message = judge_data["response"]
    except (ValueError, orjson.JSONDecodeError):
        # If JSON parsing fails, use the full response text as message
        eval_message = judge_response_text

    threshold = 0.5
    eval_result = EvaluationResultExperimental(
        actual_output=actual_output_text,
        score=score,
        eval_message=eval_message,
        user_id=current_user.id,
        evaluation_case_id=UUID(evaluation_id),
        success=score >= threshold,
    )

    session.add(eval_result)
    await session.flush()
    await session.refresh(eval_result)
    return eval_result


@router.get("/{evaluation_id}/results")
async def list_all_eval_results(
    *,
    evaluation_id: str,
    # current_user: CurrentActiveUser,
    session: DbSession,
):
    query = select(
        EvaluationResultExperimental,
    ).where(
        EvaluationResultExperimental.evaluation_case_id == evaluation_id,
    )

    items = (await session.exec(query)).fetchall()

    return {
        "items": [EvaluationResultExperimentalRead(**item.model_dump()) for item in items],
    }


# =============================================================================
#                          Evaluation Metrics
# =============================================================================


# @router.get("/")
# async def read_all_evaluation_cases(
#     *,
#     skip: int = 0,
#     limit: int = 10,
#     session: DbSession,
# ) -> EvaluationCasesResponse:
#     """Retrieve a list of evaluation cases from the database with pagination."""

#     query: SelectOfScalar = select(EvaluationCase).offset(skip).limit(limit)
#     count_query = select(func.count()).select_from(EvaluationCase)

#     evaluation_cases = (await session.exec(query)).fetchall()
#     total_count = (await session.exec(count_query)).first()

#     return EvaluationCasesResponse(
#         total_count=total_count,
#         evaluation_cases=[EvaluationCaseRead(**case.model_dump()) for case in evaluation_cases],
#     )


# @router.get("/{evaluation_id}")
# async def get_evaluation_case_by_id(
#     evaluation_id: UUID,
#     session: DbSession,
# ) -> EvaluationCaseRead:
#     """Retrieve an evaluation case from the database"""
#     evaluation_case = await session.get(EvaluationCase, evaluation_id)

#     if evaluation_case is None:
#         raise HTTPException(status_code=404)

#     return EvaluationCaseRead.model_validate(evaluation_case, from_attributes=True)


# @router.post("/")
# async def create_evaluation_case(
#     *,
#     evaluation_case: EvaluationCaseCreate,
#     session: DbSession,
# ) -> EvaluationCase:
#     """Add a new evaluation case to the database"""
#     try:
#         new_evaluation = EvaluationCase.model_validate(evaluation_case, from_attributes=True)
#         session.add(new_evaluation)
#         await session.flush()
#         await session.refresh(new_evaluation)
#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e)) from e

#     return new_evaluation


# # =============================================================================
# #                          Evaluation Metrics
# # =============================================================================


# @router.get("/metrics")
# async def read_all_metrics(
#     *,
#     session: DbSession,
#     skip: int = 0,
#     limit: int = 10,
# ) -> EvaluationMetricsResponse:
#     query = select(EvaluationMetric).offset(skip).limit(limit)
#     count_query = select(func.count()).select_from(EvaluationMetric)

#     metrics = (await session.exec(query)).fetchall()
#     total_count = (await session.exec(count_query)).first()

#     return EvaluationMetricsResponse(
#         total_count=total_count,
#         evaluation_metrics=list(metrics),
#     )


# @router.get("/metrics/{metric_id}")
# async def get_metric_by_id(
#     *,
#     metric_id: UUID,
#     session: DbSession,
# ) -> EvaluationMetric:
#     metric = await session.get(EvaluationMetric, metric_id)

#     if metric is None:
#         raise HTTPException(status_code=404)

#     # TODO: adicionar schema e validação para EvaluationMetricRead
#     return metric


# @router.post("/metrics")
# async def create_metric(
#     *,
#     metric: EvaluationMetricCreate,
#     session: DbSession,
# ) -> EvaluationMetric:
#     try:
#         new_metric = EvaluationMetric.model_validate(metric, from_attributes=True)
#         session.add(new_metric)
#         await session.flush()
#         await session.refresh(new_metric)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e)) from e

#     return new_metric


# # =============================================================================
# #                          Evaluation Result
# # =============================================================================


# @router.get("/{evaluation_id}/results")
# async def list_all_evaluation_results(
#     *,
#     evaluation_id: UUID | None = None,
#     skip: int = 0,
#     limit: int = 10,
#     session: DbSession,
# ) -> EvaluationResultsResponse:
#     # TODO: implementar filtros (project, user, evaluation case, folder, etc)
#     query = select(EvaluationResult).offset(skip).limit(limit)
#     count_query = select(func.count()).select_from(EvaluationResult)

#     evaluation_results = (await session.exec(query)).fetchall()
#     total_count = (await session.exec(count_query)).first()

#     return EvaluationResultsResponse(
#         total_count=total_count,
#         evaluation_results=list(evaluation_results),
#     )
