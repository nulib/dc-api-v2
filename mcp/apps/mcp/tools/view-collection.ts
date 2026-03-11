import * as z from "zod/v4";
import { components } from "../api-schema.d.js";
import { getCollection } from "../dc-api.js";

export const name = "view-collection";
export const config = {
  title: "View Collection",
  description:
    "View a collection from the NUL Digital Collections in an interactive viewer.",
  inputSchema: z.object({
    collection_id: z.string().describe("The ID of the collection to view")
  }),
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export const handler = async ({ collection_id }: { collection_id: string }) => {
  const collection = await getCollection(collection_id);
  const { id, title, iiif_collection } =
    collection?.data as components["schemas"]["Collection"];

  return {
    content: [
      {
        type: "text" as const,
        text: `${id} - "${title}"`
      }
    ],
    structuredContent: {
      iiifContentUrl: iiif_collection
    }
  };
};

export default { name, config, handler };
