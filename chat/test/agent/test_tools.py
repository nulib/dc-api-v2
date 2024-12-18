from unittest import TestCase
from unittest.mock import patch
import sys

sys.path.append('./src')

from agent.tools import get_keyword_fields, discover_fields, search, aggregate
from test.fixtures.opensearch import TOP_PROPERTIES

class TestTools(TestCase):
    def test_get_keyword_fields(self):
        properties = {
            "field1": {"type": "keyword"},
            "field2": {"type": "text"},
            "field3": {
                "type": "object",
                "properties": {
                    "subfield1": {"type": "keyword"},
                    "subfield2": {"type": "text"}
                }
            }
        }
        result = get_keyword_fields(properties)
        self.assertEqual(result, ["field1", "field3.subfield1"])
    
    def test_nested_get_keyword_fields(self):
        properties = {
            "field1": {"type": "keyword"},
            "field2": {"type": "text"},
            "field3": {
                "type": "object",
                "properties": {
                    "subfield1": {"type": "keyword"},
                    "subfield2": {"type": "text"},
                    "subfield3": {
                        "type": "object",
                        "properties": {
                            "subsubfield1": {"type": "keyword"},
                            "subsubfield2": {"type": "text"}
                        }
                    }
                }
            }
        }
        result = get_keyword_fields(properties)
        self.assertEqual(result, ["field1", "field3.subfield1", "field3.subfield3.subsubfield1"])
        
    def test_complex_mapping_get_keyword_fields(self):
        result = get_keyword_fields(TOP_PROPERTIES)
        self.assertEqual(
            result, 
            ['accession_number', 'all_controlled_terms', 'all_ids', 'api_link', 'api_model', 'ark', 'batch_ids', 'box_name', 'box_number', 'canonical_link', 'catalog_key', 'collection.id', 'collection.title.keyword', 'contributor.facet', 'contributor.id', 'contributor.label', 'contributor.label_with_role', 'contributor.role', 'contributor.variants', 'creator.facet', 'creator.id', 'creator.label', 'creator.variants', 'csv_metadata_update_jobs', 'date_created', 'date_created_edtf', 'embedding_model', 'file_sets.accession_number', 'file_sets.download_url', 'file_sets.id', 'file_sets.label', 'file_sets.mime_type', 'file_sets.original_filename', 'file_sets.representative_image_url', 'file_sets.role', 'file_sets.streaming_url', 'file_sets.webvtt', 'folder_name', 'folder_number', 'genre.facet', 'genre.id', 'genre.label', 'genre.label_with_role', 'genre.role', 'genre.variants', 'id', 'identifier', 'iiif_manifest', 'ingest_project.id', 'ingest_project.title', 'ingest_sheet.id', 'ingest_sheet.title', 'keywords', 'language.facet', 'language.id', 'language.label', 'language.variants', 'legacy_identifier', 'library_unit', 'license.id', 'license.label', 'location.facet', 'location.id', 'location.label', 'location.variants', 'notes.note', 'notes.type', 'physical_description_material', 'physical_description_size', 'preservation_level', 'project.cycle', 'project.desc', 'project.manager', 'project.name', 'project.proposer', 'project.task_number', 'provenance', 'publisher', 'related_material', 'related_url.label', 'related_url.url', 'representative_file_set.id', 'representative_file_set.url', 'rights_holder', 'rights_statement.id', 'rights_statement.label', 'scope_and_contents', 'series', 'source', 'status', 'style_period.facet', 'style_period.id', 'style_period.label', 'style_period.variants', 'subject.facet', 'subject.id', 'subject.label', 'subject.label_with_role', 'subject.role', 'subject.variants', 'technique.facet', 'technique.id', 'technique.label', 'technique.variants', 'terms_of_use', 'thumbnail', 'title.keyword', 'visibility', 'work_type'])