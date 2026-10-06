import { describe, it, expect } from "bun:test";
import {
  generalizeStaff,
  STAFF_LABEL,
} from "../../../../src/api/response/staff.ts";

describe("generalizeStaff", () => {
  it("credits staff in place of the reviewer of a document's AI provenance", () => {
    const doc = {
      id: "1234",
      ai_provenance: {
        "descriptive_metadata.description": {
          origin: "ai_generated",
          model: "test-model",
          reviewer: "abc123",
        },
        "descriptive_metadata.title": null,
      },
    };

    expect(generalizeStaff(doc) as unknown).toEqual({
      id: "1234",
      ai_provenance: {
        "descriptive_metadata.description": {
          origin: "ai_generated",
          model: "test-model",
          reviewer: STAFF_LABEL,
        },
        "descriptive_metadata.title": null,
      },
    });
    // The input is left as it was.
    expect(
      doc.ai_provenance["descriptive_metadata.description"]?.reviewer,
    ).toEqual("abc123");
  });

  it("credits staff in place of the reviewer of a file set's annotations", () => {
    const doc = {
      id: "fs-1",
      annotations: [
        {
          id: "anno-1",
          content: "text",
          ai_provenance: {
            "file_set_annotations.content:anno-1": { reviewer: "abc123" },
          },
        },
        { id: "anno-2", content: "more text" },
      ],
    };

    expect(JSON.stringify(generalizeStaff(doc))).not.toContain("abc123");
    expect(
      generalizeStaff(doc).annotations[0].ai_provenance?.[
        "file_set_annotations.content:anno-1"
      ],
    ).toEqual({ reviewer: STAFF_LABEL });
    expect(generalizeStaff(doc).annotations[1]).toEqual(doc.annotations[1]);
  });

  it("finds the reviewer under nested field paths, as Meadow indexes them", () => {
    const doc = {
      ai_provenance: {
        descriptive_metadata: {
          subject: { origin: "ai_generated", reviewer: "abc123" },
          notes: { origin: "human_generated", reviewer: null },
        },
        file_set_annotations: {
          "content:anno-1": { reviewer: "abc123", premis: { event_type: "x" } },
        },
      },
    };

    expect(generalizeStaff(doc) as unknown).toEqual({
      ai_provenance: {
        descriptive_metadata: {
          subject: { origin: "ai_generated", reviewer: STAFF_LABEL },
          notes: { origin: "human_generated", reviewer: null },
        },
        file_set_annotations: {
          "content:anno-1": {
            reviewer: STAFF_LABEL,
            premis: { event_type: "x" },
          },
        },
      },
    });
  });

  it("does not invent a reviewer for a field nobody reviewed", () => {
    const doc = {
      ai_provenance: { "descriptive_metadata.title": { reviewer: null } },
    };
    expect(generalizeStaff(doc)).toEqual(doc);
  });

  it("returns documents without AI provenance untouched", () => {
    const doc = { id: "1234", title: "A work" };
    expect(generalizeStaff(doc)).toBe(doc);
    expect(generalizeStaff(null)).toBeNull();
  });
});
