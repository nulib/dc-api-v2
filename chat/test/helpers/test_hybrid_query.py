import sys
from helpers.hybrid_query import hybrid_query
from unittest import TestCase

sys.path.append('./src')

class TestFunction(TestCase):
    def test_hybrid_query(self):
        subquery = { "term": { "title": { "value": "The Title" } } }
        dsl = hybrid_query("Question?", "MODEL_ID", k=10, subquery=subquery)
        subject = dsl["query"]["hybrid"]["queries"]

        checks = [
          (lambda x: x["query_string"]["query"], "Question?"),
          (lambda x: x["neural"]["embedding"]["model_id"], "MODEL_ID"),
          (lambda x: x["term"]["title"]["value"], "The Title")
        ]

        self.assertEqual(len(subject), 3)

        for i in range(3):
          lookup, expected = checks[i]
          queries = subject[i]["bool"]["must"]
          self.assertEqual(lookup(queries[0]), expected)
          self.assertIn({ "terms": { "visibility": ["Public", "Institution"] } }, queries)
          self.assertIn({ "term": { "published": True } }, queries)