// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  buildEmbeddedOpenCodeProjectUrl,
  DEFAULT_OPENCODE_WEB_URL,
  buildOpenCodeProjectUrl,
  readOpenCodeProjectConfig,
  resolveOpenCodeProjectDirectory,
  suggestOpenCodeLaunchCommand,
  writeOpenCodeProjectConfigToMetadata,
} from "./opencode-project";

describe("opencode project helpers", () => {
  it("reads defaults when metadata is empty", () => {
    expect(readOpenCodeProjectConfig(null)).toEqual({
      webUrl: DEFAULT_OPENCODE_WEB_URL,
      launchCommand: "opencode web --port 4096",
    });
  });

  it("preserves sibling metadata while writing OpenCode settings", () => {
    expect(
      writeOpenCodeProjectConfigToMetadata(
        {
          runtimeConfig: { desiredState: "running" },
          integrations: {
            other: { enabled: true },
          },
        },
        {
          webUrl: "http://127.0.0.1:4100",
          launchCommand: "opencode web --port 4100",
        },
      ),
    ).toEqual({
      runtimeConfig: { desiredState: "running" },
      integrations: {
        other: { enabled: true },
        opencode: {
          webUrl: "http://127.0.0.1:4100",
          launchCommand: "opencode web --port 4100",
        },
      },
    });
  });

  it("builds a project-specific OpenCode URL from the workspace directory", () => {
    expect(buildOpenCodeProjectUrl("http://127.0.0.1:4096", "/tmp/demo")).toBe(
      "http://127.0.0.1:4096/L3RtcC9kZW1v/session",
    );
  });

  it("adds Finance Anything embed params for themed sidebar-hidden embeds", () => {
    expect(buildEmbeddedOpenCodeProjectUrl("http://127.0.0.1:4096", "/tmp/demo", { theme: "dark" })).toBe(
      "http://127.0.0.1:4096/L3RtcC9kZW1v/session?paperclip_embed=1&paperclip_theme=dark&paperclip_sidebar=hidden",
    );
  });

  it("resolves directory from workspace first, then codebase fallback", () => {
    expect(
      resolveOpenCodeProjectDirectory({
        primaryWorkspace: { cwd: "/workspace/app" } as never,
        workspaces: [],
        codebase: { effectiveLocalFolder: "/fallback/app" } as never,
      }),
    ).toEqual({ path: "/workspace/app", source: "workspace" });

    expect(
      resolveOpenCodeProjectDirectory({
        primaryWorkspace: null,
        workspaces: [],
        codebase: { effectiveLocalFolder: "/fallback/app" } as never,
      }),
    ).toEqual({ path: "/fallback/app", source: "codebase" });
  });

  it("derives a launch command from the configured URL", () => {
    expect(suggestOpenCodeLaunchCommand("http://localhost:4200")).toBe("opencode web --port 4200");
    expect(suggestOpenCodeLaunchCommand("http://192.168.1.10:4200")).toBe("opencode web --hostname 0.0.0.0 --port 4200");
  });
});
