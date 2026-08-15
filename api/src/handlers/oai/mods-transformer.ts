// Transforms a work document into a MODS v3.7 metadata element for the
// OAI-PMH endpoint, implementing the Digital Collections to MODS crosswalk
// (DigitalCollectionstoMODSJuly2026_forOAIPMH.xlsx)

import type {
  ControlledTerm,
  ControlledTermWithRole,
  Work,
  WorkType,
} from "../../dcapi-types.ts";

export const MODS_NAMESPACE = "http://www.loc.gov/mods/v3";
export const MODS_SCHEMA = "http://www.loc.gov/standards/mods/v3/mods-3-7.xsd";

type XmlElement = Record<string, unknown>;

// The helpers below keep their runtime guards even where the Work type makes
// stronger promises, because indexed documents can predate the current schema

function normalizeSpace(value: unknown): string {
  return String(value).replace(/\s+/g, " ").trim();
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function stringItems(value: string | string[] | null | undefined): string[] {
  return asArray(value)
    .filter((item): item is string => typeof item === "string")
    .map(normalizeSpace)
    .filter((item) => item !== "");
}

function termItems<T extends object>(value: T | T[] | null | undefined): T[] {
  return asArray(value).filter(
    (item): item is T =>
      typeof item === "object" && item !== null && !Array.isArray(item),
  );
}

function textElement(value: unknown): XmlElement {
  return { _text: normalizeSpace(value) };
}

function validUri(id: unknown): string | undefined {
  return typeof id === "string" && id !== "" && id !== "null" ? id : undefined;
}

function titleInfo(work: Work): XmlElement[] {
  const result: XmlElement[] = [];
  if (work.title) result.push({ "mods:title": textElement(work.title) });
  for (const title of [
    ...stringItems(work.alternate_title),
    ...stringItems(work.caption),
  ]) {
    result.push({
      _attributes: { type: "alternative" },
      "mods:title": textElement(title),
    });
  }
  return result;
}

function name(
  item: ControlledTerm | ControlledTermWithRole,
  defaultRole: string,
): XmlElement {
  const element: XmlElement = {};
  const valueURI = validUri(item.id);
  if (valueURI) element._attributes = { valueURI };
  const role = ("role" in item && item.role) || defaultRole;
  if (role) {
    element["mods:role"] = {
      "mods:roleTerm": { _attributes: { type: "text" }, _text: role },
    };
  }
  element["mods:namePart"] = textElement(item.label);
  element["mods:displayForm"] = textElement(item.label);
  return element;
}

function names(work: Work): XmlElement[] {
  return [
    ...termItems(work.creator).map((item) => name(item, "Creator")),
    ...termItems(work.contributor).map((item) => name(item, "Contributor")),
  ];
}

const typeOfResourceMap: Record<
  NonNullable<WorkType>,
  { valueURI: string; value: string }
> = {
  Image: {
    valueURI: "https://www.loc.gov/standards/mods/userguide/typeofresource/img",
    value: "still image",
  },
  Video: {
    valueURI: "https://www.loc.gov/standards/mods/userguide/typeofresource/mov",
    value: "moving image",
  },
  Audio: {
    valueURI: "https://www.loc.gov/standards/mods/userguide/typeofresource/aud",
    value: "audio",
  },
};

function typeOfResource(work: Work): XmlElement | undefined {
  const mapped = work.work_type ? typeOfResourceMap[work.work_type] : undefined;
  if (!mapped) return undefined;
  return { _attributes: { valueURI: mapped.valueURI }, _text: mapped.value };
}

function genres(work: Work): XmlElement[] {
  return [...termItems(work.genre), ...termItems(work.technique)].map(
    (item) => {
      const valueURI = validUri(item.id);
      return {
        ...(valueURI && { _attributes: { valueURI } }),
        _text: normalizeSpace(item.label),
      };
    },
  );
}

function originInfo(work: Work): XmlElement | undefined {
  const publishers = stringItems(work.publisher);
  const datesCreated = stringItems(work.date_created);
  if (publishers.length === 0 && datesCreated.length === 0) return undefined;
  return {
    ...(publishers.length > 0 && {
      "mods:publisher": publishers.map(textElement),
    }),
    ...(datesCreated.length > 0 && {
      "mods:dateCreated": datesCreated.map(textElement),
    }),
  };
}

const languageUriPrefix = "http://id.loc.gov/vocabulary/languages/";

function languages(work: Work): XmlElement[] {
  return termItems(work.language).map((item) => {
    const valueURI = validUri(item.id);
    return {
      "mods:languageTerm": [
        {
          _attributes: { type: "text", ...(valueURI && { valueURI }) },
          _text: normalizeSpace(item.label),
        },
        {
          _attributes: {
            type: "code",
            authority: "iso639-2b",
            ...(valueURI && { valueURI }),
          },
          _text: valueURI?.startsWith(languageUriPrefix)
            ? valueURI.slice(languageUriPrefix.length)
            : normalizeSpace(item.id ?? ""),
        },
      ],
    };
  });
}

function physicalDescription(work: Work): XmlElement | undefined {
  const materials = stringItems(work.physical_description_material);
  const sizes = stringItems(work.physical_description_size);
  const extent = [materials.join(", "), sizes.join(", ")]
    .filter((part) => part !== "")
    .join("; ");
  if (extent === "") return undefined;
  return { "mods:extent": { _text: extent } };
}

function notes(work: Work): XmlElement[] {
  const result: XmlElement[] = [];
  for (const item of termItems(work.notes)) {
    if (!item.note || normalizeSpace(item.note) === "") continue;
    result.push({
      _attributes: { displayLabel: item.type ?? "General Note" },
      _text: normalizeSpace(item.note),
    });
  }
  for (const scopeAndContents of stringItems(work.scope_and_contents)) {
    result.push({
      _attributes: { displayLabel: "Scope and Contents" },
      _text: scopeAndContents,
    });
  }
  return result;
}

function fullTextNote(work: Work): XmlElement {
  const strings: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") {
      const normalized = normalizeSpace(value);
      if (normalized !== "") strings.push(normalized);
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (typeof value === "object" && value !== null) {
      Object.values(value).forEach(walk);
    }
  };
  walk(work);
  return {
    _attributes: { type: "for indexing only" },
    _text: strings.join("  "),
  };
}

