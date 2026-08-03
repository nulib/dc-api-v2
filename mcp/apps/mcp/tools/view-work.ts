import * as z from "zod/v4";
import { components } from "../api-schema.d.js";
import { getWork } from "../dc-api.js";
import { iiifContentSchema } from "../common/schemas.js";

export const name = "view-work";
export const config = {
  title: "View Work",
  description:
    "View a work from the NUL Digital Collections in an interactive viewer.",
  inputSchema: z.object({
    work_id: z.string().describe("The ID of the work to view")
  }),
  outputSchema: iiifContentSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export const handler = async ({
  work_id
}: z.infer<typeof config.inputSchema>) => {
  const work = await getWork(work_id);
  const { id, title, iiif_manifest } =
    work?.data as components["schemas"]["Work"];

  const structuredContent = {
    iiifContentUrl: iiif_manifest
  };
  return {
    content: [
      {
        type: "text" as const,
        text: `${id} - "${title}"`
      },
      {
        type: "text" as const,
        text: JSON.stringify(structuredContent)
      }
    ],
    structuredContent
  };
};

export default { name, config, handler };
