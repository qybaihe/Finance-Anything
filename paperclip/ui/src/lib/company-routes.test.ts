import { describe, expect, it } from "vitest";
import {
  applyCompanyPrefix,
  extractCompanyPrefixFromPath,
  isBoardPathWithoutPrefix,
  toCompanyRelativePath,
} from "./company-routes";

describe("company routes", () => {
  it("treats execution workspace paths as board routes that need a company prefix", () => {
    expect(isBoardPathWithoutPrefix("/execution-workspaces/workspace-123")).toBe(true);
    expect(isBoardPathWithoutPrefix("/execution-workspaces/workspace-123/routines")).toBe(true);
    expect(extractCompanyPrefixFromPath("/execution-workspaces/workspace-123")).toBeNull();
    expect(applyCompanyPrefix("/execution-workspaces/workspace-123", "PAP")).toBe(
      "/PAP/execution-workspaces/workspace-123",
    );
    expect(applyCompanyPrefix("/execution-workspaces/workspace-123/routines", "PAP")).toBe(
      "/PAP/execution-workspaces/workspace-123/routines",
    );
  });

  it("normalizes prefixed execution workspace paths back to company-relative paths", () => {
    expect(toCompanyRelativePath("/PAP/execution-workspaces/workspace-123")).toBe(
      "/execution-workspaces/workspace-123",
    );
    expect(toCompanyRelativePath("/PAP/execution-workspaces/workspace-123/routines")).toBe(
      "/execution-workspaces/workspace-123/routines",
    );
  });

  it("treats /search as a board route that needs a company prefix", () => {
    expect(isBoardPathWithoutPrefix("/search")).toBe(true);
    expect(extractCompanyPrefixFromPath("/search")).toBeNull();
    expect(applyCompanyPrefix("/search", "PAP")).toBe("/PAP/search");
    expect(applyCompanyPrefix("/search?q=hello%20world", "PAP")).toBe("/PAP/search?q=hello%20world");
    expect(toCompanyRelativePath("/PAP/search?q=foo")).toBe("/search?q=foo");
  });

  it("treats /opencode as a board route instead of a fake company prefix", () => {
    expect(isBoardPathWithoutPrefix("/opencode")).toBe(true);
    expect(extractCompanyPrefixFromPath("/opencode")).toBeNull();
    expect(applyCompanyPrefix("/opencode", "PAP")).toBe("/PAP/opencode");
    expect(applyCompanyPrefix("/opencode?project=demo-1", "PAP")).toBe("/PAP/opencode?project=demo-1");
    expect(toCompanyRelativePath("/PAP/opencode?project=demo-1")).toBe("/opencode?project=demo-1");
  });

  it("treats /monitoring as a board route instead of a fake company prefix", () => {
    expect(isBoardPathWithoutPrefix("/monitoring")).toBe(true);
    expect(extractCompanyPrefixFromPath("/monitoring")).toBeNull();
    expect(applyCompanyPrefix("/monitoring", "PAP")).toBe("/PAP/monitoring");
    expect(toCompanyRelativePath("/PAP/monitoring")).toBe("/monitoring");
  });

  it("treats /knowledge as a board route instead of a fake company prefix", () => {
    expect(isBoardPathWithoutPrefix("/knowledge")).toBe(true);
    expect(extractCompanyPrefixFromPath("/knowledge")).toBeNull();
    expect(applyCompanyPrefix("/knowledge", "PAP")).toBe("/PAP/knowledge");
    expect(applyCompanyPrefix("/knowledge?view=project&project=demo-1", "PAP")).toBe(
      "/PAP/knowledge?view=project&project=demo-1",
    );
    expect(toCompanyRelativePath("/PAP/knowledge?view=project&project=demo-1")).toBe(
      "/knowledge?view=project&project=demo-1",
    );
  });

  it("treats /products as a board route instead of a fake company prefix", () => {
    expect(isBoardPathWithoutPrefix("/products")).toBe(true);
    expect(extractCompanyPrefixFromPath("/products")).toBeNull();
    expect(applyCompanyPrefix("/products", "PAP")).toBe("/PAP/products");
    expect(applyCompanyPrefix("/products?product=demo-1", "PAP")).toBe("/PAP/products?product=demo-1");
    expect(toCompanyRelativePath("/PAP/products?product=demo-1")).toBe("/products?product=demo-1");
  });
});
