// Renders the small markdown subset allowed in incident updates and
// post-mortems. Input is HTML-escaped BEFORE any markup is applied, so no
// author-supplied HTML can ever reach the page; only markup emitted by this
// file exists in the output. Links are restricted to http(s).
export function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inline(escaped: string): string {
  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" rel="noopener nofollow">$1</a>',
    );
}

export function renderMarkdown(input: string): string {
  const escaped = escapeHtml(input.trim());
  const blocks = escaped.split(/\n{2,}/);

  const html = blocks.map((block) => {
    const lines = block.split("\n").map((l) => l.trim());

    if (lines.every((l) => l.startsWith("- ")) && lines.length > 0) {
      const items = lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join("");
      return `<ul>${items}</ul>`;
    }

    return `<p>${lines.map(inline).join("<br>")}</p>`;
  });

  return html.join("\n");
}