function accessConditions(work: Work): XmlElement[] {
  const result: XmlElement[] = [];
  const rightsStatement = work.rights_statement;
  if (rightsStatement?.label) {
    const href = validUri(rightsStatement.id);
    result.push({
      _attributes: { type: "rights", ...(href && { "xlink:href": href }) },
      _text: normalizeSpace(rightsStatement.label),
    });
  }
  for (const termsOfUse of stringItems(work.terms_of_use)) {
    result.push({
      _attributes: { type: "useAndReproduction" },
      _text: termsOfUse,
    });
  }
  return result;
}

const subjectElementForRole: Record<string, string> = {
  Topical: "mods:topic",
  Temporal: "mods:temporal",
  Geographical: "mods:geographic",
};

function subjects(work: Work): XmlElement[] {
  const result: XmlElement[] = [];
  for (const item of termItems(work.subject)) {
    const childName = subjectElementForRole[item.role] ?? "mods:topic";
    const valueURI = validUri(item.id);
    result.push({
      ...(valueURI && { _attributes: { valueURI } }),
      [childName]: textElement(item.label),
    });
  }
  for (const item of termItems(work.style_period)) {
    const valueURI = validUri(item.id);
    result.push({
      ...(valueURI && { _attributes: { valueURI } }),
      "mods:topic": textElement(item.label),
    });
  }
  return result;
}

function identifiers(work: Work): XmlElement[] {
  const result: XmlElement[] = stringItems(work.identifier).map((item) => ({
    _attributes: { type: "local" },
    _text: item,
  }));
  result.push({
    _attributes: { displayLabel: "PID", type: "local" },
    _text: work.id,
  });
  return result;
}

function locations(work: Work): XmlElement[] {
  const urls: XmlElement[] = [
    {
      _attributes: {
        displayLabel: "Digitized Image",
        access: "object in context",
        ...(work.visibility === "Institution" && { note: "netID" }),
      },
      _text: `https://dc.library.northwestern.edu/items/${work.id}`,
    },
  ];
  const representativeFileSet = work.representative_file_set;
  if (representativeFileSet?.url) {
    urls.push({
      _attributes: { displayLabel: "Thumbnail", note: "thumbnail" },
      _text: `${representativeFileSet.url}/square/100,100/0/default.jpg`,
    });
  }
  const result: XmlElement[] = [{ "mods:url": urls }];

  const localIdentifiers = stringItems(work.identifier);
  if (work.library_unit || localIdentifiers.length > 0) {
    const physicalLocation: XmlElement = {};
    if (work.library_unit)
      physicalLocation["mods:physicalLocation"] = textElement(
        work.library_unit,
      );
    if (localIdentifiers.length > 0)
      physicalLocation["mods:shelfLocator"] = { _text: localIdentifiers[0] };
    result.push(physicalLocation);
  }
  return result;
}

