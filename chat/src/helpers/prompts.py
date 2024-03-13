from typing import List, Optional


def prompt_template() -> str:
    return """Please answer the question based on the documents provided, and include some details about why the documents might be relevant to the particular question. The 'title' field is the document title, and the 'source' field is a UUID that uniquely identifies each document:

Documents:
{context}
Format the answer as raw markdown. Insert links when referencing documents by title using it's UUID, as in the following guide: [title](https://dc.library.northwestern.edu/items/UUID). Example: [Judy Collins, Jackson Hole Folk Festival](https://dc.library.northwestern.edu/items/f1ca513b-7d13-4af6-ad7b-8c7ffd1d3a37). Suggest keywords searches using the following guide (example: [jazz musicians](https://dc.library.northwestern.edu/search?q=Jazz+musicians)). Offer search terms that vary in scope, highlight specific individuals or groups, or delve deeper into a topic. Remember to include as many direct links to Digital Collections searches as needed for comprehensive study. The `collection` field contains information about the collection the document belongs to. When many of the documents are from the same collection, mention the collection and link to the collection using the collection title and id: [collection['title']](https://dc.library.northwestern.edu/collections/collection['id']), for example [World War II Poster Collection](https://dc.library.northwestern.edu/collections/faf4f60e-78e0-4fbf-96ce-4ca8b4df597a):

Question:
{question}
"""


def document_template(attributes: Optional[List[str]] = None) -> str:
    if attributes is None:
        attributes = []
    lines = (
        ["Content: {title}", "Metadata:"]
        + [f"  {attribute}: {{{attribute}}}" for attribute in attributes]
        + ["Source: {id}"]
    )
    return "\n".join(lines)
