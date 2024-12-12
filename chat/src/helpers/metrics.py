import tiktoken

def debug_response(config, response, original_question):
    source_urls = [doc["api_link"] for doc in original_question.get("source_documents", [])]

    return {
        "answer": response,
        "attributes": config.attributes,
        "deployment_name": config.deployment_name,
        "is_dev_team": config.api_token.is_dev_team(),
        "is_superuser": config.api_token.is_superuser(),
        "k": config.k,
        "prompt": config.prompt_text,
        "question": config.question,
        "ref": config.ref,
        "size": config.size,
        "source_documents": source_urls,
        "temperature": config.temperature,
        "text_key": config.text_key,
        "token_counts": token_usage(config, response, original_question),
    }

def token_usage(config, response, original_question):
    data = {
        "question": count_tokens(config.question),
        "answer": count_tokens(response),
        "prompt": count_tokens(config.prompt_text),
        "source_documents": count_tokens(original_question["source_documents"]),
    }
    data["total"] = sum(data.values())
    return data


def count_tokens(val):
    encoding = tiktoken.encoding_for_model("gpt-4")
    token_integers = encoding.encode(str(val))
    num_tokens = len(token_integers)

    return num_tokens
