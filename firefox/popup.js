// Default filter settings
const DEFAULT_FILTERS = {
  dateRange: '60', // Last 2 months (like GitHub default)
  customDays: '',
  showOpen: true,
  showDraft: true,
  showAuthor: true,
  showAssigned: false,
  showOthers: false,
  maxResults: '8',
  customMaxResults: ''
};

// Theme detection function
function initializeThemeDetection() {
  // Check system preference first
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.setAttribute('data-color-mode', 'dark');
  }
  
  // Try to detect GitHub's theme from the active tab
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('github.com')) {
        chrome.tabs.executeScript(tabs[0].id, {
          code: `
            const htmlElement = document.documentElement;
            const dataColorMode = htmlElement.getAttribute('data-color-mode');
            const dataLightTheme = htmlElement.getAttribute('data-light-theme');
            const dataDarkTheme = htmlElement.getAttribute('data-dark-theme');
            
            // GitHub's theme detection logic
            let theme = 'light';
            if (dataColorMode === 'dark' || 
                (dataColorMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
                dataDarkTheme === 'dark' ||
                document.body.classList.contains('dark')) {
              theme = 'dark';
            }
            theme;
          `
        }, function(result) {
          if (result && result[0] === 'dark') {
            document.body.setAttribute('data-color-mode', 'dark');
          } else {
            document.body.removeAttribute('data-color-mode');
          }
        });
      }
    });
  }
  
  // Listen for system theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
      if (e.matches) {
        document.body.setAttribute('data-color-mode', 'dark');
      } else {
        document.body.removeAttribute('data-color-mode');
      }
    });
  }
}

// Load saved filters or use defaults
async function loadFilters() {
  try {
    const result = await chrome.storage.sync.get({ filters: DEFAULT_FILTERS });
    return result.filters;
  } catch (error) {
    console.warn('Could not load filters, using defaults:', error);
    return DEFAULT_FILTERS;
  }
}

// Save filters to storage
async function saveFilters(filters) {
  try {
    await chrome.storage.sync.set({ filters });
  } catch (error) {
    console.error('Could not save filters:', error);
  }
}

// Apply filters to UI elements
function applyFiltersToUI(filters) {
  document.getElementById('dateRange').value = filters.dateRange || DEFAULT_FILTERS.dateRange;
  document.getElementById('customDays').value = filters.customDays || '';
  document.getElementById('showOpen').checked = filters.showOpen ?? DEFAULT_FILTERS.showOpen;
  document.getElementById('showDraft').checked = filters.showDraft ?? DEFAULT_FILTERS.showDraft;
  document.getElementById('showAuthor').checked = filters.showAuthor ?? DEFAULT_FILTERS.showAuthor;
  document.getElementById('showAssigned').checked = filters.showAssigned ?? DEFAULT_FILTERS.showAssigned;
  document.getElementById('showOthers').checked = filters.showOthers ?? DEFAULT_FILTERS.showOthers;
  document.getElementById('maxResults').value = filters.maxResults || DEFAULT_FILTERS.maxResults;
  document.getElementById('customMaxResults').value = filters.customMaxResults || '';
  
  // Show/hide custom inputs
  toggleCustomDaysInput();
  toggleCustomMaxResultsInput();
  
  // Update status indicator
  updateStatusIndicator(filters);
}

// Get current filters from UI
function getCurrentFilters() {
  return {
    dateRange: document.getElementById('dateRange').value,
    customDays: document.getElementById('customDays').value,
    showOpen: document.getElementById('showOpen').checked,
    showDraft: document.getElementById('showDraft').checked,
    showAuthor: document.getElementById('showAuthor').checked,
    showAssigned: document.getElementById('showAssigned').checked,
    showOthers: document.getElementById('showOthers').checked,
    maxResults: document.getElementById('maxResults').value,
    customMaxResults: document.getElementById('customMaxResults').value
  };
}

// Toggle custom days input visibility
function toggleCustomDaysInput() {
  const dateRange = document.getElementById('dateRange').value;
  const customDaysInput = document.getElementById('customDays');
  
  if (dateRange === 'custom') {
    customDaysInput.style.display = 'block';
    customDaysInput.focus();
  } else {
    customDaysInput.style.display = 'none';
  }
}

