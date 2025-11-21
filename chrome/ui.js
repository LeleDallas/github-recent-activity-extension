// UI components and rendering functions

function getPRIcon(pr) {
  if (pr.isDraft) {
    return `<span class="gh-pr-icon gh-pr-draft" title="Draft PR">
      <svg color="var(--fgColor-draft)" aria-hidden="true" focusable="false" aria-label="" class="octicon octicon-git-pull-request-draft" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="vertical-align: text-bottom;">
        <path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 14a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM14 7.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm0-4.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z"></path>
      </svg>
    </span>`;
  }
  return `<span class="gh-pr-icon gh-pr-open" title="Open PR">
    <svg color="var(--fgColor-open)" aria-hidden="true" focusable="false" aria-label="" class="octicon octicon-git-pull-request" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="vertical-align: text-bottom;">
      <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"></path>
    </svg>
  </span>`;
}

function createActivityCard(allPRs) {
  const card = document.createElement("div");
  card.className = "gh-activity-card";
  card.innerHTML = `
    <div class="gh-activity-header">
      <h2>Recent Activity</h2>
    </div>
    ${
      allPRs.length === 0
        ? `<p class="gh-empty">No open or reviewed pull requests match your filters 🎉</p>`
        : `<ul class="gh-activity-list">
          ${allPRs
            .map((pr) => {
              const prIcon = getPRIcon(pr);
              const processedTitle = processMarkdownTitle(pr.title);

              return `
            <li>
              <div class="gh-activity-header-row">
                ${prIcon}
                <a href="${pr.html_url}" 
                   data-hovercard-type="pull_request" 
                   data-hovercard-url="${pr.html_url}/hovercard"
                   data-turbo-frame="repo-content-turbo-frame">${processedTitle}</a>
              </div>
              <div class="gh-activity-repo">
                <a href="https://github.com/${pr.repo}" 
                   data-hovercard-type="repository" 
                   data-hovercard-url="https://github.com/${pr.repo}/hovercard">${pr.repo}</a>
              </div>
            </li>
          `;
            })
            .join("")}
        </ul>`
    }
  `;
  return card;
}