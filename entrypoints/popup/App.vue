<script lang="ts" setup>
import { ref } from 'vue';

const checkboxSelector = ref('#auto');
const inputSelector = ref('input[placeholder="Enter Amount"]');
const buttonSelector = ref('button.from-red-600.to-red-900');
const inputValue = ref('5');
const status = ref('');
const selectedButton = ref('red'); // 'red' or 'blue'
const username = ref('Loading...');
const debugMessages = ref<string[]>([]);

function updateButtonSelector() {
  if (selectedButton.value === 'red') {
    buttonSelector.value = 'button.from-red-600.to-red-900';
  } else {
    buttonSelector.value = 'button.from-blue-600.to-blue-900';
  }
}

async function fetchUsername() {
  try {
    debugMessages.value = [];
    debugMessages.value.push('Starting username fetch...');

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      username.value = 'No active tab';
      debugMessages.value.push('❌ No active tab found');
      return;
    }

    debugMessages.value.push(`✓ Active tab: ${tab.title || 'Unknown'}`);

    const response = await browser.tabs.sendMessage(tab.id, {
      action: 'getUsername',
    });

    debugMessages.value.push(`Response type: ${typeof response}`);
    debugMessages.value.push(`Response received: ${JSON.stringify(response)}`);

    if (!response) {
      username.value = 'No response';
      debugMessages.value.push('❌ Response is null/undefined');
      debugMessages.value.push('💡 Content script may not be loaded');
      return;
    }

    if (response?.username) {
      username.value = response.username;
      debugMessages.value.push(`✓ Username: ${response.username}`);
    } else {
      username.value = 'Not found';
      debugMessages.value.push('❌ No username in response');
    }

    if (response?.debug && Array.isArray(response.debug)) {
      debugMessages.value.push('--- Content Script Debug ---');
      debugMessages.value.push(...response.debug);
    }
  } catch (error: any) {
    console.error('Fetch username error:', error);
    username.value = 'Error';
    debugMessages.value.push(`❌ Error: ${error?.message || 'Unknown error'}`);

    if (error?.message?.includes('Receiving end does not exist')) {
      username.value = 'Reload page';
      debugMessages.value.push('💡 Try reloading the webpage');
    }
  }
}

// Fetch username when popup opens - wrapped in try-catch
try {
  setTimeout(() => {
    fetchUsername().catch(err => {
      console.error('Failed to fetch username:', err);
      username.value = 'Error loading';
      debugMessages.value = [`Error: ${err.message}`];
    });
  }, 100);
} catch (err) {
  console.error('Setup error:', err);
}

async function runAutomation() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      status.value = 'Error: No active tab';
      return;
    }

    // Update button selector based on selection
    updateButtonSelector();

    // Check if content script is ready
    try {
      await browser.tabs.sendMessage(tab.id, {
        action: 'automate',
        checkboxSelector: checkboxSelector.value,
        inputSelector: inputSelector.value,
        buttonSelector: buttonSelector.value,
        inputValue: inputValue.value,
      });

      status.value = 'Automation triggered!';
      setTimeout(() => {
        status.value = '';
      }, 3000);
    } catch (error: any) {
      if (error.message?.includes('Receiving end does not exist')) {
        status.value = 'Please reload the webpage and try again';
      } else {
        status.value = `Error: ${error.message || error}`;
      }
    }
  } catch (error: any) {
    status.value = `Error: ${error.message || error}`;
  }
}
</script>

