export function cleanKnowledgeHtml(html: string | undefined) {
  if (!html) return "";

  if (typeof window === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");

  document.querySelectorAll('[data-type="list"]').forEach((listRoot) => {
    const list = document.createElement("ul");

    Array.from(listRoot.children).forEach((child) => {
      const item = child as HTMLElement;
      if (item.getAttribute("data-type") !== "list-item") return;

      const listItem = document.createElement("li");
      const contentNodes = Array.from(item.children).slice(1);

      contentNodes.forEach((node) => {
        Array.from(node.childNodes).forEach((childNode) => {
          listItem.appendChild(childNode.cloneNode(true));
        });
      });

      if (listItem.textContent?.trim()) {
        list.appendChild(listItem);
      }
    });

    listRoot.replaceWith(list);
  });

  document.querySelectorAll("*").forEach((element) => {
    element.removeAttribute("style");
    element.removeAttribute("class");
    element.removeAttribute("id");
    element.removeAttribute("data-first");
    element.removeAttribute("data-last");
    element.removeAttribute("data-type");
    element.removeAttribute("data-index");
    element.removeAttribute("data-orderer");
  });

  document.querySelectorAll("a").forEach((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    const text = anchor.textContent?.trim() ?? "";
    const isEmptyAnchor = !text;
    const isHashAnchor = href.startsWith("#");
    const isDocAnchor = anchor.getAttribute("aria-hidden") === "true";

    if (isEmptyAnchor || isHashAnchor || isDocAnchor) {
      anchor.replaceWith(...anchor.childNodes);
      return;
    }

    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noreferrer noopener");
  });

  document.querySelectorAll("span").forEach((span) => {
    const text = span.textContent?.trim() ?? "";
    const hasElementChildren = span.children.length > 0;

    if (!hasElementChildren && !text) {
      span.remove();
    }
  });

  document.querySelectorAll("section, div").forEach((div) => {
    if (!div.attributes.length) {
      div.replaceWith(...div.childNodes);
    }
  });

  return document.body.innerHTML;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineMarkdown(value: string) {
  let output = escapeHtml(value);

  output = output.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>',
  );
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  return output;
}

function renderTable(rows: string[][]) {
  if (rows.length < 2) return "";

  const [header, ...body] = rows;
  const bodyRows = body.filter(
    (row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell.trim())),
  );

  if (!bodyRows.length) return "";

  return `
    <table>
      <thead>
        <tr>${header.map((cell) => `<th>${renderInlineMarkdown(cell.trim())}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${bodyRows
          .map(
            (row) =>
              `<tr>${row
                .map((cell) => `<td>${renderInlineMarkdown(cell.trim())}</td>`)
                .join("")}</tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function renderKnowledgeMarkdown(markdown: string | undefined) {
  if (!markdown) return "";

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let paragraphBuffer: string[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let tableRows: string[][] = [];
  let inCodeBlock = false;
  let codeLanguage = "";
  let codeLines: string[] = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    html.push(`<p>${renderInlineMarkdown(paragraphBuffer.join(" "))}</p>`);
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!listItems.length || !listType) return;
    html.push(`<${listType}>${listItems.join("")}</${listType}>`);
    listItems = [];
    listType = null;
  };

  const flushTable = () => {
    if (!tableRows.length) return;
    const tableHtml = renderTable(tableRows);
    if (tableHtml) {
      html.push(tableHtml);
    }
    tableRows = [];
  };

  const flushCode = () => {
    if (!inCodeBlock) return;
    html.push(
      `<pre><code${codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : ""}>${escapeHtml(
        codeLines.join("\n"),
      )}</code></pre>`,
    );
    inCodeBlock = false;
    codeLanguage = "";
    codeLines = [];
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("```")) {
      flushParagraph();
      flushList();
      flushTable();

      if (inCodeBlock) {
        flushCode();
      } else {
        inCodeBlock = true;
        codeLanguage = trimmedLine.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!trimmedLine) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    const headingMatch = trimmedLine.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushTable();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    const unorderedMatch = trimmedLine.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      flushTable();
      if (listType && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listItems.push(`<li>${renderInlineMarkdown(unorderedMatch[1])}</li>`);
      continue;
    }

    const orderedMatch = trimmedLine.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      flushTable();
      if (listType && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listItems.push(`<li>${renderInlineMarkdown(orderedMatch[1])}</li>`);
      continue;
    }

    if (trimmedLine.startsWith(">")) {
      flushParagraph();
      flushList();
      flushTable();
      html.push(`<blockquote>${renderInlineMarkdown(trimmedLine.slice(1).trim())}</blockquote>`);
      continue;
    }

    if (trimmedLine.includes("|") && trimmedLine.startsWith("|") && trimmedLine.endsWith("|")) {
      flushParagraph();
      flushList();
      tableRows.push(
        trimmedLine
          .slice(1, -1)
          .split("|")
          .map((cell) => cell.trim()),
      );
      continue;
    }

    flushList();
    flushTable();
    paragraphBuffer.push(trimmedLine);
  }

  flushParagraph();
  flushList();
  flushTable();
  flushCode();

  return html.join("\n");
}