// Toggle custom max results input visibility
function toggleCustomMaxResultsInput() {
  const maxResults = document.getElementById('maxResults').value;
  const customMaxResultsInput = document.getElementById('customMaxResults');
  
  if (maxResults === 'custom') {
    customMaxResultsInput.style.display = 'block';
    customMaxResultsInput.focus();
  } else {
    customMaxResultsInput.style.display = 'none';
  }
}

// Update status indicator
function updateStatusIndicator(filters) {
  const statusIndicator = document.getElementById('filter-status');
  const isCustom = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  
  if (isCustom) {
    statusIndicator.textContent = 'Custom filters active';
    statusIndicator.className = 'status-indicator status-active';
  } else {
    statusIndicator.textContent = 'Using default filters';
    statusIndicator.className = 'status-indicator status-default';
  }
}

// Apply filters and notify content script
async function applyFilters() {
  const filters = getCurrentFilters();
  
  // Validate that at least one status type is selected
  if (!filters.showOpen && !filters.showDraft) {
    alert('Please select at least one PR status (Open or Draft)');
    return;
  }
  
  // Validate that at least one author type is selected
  if (!filters.showAuthor && !filters.showAssigned && !filters.showOthers) {
    // Auto-enable showAuthor if none are selected to prevent no results
    filters.showAuthor = true;
    document.getElementById('showAuthor').checked = true;
  }
  
  // Validate custom days if selected
  if (filters.dateRange === 'custom') {
    const customDays = Number.parseInt(filters.customDays, 10);
    if (!customDays || customDays < 1) {
      alert('Please enter a valid number of days (1 or more)');
      document.getElementById('customDays').focus();
      return;
    }
  }
  
  // Validate custom max results if selected
  if (filters.maxResults === 'custom') {
    const customMaxResults = Number.parseInt(filters.customMaxResults, 10);
    if (!customMaxResults || customMaxResults < 1 || customMaxResults > 50) {
      alert('Please enter a valid number of results (1-50)');
      document.getElementById('customMaxResults').focus();
      return;
    }
  }
  
  // Save filters
  await saveFilters(filters);
  
  // Update status indicator
  updateStatusIndicator(filters);
  
  // Notify content scripts to refresh with new filters
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes('github.com')) {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'updateFilters',
        filters: filters
      });
    }
  } catch (error) {
    console.warn('Could not update filters on page (extension may need reload):', error.message);
  }
  
  // Show success feedback
  const applyButton = document.getElementById('applyFilters');
  const originalText = applyButton.textContent;
  applyButton.textContent = 'Applied!';
  applyButton.style.background = '#2ea043';
  
  setTimeout(() => {
    applyButton.textContent = originalText;
    applyButton.style.background = '#238636';
  }, 1500);
}

// Reset to default filters
async function resetFilters() {
  applyFiltersToUI(DEFAULT_FILTERS);
  await saveFilters(DEFAULT_FILTERS);
  
  // Notify content scripts
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes('github.com')) {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'updateFilters',
        filters: DEFAULT_FILTERS
      });
    }
  } catch (error) {
    console.warn('Could not reset filters on page (extension may need reload):', error.message);
  }
  
  // Show feedback
  const resetButton = document.getElementById('resetFilters');
  const originalText = resetButton.textContent;
  resetButton.textContent = 'Reset!';
  
  setTimeout(() => {
    resetButton.textContent = originalText;
  }, 1500);
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Load and apply saved filters
  const savedFilters = await loadFilters();
  applyFiltersToUI(savedFilters);
  
  // Set up event listeners
  document.getElementById('dateRange').addEventListener('change', toggleCustomDaysInput);
  document.getElementById('maxResults').addEventListener('change', toggleCustomMaxResultsInput);
  document.getElementById('applyFilters').addEventListener('click', applyFilters);
  document.getElementById('resetFilters').addEventListener('click', resetFilters);
  
  // Allow Enter key to apply filters when in custom inputs
  document.getElementById('customDays').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      applyFilters();
    }
  });
  
  document.getElementById('customMaxResults').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      applyFilters();
    }
  });
});