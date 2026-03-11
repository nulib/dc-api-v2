import * as z from "zod/v4";
import { components } from "../api-schema.d";
import { getWork } from "../dc-api";
import {
  UI_RESOURCE_URI,
  API_BASE_ORIGIN,
  IIIF_BASE_ORIGIN
} from "../resources/view-work-ui.js";

export const name = "view-work";
export const config = {
  title: "View Work",
  description:
    "View a work from the NUL Digital Collections in an interactive viewer.",
  inputSchema: z.object({
    work_id: z.string().describe("The ID of the work to view")
  }),
  _meta: {
    ui: {
      resourceUri: UI_RESOURCE_URI
    }
  }
};

export const handler = async ({ work_id }: { work_id: string }) => {
  const work = await getWork(work_id);
  const { id, title, iiif_manifest } =
    work?.data as components["schemas"]["Work"];

  return {
    content: [
      {
        type: "text" as const,
        text: `${id} - "${title}"`
      }
    ],
    structuredContent: {
      iiifManifestUrl: iiif_manifest
    },
    _meta: {
      ui: {
        resourceUri: UI_RESOURCE_URI,
        csp: {
          resourceDomains: [API_BASE_ORIGIN, IIIF_BASE_ORIGIN],
          connectDomains: [API_BASE_ORIGIN, IIIF_BASE_ORIGIN]
        }
      },
      "ui/resourceUri": UI_RESOURCE_URI
    }
  };
};

export default { name, config, handler };
