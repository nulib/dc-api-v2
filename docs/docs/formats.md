## Introduction

Most resources in this API can be served in more than one representation. A work, for
example, can be returned as the API's own JSON document, as a IIIF Presentation 3.0
manifest, as a PREMIS 3.0 record of the AI provenance of its metadata, or as a C2PA
Manifest Store carrying that record's Content Credentials.

There are two ways to ask for a representation, and they are interchangeable:

- the `as` query parameter — `?as=iiif` — which is convenient in a browser, in a link,
  or anywhere a request is just a URL; and
- the HTTP `Accept` header, which is the standard mechanism and the better fit for a
  client library that already sets headers.

When a request carries both, **`as` wins**. The `Accept` header is only consulted when
no `as` parameter is present.

Responses that were negotiated carry `Vary: Accept`, so a shared cache will keep the
representations apart.

## Formats

| `as` value | Media type | Applies to |
| --- | --- | --- |
| `opensearch` (default) | `application/json` | every resource and search endpoint |
| `iiif` | `application/ld+json` with the IIIF Presentation 3 `profile` | works, collections, file sets, annotations, search |
| `premis` | `application/xml` (or `application/json`, see below) | a single work |
| `c2pa` | `application/c2pa` | a single work |

Omitting `as` — or sending a value the endpoint doesn't recognize — yields the default
JSON representation.

### Default (`as=opensearch`)

The API's own JSON envelope: a `data` member holding the document or list of documents,
an `info` member, and, for search and other list responses, `pagination` and
`aggregations`. This is what you get when you ask for nothing in particular, and it is
the representation every other one is derived from.

```sh title="the default JSON representation of a work"
curl 'https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090'
```

### IIIF (`as=iiif`)

A IIIF Presentation 3.0 resource: a Manifest for a work, a Collection for a collection
or for a set of search results, a Canvas for a file set, and an AnnotationPage for a file
set's annotations. The response is `application/ld+json` with the Presentation 3 context
as its `profile` parameter, so a client that negotiates on the profile gets what it
expects. The IIIF section of the Overview describes what the manifests contain.

On search endpoints, `as=iiif` is only valid for a single model, either `works` or
`collections`; asking for several models at once, or for `file-sets`, returns `400`.

```sh title="IIIF representations"
# a work, as a Manifest
curl 'https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090?as=iiif'

# search results, as a Collection
curl 'https://api.dc.library.northwestern.edu/api/v2/search/works?query=football&as=iiif'
```

### PREMIS (`as=premis`)

