from search.hybrid_query import hybrid_query, filter

class TestFunction:
    def test_hybrid_query(self):
        dsl = hybrid_query("Question?", "MODEL_ID", k=10)
        subject = dsl["query"]["hybrid"]["queries"]

        assert len(subject) == 2

        queries_first = subject[0]["bool"]["must"]
        assert queries_first[0]["query_string"]["query"] == "Question?"
        assert {"terms": {"visibility": ["Public", "Institution"]}} in queries_first
        assert {"term": {"published": True}} in queries_first

        queries_second = subject[1]["bool"]["must"]
        assert queries_second[0]["neural"]["embedding"]["model_id"] == "MODEL_ID"
        assert {"terms": {"visibility": ["Public", "Institution"]}} in queries_second
        assert {"term": {"published": True}} in queries_second

    def test_filter(self):
        dummy_query = {"match": {"title": "Hello World"}}
        result = filter(dummy_query)
        assert "bool" in result
        assert "must" in result["bool"]
        must_clause = result["bool"]["must"]
        assert must_clause[0] == dummy_query
        assert {"terms": {"visibility": ["Public", "Institution"]}} in must_clause
        assert {"term": {"published": True}} in must_clause