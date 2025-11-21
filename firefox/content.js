(async function () {
  const username = getUsername();
  if (!username) {
    console.error("❌ No username found! Cannot proceed.");
    return;
  }

  const topReposSection = await waitForTopRepos();
  if (!topReposSection) {
    console.warn("⚠️ Could not find GitHub sidebar Top Repositories section.");
    return;
  }

  // Cross-browser storage API
  const storage = typeof browser !== 'undefined' ? browser.storage : chrome.storage;

  // Load user filters
  let userFilters;
  try {
    const result = await browser.storage.sync.get({ filters: null });
    userFilters = result.filters;
  } catch (error) {
    console.error('GitHub Activity Extension: Failed to load user filters:', error);
    userFilters = null;
  }

  // Function to refresh PRs with current filters
  async function refreshPRs() {
    try {
      // Remove existing card if present
      const existingCard = document.querySelector('.gh-activity-card');
      if (existingCard) {
        existingCard.remove();
      }

      // Multi-tier fetching strategy
      let allPRs = [];
      
      // Try web interface first
      try {
        allPRs = await fetchPRsFromWebInterface(username, userFilters);
      } catch (error) {
        console.error('GitHub Activity Extension: Web interface failed:', error);
      }

      // Fallback 1: Events API
      if (allPRs.length === 0 && typeof fetchPRsFromEventsAPI === 'function') {
        try {
          const eventsPRs = await fetchPRsFromEventsAPI(username, userFilters?.dateRange);
          allPRs.push(...eventsPRs);
        } catch (error) {
          console.error('GitHub Activity Extension: Events API failed:', error);
        }
      }

      // Fallback 2: Standard API
      if (allPRs.length === 0) {
        try {
          const fallbackPRs = await fetchPRsFromAPI(username, userFilters);
          allPRs.push(...fallbackPRs);
        } catch (error) {
          console.error('GitHub Activity Extension: Standard API failed:', error);
        }
      }

      // Apply user filters if available and filterPRs function exists
      if (userFilters && typeof filterPRs === 'function') {
        try {
          allPRs = filterPRs(allPRs, userFilters);
        } catch (error) {
          console.error('GitHub Activity Extension: Filtering failed:', error);
          // Apply basic max results as fallback
          const maxResults = userFilters.maxResults === 'custom' 
            ? Number.parseInt(userFilters.customMaxResults, 10) || 8
            : Number.parseInt(userFilters.maxResults, 10) || 8;
          allPRs = allPRs.slice(0, maxResults);
        }
      } else if (userFilters) {
        // Fallback: apply basic filtering inline if filterPRs is not available
        const maxResults = userFilters.maxResults === 'custom' 
          ? Number.parseInt(userFilters.customMaxResults, 10) || 8
          : Number.parseInt(userFilters.maxResults, 10) || 8;
        allPRs = allPRs.slice(0, maxResults);
      }

      // Create and insert the activity card
      const card = createActivityCard(allPRs);
      if (!card) {
        console.error('GitHub Activity Extension: Failed to create activity card');
        return;
      }
      
      topReposSection.before(card);

      // Initialize GitHub hovercards for our dynamically added elements
      try {
        initializeHovercards(card);
      } catch (error) {
        console.warn('GitHub Activity Extension: Hovercards initialization failed:', error);
      }
    } catch (error) {
      console.error('GitHub Activity Extension: Critical error in refreshPRs:', error);
      // Show a basic error card
      try {
        const errorCard = createActivityCard([]);
        if (errorCard) {
          topReposSection.before(errorCard);
        }
      } catch (fallbackError) {
        console.error('GitHub Activity Extension: Even fallback card creation failed:', fallbackError);
      }
    }
  }

  // Listen for filter updates from popup
  const runtime = typeof browser !== 'undefined' ? browser.runtime : chrome.runtime;
  runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateFilters') {
      userFilters = request.filters;
      refreshPRs().then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        console.error('GitHub Activity Extension: Error handling message:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep the message channel open for async response
    }
  });

  // Initial load
  await refreshPRs();
})();
