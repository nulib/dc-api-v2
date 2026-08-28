## Introduction

The Open Archives Initiative Protocol for Metadata Harvesting (OAI-PMH) is a protocol that enables the harvesting of metadata descriptions of records in a repository. The Digital Collections API is an OAI-PMH `Data Provider`, which means structured metadata is exposed according to the [OAI-PMH specification](http://www.openarchives.org/OAI/openarchivesprotocol.html). OAI-PMH is a set of verbs or services that are invoked using the HTTP protocol. The OAI-PMH endpoint is available at `https://api.dc.library.northwestern.edu/api/v2/oai`.

Please see the [OpenAPI specification page](./spec.md) for more information about making requests using each OAI-PMH verb, including parameters and examples.

## Verbs

All six verbs are supported:

- `GetRecord`: Retrieves metadata records from a repository.
- `Identify`: Provides information about the repository and its policies.
- `ListIdentifiers`: Returns a list of headers for records, without the actual metadata records.
- `ListMetadataFormats`: Lists the metadata formats supported by the repository.
- `ListRecords`: Returns a list of records, along with metadata records.
- `ListSets`: Lists the sets or collections available in the repository.

## Metadata Formats

Two metadata formats are supported via the `metadataPrefix` parameter:

- `oai_dc`: [Dublin Core](http://www.openarchives.org/OAI/2.0/oai_dc.xsd), the format required by the OAI-PMH specification.
- `mods`: [MODS v3.7](http://www.loc.gov/standards/mods/v3/mods-3-7.xsd), which provides richer metadata, including names with authority URIs and roles, typed subjects, rights statement URIs, and links to the item and its thumbnail.

For example: `?verb=GetRecord&identifier=<id>&metadataPrefix=mods`
