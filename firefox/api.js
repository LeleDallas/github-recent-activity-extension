// Build dynamic GitHub search URL based on filters
function buildGitHubSearchURL(username, filters) {
  const baseUrl = 'https://github.com/issues';
  const queryParams = [];
  
  // Always include type:pr
  queryParams.push('type:pr');
  
  // Handle author type filters
  if (filters) {
    const authorFilters = [];
    if (filters.showAuthor) {
      authorFilters.push(`author:${username}`);
    }
    if (filters.showAssigned) {
      authorFilters.push(`assignee:${username}`);
    }
    if (filters.showOthers) {
      authorFilters.push(`involves:${username} -author:${username}`);
    }
    
    // If no specific author filters, default to involves (author OR assignee OR mentions)
    if (authorFilters.length === 0) {
      queryParams.push(`involves:${username}`);
    } else {
      // Combine author filters with OR
      queryParams.push(authorFilters.join(' '));
    }
    
    // Handle status filters
    const statusFilters = [];
    if (filters.showOpen && !filters.showDraft) {
      statusFilters.push('state:open', '-is:draft'); // Exclude drafts
    } else if (!filters.showOpen && filters.showDraft) {
      statusFilters.push('is:draft');
    } else if (filters.showOpen && filters.showDraft) {
      statusFilters.push('state:open'); // Includes both open and draft
    } else {
      // Neither selected - default to open
      statusFilters.push('state:open');
    }
    queryParams.push(...statusFilters);
    
    // Handle date range filters
    if (filters.dateRange && filters.dateRange !== 'all') {
      const daysBack = filters.dateRange === 'custom' 
        ? Number.parseInt(filters.customDays, 10) || 60
        : Number.parseInt(filters.dateRange, 10);
      
      if (daysBack) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        const dateStr = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        queryParams.push(`updated:>${dateStr}`);
      }
    }
  } else {
    // Default query when no filters
    queryParams.push(`involves:${username}`, 'state:open');
  }
  
  // Build the final URL
  const query = queryParams.join(' ');
  const encodedQuery = encodeURIComponent(query);
  return `${baseUrl}?q=${encodedQuery}&sort=updated&order=desc`;
}

// Build API search queries based on filters
function buildAPIQueries(username, filters) {
  const queries = [];
  
  if (!filters) {
    // Default queries
    return [
      `author:${username}+type:pr+state:open`,
      `assignee:${username}+type:pr+state:open`,
    ];
  }
  
  // Base query parts
  const baseQuery = 'type:pr';
  let statusQuery;
  if (filters.showOpen && !filters.showDraft) {
    statusQuery = 'state:open+-is:draft';
  } else if (filters.showDraft && !filters.showOpen) {
    statusQuery = 'is:draft';
  } else {
    statusQuery = 'state:open';
  }
  
  // Date filter
  let dateQuery = '';
  if (filters.dateRange && filters.dateRange !== 'all') {
    const daysBack = filters.dateRange === 'custom' 
      ? Number.parseInt(filters.customDays, 10) || 60
      : Number.parseInt(filters.dateRange, 10);
    
    if (daysBack) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      const dateStr = cutoffDate.toISOString().split('T')[0];
      dateQuery = `+updated:>${dateStr}`;
    }
  }
  
  // Author-specific queries
  if (filters.showAuthor) {
    queries.push(`author:${username}+${baseQuery}+${statusQuery}${dateQuery}`);
  }
  if (filters.showAssigned) {
    queries.push(`assignee:${username}+${baseQuery}+${statusQuery}${dateQuery}`);
  }
  if (filters.showOthers) {
    queries.push(`involves:${username}+-author:${username}+${baseQuery}+${statusQuery}${dateQuery}`);
  }
  
  // If no specific filters selected, use default
  if (queries.length === 0) {
    queries.push(`involves:${username}+${baseQuery}+${statusQuery}${dateQuery}`);
  }
  
  return queries;
}

async function fetchPRsFromWebInterface(username, filters = null) {
  try {
    // Build dynamic GitHub search URL based on filters
    const url = buildGitHubSearchURL(username, filters);

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
    // Process all items, don't limit here
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

        // Try to extract date information from the page
        const dateElement = item.querySelector('time, [datetime], .opened-by');
        let dateString = null;
        if (dateElement) {
          dateString = dateElement.getAttribute('datetime') || 
                      dateElement.getAttribute('title') ||
                      dateElement.textContent;
        }

        prs.push({
          html_url: url,
          title: title,
          repo: repo,
          isAuthor: isAuthor,
          isDraft: isDraft,
          status: isDraft ? "draft" : "open",
          source: "web-interface",
        });
      } catch (error) {
        // Skip items that can't be parsed
        console.warn('GitHub Activity Extension: Failed to parse PR item:', error);
      }
    }

    return prs;
  } catch (error) {
    console.error('GitHub Activity Extension: Web interface fetch failed:', error);
    return [];
  }
}

