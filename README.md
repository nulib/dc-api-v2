# dc-api-v2

## Directory structure

```
src/
 api/ - code that directly supports API requests
  request/ - code to wrap/transform/modify incoming queries
  response/ - code to transform OpenSearch responses into the proper result format
   iiif/ - iiif formatted response transformers
   opensearch/ - opensearch formatted response transformers
   oai-pmh/ - oai-pmh formatted response transformers
 aws/ - lower-level code to interact with AWS resources and OpenSearch
 handlers/ - minimal code required to bridge between API Gateway request and core logic
```
