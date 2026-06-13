import json
from typing import TypedDict
from uuid import UUID

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage
from lfx.base.models.unified_models import get_llm, get_provider_for_model_name
from pydantic import BaseModel
from typing_extensions import override

from langflow.api.v1.schemas import RunResponse
from langflow.services.database.models.evaluation import EvalCase
from langflow.services.database.models.evaluation.model import EvalCaseExpectedOutput
from langflow.services.evaluations.algorithms.algorithm import Algorithm, AlgorithmOutput


def extract_text_from_content(content: str | list | dict | None) -> str:
    """Extract plain text from various content formats.

    Handles:
    - Plain strings
    - Lists of content blocks (Gemini/Google style)
    - Dicts with 'text', 'content', 'message'
    - 'candidates' arrays used by some APIs
    - Nested structures (recursively)
    """
    if content is None:
        return ""

    # Direct string
    if isinstance(content, str):
        return content

    # If it's already a dict with expected keys (maybe already parsed JSON)
    if isinstance(content, dict):
        # 1) If it's already structured output (score/response), return as JSON string
        #    (the caller can try json.loads on the resulting string or detect a dict directly)
        # 2) Try common keys that may be nested: candidates, content, message
        # Candidates: common in Google's responses
        candidates = content.get("candidates") or content.get("candidate")
        if isinstance(candidates, list) and candidates:
            # Look into first candidate for content
            first = candidates[0]
            # candidate may have 'content' or 'message'
            for key in ("content", "message", "text", "output"):
                if key in first:
                    return extract_text_from_content(first[key])

        # If content is a dict with 'content' key that is list/dict -> recurse
        if "content" in content:
            return extract_text_from_content(content["content"])

        if "message" in content:
            return extract_text_from_content(content["message"])

        # Try keys that directly contain a string
        for key in ("text", "response", "message"):
            val = content.get(key)
            if isinstance(val, str):
                return val
            if isinstance(val, (list, dict)):
                return extract_text_from_content(val)

        # As a last attempt, if it's a dict, try to dump it (so caller can json.loads it)
        try:
            return json.dumps(content)
        except Exception:
            return str(content)

    # List of blocks (Gemini style)
    if isinstance(content, list):
        parts = []
        for block in content:
            # block could be a string
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                # Typical block types: 'output_text', 'text', 'message', etc.
                # Prefer explicit text keys
                if "text" in block and isinstance(block["text"], str):
                    parts.append(block["text"])
                    continue
                # some blocks keep text in 'content' or nested content
                if "content" in block:
                    parts.append(extract_text_from_content(block["content"]))
                    continue
                # fallback: try message field
                if "message" in block:
                    parts.append(extract_text_from_content(block["message"]))
                    continue
                # fallback on any string values inside dict
                for v in block.values():
                    if isinstance(v, str):
                        parts.append(v)
                        break
        return "".join(parts)

    # Fallback to string representation
    return str(content)


class JudgeParams(TypedDict):
    model_name: str
    user_id: UUID
    prompt: str


class JudgeParamsValidator(BaseModel):
    model_name: str
    user_id: UUID
    prompt: str


class Judge(Algorithm):
    def __init__(self, params: JudgeParams):
        validated_params = JudgeParamsValidator.model_validate(params)

        self._provider = get_provider_for_model_name(validated_params.model_name)
        self._model_name = validated_params.model_name
        self._user_id = validated_params.user_id
        self._prompt = (
            "Você deve atuar como um juíz que definirá quando a resposta está aceitável ou não.\n"
            "Além disso você deve atribuir também um score entre 0 e 1, que define "
            "o quão boa é o actual_output se comparado expected_output.\n"
            f"{validated_params.prompt}"
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
                if isinstance(getattr(result_data, "results", None), dict):
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
                if getattr(result_data_any, "messages", None):
                    for msg in result_data_any.messages:
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
                if isinstance(getattr(result_data_any, "artifacts", None), dict):
                    for value in result_data_any.artifacts.values():
                        if isinstance(value, dict):
                            text = value.get("text") or value.get("content") or value.get("message")
                            if text:
                                return str(text)
                        if isinstance(value, str):
                            return value

        return None

    def _get_llm(self) -> BaseChatModel:
        if not self._provider:
            raise ValueError("No provider defined.")

        if not self._model_name:
            raise ValueError("No model defineds.")

        return get_llm(
            model=[
                {
                    "provider": self._provider,
                    "name": self._model_name,
                }
            ],
            user_id=self._user_id,
        )

    def _invoke_judge(
        self,
        expected_output: EvalCaseExpectedOutput,
        actual_output: EvalCaseExpectedOutput,
    ) -> BaseMessage:
        llm: BaseChatModel = self._get_llm()

        return llm.invoke(
            input=(
                "# instruction:\n"
                f"{self._prompt}\n"
                "# expected_output:\n"
                f"{expected_output.get('message')}\n\n"
                "# actual_output:\n"
                f"{actual_output.get('message')}\n\n"
                "# formato de resposta\n"
                '{\n\t"score": 0.5,\n\t"response": "<your-analisys-result>"}\n'
            )
        )

    def _extract_text_from_content(self, content: str | list | dict | None) -> str:
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

    def _process_judge_output(self, data: BaseMessage):
        # Use EvalMiscServices.extract_text_from_content if centralized, otherwise self._extract_text_from_content
        data_content = getattr(data, "content", None)

        # If data.content is already a dict-like with score/response, return it directly
        if isinstance(data_content, dict):
            if "score" in data_content and "response" in data_content:
                return data_content

        data_text = self._extract_text_from_content(data_content)

        if not data_text:
            # Fallback: maybe `data` itself is serializable to dict/json-like string
            try:
                # Try if data has dict-like attributes (langchain messages may)
                data_dict = data.__dict__ if hasattr(data, "__dict__") else None
                if isinstance(data_dict, dict) and "content" in data_dict:
                    # attempt to parse
                    parsed = data_dict.get("content")
                    if isinstance(parsed, dict) and "score" in parsed and "response" in parsed:
                        return parsed
            except Exception:
                pass

            raise TypeError("Invalid message.")

        # Try parse as JSON (normal case)
        try:
            return json.loads(data_text)
        except json.JSONDecodeError:
            # try to extract a JSON substring inside text (e.g., wrapped in markdown)
            import re

            m = re.search(r"\\{.*\\}", data_text, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group(0))
                except Exception:
                    pass

            # Fallback: return a dict with response text so the caller can still use it
            return {"response": data_text}

    @override
    def run(
        self,
        eval_case: EvalCase,
        flow_output: RunResponse,
        trace=None,
    ) -> AlgorithmOutput:
        # Extrair o texto da resposta do fluxo
        response_text = self.extract_response_text(flow_output)
        messages = [response_text] if response_text else []

        judge_output = self._invoke_judge(
            expected_output=eval_case.expected_output,
            actual_output={
                "message": messages[0] if len(messages) > 0 else " ",
                "tools": [],
            },
        )

        # Thiago Coelho - TODO: implementar uma validação e tratamento mais adequado
        result = self._process_judge_output(judge_output)

        return {
            "score": result.get("score", -1),
            "message": str(result.get("response", "Error")),
        }
