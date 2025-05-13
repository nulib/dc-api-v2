## Introduction

Our mission is to create, acquire, describe, and archive digital objects for long-term preservation, as well as to develop and deploy software that supports the discovery, access, and use of digital resources by members of Northwestern University, scholarly communities, and the public. The API provides access to the rich collections of the Northwestern University Libraries and allows users to explore and discover new resources.

This API provides access to the Library's digital resources to easily integrate the data into your own applications and workflows, regardless of your preferred programming language or framework. In fact, we use the API internally to provide the data and search functionality for our [Digital Collections site](https://dc.library.northwestern.edu). We also publish a command-line interface (CLI) [application](https://github.com/nulib/nuldc) written in Python that provides built-in commands for fetching and querying the API from your terminal. See the code examples below for ways to interact with the API using a variety of programming languages.

Check out the [OpenAPI specification page](./spec.md) for detailed descriptions of each API endpoint with runnable examples.

### Application Programming Interfaces (APIs)

An API allows end users to interact with the data stored in the Digital Collections in a structured and programmatic way, which makes it possible to integrate the data into own applications and workflows. Most programming languages and frameworks provide the scope to send and receive information using HTTP requests. The Northwestern University Libraries Digital Collections API is designed with flexibility in mind and works with a wide range of programming languages and frameworks.

Our API allows developers to access the data in the Digital Collections API by sending HTTP requests and receiving responses in a format that can be parsed and processed by the application. This makes it simple to fetch and process data, reshaping the data if necessary for integration into your application or project. The API also allows developers to authenticate and authorize their requests using standard protocols such as OAuth, but for now this feature is internal (check back for future updates on authentication/authorization!).

### Representational State Transfer (REST)

Working with a REST (Representational State Transfer) API is a common method for interacting with web-based services. RESTful APIs use HTTP requests to POST (create), PUT (update), GET (read), and DELETE data. The API's endpoints are typically organized around resources, with a typical RESTful API endpoint being a URL that represents a specific resource or set of resources. The benefits of using a RESTful API include ease of use, as it can be integrated with many programming languages, and it is easy to understand, as it follows conventions of the HTTP protocol. Additionally, RESTful APIs have a stateless architecture, which means that each request is self-contained and does not depend on the previous request, which can make it easier to build and maintain.

### Example

=== "cURL"

    ```sh title="GET request for a work by identifier"
    curl 'https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090'
    ```

=== "JavaScript"

    ```js title="GET request for a work by identifier"
    let response = await fetch("https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090");

    let data = await response.text();
    console.log(data);
    ```

=== "Ruby"

    ```ruby title="GET request for a work by identifier"
    require 'uri'
    require 'net/http'
    require 'openssl'

    url = URI("https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090")

    http = Net::HTTP.new(url.host, url.port)
    http.use_ssl = true
    http.verify_mode = OpenSSL::SSL::VERIFY_NONE

    request = Net::HTTP::Get.new(url)

    response = http.request(request)
    puts response.read_body
    ```

=== "PowerShell"

    ```powershell title="GET request for a work by identifier"
    $headers = @{}
    $reqUrl = 'https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090'

    $response = Invoke-RestMethod -Uri $reqUrl -Method Get -Headers $headers
    $response | ConvertTo-Json
    ```

=== "Python"

    ```python title="GET request for a work by identifier"
    import http.client

    conn = http.client.HTTPSConnection("api.dc.library.northwestern.edu")

    conn.request("GET", "/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090")
    response = conn.getresponse()
    result = response.read()

    print(result.decode("utf-8"))
    ```

## OpenSearch