async function fetchPRsFromAPI(username, filters = null) {
  try {
    // Build queries based on filters
    const queries = buildAPIQueries(username, filters);

    const allResults = [];
    for (const query of queries) {
      // Fetch more results initially (up to 100 per query)
      const url = `https://api.github.com/search/issues?q=${encodeURIComponent(
        query
      )}&sort=updated&order=desc&per_page=100`;

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
            isAuthor: query.includes(`author:${username}`),
            isDraft: item.draft || false,
            updated_at: item.updated_at,
            created_at: item.created_at,
            source: "api-search",
          }));
          allResults.push(...items);
        } else {
          console.warn('GitHub Activity Extension: API query failed with status:', res.status, 'for query:', query);
        }
      } catch (error) {
        console.warn('GitHub Activity Extension: API query failed for:', query, error);
      }
    }

    return allResults;
  } catch (error) {
    console.error('GitHub Activity Extension: API fetch failed:', error);
    return [];
  }
}

// Alternative approach using GitHub's events API
async function fetchPRsFromEventsAPI(username, dateFilter = '3months') {
  try {
    
    // Get recent events for the user
    const eventsUrl = `https://api.github.com/users/${username}/events`;
    const response = await fetch(eventsUrl);
    
    if (!response.ok) {
      console.error('GitHub Activity Extension: Events API failed:', response.status);
      return [];
    }
    
    const events = await response.json();
    const cutoffDate = getDateCutoff(dateFilter);
    
    // Filter for PR-related events
    const prEvents = events.filter(event => {
      const eventDate = new Date(event.created_at);
      return eventDate >= cutoffDate && 
             (event.type === 'PullRequestEvent' || 
              event.type === 'PullRequestReviewEvent');
    });
    
    // Extract unique PRs from events
    const prMap = new Map();
    for (const event of prEvents) {
      if (event.payload?.pull_request) {
        const pr = event.payload.pull_request;
        // Add null checking for pr.user and pr.base.repo
        if (!pr.user || !pr.base?.repo) {
          console.warn('GitHub Activity Extension: Skipping PR with missing data:', pr.html_url);
          continue;
        }
        prMap.set(pr.html_url, {
          html_url: pr.html_url,
          title: pr.title,
          repo: pr.base.repo.full_name,
          isAuthor: pr.user.login === username,
          isDraft: pr.draft || false,
          status: pr.draft ? "draft" : "open",
          source: "events-api",
          updated_at: pr.updated_at,
          created_at: pr.created_at,
        });
      }
    }
    
    const results = Array.from(prMap.values());
    return results;
  } catch (error) {
    console.error('GitHub Activity Extension: Events API failed:', error);
    return [];
  }
}

function parseRelativeTime(timeText) {
  // Parse relative time strings like "2 days ago", "3 months ago", "1 year ago"
  const now = new Date();
  const timeMatch = timeText.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);
  
  if (!timeMatch) {
    return now.toISOString(); // Default to now if we can't parse
  }
  
  const amount = Number.parseInt(timeMatch[1], 10);
  const unit = timeMatch[2].toLowerCase();
  
  const result = new Date(now);
  
  switch (unit) {
    case 'second':
      result.setSeconds(result.getSeconds() - amount);
      break;
    case 'minute':
      result.setMinutes(result.getMinutes() - amount);
      break;
    case 'hour':
      result.setHours(result.getHours() - amount);
      break;
    case 'day':
      result.setDate(result.getDate() - amount);
      break;
    case 'week':
      result.setDate(result.getDate() - (amount * 7));
      break;
    case 'month':
      result.setMonth(result.getMonth() - amount);
      break;
    case 'year':
      result.setFullYear(result.getFullYear() - amount);
      break;
    default:
      return now.toISOString();
  }
  
  return result.toISOString();
}

function getDateCutoff(dateFilter) {
  const now = new Date();
  const cutoff = new Date(now);
  
  switch (dateFilter) {
    case '1week':
      cutoff.setDate(now.getDate() - 7);
      break;
    case '1month':
      cutoff.setMonth(now.getMonth() - 1);
      break;
    case '3months':
      cutoff.setMonth(now.getMonth() - 3);
      break;
    case '6months':
      cutoff.setMonth(now.getMonth() - 6);
      break;
    case '1year':
      cutoff.setFullYear(now.getFullYear() - 1);
      break;
    default:
      cutoff.setMonth(now.getMonth() - 3); // Default to 3 months
  }
  
  return cutoff;
}

// Filter PRs based on user preferences
// Apply remaining filters that can't be done via URL (mainly max results)
function filterPRs(prs, filters) {
  if (!filters) return prs.slice(0, 8); // Default limit
  
  // Remove duplicates (same PR from different sources)
  const uniquePRs = [];
  const seenURLs = new Set();
  for (const pr of prs) {
    if (!seenURLs.has(pr.html_url)) {
      seenURLs.add(pr.html_url);
      uniquePRs.push(pr);
    }
  }
  
  // Apply max results limit
  const maxResults = getMaxResults(filters);
  return uniquePRs.slice(0, maxResults);
}

// Get the effective max results value
function getMaxResults(filters) {
  if (filters.maxResults === 'custom') {
    return Number.parseInt(filters.customMaxResults) || 8;
  }
  return Number.parseInt(filters.maxResults) || 8;
}