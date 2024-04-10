from helpers.metrics import token_usage
from openai.error import InvalidRequestError

def debug_response(config, response, original_question):
    return {
        "answer": response["output_text"],
        "attributes": config.attributes,
        "azure_endpoint": config.azure_endpoint,
        "deployment_name": config.deployment_name,
        "is_superuser": config.api_token.is_superuser(),
        "k": config.k,
        "openai_api_version": config.openai_api_version,
        "prompt": config.prompt_text,
        "question": config.question,
        "ref": config.ref,
        "temperature": config.temperature,
        "text_key": config.text_key,
        "token_counts": token_usage(config, response, original_question),
    }

def get_and_send_original_question(config, docs):
    doc_response = []
    for doc in docs:
        doc_dict = doc.__dict__
        metadata = doc_dict.get('metadata', {})
        new_doc = {key: extract_prompt_value(metadata.get(key)) for key in config.attributes if key in metadata}
        doc_response.append(new_doc)
        
    original_question = {
        "question": config.question,
        "source_documents": doc_response,
    }
    config.socket.send(original_question)
    return original_question

def extract_prompt_value(v):
    if isinstance(v, list):
        return [extract_prompt_value(item) for item in v]
    elif isinstance(v, dict) and 'label' in v:
        return [v.get('label')]
    else:
        return v
    
def prepare_response(config):
    try:
        subquery = {"match": {"all_text": {"query": config.question}}}
        docs = config.opensearch.similarity_search(
            query=config.question, k=config.k, subquery=subquery, _source={"excludes": ["embedding"]}
        )
        original_question = get_and_send_original_question(config, docs)
        response = config.chain({"question": config.question, "input_documents": docs})

        prepared_response = debug_response(config, response, original_question)
    except InvalidRequestError as err:
        prepared_response = {
            "question": config.question,
            "error": str(err),
            "source_documents": [],
        }
    return prepared_response
