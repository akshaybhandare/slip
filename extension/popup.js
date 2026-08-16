document.addEventListener('DOMContentLoaded', async () => {
  const unconfiguredView = document.getElementById('unconfigured-view');
  const clipperView = document.getElementById('clipper-view');
  const openSettingsBtn = document.getElementById('open-settings');
  const btnConfig = document.getElementById('btn-config');
  const pageTitleEl = document.getElementById('page-title');
  const pageDomainEl = document.getElementById('page-domain');
  const tagsChipsEl = document.getElementById('tags-chips');
  const tagInput = document.getElementById('tag-input');
  const saveBtn = document.getElementById('save-btn');
  const saveBtnText = document.getElementById('save-btn-text');
  const saveSpinner = document.getElementById('save-spinner');
  const saveFeedback = document.getElementById('save-feedback');

  const tags = [];
  let currentTab = null;
  let serverUrl = '';
  let apiKey = '';

  const openSettings = () => {
    if (chrome && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('options.html');
    }
  };

  openSettingsBtn.addEventListener('click', openSettings);
  btnConfig.addEventListener('click', openSettings);

  // Load storage
  const storageData = await new Promise((resolve) => {
    if (chrome && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['slip_server_url', 'slip_api_key'], resolve);
    } else {
      resolve({
        slip_server_url: localStorage.getItem('slip_server_url'),
        slip_api_key: localStorage.getItem('slip_api_key')
      });
    }
  });

  serverUrl = storageData.slip_server_url || '';
  apiKey = storageData.slip_api_key || '';

  if (!serverUrl || !apiKey) {
    clipperView.classList.add('hidden');
    unconfiguredView.classList.remove('hidden');
    return;
  }

  // Get active tab URL
  if (chrome && chrome.tabs && chrome.tabs.query) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      currentTab = tabs[0];
    }
  }

  if (!currentTab || !currentTab.url) {
    currentTab = {
      url: window.location.href,
      title: document.title
    };
  }

  pageTitleEl.textContent = currentTab.title || currentTab.url;
  try {
    pageDomainEl.textContent = new URL(currentTab.url).hostname.replace(/^www\./, '');
  } catch {
    pageDomainEl.textContent = currentTab.url;
  }

  // Tag input handling
  const renderTags = () => {
    tagsChipsEl.innerHTML = '';
    tags.forEach((tag, idx) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `#${tag} <button type="button" class="tag-chip-remove" data-idx="${idx}">×</button>`;
      tagsChipsEl.appendChild(chip);
    });

    tagsChipsEl.querySelectorAll('.tag-chip-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const i = Number(e.currentTarget.getAttribute('data-idx'));
        tags.splice(i, 1);
        renderTags();
      });
    });
  };

  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.value.trim().toLowerCase().replace(/^#/, '');
      if (val && !tags.includes(val)) {
        tags.push(val);
        renderTags();
      }
      tagInput.value = '';
    } else if (e.key === 'Backspace' && !tagInput.value && tags.length > 0) {
      tags.pop();
      renderTags();
    }
  });

  // Save Bookmark
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtnText.textContent = 'Saving...';
    saveSpinner.classList.remove('hidden');
    saveFeedback.classList.add('hidden');

    const cleanServerUrl = serverUrl.replace(/\/+$/, '');

    try {
      const response = await fetch(`${cleanServerUrl}/api/bookmarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          url: currentTab.url,
          title: currentTab.title || undefined,
          tags: tags.length > 0 ? tags : undefined
        })
      });

      if (response.ok) {
        saveBtnText.textContent = '✓ Saved!';
        saveSpinner.classList.add('hidden');
        saveFeedback.textContent = 'Bookmark saved to Slip archive!';
        saveFeedback.className = 'feedback-msg feedback-success';
        saveFeedback.classList.remove('hidden');

        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || response.statusText || 'Failed to save');
      }
    } catch (err) {
      saveBtn.disabled = false;
      saveBtnText.textContent = 'Retry Save';
      saveSpinner.classList.add('hidden');
      saveFeedback.textContent = `Error: ${err.message}`;
      saveFeedback.className = 'feedback-msg feedback-error';
      saveFeedback.classList.remove('hidden');
    }
  });
});