<template>
  <div class="popup-container">
    <h1>Form Automation Helper</h1>
    <p class="subtitle">Educational Tool for Learning DOM Manipulation</p>

    <div class="username-display">
      <span class="username-label">User:</span>
      <span class="username-value">{{ username }}</span>
      <button @click="fetchUsername" class="refresh-button" title="Refresh username">
        ↻
      </button>
    </div>

    <div class="form-group">
      <label>Checkbox Selector:</label>
      <input v-model="checkboxSelector" type="text" placeholder="input[type='checkbox']" />
    </div>

    <div class="form-group">
      <label>Input Selector:</label>
      <input v-model="inputSelector" type="text" placeholder="input[type='number']" />
    </div>

    <div class="form-group">
      <label>Input Value:</label>
      <input v-model="inputValue" type="text" placeholder="5" />
    </div>

    <div class="form-group">
      <label>Select Button:</label>
      <div class="button-selector">
        <button
          @click="selectedButton = 'red'"
          :class="['bet-option', 'red-bet', { active: selectedButton === 'red' }]"
          type="button"
        >
          🔴 MERON (Red)
        </button>
        <button
          @click="selectedButton = 'blue'"
          :class="['bet-option', 'blue-bet', { active: selectedButton === 'blue' }]"
          type="button"
        >
          🔵 WALA (Blue)
        </button>
      </div>
    </div>

    <div class="form-group">
      <label>Button Selector:</label>
      <input v-model="buttonSelector" type="text" placeholder="button" readonly />
    </div>

    <button @click="runAutomation" class="run-button">
      Run Automation
    </button>

    <div v-if="status" class="status">{{ status }}</div>

    <div v-if="debugMessages.length > 0" class="debug-panel">
      <div class="debug-header">Debug Info:</div>
      <div class="debug-messages">
        <div v-for="(msg, index) in debugMessages" :key="index" class="debug-message">
          {{ msg }}
        </div>
      </div>
    </div>

    <div class="info">
      <h3>How to use:</h3>
      <ol>
        <li>Open a webpage with a form</li>
        <li><strong>Reload the page</strong> (F5 or Ctrl/Cmd+R)</li>
        <li>Open DevTools (F12) to inspect elements</li>
        <li>Update selectors to match your form elements</li>
        <li>Click "Run Automation"</li>
      </ol>
      <p class="note"><strong>Note:</strong> If you see "Could not establish connection", reload the webpage.</p>
    </div>
  </div>
</template>

<style scoped>
.popup-container {
  width: 400px;
  padding: 20px;
  font-family: Arial, sans-serif;
}

h1 {
  font-size: 24px;
  margin-bottom: 5px;
  color: #333;
}

.subtitle {
  font-size: 12px;
  color: #666;
  margin-bottom: 15px;
}

.username-display {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.username-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.username-value {
  font-size: 16px;
  font-weight: 700;
  color: white;
  flex: 1;
}

.refresh-button {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.refresh-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: rotate(180deg);
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  font-size: 13px;
  color: #555;
}

.form-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}

.run-button {
  width: 100%;
  padding: 12px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 10px;
}

.run-button:hover {
  background-color: #45a049;
}

.status {
  margin-top: 15px;
  padding: 10px;
  background-color: #e7f3ff;
  border-left: 4px solid #2196F3;
  border-radius: 4px;
  font-size: 13px;
  color: #000;
  font-weight: 500;
}

.info {
  margin-top: 20px;
  padding: 15px;
  background-color: #f9f9f9;
  border-radius: 4px;
  font-size: 12px;
}

.info h3 {
  margin-top: 0;
  font-size: 14px;
  color: #333;
}

.info ol {
  margin: 10px 0 0 0;
  padding-left: 20px;
}

.info li {
  margin-bottom: 5px;
  color: #666;
}

.note {
  margin-top: 10px;
  padding: 8px;
  background-color: #fff3cd;
  border-left: 3px solid #ffc107;
  border-radius: 3px;
  font-size: 11px;
  color: #856404;
}

.button-selector {
  display: flex;
  gap: 10px;
}

.bet-option {
  flex: 1;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background-color: #f5f5f5;
  color: #666;
}

.bet-option:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.bet-option.active {
  border-width: 3px;
  transform: scale(1.05);
}

.red-bet {
  background: linear-gradient(to bottom, #fee, #fdd);
  border-color: #faa;
}

.red-bet.active {
  background: linear-gradient(to bottom, #dc2626, #991b1b);
  color: white;
  border-color: #dc2626;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

.blue-bet {
  background: linear-gradient(to bottom, #eff6ff, #dbeafe);
  border-color: #93c5fd;
}

.blue-bet.active {
  background: linear-gradient(to bottom, #2563eb, #1e3a8a);
  color: white;
  border-color: #2563eb;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.debug-panel {
  margin-top: 15px;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  background-color: #f8f9fa;
}

.debug-header {
  background-color: #343a40;
  color: white;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
}

.debug-messages {
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
}

.debug-message {
  font-family: 'Courier New', monospace;
  font-size: 10px;
  padding: 4px 8px;
  margin-bottom: 2px;
  background-color: white;
  border-left: 3px solid #6c757d;
  border-radius: 3px;
  line-height: 1.4;
  color: #212529;
  word-wrap: break-word;
}
</style>