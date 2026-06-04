from uuid import UUID, uuid4

from fastapi import status
from fastapi.exceptions import HTTPException
from lfx.utils.flow_validation import CustomComponentValidationError
from sqlalchemy.orm import selectinload
from sqlmodel.ext.asyncio.session import AsyncSession

from langflow.api.v1.endpoints import simple_run_flow
from langflow.api.v1.schemas import RunResponse, SimplifiedAPIRequest
from langflow.exceptions.api import APIException, InvalidChatInputError

# from langflow.graph import Graph
# from langflow.processing.process import process_tweaks, run_graph_internal
from langflow.services.database.models import User
from langflow.services.database.models.evaluation import EvalCase, EvalRun
from langflow.services.database.models.flow import Flow
from langflow.services.evaluations.algorithms.algorithm_factory import get_algorithm_factory


class EvalCaseService:
    @staticmethod
    async def get_eval_case(eval_id: UUID, session: AsyncSession) -> EvalCase:
        """
        Retrieve evaluation case by ID from the database.

        Args:
            eval_id: The unique identifier (UUID) of the evaluation case.
            session: Database session for executing the query

        Returns:
            EvalCase: The evaluations case object if found.

        Exceptions:
            HTTPException: With status code 404 if the evaluation code does not exist.
        """
        from sqlmodel import select

        stmt = (
            select(EvalCase)
            .where(EvalCase.id == eval_id)
            .options(selectinload(EvalCase.flow), selectinload(EvalCase.metrics))
        )
        result = await session.exec(stmt)
        eval_case = result.first()
        if eval_case is None:
            raise HTTPException(status_code=404, detail="Eval case no found.")
        return eval_case

    @staticmethod
    def get_strategy(eval_case: EvalCase):
        pass

    @staticmethod
    async def _run_flow(flow: Flow, api_key_user: User | None, messages: list[str]) -> list[tuple[RunResponse, str]]:
        session_id = str(uuid4())
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
        return outputs

    @staticmethod
    async def evaluate(eval_case: EvalCase, api_key_user: User | None) -> list[EvalRun]:
        # Executes the flow to get its response and trace
        messages = eval_case.input.get("messages")
        responses = await EvalCaseService._run_flow(
            eval_case.flow,
            api_key_user,
            messages,
        )

        flow_output, run_id = responses[-1]

        # Run every metric in the eval case
        eval_runs = []
        for metric in eval_case.metrics:
            err_message = None
            result = {}
            try:
                alg = get_algorithm_factory().create(
                    metric.algorithm,
                    params={
                        **metric.params,
                        "model_name": eval_case.model_name,
                        "user_id": str(eval_case.flow_id),
                    },
                )
                result = alg.run(eval_case, flow_output)
            except Exception as e:
                err_message = str(e)
            finally:
                eval_runs.append(
                    EvalRun(
                        eval_case_id=eval_case.id,
                        eval_metric_id=metric.id,
                        trace_id=UUID(run_id),
                        score=result.get("score", 0),
                        message=result.get("message", None),
                        err_message=err_message,
                    )
                )

        return eval_runs


# =============================================================================
#                                  Helpers
# =============================================================================


async def run_flow_internal(
    flow: Flow,
    input_request: SimplifiedAPIRequest,  # | None,
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

    return result, run_id


# def _get_graph_from_flow(
#     flow: Flow,
#     input_request: SimplifiedAPIRequest,
#     api_key_user: User | None = None,
# ):
#     user_id = api_key_user.id if api_key_user else None
#     flow_id_str = str(flow.id)
#     graph_data = flow.data.copy()
#     graph_data = process_tweaks(graph_data, input_request.tweaks or {})

#     return Graph.from_payload(
#         graph_data,
#         flow_id=flow_id_str,
#         flow_name=flow.name,
#         user_id=str(user_id),
#     )


# def _extract_response_text(response: RunResponse) -> str | None:
#     """Extract text from RunResponse outputs.

#     Traverses the nested output structure looking for text content.
#     Handles ResultData objects from RunOutputs.outputs.
#     """
#     if response.outputs is None or not response.outputs:
#         return None

#     for run_output in response.outputs:
#         # run_output is a RunOutputs object
#         if not hasattr(run_output, "outputs") or run_output.outputs is None:
#             continue

#         # run_output.outputs is a list of ResultData | None
#         for result_data in run_output.outputs:
#             if result_data is None:
#                 continue

#             # Try to get message from results
#             if hasattr(result_data, "results") and isinstance(result_data.results, dict):
#                 msg = result_data.results.get("message")
#                 if msg is not None:
#                     # msg might be a Message object with .text or a dict
#                     if isinstance(msg, str):
#                         return msg
#                     if isinstance(msg, dict):
#                         text = msg.get("text")
#                         if text is not None:
#                             return str(text)
#                     # Try to get .text attribute if it's a Message object
#                     if hasattr(msg, "text"):
#                         text_attr = getattr(msg, "text", None)
#                         if text_attr:
#                             return str(text_attr)
#                     if hasattr(msg, "content"):
#                         content_attr = getattr(msg, "content", None)
#                         if content_attr:
#                             return str(content_attr)

#             # Try messages field (list of ChatOutputResponse)
#             if hasattr(result_data, "messages") and result_data.messages:
#                 for msg in result_data.messages:
#                     # ChatOutputResponse has 'message' field, not 'text'
#                     if hasattr(msg, "message") and msg.message:
#                         message_content = msg.message
#                         if isinstance(message_content, str):
#                             return message_content
#                         if isinstance(message_content, list):
#                             # Join list of strings
#                             for item in message_content:
#                                 if isinstance(item, str):
#                                     return item
#                     if isinstance(msg, dict):
#                         text = msg.get("message") or msg.get("text") or msg.get("content")
#                         if text:
#                             return str(text)

#             # Try artifacts as fallback
#             if hasattr(result_data, "artifacts") and isinstance(result_data.artifacts, dict):
#                 for value in result_data.artifacts.values():
#                     if isinstance(value, dict):
#                         text = value.get("text") or value.get("content") or value.get("message")
#                         if text:
#                             return str(text)
#                     if isinstance(value, str):
#                         return value

#     return None
