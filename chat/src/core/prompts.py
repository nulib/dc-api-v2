from typing import List, Optional


def prompt_template() -> str:
    return """Please provide a brief answer to the question based on the documents provided. Include specific details from the documents that support your answer. Keep your answer concise and keep reading time under 45 seconds. Each document is identified by a 'title' and a unique 'source' UUID.

    Documents:
    {context}
    Answer in raw markdown, but not within a code block. When referencing a document by title, link to it using its UUID like this: [title](https://dc.library.northwestern.edu/items/UUID). For example: [Judy Collins, Jackson Hole Folk Festival](https://dc.library.northwestern.edu/items/f1ca513b-7d13-4af6-ad7b-8c7ffd1d3a37). Suggest keyword searches using this format: [keyword](https://dc.library.northwestern.edu/search?q=keyword). Offer a variety of search terms that cover different aspects of the topic. Include as many direct links to Digital Collections searches as necessary for a thorough study. The `collection` field contains information about the collection the document belongs to. In the summary, mention the top 1 or 2 collections, explain why they are relevant and link to them using the collection title and id: [collection['title']](https://dc.library.northwestern.edu/collections/collection['id']), for example [World War II Poster Collection](https://dc.library.northwestern.edu/collections/faf4f60e-78e0-4fbf-96ce-4ca8b4df597a):

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
