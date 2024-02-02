from typing import List, Optional


def prompt_template() -> str:
    return """Please answer the question based on the documents provided, and include some details about why the documents might be relevant to the particular question:

Documents:
{context}

Question:
{question}
"""


def document_template(attributes: Optional[List[str]] = None) -> str:
    if attributes is None:
        attributes = []
    lines = (
        ["Content: {page_content}", "Metadata:"]
        + [f"  {attribute}: {{{attribute}}}" for attribute in attributes]
        + ["Source: {source}"]
    )
    return "\n".join(lines)
