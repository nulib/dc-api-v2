# ruff: noqa: E501
def prompt_template():
    return """Please answer the question based on the documents provided, and include some details about why the documents might be relevant to the particular question:

Documents:
{context}

Question:
{question}
"""


def document_template(attributes):
    lines = (
        ["Content: {page_content}", "Metadata:"]
        + [f"  {attribute}: {{{attribute}}}" for attribute in attributes]
        + ["Source: {source}"]
    )
    return "\n".join(lines)
