import boto3
import json
import os
import setup
import tiktoken
from helpers.apitoken import ApiToken
from helpers.prompts import document_template, prompt_template
from langchain.callbacks.base import BaseCallbackHandler
from langchain.chains.qa_with_sources import load_qa_with_sources_chain
from langchain.prompts import PromptTemplate
from openai.error import InvalidRequestError

DEFAULT_INDEX = "DCWork"
DEFAULT_KEY = "title"
DEFAULT_K = 10
MAX_K = 100


class Websocket:
    def __init__(self, endpoint_url, connection_id, ref):
        self.client = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint_url)
        self.connection_id = connection_id
        self.ref = ref

    def send(self, data):
        data["ref"] = self.ref
        data_as_bytes = bytes(json.dumps(data), "utf-8")
        self.client.post_to_connection(
            Data=data_as_bytes, ConnectionId=self.connection_id
        )


class StreamingSocketCallbackHandler(BaseCallbackHandler):
    def __init__(self, socket: Websocket, debug_mode: bool):
        self.socket = socket
        self.debug_mode = debug_mode

    def on_llm_new_token(self, token: str, **kwargs):
        if not self.debug_mode:
            self.socket.send({"token": token})


def handler(event, context):
    try:
        payload = json.loads(event.get("body", "{}"))

        request_context = event.get("requestContext", {})
        connection_id = request_context.get("connectionId")
        endpoint_url = f'https://{request_context.get("domainName")}/{request_context.get("stage")}'
        ref = payload.get("ref")
        socket = Websocket(
            connection_id=connection_id, endpoint_url=endpoint_url, ref=ref
        )

        api_token = ApiToken(signed_token=payload.get("auth"))
        if not api_token.is_logged_in():
            socket.send({"statusCode": 401, "body": "Unauthorized"})
            return {"statusCode": 401, "body": "Unauthorized"}

        debug_mode = payload.get("debug", False) and api_token.is_superuser()

        question = payload.get("question")
        index_name = payload.get("index", payload.get("index", DEFAULT_INDEX))
        print(f"Searching index {index_name}")
        text_key = payload.get("text_key", DEFAULT_KEY)
        attributes = [
            item
            for item in get_attributes(
                index_name, payload if api_token.is_superuser() else {}
            )
            if item not in [text_key, "source"]
        ]

        weaviate = setup.weaviate_vector_store(
            index_name=index_name, text_key=text_key, attributes=attributes + ["source"]
        )

        client = setup.openai_chat_client(
            callbacks=[StreamingSocketCallbackHandler(socket, debug_mode)],
            streaming=True,
        )

        prompt_text = (
            payload.get("prompt", prompt_template())
            if api_token.is_superuser()
            else prompt_template()
        )
        prompt = PromptTemplate(
            template=prompt_text, input_variables=["question", "context"]
        )

        document_prompt = PromptTemplate(
            template=document_template(attributes),
            input_variables=["page_content", "source"] + attributes,
        )

        k = min(payload.get("k", DEFAULT_K), MAX_K)
        docs = weaviate.similarity_search(question, k=k, additional="certainty")
        chain = load_qa_with_sources_chain(
            client,
            chain_type="stuff",
            prompt=prompt,
            document_prompt=document_prompt,
            document_variable_name="context",
            verbose=to_bool(os.getenv("VERBOSE")),
        )

        try:
            doc_response = [doc.__dict__ for doc in docs]
            original_question = {"question": question, "source_documents": doc_response}
            socket.send(original_question)
            response = chain({"question": question, "input_documents": docs})
            if debug_mode:
                final_response = {
                    "answer": response["output_text"],
                    "attributes": attributes,
                    "isSuperuser": api_token.is_superuser(),
                    "prompt": prompt_text,
                    "ref": ref,
                    "k": k,
                    "original_question": original_question,
                    "token_counts": {
                        "question": count_tokens(question),
                        "answer": count_tokens(response["output_text"]),
                        "prompt": count_tokens(prompt_text),
                        "source_documents": count_tokens(doc_response),
                    },
                }
            else:
                final_response = {"answer": response["output_text"], "ref": ref}
        except InvalidRequestError as err:
            final_response = {
                "question": question,
                "error": str(err),
                "source_documents": [],
            }

        socket.send(final_response)
        return {"statusCode": 200}
    except Exception as err:
        print(event)
        raise err


def get_attributes(index, payload):
    request_attributes = payload.get("attributes", None)
    if request_attributes is not None:
        return request_attributes

    client = setup.weaviate_client()
    schema = client.schema.get(index)
    names = [prop["name"] for prop in schema.get("properties")]
    print(f"Retrieved attributes: {names}")
    return names


def count_tokens(val):
    encoding = tiktoken.encoding_for_model("gpt-4")
    token_integers = encoding.encode(str(val))
    num_tokens = len(token_integers)

    return num_tokens


def to_bool(val):
    if isinstance(val, str):
        return val.lower() not in ["", "no", "false", "0"]
    return bool(val)