We use [OpenSearch](https://opensearch.org) to provide the search functionality behind our API. One of the key advantages of using a tool like OpenSearch is the scope to perform advanced searches using tokenization, custom queries, and aggregations. Tokenization allows for the search engine to break down text into smaller units, or tokens, for more precise searching. This allows users to search for specific words or phrases within the digital collections. Custom queries allow users to create more complex searches using Boolean operators and other advanced search features. Aggregations provide the scope to group results by specific fields, such as by creator or subject, allowing users to quickly filter and analyze large sets of data. With range queries, users can perform searches based on specific numerical or date ranges, such as finding all resources that were created between two specific dates. This is particularly useful when searching large datasets. See the [OpenSearch documentation](https://opensearch.org/docs/latest/) for more information about using OpenSearch's many features.

### Example

=== "cURL"

    ```sh title="range search via POST request:"
    	curl -X 'POST' \
    	'https://api.dc.library.northwestern.edu/api/v2/search' \
    	--header 'Content-Type: application/json' \
    	--data-raw '{
    	"query": {
    		"range": {
    			"modified_date": {
    				"gt": "2023-01-01",
    				"lt": "2023-02-01"
    			}
    		}
    	},
    	"sort": [{"modified_date": "asc" }]
    }'
    ```

=== "JavaScript"

    ```js title="range search via POST request:"
    let headersList = {
    "Content-Type": "application/json"
    }

    let bodyContent = JSON.stringify({
      "query": {
      "range": {
    			"modified_date": {
    				"gt": "2023-01-01",
    				"lt": "2023-02-01"
    			}
    		}
    	},
    		"sort": [{ "modified_date": "asc" }]
    });

    let response = await fetch("https://api.dc.library.northwestern.edu/api/v2/search", {
    	method: "POST",
    	body: bodyContent,
    	headers: headersList
    });

    let data = await response.text();
    console.log(data);
    ```

=== "Ruby"

    ```ruby title="range search via POST request:"
    require 'uri'
    require 'net/http'
    require 'openssl'

    url = URI("https://api.dc.library.northwestern.edu/api/v2/search")

    http = Net::HTTP.new(url.host, url.port)
    http.use_ssl = true
    http.verify_mode = OpenSSL::SSL::VERIFY_NONE

    request = Net::HTTP::Post.new(url)
    request["Content-Type"] = 'application/json'
    request.body = "{\n  \"query\": {\n    \"range\": {\n      \"modified_date\": {\n        \"gt\": \"2023-01-01\",\n        \"lt\": \"2023-02-01\"\n      }\n    }\n  },\n    \"sort\": [{ \"modified_date\": \"asc\" }]\n}"

    response = http.request(request)
    puts response.read_body
    ```

=== "PowerShell"

    ```powershell title="range search via POST request:"
    $headers = @{}
    $headers.Add("Content-Type", "application/json")

    $reqUrl = 'https://api.dc.library.northwestern.edu/api/v2/search'
    $body = '{
    	"query": {
    		"range": {
    			"modified_date": {
    				"gt": "2023-01-01",
    				"lt": "2023-02-01"
    			}
    		}
    	},
    		"sort": [{ "modified_date": "asc" }]
    }'

    $response = Invoke-RestMethod -Uri $reqUrl -Method Post -Headers $headers -ContentType 'application/json' -Body $body
    $response | ConvertTo-Json
    ```

=== "Python"

    ```python title="range search via POST request:"
    import http.client
    import json

    conn = http.client.HTTPSConnection("api.dc.library.northwestern.edu")

    headersList = {
    "Content-Type": "application/json"
    }

    payload = json.dumps({
    	"query": {
    		"range": {
    			"modified_date": {
    				"gt": "2023-01-01",
    				"lt": "2023-02-01"
    			}
    		}
    	},
    		"sort": [{ "modified_date": "asc" }]
    })

    conn.request("POST", "/api/v2/search", payload, headersList)
    response = conn.getresponse()
    result = response.read()

    print(result.decode("utf-8"))
    ```

---

=== "cURL"

    ```sh title="boolean search selecting three fields from results:"
    curl -X POST \
    	'https://api.dc.library.northwestern.edu/api/v2/search' \
    	--header 'Content-Type: application/json' \
    	--data-raw '{
    	"_source": ["id", "title", "date_created"],
    	"query": {
    			"bool": {
    				"must": [
    					{ "term": { "work_type": "Video" } },
    					{ "match": { "all_text": "football" } }
    				]
    			}
    	},
    	"sort": [{ "date_created": "asc" }]
    }'
    ```

=== "JavaScript"

    ```js title="boolean search selecting three fields from results:"
    let headersList = {
    "Content-Type": "application/json"
    }

    let bodyContent = JSON.stringify({
    	"_source": ["id", "title", "date_created"],
    	"query": {
    			"bool": {
    				"must": [
    					{ "term": { "work_type": "Video" } },
    					{ "match": { "all_text": "football" } }
    				]
    			}
    	},
    	"sort": [{ "date_created": "asc" }]
    });

    let response = await fetch("https://api.dc.library.northwestern.edu/api/v2/search", {
    	method: "POST",
    	body: bodyContent,
    	headers: headersList
    });

    let data = await response.text();
    console.log(data);
    ```

=== "Ruby"

    ```ruby title="boolean search selecting three fields from results:"
    require 'uri'
    require 'net/http'
    require 'openssl'

    url = URI("https://api.dc.library.northwestern.edu/api/v2/search")

    http = Net::HTTP.new(url.host, url.port)
    http.use_ssl = true
    http.verify_mode = OpenSSL::SSL::VERIFY_NONE

    request = Net::HTTP::Post.new(url)
    request["Content-Type"] = 'application/json'
    request.body = "{\n  \"_source\": [\"id\", \"title\", \"date_created\"],\n  \"query\": {\n      \"bool\": {\n        \"must\": [\n          { \"term\": { \"work_type\": \"Video\" } },\n          { \"match\": { \"all_text\": \"football\" } }\n        ]\n      }\n  },\n  \"sort\": [{ \"date_created\": \"asc\" }]\n}"

    response = http.request(request)
    puts response.read_body
    ```

=== "PowerShell"

    ```powershell title="boolean search selecting three fields from results:"
    $headers = @{}
    $headers.Add("Content-Type", "application/json")

    $reqUrl = 'https://api.dc.library.northwestern.edu/api/v2/search'
    $body = '{
    	"_source": ["id", "title", "date_created"],
    	"query": {
    			"bool": {
    				"must": [
    					{ "term": { "work_type": "Video" } },
    					{ "match": { "all_text": "football" } }
    				]
    			}
    	},
    	"sort": [{ "date_created": "asc" }]
    }'

    $response = Invoke-RestMethod -Uri $reqUrl -Method Post -Headers $headers -ContentType 'application/json' -Body $body
    $response | ConvertTo-Json
    ```

=== "Python"

    ```python title="boolean search selecting three fields from results:"
    import http.client
    import json

    conn = http.client.HTTPSConnection("api.dc.library.northwestern.edu")

    headersList = {
    "Content-Type": "application/json"
    }

    payload = json.dumps({
    	"_source": ["id", "title", "date_created"],
    	"query": {
    			"bool": {
    				"must": [
    					{ "term": { "work_type": "Video" } },
    					{ "match": { "all_text": "football" } }
    				]
    			}
    	},
    	"sort": [{ "date_created": "asc" }]
    })

    conn.request("POST", "/api/v2/search", payload, headersList)
    response = conn.getresponse()
    result = response.read()

    print(result.decode("utf-8"))
    ```

## International Image Interoperability Framework (IIIF)

[IIIF](<[https://iiif.io](https://iiif.io/)>) is a set of open standards for delivering digital objects in a standardized and interoperable way.

The `?as=iiif` parameter in the API allows users to retrieve resources as IIIF manifests. IIIF manifests allow developers to create user-friendly and interactive front-end interfaces that allows users to easily navigate and explore digital collections. A manifest contains descriptive metadata about a work or a collection as well as information about the structure including related works or file sets. This information can be used to create an intuitive and engaging user interface that allows users to easily explore and interact with the data.

Additionally, IIIF manifests provide a rich set of metadata that can be used to improve the user experience, such as captions, translations, and descriptions. This metadata can be displayed in the front-end interface to provide users with more context and information about the images they are viewing.

One of the primary benefits of using IIIF is the scope to easily access and manipulate images and other multimedia resources solely making HTTP requests. The IIIF specification makes allowances for cropping, rotation, and zooming in a standardized way. This allows users to easily access, manipulate, and display images in a consistent way across different applications that implement the specification.

### Example

=== "cURL"

    ```sh title="request the IIIF representation of a work"
    curl 'https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090?as=iiif'
    ```

=== "JavaScript"

    ```js title="request the IIIF representation of a work"
    let response = await fetch("https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090?as=iiif");

    let data = await response.text();
    console.log(data);
    ```

=== "Ruby"

    ```ruby title="request the IIIF representation of a work"
    require 'uri'
    require 'net/http'
    require 'openssl'

    url = URI("https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090?as=iiif")

    http = Net::HTTP.new(url.host, url.port)
    http.use_ssl = true
    http.verify_mode = OpenSSL::SSL::VERIFY_NONE

    request = Net::HTTP::Get.new(url)

    response = http.request(request)
    puts response.read_body
    ```

=== "PowerShell"

    ```powershell title="request the IIIF representation of a work"
    $headers = @{}
    $reqUrl = 'https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090?as=iiif'

    $response = Invoke-RestMethod -Uri $reqUrl -Method Get -Headers $headers
    $response | ConvertTo-Json
    ```

=== "Python"

    ```python title="request the IIIF representation of a work"
    import http.client

    conn = http.client.HTTPSConnection("api.dc.library.northwestern.edu")

    conn.request("GET", "/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090?as=iiif")
    response = conn.getresponse()
    result = response.read()

    print(result.decode("utf-8"))
    ```

## Image Thumbnails

Thumbnail images for collections and works are accessible by adding `/thumbnail` to a get request for a work or a collection. For example, [https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090/thumbnail](https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090/thumbnail) will return an image constrained to `300px` for the longest dimension (height or width). Modify the request with either or both optional parameters: `size` and `aspect`. So, if you want the same thumbnail as a `200px` square then make a request for [https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090/thumbnail?size=200&aspect=square](https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090/thumbnail?size=200&aspect=square). The maximum value for the `size` parameter is `300px`.
