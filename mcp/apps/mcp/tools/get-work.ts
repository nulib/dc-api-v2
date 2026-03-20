import * as z from "zod/v4";
import { components } from "../api-schema.d.js";
import { getWork } from "../dc-api.js";

export const name = "get-work";
export const config = {
  title: "Get Work",
  description:
    "Retrieve the full metadata for a work from the NUL Digital Collections.",
  inputSchema: z.object({
    work_id: z.string().describe("The ID of the work to retrieve")
  }),
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
  const structuredContent = work?.data as components["schemas"]["Work"];

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(structuredContent)
      }
    ],
    structuredContent
  };
};

export default { name, config, handler };
