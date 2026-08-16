document.addEventListener('DOMContentLoaded', () => {
  const serverUrlInput = document.getElementById('server-url');
  const apiKeyInput = document.getElementById('api-key');
  const form = document.getElementById('settings-form');
  const testBtn = document.getElementById('test-btn');
  const statusMsg = document.getElementById('status-msg');

  // Load existing settings
  if (chrome && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['slip_server_url', 'slip_api_key'], (result) => {
      if (result.slip_server_url) serverUrlInput.value = result.slip_server_url;
      if (result.slip_api_key) apiKeyInput.value = result.slip_api_key;
    });
  }

  // Save settings
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let url = serverUrlInput.value.trim().replace(/\/+$/, '');
    const key = apiKeyInput.value.trim();

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }

    if (chrome && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ slip_server_url: url, slip_api_key: key }, () => {
        showStatus('✓ Settings saved successfully!', 'success');
      });
    } else {
      localStorage.setItem('slip_server_url', url);
      localStorage.setItem('slip_api_key', key);
      showStatus('✓ Settings saved successfully!', 'success');
    }
  });

  // Test connection
  testBtn.addEventListener('click', async () => {
    let url = serverUrlInput.value.trim().replace(/\/+$/, '');
    const key = apiKeyInput.value.trim();

    if (!url || !key) {
      showStatus('Please enter both Server URL and API Key before testing.', 'error');
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }

    showStatus('Connecting to Slip server...', '');
    testBtn.disabled = true;

    try {
      const response = await fetch(`${url}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        showStatus(`✓ Connected successfully as @${data.user?.username || 'User'}!`, 'success');
      } else {
        const err = await response.json().catch(() => ({}));
        showStatus(`✕ Connection failed: ${err.message || response.statusText || 'Unauthorized'}`, 'error');
      }
    } catch (err) {
      showStatus(`✕ Connection error: Could not reach ${url}. Check your server and port.`, 'error');
    } finally {
      testBtn.disabled = false;
    }
  });

  function showStatus(text, type) {
    statusMsg.textContent = text;
    statusMsg.className = type ? `status-${type}` : '';
  }
});
