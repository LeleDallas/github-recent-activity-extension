// Utility functions for GitHub Activity Restore extension

function getUsername() {
  const meta = document.querySelector('meta[name="user-login"]');
  const username = meta ? meta.content : null;
  return username;
}

async function waitForTopRepos() {
  for (let i = 0; i < 20; i++) {
    const el = [...document.querySelectorAll("aside h2")].find((h) =>
      h.textContent.trim().toLowerCase().includes("top repositories")
    );
    if (el) return el.closest("div");
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function processMarkdownTitle(title) {
  if (!title) return "";

  // Simple markdown processing - just handle bold and code
  let processed = title;

  // Handle **bold** text
  while (processed.includes("**")) {
    const firstIndex = processed.indexOf("**");
    const secondIndex = processed.indexOf("**", firstIndex + 2);
    if (secondIndex > -1) {
      const before = processed.substring(0, firstIndex);
      const boldText = processed.substring(firstIndex + 2, secondIndex);
      const after = processed.substring(secondIndex + 2);
      processed =
        before + "<strong>" + escapeHtml(boldText) + "</strong>" + after;
    } else {
      break;
    }
  }

  // Handle `code` text
  while (processed.includes("`") && !processed.includes("<")) {
    const firstIndex = processed.indexOf("`");
    const secondIndex = processed.indexOf("`", firstIndex + 1);
    if (secondIndex > -1) {
      const before = processed.substring(0, firstIndex);
      const codeText = processed.substring(firstIndex + 1, secondIndex);
      const after = processed.substring(secondIndex + 1);
      processed =
        before + "<code>" + escapeHtml(codeText) + "</code>" + after;
    } else {
      break;
    }
  }

  // Escape any remaining text that wasn't processed
  return processed.includes("<") ? processed : escapeHtml(processed);
}