import { describe, expect, it } from "vitest";
import { readCapped, resolveWorkspacePath, sendableName } from "./sandbox-files";

describe("resolveWorkspacePath", () => {
  it("anchors relative paths to /workspace", () => {
    expect(resolveWorkspacePath("charts/top10.png")).toBe("/workspace/charts/top10.png");
    expect(resolveWorkspacePath("./data.csv")).toBe("/workspace/data.csv");
  });

  it("accepts absolute paths inside /workspace and normalises them", () => {
    expect(resolveWorkspacePath("/workspace/out/report.pdf")).toBe("/workspace/out/report.pdf");
    expect(resolveWorkspacePath("/workspace/a/../b.csv")).toBe("/workspace/b.csv");
  });

  it("rejects .. traversal out of the workspace", () => {
    expect(() => resolveWorkspacePath("../etc/passwd")).toThrow(/inside \/workspace/);
    expect(() => resolveWorkspacePath("charts/../../etc/passwd")).toThrow(/inside \/workspace/);
    expect(() => resolveWorkspacePath("/workspace/../etc/passwd")).toThrow(/inside \/workspace/);
  });

  it("rejects absolute paths outside /workspace, including look-alike prefixes", () => {
    expect(() => resolveWorkspacePath("/etc/passwd")).toThrow(/inside \/workspace/);
    expect(() => resolveWorkspacePath("/workspace-other/secret.txt")).toThrow(/inside \/workspace/);
  });

  it("rejects the workspace root itself, empty input and NUL bytes", () => {
    expect(() => resolveWorkspacePath("/workspace")).toThrow(/inside \/workspace/);
    expect(() => resolveWorkspacePath("")).toThrow(/inside \/workspace/);
    expect(() => resolveWorkspacePath("a\0b.png")).toThrow(/inside \/workspace/);
  });
});

describe("sendableName", () => {
  it("returns the file name for types iMessage can carry", () => {
    expect(sendableName("/workspace/charts/top10.PNG")).toBe("top10.PNG");
    expect(sendableName("/workspace/data.csv")).toBe("data.csv");
  });

  it("rejects types the Linq adapter cannot label", () => {
    expect(() => sendableName("/workspace/run.sh")).toThrow(/cannot be sent/);
    expect(() => sendableName("/workspace/Makefile")).toThrow(/cannot be sent/);
  });
});

describe("readCapped", () => {
  const streamOf = (...chunks: number[][]) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(Uint8Array.from(chunk));
        controller.close();
      },
    });

  it("joins the chunks of a stream that fits", async () => {
    expect(Array.from(await readCapped(streamOf([1, 2], [3]), 3))).toEqual([1, 2, 3]);
  });

  it("stops with an error as soon as the cap is passed", async () => {
    await expect(readCapped(streamOf([1, 2], [3, 4]), 3)).rejects.toThrow(/larger than/);
  });
});
