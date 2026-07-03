import { describe, expect, it } from "vitest";
import { renderMarkdown, escapeHtml } from "./markdown";

describe("escapeHtml", () => {
  it("escapes all HTML metacharacters", () => {
    expect(escapeHtml(`<script>alert("x&y'z")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&amp;y&#39;z&quot;)&lt;/script&gt;",
    );
  });
});

describe("renderMarkdown", () => {
  it("never lets raw HTML through", () => {
    const html = renderMarkdown("<img src=x onerror=alert(1)> **bold**");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("blocks javascript: URLs in links", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain("<a");
  });

  it("renders http(s) links with rel hardening", () => {
    const html = renderMarkdown("[status](https://example.com/x)");
    expect(html).toContain(
      '<a href="https://example.com/x" rel="noopener nofollow">status</a>',
    );
  });

  it("renders paragraphs, lists, bold, italics, and code", () => {
    const html = renderMarkdown(
      "First **bold** and *em* and `code`\n\n- one\n- two",
    );
    expect(html).toContain(
      "<p>First <strong>bold</strong> and <em>em</em> and <code>code</code></p>",
    );
    expect(html).toContain("<ul><li>one</li><li>two</li></ul>");
  });

  it("survives pathological input without throwing", () => {
    expect(() => renderMarkdown("*".repeat(10_000))).not.toThrow();
    expect(() => renderMarkdown("")).not.toThrow();
  });
});