A [PREMIS 3.0](https://www.loc.gov/standards/premis/) document describing the AI
provenance of a work's *metadata* — the objects, events, agents, and rights statements
recorded when machine-generated description was applied to the record. The default
response is XML, valid against the Library of Congress schema, and is served as
`application/xml`.

A work that no AI activity has touched is not an error: it returns a document describing
the work with no events, rather than a `404`.

`as=premis` negotiates a second time on `Accept`. Where the request also sends
`Accept: application/json`, the response is the PREMIS-shaped JSON projection as indexed,
in the usual `data`/`info` envelope, instead of XML.

```sh title="PREMIS provenance for a work"
# PREMIS 3.0 XML
curl 'https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090?as=premis'

# the same provenance as JSON
curl -H 'Accept: application/json' \
  'https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090?as=premis'
```

### C2PA (`as=c2pa`)

A [C2PA](https://c2pa.org) Manifest Store — Content Credentials — for a work's metadata
record, served as `application/c2pa` with a `Content-Disposition` filename so that
browsers and validators save it under the name they look for.

The manifest is **detached**: JSON has nowhere to embed one, so the manifest is signed on
request and bound to the asset it describes by hash. That asset is the body of the
default work response, *byte for byte*, which means a validator needs both the `.c2pa`
file and the unmodified `?as=opensearch` response to check the credentials. The default
response advertises where to find its manifest in a `Link` header:

```
Link: <https://api.dc.library.northwestern.edu/api/v2/works/{id}?as=c2pa>; rel="c2pa-manifest"
```

and the manifest response points back at the asset with `rel="describes"`.

Two responses are worth planning for. Where signing is not configured in an environment,
`as=c2pa` returns the unsigned manifest *definition* as JSON with `info.c2pa.signed` set
to `false` — a description of what would be signed, not a Content Credential. Where
signing is configured but fails, the response is `503` rather than an unsigned stand-in.

```sh title="fetching and validating Content Credentials"
# the asset: exactly the bytes the manifest is bound to
curl -o work.json \
  'https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090'

# the detached manifest
curl -o work.c2pa \
  'https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090?as=c2pa'
```

## The `Accept` header

Where no `as` parameter is present, the request's `Accept` header selects the format:

| `Accept` contains | Equivalent to |
| --- | --- |
| `application/c2pa` | `as=c2pa` |
| `application/json` | `as=opensearch` |
| `application/ld+json` | `as=iiif` |
| `application/premis+xml` | `as=premis` |

The header is parsed properly: quality values are honored, so
`Accept: application/json;q=0.5, application/ld+json` returns IIIF, and `q=0` refuses a
type outright. A wildcard — `*/*`, or the long header a browser sends — asks for whatever
the endpoint serves by default.

The two mechanisms differ in how strict they are, by design:

- **`as` is an instruction.** Naming a format the endpoint doesn't produce returns
  `406 Not Acceptable`. Every endpoint answers the same way, so `?as=c2pa` on a search is
  a `406` just as it is on a file set — it never falls back silently.
- **`Accept` is a preference.** Where it asks for something the endpoint can't produce —
  `Accept: text/csv`, say — it's disregarded and the default representation is served,
  rather than the request being refused.

The exception to that fallback is an endpoint with no default representation: the two
content-search routes serve IIIF and nothing else, so they answer only a request that
asks for IIIF by name, and a request that states no preference gets a `406`.

Responses from endpoints that negotiate carry `Vary: Accept`, so a shared cache keeps the
representations apart. Endpoints that serve only one thing — thumbnails, downloads, the
auth routes — don't.

=== "cURL"

    ```sh title="request a work's IIIF manifest with an Accept header"
    curl -H 'Accept: application/ld+json' \
      'https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090'
    ```

=== "JavaScript"

    ```js title="request a work's IIIF manifest with an Accept header"
    let response = await fetch(
      "https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090",
      { headers: { Accept: "application/ld+json" } }
    );

    let manifest = await response.json();
    console.log(manifest);
    ```

=== "Ruby"

    ```ruby title="request a work's IIIF manifest with an Accept header"
    require 'uri'
    require 'net/http'

    url = URI("https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090")

    http = Net::HTTP.new(url.host, url.port)
    http.use_ssl = true

    request = Net::HTTP::Get.new(url)
    request["Accept"] = "application/ld+json"

    response = http.request(request)
    puts response.read_body
    ```

=== "PowerShell"

    ```powershell title="request a work's IIIF manifest with an Accept header"
    $headers = @{ 'Accept' = 'application/ld+json' }
    $reqUrl = 'https://api.dc.library.northwestern.edu/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090'

    $response = Invoke-RestMethod -Uri $reqUrl -Method Get -Headers $headers
    $response | ConvertTo-Json
    ```

=== "Python"

    ```python title="request a work's IIIF manifest with an Accept header"
    import http.client

    conn = http.client.HTTPSConnection("api.dc.library.northwestern.edu")

    conn.request(
        "GET",
        "/api/v2/works/9f9a7032-717f-4446-a0c3-193404a4c090",
        headers={"Accept": "application/ld+json"},
    )
    response = conn.getresponse()

    print(response.read().decode("utf-8"))
    ```

## Which formats apply where

| Endpoint | Formats |
| --- | --- |
| `/works/{id}` | default, `iiif`, `premis`, `c2pa` |
| `/works/{id}/search` | `iiif` only — a request without it returns `400` |
| `/collections`, `/collections/{id}` | default, `iiif` |
| `/file-sets/{id}` | default, `iiif` |
| `/file-sets/{id}/annotations`, `/annotations/{id}` | default, `iiif` |
| `/file-sets/{id}/search` | `iiif` only — a request without it returns `400` |
| `/search`, `/search/{models}`, `/works/{id}/similar` | default, `iiif` |

`premis` and `c2pa` describe a single work's metadata record, so they are meaningful only
on `/works/{id}`; elsewhere they result in a `406 Not Acceptable` error response.
