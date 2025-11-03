async function fetchPRsFromWebInterface(username) {
  try {
    const url =
      "https://github.com/issues/recent?q=involves%3A%40me%20type%3Apr%20is%3Aopen";

    const response = await fetch(url, {
      credentials: "same-origin", // Include cookies for authentication
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();

    // Parse the HTML to extract PR information
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Try multiple selectors that GitHub might use for issues/PRs
    const possibleSelectors = [
      '[data-hovercard-type="pull_request"]',
      '[data-hovercard-type="issue"]',
      ".js-issue-row",
      ".Box-row",
      ".issue-row",
      ".pr-row",
      '[id*="issue_"]',
      'a[href*="/pull/"]',
      'a[href*="/issues/"]',
    ];

    let issueItems = [];
    for (const selector of possibleSelectors) {
      const elements = doc.querySelectorAll(selector);
      if (elements.length > 0) {
        issueItems = elements;
        break;
      }
    }

    if (issueItems.length === 0) {
      return [];
    }

    const prs = [];
    for (const item of issueItems) {
      try {
        let titleLink = item.querySelector(
          'a[data-hovercard-type="pull_request"]'
        );
        if (!titleLink) {
          titleLink = item.querySelector('a[href*="/pull/"]');
        }
        if (!titleLink) {
          // Maybe it's the item itself
          if (item.tagName === "A" && item.href?.includes("/pull/")) {
            titleLink = item;
          }
        }
        if (!titleLink) {
          continue;
        }

        const title =
          titleLink.textContent.trim() ||
          titleLink.getAttribute("aria-label") ||
          "Untitled";
        let url = titleLink.href;

        if (url && !url.startsWith("http")) {
          url =
            "https://github.com" + (url.startsWith("/") ? url : "/" + url);
        }

        const repoMatch = url.match(/github\.com\/([^/]+\/[^/]+)\//);
        const repo = repoMatch ? repoMatch[1] : "unknown";
        const authorElement = item.querySelector(
          '.opened-by, .author, [data-hovercard-type="user"]'
        );
        const isAuthor = authorElement
          ? authorElement.textContent.includes(username)
          : false;

        const draftIndicators = item.querySelectorAll(
          '[title*="Draft"], .Label--draft, .State--draft, [aria-label*="Draft"]'
        );
        const statusElement = item.querySelector(
          '.State, .Label, [data-view-component="true"][class*="State"]'
        );
        const statusText =
          statusElement?.textContent?.trim()?.toLowerCase() || "";

        const isDraft =
          draftIndicators.length > 0 || statusText.includes("draft");

        prs.push({
          html_url: url,
          title: title,
          repo: repo,
          isAuthor: isAuthor,
          isDraft: isDraft,
          status: isDraft ? "draft" : "open",
          source: "web-interface",
        });
      } catch {
        // Skip items that can't be parsed
      }
    }

    return prs;
  } catch {
    return [];
  }
}

async function fetchPRsFromAPI(username) {
  try {
    const queries = [
      `author:${username}+type:pr+state:open`,
      `assignee:${username}+type:pr+state:open`,
    ];

    const allResults = [];
    for (const query of queries) {
      const url = `https://api.github.com/search/issues?q=${encodeURIComponent(
        query
      )}&sort=updated&order=desc`;

      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const items = data.items.map((item) => ({
            html_url: item.html_url,
            title: item.title,
            repo:
              item.repository_url?.split("/").slice(-2).join("/") ??
              "unknown",
            isAuthor: query.includes("author:"),
            source: "api-fallback",
          }));
          allResults.push(...items);
        }
      } catch {
        // Skip failed queries
      }
    }

    return allResults;
  } catch {
    return [];
  }
}