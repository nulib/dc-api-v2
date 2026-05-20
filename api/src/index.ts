import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import app from "./app.ts";

const wrapper = new Hono();
wrapper.use("*", async (c) => {
  console.log(`Received request: ${c.req.method} ${c.req.url}`);
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace(/^.*\/v2\//, "/");
  const newReq = new Request(url.toString(), c.req.raw.clone());
  console.log(`Forwarding to app: ${newReq.method} ${newReq.url}`);
  return await app.request(newReq);
});

export const handler = handle(wrapper);
