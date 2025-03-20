from unittest import TestCase
from unittest.mock import patch, MagicMock
import json

from agent.tools import discover_fields, search, aggregate, get_keyword_fields
from test.fixtures.opensearch import TOP_PROPERTIES


class TestTools(TestCase):
    @patch('agent.tools.opensearch_vector_store')
    def test_discover_fields(self, mock_opensearch):
        # Mock the OpenSearch response
        mock_client = MagicMock()
        mock_client.indices.get_mapping.return_value = {
            'index_name': {
                'mappings': {
                    'properties': {
                        'field1': {'type': 'keyword'},
                        'field3': {
                            'properties': {
                                'subfield1': {'type': 'keyword'}
                            }
                        }
                    }
                }
            }
        }
        mock_opensearch.return_value.client = mock_client
        
        # Pass required parameters based on the tool's schema
        response = discover_fields.invoke({"query": ""})  # Assuming query is the required parameter
        self.assertEqual(response, ["field1", "field3.subfield1"])

    @patch('agent.tools.opensearch_vector_store')
    def test_search(self, mock_opensearch):
        mock_results = [{"id": "doc1", "text": "example result"}]
        mock_opensearch.return_value.similarity_search.return_value = mock_results
        
        response = search.invoke("test query")
        self.assertEqual(response, mock_results)

    @patch('agent.tools.opensearch_vector_store')
    def test_aggregate(self, mock_opensearch):
        mock_response = json.dumps({
            "aggregations": {
                "example_agg": {
                    "buckets": []
                }
            }
        })
        mock_opensearch.return_value.aggregations_search.return_value = mock_response
        
        # Pass parameters directly instead of as JSON string
        response = aggregate.invoke({
            "agg_field": "field1",
            "term_field": "term_field",
            "term": "term"
        })
        self.assertIsInstance(response, str)
        self.assertEqual(json.loads(response), json.loads(mock_response))

    @patch('agent.tools.opensearch_vector_store')
    def test_aggregate_no_term(self, mock_opensearch):
        mock_response = json.dumps({
            "aggregations": {
                "all_docs": {
                    "buckets": []
                }
            }
        })
        mock_opensearch.return_value.aggregations_search.return_value = mock_response

        response = aggregate.invoke({
            "agg_field": "field1",
            "term_field": "",
            "term": ""
        })
        self.assertIsInstance(response, str)
        self.assertEqual(json.loads(response), json.loads(mock_response))

    def test_get_keyword_fields(self):
        properties = {
            'field1': {'type': 'keyword'},
            'field2': {'type': 'text'},
            'field3': {
                'fields': {
                    'raw': {'type': 'keyword'}
                }
            }
        }
        result = get_keyword_fields(properties)
        self.assertEqual(set(result), {'field1', 'field3.raw'})

    def test_nested_get_keyword_fields(self):
        properties = {
            'field1': {
                'properties': {
                    'nested1': {'type': 'keyword'},
                    'nested2': {'type': 'text'}
                }
            }
        }
        result = get_keyword_fields(properties)
        self.assertEqual(result, ['field1.nested1'])

    def test_complex_mapping_get_keyword_fields(self):
        properties = {
            'field1': {
                'properties': {
                    'nested1': {
                        'type': 'keyword'
                    },
                    'nested2': {
                        'properties': {
                            'subnested1': {'type': 'keyword'}
                        }
                    }
                }
            },
            'field2': {
                'fields': {
                    'raw': {'type': 'keyword'}
                }
            }
        }
        result = get_keyword_fields(properties)
        self.assertEqual(set(result), {'field1.nested1', 'field1.nested2.subnested1', 'field2.raw'})
        
    def test_meadow_mapping_get_keyword_fields(self):
        result = get_keyword_fields(TOP_PROPERTIES)
        expected_result = ['accession_number', 'all_controlled_terms', 'all_ids', 'api_link', 'api_model', 'ark', 'batch_ids', 'box_name', 'box_number', 'canonical_link', 'catalog_key', 'collection.id', 'collection.title.keyword', 'contributor.facet', 'contributor.id', 'contributor.label', 'contributor.label_with_role', 'contributor.role', 'contributor.variants', 'creator.facet', 'creator.id', 'creator.label', 'creator.variants', 'csv_metadata_update_jobs', 'date_created', 'date_created_edtf', 'embedding_model', 'file_sets.accession_number', 'file_sets.download_url', 'file_sets.id', 'file_sets.label', 'file_sets.mime_type', 'file_sets.original_filename', 'file_sets.representative_image_url', 'file_sets.role', 'file_sets.streaming_url', 'file_sets.webvtt', 'folder_name', 'folder_number', 'genre.facet', 'genre.id', 'genre.label', 'genre.label_with_role', 'genre.role', 'genre.variants', 'id', 'identifier', 'iiif_manifest', 'ingest_project.id', 'ingest_project.title', 'ingest_sheet.id', 'ingest_sheet.title', 'keywords', 'language.facet', 'language.id', 'language.label', 'language.variants', 'legacy_identifier', 'library_unit', 'license.id', 'license.label', 'location.facet', 'location.id', 'location.label', 'location.variants', 'notes.note', 'notes.type', 'physical_description_material', 'physical_description_size', 'preservation_level', 'project.cycle', 'project.desc', 'project.manager', 'project.name', 'project.proposer', 'project.task_number', 'provenance', 'publisher', 'related_material', 'related_url.label', 'related_url.url', 'representative_file_set.id', 'representative_file_set.url', 'rights_holder', 'rights_statement.id', 'rights_statement.label', 'scope_and_contents', 'series', 'source', 'status', 'style_period.facet', 'style_period.id', 'style_period.label', 'style_period.variants', 'subject.facet', 'subject.id', 'subject.label', 'subject.label_with_role', 'subject.role', 'subject.variants', 'technique.facet', 'technique.id', 'technique.label', 'technique.variants', 'terms_of_use', 'thumbnail', 'title.keyword', 'visibility', 'work_type']
        self.assertEqual(
            result, 
            expected_result)

    @patch('agent.tools.opensearch_vector_store')
    def test_aggregate_exception(self, mock_opensearch):
        # Configure the mock to raise an exception
        mock_client = MagicMock()
        mock_client.aggregations_search.side_effect = Exception("Test error")
        mock_opensearch.return_value = mock_client
        
        # Call aggregate with some parameters
        response = aggregate.invoke({
            "agg_field": "field1",
            "term_field": "term_field",
            "term": "term"
        })
        
        # Verify the response contains the error message
        self.assertIsInstance(response, str)
        parsed_response = json.loads(response)
        self.assertEqual(parsed_response, {"error": "Test error"})
        
        # Verify the mock was called with expected parameters
        mock_client.aggregations_search.assert_called_once()