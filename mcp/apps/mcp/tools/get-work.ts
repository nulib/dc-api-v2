import * as z from "zod/v4";
import { components } from "../api-schema.d";
import { getWork } from "../dc-api";

export const name = "get-work";
export const config = {
  title: "Get Work",
  description:
    "Retrieve the metadata for a work from the NUL Digital Collections.",
  inputSchema: z.object({
    work_id: z.string().describe("The ID of the work to retrieve")
  })
};

export const handler = async ({ work_id }: { work_id: string }) => {
  const work = await getWork(work_id);
  const structuredContent = work?.data as components["schemas"]["Work"];

  return {
    content: [
      {
        type: "text" as const,
        text: structuredContent.title
      }
    ],
    structuredContent
  };
};

export default { name, config, handler };
