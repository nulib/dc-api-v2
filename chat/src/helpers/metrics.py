import tiktoken


def token_usage(config, response, original_question):
    data = {
        "question": count_tokens(config.question),
        "answer": count_tokens(response["output_text"]),
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
