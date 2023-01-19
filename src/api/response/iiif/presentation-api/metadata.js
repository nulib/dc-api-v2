/** Build manifest metadata */
function formatSingleValuedField(value) {
  return value ? [value] : [];
}

function metadataLabelFields(source) {
  return [
    {
      label: "Alternate Title",
      value: source.alternate_title,
    },
    {
      label: "Abstract",
      value: source.abstract,
    },
    {
      label: "Caption",
      value: source.caption,
    },
    {
      label: "Contributor",
      value: source.contributor.map((item) => item.label_with_role),
    },
    {
      label: "Creator",
      value: source.creator.map((item) => item.label),
    },
    {
      label: "Cultural Context",
      value: source.cultural_context,
    },
    {
      label: "Date",
      value: source.date_created,
    },
    {
      label: "Department",
      value: formatSingleValuedField(source.library_unit),
    },
    {
      label: "Dimensions",
      value: source.physical_description_size,
    },
    {
      label: "Genre",
      value: source.genre.map((item) => item.label),
    },
    {
      label: "Keyword",
      value: source.keywords,
    },
    {
      label: "Last Modified",
      value: formatSingleValuedField(source.modified_date),
    },
    {
      label: "Language",
      value: source.language.map((item) => item.label),
    },
    {
      label: "Location",
      value: source.location?.map((item) => item.label),
    },
    {
      label: "Materials",
      value: source.physical_description_material,
    },
    {
      label: "Notes",
      value: source.notes.map((item) => `${item.note} (${item.type})`),
    },
    {
      label: "Provenance",
      value: source.provenance,
    },
    {
      label: "Publisher",
      value: source.publisher,
    },
    {
      label: "Related Material",
      value: source.related_material,
    },
    {
      label: "Related URL",
      value: source.related_url.map(
        (item) => `<span><a href=${item.url}>${item.label}</a></span>`
      ),
    },
    {
      label: "Rights Holder",
      value: source.rights_holder,
    },
    {
      label: "Rights Statement",
      value: formatSingleValuedField(source.rights_statement?.label),
    },
    {
      label: "Scope and Contents",
      value: source.scope_and_contents,
    },
    {
      label: "Series",
      value: source.series,
    },
    {
      label: "Source",
      value: source.source,
    },
    {
      label: "Style Period",
      value: source.style_period.map((item) => item.label),
    },
    {
      label: "Subject",
      value: source.subject.map((item) => item.label),
    },
    {
      label: "Table of Contents",
      value: source.table_of_contents,
    },
    {
      label: "Technique",
      value: source.technique.map((item) => item.label),
    },
  ];
}

module.exports = { formatSingleValuedField, metadataLabelFields };