function recordInfo(work: Work): XmlElement {
  return {
    "mods:recordOrigin": {
      _text: "Northwestern University Libraries Digital Collections API",
    },
    "mods:recordContentSource": {
      _attributes: { authority: "marcorg" },
      _text: "IEN",
    },
    "mods:recordCreationDate": {
      _attributes: { encoding: "marc" },
      _text: work.create_date,
    },
    "mods:recordIdentifier": {
      _attributes: { source: "IEN" },
      _text: work.id,
    },
    "mods:languageOfCataloging": {
      "mods:languageTerm": {
        _attributes: { authority: "iso639-2b", type: "code" },
        _text: "eng",
      },
    },
    "mods:recordInfoNote": { _text: "item" },
  };
}

function relatedItems(work: Work): XmlElement[] {
  const result: XmlElement[] = [];

  const collection = work.collection;
  if (collection?.title) {
    result.push({
      _attributes: { type: "host", displayLabel: "Collection" },
      "mods:titleInfo": { "mods:title": textElement(collection.title) },
      "mods:identifier": {
        _attributes: { displayLabel: "Collection PID", type: "local" },
        _text: collection.id,
      },
    });
  }

  for (const series of stringItems(work.series)) {
    result.push({
      _attributes: { type: "series" },
      "mods:titleInfo": { "mods:title": { _text: series } },
    });
  }

  for (const relatedUrl of termItems(work.related_url)) {
    if (!relatedUrl.url) continue;
    result.push({
      _attributes: {
        otherType: "Related URL",
        ...(relatedUrl.label && { displayLabel: relatedUrl.label }),
      },
      "mods:location": { "mods:url": textElement(relatedUrl.url) },
    });
  }

  for (const relatedMaterial of stringItems(work.related_material)) {
    result.push({
      _attributes: {
        otherType: "Related Material",
        displayLabel: "Related Material",
      },
      "mods:titleInfo": { "mods:title": { _text: relatedMaterial } },
    });
  }

  for (const source of stringItems(work.source)) {
    result.push({
      _attributes: { type: "original", displayLabel: "Source" },
      "mods:titleInfo": { "mods:title": { _text: source } },
    });
  }

  result.push({
    _attributes: { type: "host", otherType: "sourceSystem" },
    "mods:titleInfo": {
      "mods:title": { _text: "Digital Collections Images Repository" },
    },
  });

  return result;
}

export function modsTransform(work: Work): Record<string, unknown> {
  const mods: XmlElement = {
    _attributes: {
      "xmlns:mods": MODS_NAMESPACE,
      "xmlns:xlink": "http://www.w3.org/1999/xlink",
      "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "xsi:schemaLocation": `${MODS_NAMESPACE} ${MODS_SCHEMA}`,
      version: "3.7",
    },
  };

  const addIfPresent = (
    elementName: string,
    value: XmlElement | XmlElement[] | undefined,
  ): void => {
    if (value === undefined) return;
    if (Array.isArray(value) && value.length === 0) return;
    mods[elementName] = value;
  };

  addIfPresent("mods:titleInfo", titleInfo(work));
  addIfPresent("mods:name", names(work));
  addIfPresent("mods:typeOfResource", typeOfResource(work));
  addIfPresent("mods:genre", genres(work));
  addIfPresent("mods:originInfo", originInfo(work));
  addIfPresent("mods:language", languages(work));
  addIfPresent("mods:physicalDescription", physicalDescription(work));
  addIfPresent("mods:abstract", [
    ...stringItems(work.description).map(textElement),
    ...stringItems(work.abstract).map(textElement),
  ]);
  addIfPresent(
    "mods:tableOfContents",
    stringItems(work.table_of_contents).map(textElement),
  );
  addIfPresent("mods:note", [...notes(work), fullTextNote(work)]);
  addIfPresent("mods:accessCondition", accessConditions(work));
  addIfPresent("mods:subject", subjects(work));
  addIfPresent("mods:identifier", identifiers(work));
  addIfPresent("mods:location", locations(work));
  addIfPresent("mods:recordInfo", recordInfo(work));
  addIfPresent("mods:relatedItem", relatedItems(work));

  return { "mods:mods": mods };
}
