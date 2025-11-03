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

  // Fetch user PRs by scraping GitHub's issues page (same as web interface)
  const allPRs = await fetchPRsFromWebInterface(username);

  // Fallback: if web interface parsing fails, try a simpler API approach
  if (allPRs.length === 0) {
    const fallbackPRs = await fetchPRsFromAPI(username);
    allPRs.push(...fallbackPRs);
  }

  // Create and insert the activity card
  const card = createActivityCard(allPRs);

  // ✅ Insert BEFORE Top Repositories (above it)
  topReposSection.before(card);

  // Initialize GitHub hovercards for our dynamically added elements
  initializeHovercards(card);
})();
