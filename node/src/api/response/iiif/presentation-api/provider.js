const nulLogo = {
  id: "https://iiif.dc.library.northwestern.edu/iiif/2/00000000-0000-0000-0000-000000000003/full/pct:50/0/default.webp",
  type: "Image",
  format: "image/webp",
  height: 139,
  width: 1190,
};

const provider = {
  id: "https://www.library.northwestern.edu/",
  type: "Agent",
  label: { none: ["Northwestern University Libraries"] },
  homepage: [
    {
      id: "https://dc.library.northwestern.edu/",
      type: "Text",
      label: {
        none: [
          "Northwestern University Libraries Digital Collections Homepage",
        ],
      },
      format: "text/html",
      language: ["en"],
    },
  ],
  logo: [nulLogo],
};

module.exports = { nulLogo, provider };
