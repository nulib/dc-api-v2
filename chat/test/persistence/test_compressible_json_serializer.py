# ruff: noqa: E402
import sys

sys.path.append("./src")

from unittest import TestCase

from langchain_core.messages import HumanMessage
from persistence.compressible_json_serializer import CompressibleJsonSerializer
import warnings

warnings.simplefilter("ignore", DeprecationWarning)


class TestCompressibleJsonSerializer(TestCase):
    def test_dumps_typed(self):
        serializer = CompressibleJsonSerializer()
        obj = {"key": "value"}
        data = serializer.dumps_typed(obj)
        self.assertEqual(data, ("json", '{"key": "value"}'))

    def test_loads_typed(self):
        serializer = CompressibleJsonSerializer()
        data = ("json", '{"key": "value"}')
        obj = serializer.loads_typed(data)
        self.assertEqual(obj, {"key": "value"})

    def test_dumps_typed_with_bz2_compression(self):
        serializer = CompressibleJsonSerializer(compression="bz2")
        obj = {"key": "value"}
        data = serializer.dumps_typed(obj)
        self.assertEqual(data[0], "bz2_json")

    def test_loads_typed_with_bz2_compression(self):
        serializer = CompressibleJsonSerializer(compression="bz2")
        data = (
            "bz2_json",
            "QlpoOTFBWSZTWYByjU0AAAcZgFAAABAiDAMqIAAim0BkEDQNAFPUpFyhWjhdyRThQkIByjU0",
        )
        obj = serializer.loads_typed(data)
        self.assertEqual(obj, {"key": "value"})

    def test_dumps_typed_with_gzip_compression(self):
        serializer = CompressibleJsonSerializer(compression="gzip")
        obj = {"key": "value"}
        data = serializer.dumps_typed(obj)
        self.assertEqual(data[0], "gzip_json")

    def test_loads_typed_with_gzip_compression(self):
        serializer = CompressibleJsonSerializer(compression="gzip")
        data = ("gzip_json", "H4sIALfEW2cC/6tWyk6tVLJSUCpLzClNVaoFABtINTMQAAAA")
        obj = serializer.loads_typed(data)
        self.assertEqual(obj, {"key": "value"})

    def test_nested_complex_object(self):
        serializer = CompressibleJsonSerializer(compression="gzip")
        data = (
            "gzip_json",
            "H4sIAGwoW2cC/2WQMW/CMBCF/0rktU1lpyGELAxdunTrViHrjC8Q4Zyj2IEilP/enAtSpUoezv7e3Tu/mziLJlPPmYhhKUQhizJXxXI+Vd2oqlHFy6belFI+SdlIKRZlZ1mpsDW1WR\
W5WRuTVxWa3LRtm5dQlXVRrlZr+8rq/RGI0OkzuAnZ4ya0DhHGqHW69RgCHBL6YhavAyYk3qce6OMX8ygLEVLL3lNEiqx5A8qufsoCwrg/Zq0fs4sfTyED46e43H004NyW+8HaLnaewOnTBcZD2mZewIhh8BRQ9xjh4c\
KAd2GXI2/CIwh6fqDJuUcS9xq/oR8cwxZcwHnezfPf7+MYFuv/AShWPagOiHSXdDRM94zSpAHJdnRYJGRTWLv5B3RajDe+AQAA",
        )
        obj = serializer.loads_typed(data)
        self.assertEqual(
            obj,
            {
                "v": 1,
                "ts": "2024-12-12T18:16:12.989400+00:00",
                "id": "1efb8b52-b7bb-66eb-bfff-4a64824557d3",
                "channel_values": {
                    "__start__": {
                        "messages": [
                            HumanMessage(
                                content="Can you search for works about football?",
                                additional_kwargs={},
                                response_metadata={},
                            )
                        ]
                    }
                },
                "channel_versions": {"__start__": 1},
                "versions_seen": {"__input__": {}},
                "pending_sends": [],
            },
        )

    def test_dumps_typed_unsupported_compression(self):
        serializer = CompressibleJsonSerializer(compression="unsupported")
        with self.assertRaises(ValueError) as context:
            serializer.dumps_typed({"key": "value"})

        self.assertIn("Unsupported compression type", str(context.exception))

    def test_loads_typed_unknown_type(self):
        serializer = CompressibleJsonSerializer()
        data = ("unknown_type", "payload")
        with self.assertRaises(ValueError) as context:
            serializer.loads_typed(data)

        self.assertIn("Unknown data type", str(context.exception))

    def test_object_hook_unknown_type(self):
        serializer = CompressibleJsonSerializer()
        invalid_json = '{"__type__": "UnknownType", "data": {}}'
        data = ("json", invalid_json)
        with self.assertRaises(ValueError) as context:
            serializer.loads_typed(data)

        self.assertIn("Unknown type", str(context.exception))

    def test_loads_typed_empty_payload(self):
        from json.decoder import JSONDecodeError

        serializer = CompressibleJsonSerializer()
        data = ("json", "")
        with self.assertRaises(JSONDecodeError):
            serializer.loads_typed(data)

    def test_dumps_typed_base_message(self):
        serializer = CompressibleJsonSerializer()
        # Create a BaseMessage instance (HumanMessage is one)
        message = HumanMessage(content="Hello")
        data_type, data_str = serializer.dumps_typed(message)
        # Verify it returns a JSON string with the correct type and data
        self.assertEqual(data_type, "json")
        # We know that it returns {"__type__": "HumanMessage", "data": {...}}
        # Check if the resulting JSON contains the expected keys
        self.assertIn('"__type__": "HumanMessage"', data_str)
        self.assertIn('"data":', data_str)
        self.assertIn('"content": "Hello"', data_str)

    def test_dumps_typed_type_error(self):
        serializer = CompressibleJsonSerializer()

        # Define a class that is not a BaseMessage
        class NotSerializable:
            pass

        with self.assertRaises(TypeError) as context:
            serializer.dumps_typed(NotSerializable())

        self.assertIn("is not JSON serializable", str(context.exception))
