TOP_PROPERTIES = {
    "abstract": {
        "type": "text",
        "copy_to": ["all_text"],
        "analyzer": "full_analyzer",
        "search_analyzer": "stopword_analyzer",
        "search_quote_analyzer": "full_analyzer",
    },
    "accession_number": {"type": "keyword", "copy_to": ["all_ids"]},
    "all_controlled_labels": {
        "type": "text",
        "analyzer": "full_analyzer",
        "search_analyzer": "stopword_analyzer",
        "search_quote_analyzer": "full_analyzer",
    },
    "all_controlled_terms": {"type": "keyword"},
    "all_ids": {"type": "keyword"},
    "all_text": {
        "type": "text",
        "analyzer": "full_analyzer",
        "search_analyzer": "stopword_analyzer",
        "search_quote_analyzer": "full_analyzer",
    },
    "alternate_title": {
        "type": "text",
        "copy_to": ["all_text"],
        "analyzer": "full_analyzer",
        "search_analyzer": "stopword_analyzer",
        "search_quote_analyzer": "full_analyzer",
    },
    "api_link": {"type": "keyword", "copy_to": ["all_text"]},
    "api_model": {"type": "keyword", "copy_to": ["all_text"]},
    "ark": {"type": "keyword", "copy_to": ["all_ids"]},
    "batch_ids": {"type": "keyword", "copy_to": ["all_ids"]},
    "box_name": {"type": "keyword", "copy_to": ["all_text"]},
    "box_number": {"type": "keyword", "copy_to": ["all_text"]},
    "canonical_link": {"type": "keyword", "copy_to": ["all_text"]},
    "caption": {
        "type": "text",
        "copy_to": ["all_text"],
        "analyzer": "full_analyzer",
        "search_analyzer": "stopword_analyzer",
        "search_quote_analyzer": "full_analyzer",
    },
    "catalog_key": {"type": "keyword", "copy_to": ["all_ids"]},
    "collection": {
        "properties": {
            "description": {
                "type": "text",
                "copy_to": ["all_text"],
                "analyzer": "full_analyzer",
                "search_analyzer": "stopword_analyzer",
                "search_quote_analyzer": "full_analyzer",
            },
            "id": {"type": "keyword", "copy_to": ["all_ids"]},
            "title": {
                "type": "text",
                "fields": {"keyword": {"type": "keyword", "ignore_above": 256}},
                "copy_to": ["all_text"],
                "analyzer": "full_analyzer",
                "search_analyzer": "stopword_analyzer",
                "search_quote_analyzer": "full_analyzer",
            },
        }
    },
    "contributor": {
        "properties": {
            "facet": {"type": "keyword", "copy_to": ["all_text"]},
            "id": {"type": "keyword", "copy_to": ["all_ids"]},
            "label": {
                "type": "keyword",
                "copy_to": [
                    "all_text",
                    "all_controlled_terms",
                    "all_controlled_labels",
                ],
            },
            "label_with_role": {"type": "keyword", "copy_to": ["all_text"]},
            "role": {"type": "keyword", "copy_to": ["all_text"]},
            "variants": {"type": "keyword", "copy_to": ["all_text"]},
        }
    },
    "create_date": {"type": "date_nanos"},
    "creator": {
        "properties": {
            "facet": {"type": "keyword", "copy_to": ["all_text"]},
            "id": {"type": "keyword", "copy_to": ["all_ids"]},
            "label": {
                "type": "keyword",
                "copy_to": [
                    "all_text",
                    "all_controlled_terms",
                    "all_controlled_labels",
                ],
            },
            "variants": {"type": "keyword", "copy_to": ["all_text"]},
        }
    },
    "csv_metadata_update_jobs": {"type": "keyword", "copy_to": ["all_text"]},
    "cultural_context": {
        "type": "text",
        "copy_to": ["all_text"],
        "analyzer": "full_analyzer",
        "search_analyzer": "stopword_analyzer",
        "search_quote_analyzer": "full_analyzer",
    },
    "date_created": {"type": "keyword", "copy_to": ["all_text"]},
    "date_created_edtf": {"type": "keyword"},
    "description": {
        "type": "text",
        "copy_to": ["all_text"],
        "analyzer": "full_analyzer",
        "search_analyzer": "stopword_analyzer",
        "search_quote_analyzer": "full_analyzer",
    },
    "embedding": {
        "type": "knn_vector",
        "dimension": 1024,
        "method": {
            "engine": "lucene",
            "space_type": "cosinesimil",
            "name": "hnsw",
            "parameters": {},
        },
    },
    "embedding_model": {"type": "keyword"},
    "embedding_text_length": {"type": "long"},
    "file_sets": {
        "properties": {
            "accession_number": {"type": "keyword", "copy_to": ["all_ids"]},
            "description": {
                "type": "text",
                "copy_to": ["all_text"],
                "analyzer": "full_analyzer",
                "search_analyzer": "stopword_analyzer",
                "search_quote_analyzer": "full_analyzer",
            },
            "download_url": {"type": "keyword", "copy_to": ["all_text"]},
            "duration": {"type": "float"},
            "height": {"type": "long"},
            "id": {"type": "keyword", "copy_to": ["all_ids"]},
            "label": {"type": "keyword", "copy_to": ["all_text"]},
            "mime_type": {"type": "keyword", "copy_to": ["all_text"]},
            "original_filename": {"type": "keyword", "copy_to": ["all_text"]},
            "poster_offset": {"type": "long"},
            "rank": {"type": "long"},
            "representative_image_url": {"type": "keyword", "copy_to": ["all_text"]},
            "role": {"type": "keyword", "copy_to": ["all_text"]},
            "streaming_url": {"type": "keyword", "copy_to": ["all_text"]},
            "webvtt": {"type": "keyword", "copy_to": ["all_text"]},
            "width": {"type": "long"},
        }
    },
    "folder_name": {"type": "keyword", "copy_to": ["all_text"]},
    "folder_number": {"type": "keyword", "copy_to": ["all_text"]},
    "genre": {
        "properties": {
            "facet": {"type": "keyword", "copy_to": ["all_text"]},
            "id": {"type": "keyword", "copy_to": ["all_ids"]},
            "label": {
                "type": "keyword",
                "copy_to": [
                    "all_text",
                    "all_controlled_terms",
                    "all_controlled_labels",
                ],
            },
            "label_with_role": {"type": "keyword", "copy_to": ["all_text"]},
            "role": {"type": "keyword", "copy_to": ["all_text"]},
            "variants": {"type": "keyword", "copy_to": ["all_text"]},
        }
    },
    "id": {"type": "keyword", "copy_to": ["all_ids"]},
    "identifier": {"type": "keyword", "copy_to": ["all_ids"]},
    "iiif_manifest": {"type": "keyword", "copy_to": ["all_text"]},
    "indexed_at": {"type": "date_nanos"},
    "ingest_project": {
        "properties": {
            "id": {"type": "keyword", "copy_to": ["all_ids"]},
            "title": {"type": "keyword", "copy_to": ["all_text"]},
        }
    },
    "ingest_sheet": {
        "properties": {
            "id": {"type": "keyword", "copy_to": ["all_ids"]},
            "title": {"type": "keyword", "copy_to": ["all_text"]},
        }
    },
    "keywords": {"type": "keyword", "copy_to": ["all_text"]},
    "language": {
        "properties": {
            "facet": {"type": "keyword", "copy_to": ["all_text"]},
            "id": {"type": "keyword", "copy_to": ["all_ids"]},
            "label": {
                "type": "keyword",
                "copy_to": [
                    "all_text",
                    "all_controlled_terms",
                    "all_controlled_labels",
                ],
            },
            "variants": {"type": "keyword", "copy_to": ["all_text"]},
        }
    },
    "legacy_identifier": {"type": "keyword", "copy_to": ["all_ids"]},
    "library_unit": {"type": "keyword", "copy_to": ["all_text"]},
    "license": {
        "properties": {
            "id": {"type": "keyword", "copy_to": ["all_ids"]},
            "label": {"type": "keyword", "copy_to": ["all_text"]},
        }
    },
    "location": {
        "properties": {
            "facet": {"type": "keyword", "copy_to": ["all_text"]},
            "id": {"type": "keyword", "copy_to": ["all_ids"]},
            "label": {
                "type": "keyword",
                "copy_to": [
                    "all_text",
                    "all_controlled_terms",
                    "all_controlled_labels",
                ],
            },
            "variants": {"type": "keyword", "copy_to": ["all_text"]},
        }
    },
    "modified_date": {"type": "date_nanos"},
    "notes": {
        "properties": {
            "note": {"type": "keyword", "copy_to": ["all_text"]},
            "type": {"type": "keyword", "copy_to": ["all_text"]},
        }
    },
    "physical_description_material": {"type": "keyword", "copy_to": ["all_text"]},
    "physical_description_size": {"type": "keyword", "copy_to": ["all_text"]},
    "preservation_level": {"type": "keyword", "copy_to": ["all_text"]},
    "project": {
        "properties": {
            "cycle": {"type": "keyword", "copy_to": ["all_text"]},
            "desc": {"type": "keyword", "copy_to": ["all_text"]},
            "manager": {"type": "keyword", "copy_to": ["all_text"]},
            "name": {"type": "keyword", "copy_to": ["all_text"]},
            "proposer": {"type": "keyword", "copy_to": ["all_text"]},
            "task_number": {"type": "keyword", "copy_to": ["all_text"]},
        }
    },
    "provenance": {"type": "keyword", "copy_to": ["all_text"]},
    "published": {"type": "boolean"},
    "publisher": {"type": "keyword", "copy_to": ["all_text"]},
    "related_material": {"type": "keyword", "copy_to": ["all_text"]},
    "related_url": {
        "properties": {
            "label": {"type": "keyword", "copy_to": ["all_text"]},
            "url": {"type": "keyword", "copy_to": ["all_text"]},
        }
    },
    "representative_file_set": {
        "properties": {
            "aspect_ratio": {"type": "float"},
            "id": {"type": "keyword", "copy_to": ["all_ids"]},
            "url": {"type": "keyword", "copy_to": ["all_text"]},
        }
    },
    "rights_holder": {"type": "keyword", "copy_to": ["all_text"]},
    "rights_statement": {
        "properties": {
            "id": {"type": "keyword", "copy_to": ["all_ids"]},
            "label": {"type": "keyword", "copy_to": ["all_text"]},
        }
    },
    "scope_and_contents": {"type": "keyword", "copy_to": ["all_text"]},
    "series": {"type": "keyword", "copy_to": ["all_text"]},
    "source": {"type": "keyword", "copy_to": ["all_text"]},
    "status": {"type": "keyword", "copy_to": ["all_text"]},
    "style_period": {
        "properties": {
            "facet": {"type": "keyword", "copy_to": ["all_text"]},
            "id": {"type": "keyword", "copy_to": ["all_ids"]},
            "label": {
                "type": "keyword",
                "copy_to": [
                    "all_text",
                    "all_controlled_terms",
                    "all_controlled_labels",
                ],
            },
            "variants": {"type": "keyword", "copy_to": ["all_text"]},
        }
    },
    "subject": {
        "properties": {
            "facet": {"type": "keyword", "copy_to": ["all_text"]},
            "id": {"type": "keyword", "copy_to": ["all_ids"]},
            "label": {"type": "keyword", "copy_to": ["all_text"]},
            "label_with_role": {"type": "keyword", "copy_to": ["all_text"]},
            "role": {"type": "keyword", "copy_to": ["all_text"]},
            "variants": {"type": "keyword", "copy_to": ["all_text"]},
        }
    },
    "table_of_contents": {
        "type": "text",
        "copy_to": ["all_text"],
        "analyzer": "full_analyzer",
        "search_analyzer": "stopword_analyzer",
        "search_quote_analyzer": "full_analyzer",
    },
    "technique": {
        "properties": {
            "facet": {"type": "keyword", "copy_to": ["all_text"]},
            "id": {"type": "keyword", "copy_to": ["all_ids"]},
            "label": {
                "type": "keyword",
                "copy_to": [
                    "all_text",
                    "all_controlled_terms",
                    "all_controlled_labels",
                ],
            },
            "variants": {"type": "keyword", "copy_to": ["all_text"]},
        }
    },
    "terms_of_use": {"type": "keyword", "copy_to": ["all_text"]},
    "thumbnail": {"type": "keyword", "copy_to": ["all_text"]},
    "title": {
        "type": "text",
        "fields": {"keyword": {"type": "keyword", "ignore_above": 256}},
        "copy_to": ["all_text"],
        "analyzer": "full_analyzer",
        "search_analyzer": "stopword_analyzer",
        "search_quote_analyzer": "full_analyzer",
    },
    "visibility": {"type": "keyword", "copy_to": ["all_text"]},
    "work_type": {"type": "keyword", "copy_to": ["all_text"]},
}
