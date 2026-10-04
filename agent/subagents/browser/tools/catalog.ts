/**
 * Exposes browser-loop's tool catalog to the worker, one eve tool per spec
 * (browser_navigate, browser_snapshot, browser_click, ...). browser-loop owns
 * the descriptions, schemas and execution; this file only adapts the shape.
 */
import { defineDynamic, defineTool, toolOutput, toolOutputPart } from "eve/tools";
import { WORKER_TOOL_SPECS, runLoopTool } from "../lib/session";

type Json = string | number | boolean | null | readonly Json[] | { readonly [key: string]: Json };

export default defineDynamic({
  events: {
    "session.started": () =>
      Object.fromEntries(
        WORKER_TOOL_SPECS.map((spec) => {
          // eve stores what each callback closes over as JSON so a parked call
          // can be replayed in a fresh process. Close over the name, not the spec.
          const name = spec.name;
          // The JSON round trip drops TypeBox's hidden marker properties.
          const inputSchema: { readonly [key: string]: Json } = JSON.parse(JSON.stringify(spec.declaration.parameters));

          return [
            name,
            defineTool({
              description: spec.declaration.description,
              inputSchema,
              execute: (input, ctx) => runLoopTool(name, input, ctx.abortSignal),
              toModelOutput: (content) =>
                toolOutput.content(
                  content.map((part) =>
                    part.type === "text"
                      ? toolOutputPart.text(part.text)
                      : toolOutputPart.file(part.data, { mediaType: part.mimeType }),
                  ),
                ),
            }),
          ];
        }),
      ),
  },
});
