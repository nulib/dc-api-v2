def minimize_documents(docs):
    return [minimize_document(doc) for doc in docs]


def minimize_document(doc):
    return {
        "id": doc.get("id"),
        "title": minimize(doc.get("title")),
        "alternate_title": minimize(doc.get("alternate_title")),
        "description": minimize(doc.get("description")),
        "abstract": minimize(doc.get("abstract")),
        "subject": labels_only(doc.get("subject")),
        "date_created": minimize(doc.get("date_created")),
        "provenance": minimize(doc.get("provenance")),
        "collection": minimize(doc.get("collection", {}).get("title")),
        "creator": labels_only(doc.get("creator")),
        "contributor": labels_only(doc.get("contributor")),
        "work_type": minimize(doc.get("work_type")),
        "genre": labels_only(doc.get("genre")),
        "scope_and_contents": minimize(doc.get("scope_and_contents")),
        "table_of_contents": minimize(doc.get("table_of_contents")),
        "cultural_context": minimize(doc.get("cultural_context")),
        "notes": minimize(doc.get("notes")),
        "keywords": minimize(doc.get("keywords")),
        "visibility": minimize(doc.get("visibility")),
        "canonical_link": minimize(doc.get("canonical_link")),
        "rights_statement": label_only(doc.get("rights_statement")),
    }


def labels_only(list_of_fields):
    return minimize([label_only(field) for field in list_of_fields])


def label_only(field):
    if field is None:
        return None
    return field.get("label_with_role", field.get("label", None))


def minimize(field):
    try:
        if field is None:
            return None
        if len(field) == 0:
            return None
        return field
    except TypeError:
        return field
