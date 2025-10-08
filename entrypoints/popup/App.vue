<script lang="ts" setup>
import { ref } from 'vue';

// Configuration type definition
interface SelectorConfig {
  name: string;
  checkboxSelector: string;
  inputSelector: string;
  meronButtonSelector: string;
  walaButtonSelector: string;
  usernameSelector: string;
  balanceSelector: string;
}

// Configuration management
const configurations = ref<SelectorConfig[]>([]);
const selectedConfigName = ref('Option 1');
const newConfigName = ref('');
const showSaveDialog = ref(false);
const showSelectors = ref(false);

// Individual selector refs
const checkboxSelector = ref('#auto');
const inputSelector = ref('input[placeholder="Enter Amount"]');
const meronButtonSelector = ref('button.from-red-600.to-red-900');
const walaButtonSelector = ref('button.from-blue-600.to-blue-900');
const usernameSelector = ref('p.text-sm.text-right.pr-1.leading-none');
const balanceSelector = ref('p.text-vk884g-primary-color');
const buttonSelector = ref('button.from-red-600.to-red-900'); // For backward compatibility
const inputValue = ref('5');
const limitBalance = ref('45');
const autoBettingEnabled = ref(true);
const status = ref('');
const selectedButton = ref('red'); // 'red' or 'blue'
const username = ref('Loading...');
const balance = ref('...');
const debugMessages = ref<string[]>([]);
const autoRefresh = ref(true);
let refreshInterval: number | null = null;
let pusherWs: WebSocket | null = null;
const wsStatus = ref('Disconnected');
const wsMessages = ref<string[]>([]);
const currentPrediction = ref<any>(null);
const selectedChannel = ref('cockfight.channel.2');
const availableChannels = [
  'cockfight.channel.1',
  'cockfight.channel.2',
  'cockfight.channel.3',
  'cockfight.channel.4',
];

function updateButtonSelector() {
  if (selectedButton.value === 'red') {
    buttonSelector.value = meronButtonSelector.value;
  } else {
    buttonSelector.value = walaButtonSelector.value;
  }
}

// Configuration management functions
async function loadConfigurations() {
  try {
    const result = await browser.storage.local.get('selectorConfigs');
    if (result.selectorConfigs && Array.isArray(result.selectorConfigs)) {
      configurations.value = result.selectorConfigs;
    } else {
      // Initialize with default configurations
      configurations.value = [
        {
          name: 'Option 1',
          checkboxSelector: '#auto',
          inputSelector: 'input[placeholder="Enter Amount"]',
          meronButtonSelector: 'button.from-red-600.to-red-900',
          walaButtonSelector: 'button.from-blue-600.to-blue-900',
          usernameSelector: 'p.text-sm.text-right.pr-1.leading-none',
          balanceSelector: 'p.text-vk884g-primary-color',
        },
        {
          name: 'Option 2',
          checkboxSelector: '#auto',
          inputSelector: 'input[placeholder="បញ្ចូលចំនួនទឹកប្រាក់"]',
          meronButtonSelector: 'button.from-red-600.to-red-900.rounded-full',
          walaButtonSelector: 'button.from-blue-600.to-blue-900.rounded-full',
          usernameSelector: 'p.text-base.font-medium.text-white',
          balanceSelector: 'button.bg-black span.text-white',
        },
      ];
      await saveConfigurationsToStorage();
    }
  } catch (error) {
    console.error('Failed to load configurations:', error);
  }
}

async function saveConfigurationsToStorage() {
  try {
    await browser.storage.local.set({ selectorConfigs: configurations.value });
  } catch (error) {
    console.error('Failed to save configurations:', error);
  }
}

function switchConfiguration() {
  const config = configurations.value.find(c => c.name === selectedConfigName.value);
  if (config) {
    checkboxSelector.value = config.checkboxSelector;
    inputSelector.value = config.inputSelector;
    meronButtonSelector.value = config.meronButtonSelector;
    walaButtonSelector.value = config.walaButtonSelector;
    usernameSelector.value = config.usernameSelector;
    balanceSelector.value = config.balanceSelector;
    updateButtonSelector();
  }
}

function saveCurrentConfiguration() {
  const existingIndex = configurations.value.findIndex(c => c.name === selectedConfigName.value);
  const config: SelectorConfig = {
    name: selectedConfigName.value,
    checkboxSelector: checkboxSelector.value,
    inputSelector: inputSelector.value,
    meronButtonSelector: meronButtonSelector.value,
    walaButtonSelector: walaButtonSelector.value,
    usernameSelector: usernameSelector.value,
    balanceSelector: balanceSelector.value,
  };

  if (existingIndex >= 0) {
    configurations.value[existingIndex] = config;
  } else {
    configurations.value.push(config);
  }

  saveConfigurationsToStorage();
  status.value = `Configuration "${selectedConfigName.value}" saved!`;
  setTimeout(() => { status.value = ''; }, 2000);
}

function saveAsNewConfiguration() {
  if (!newConfigName.value.trim()) {
    status.value = 'Please enter a configuration name';
    return;
  }

  const config: SelectorConfig = {
    name: newConfigName.value.trim(),
    checkboxSelector: checkboxSelector.value,
    inputSelector: inputSelector.value,
    meronButtonSelector: meronButtonSelector.value,
    walaButtonSelector: walaButtonSelector.value,
    usernameSelector: usernameSelector.value,
    balanceSelector: balanceSelector.value,
  };

  configurations.value.push(config);
  selectedConfigName.value = config.name;
  saveConfigurationsToStorage();
  showSaveDialog.value = false;
  newConfigName.value = '';
  status.value = `Configuration "${config.name}" created!`;
  setTimeout(() => { status.value = ''; }, 2000);
}

function deleteConfiguration() {
  if (configurations.value.length <= 1) {
    status.value = 'Cannot delete the last configuration';
    setTimeout(() => { status.value = ''; }, 2000);
    return;
  }

  const index = configurations.value.findIndex(c => c.name === selectedConfigName.value);
  if (index >= 0) {
    const deletedName = configurations.value[index].name;
    configurations.value.splice(index, 1);
    selectedConfigName.value = configurations.value[0].name;
    switchConfiguration();
    saveConfigurationsToStorage();
    status.value = `Configuration "${deletedName}" deleted`;
    setTimeout(() => { status.value = ''; }, 2000);
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
      usernameSelector: usernameSelector.value,
      balanceSelector: balanceSelector.value,
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

    if (response?.balance) {
      balance.value = response.balance;
      debugMessages.value.push(`✓ Balance: ${response.balance}`);
    } else {
      balance.value = 'Not found';
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

// Start auto-refresh
function startAutoRefresh() {
  // Initial fetch
  setTimeout(() => {
    fetchUsername().catch(err => {
      console.error('Failed to fetch username:', err);
      username.value = 'Error loading';
      debugMessages.value = [`Error: ${err.message}`];
    });
  }, 100);

  // Set up interval for auto-refresh
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  refreshInterval = window.setInterval(() => {
    if (autoRefresh.value) {
      fetchUsername().catch(err => {
        console.error('Auto-refresh failed:', err);
      });
    }
  }, 5000); // Refresh every 5 seconds
}

// Stop auto-refresh when popup closes
function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

// Initialize and start auto-refresh on load
try {
  loadConfigurations().then(async () => {
    // Check if we should auto-select based on domain
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        const url = new URL(tab.url);
        if (url.hostname.includes('fun88kh.com')) {
          selectedConfigName.value = 'Option 2';
          console.log('Auto-selected Option 2 for fun88kh.com');
        }
      }
    } catch (err) {
      console.error('Error checking domain:', err);
    }
    switchConfiguration(); // Load the selected config
  });
  startAutoRefresh();
} catch (err) {
  console.error('Setup error:', err);
}

// WebSocket connection to Pusher
function connectPusher() {
  const wsUrl = 'wss://ws-fun-analyzer.kravanh.dev/app/9cpbe4mbozz6fjriingr?protocol=7&client=js&version=8.4.0&flash=false';

  wsStatus.value = 'Connecting...';
  wsMessages.value.push(`📡 Connecting to Pusher...`);

  try {
    pusherWs = new WebSocket(wsUrl);

    pusherWs.onopen = () => {
      console.log('Pusher WebSocket connected');
      wsStatus.value = 'Connected';
      wsMessages.value.push('✅ Connected to Pusher');

      // Subscribe to cockfight-matches channel
      const subscribeMsg = {
        event: 'pusher:subscribe',
        data: {
          channel: 'cockfight-matches'
        }
      };
      pusherWs?.send(JSON.stringify(subscribeMsg));
      wsMessages.value.push('📢 Subscribing to cockfight-matches');
    };

    pusherWs.onmessage = (event) => {
      console.log('Pusher message:', event.data);
      try {
        const data = JSON.parse(event.data);

        // Handle Pusher ping - respond with pong
        if (data.event === 'pusher:ping') {
          pusherWs?.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
          console.log('Sent pong response');
          return;
        }

        // Handle Pusher errors
        if (data.event === 'pusher:error') {
          const errorData = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
          wsMessages.value.push(`⚠️ Error: ${errorData.message}`);
          console.error('Pusher error:', errorData);
          return;
        }

        // Handle different event types
        if (data.event === 'pusher:connection_established') {
          wsMessages.value.push('✅ Connection established');
        } else if (data.event === 'pusher_internal:subscription_succeeded') {
          wsMessages.value.push('✅ Subscribed to channel');
        } else if (data.event === '.match.betting.opened') {
          // Parse data if needed
          let matchData = data.data;
          if (typeof matchData === 'string') {
            matchData = JSON.parse(matchData);
          }

          // Filter by channel
          if (matchData?.match?.channel_id !== selectedChannel.value) {
            return;
          }

          const fightNum = matchData?.match?.fight_number;
          wsMessages.value.push(`🎲 Betting opened: Fight #${fightNum}`);
        } else if (data.event === '.match.betting.closed') {
          // Parse data if needed
          let matchData = data.data;
          if (typeof matchData === 'string') {
            matchData = JSON.parse(matchData);
          }

          // Filter by channel
          if (matchData?.match?.channel_id !== selectedChannel.value) {
            return;
          }

          const fightNum = matchData?.match?.fight_number;
          wsMessages.value.push(`🚫 Betting closed: Fight #${fightNum}`);
        } else if (data.event === 'match.predicted' || data.event === '.match.predicted') {
          // Parse the data - it might be a string that needs parsing
          let matchData = data.data;
          if (typeof matchData === 'string') {
            matchData = JSON.parse(matchData);
          }

          const match = matchData?.match;
          const prediction = matchData?.prediction;
          const channelId = match?.channel_id;

          // Only process if it matches the selected channel
          if (channelId !== selectedChannel.value) {
            console.log(`Ignoring prediction from ${channelId}, listening to ${selectedChannel.value}`);
            return;
          }

          const fightNum = match?.fight_number;
          const predictedResult = match?.predicted_result?.toUpperCase();
          const confidence = match?.prediction_confidence || prediction?.confidence;

          // Store current prediction
          currentPrediction.value = {
            fightNumber: fightNum,
            result: predictedResult,
            confidence: parseFloat(confidence),
            strategy: prediction?.strategy,
            reasoning: prediction?.reasoning,
            probabilities: prediction?.probabilities,
            channel: channelId || 'Unknown'
          };

          wsMessages.value.push(`🔮 Fight #${fightNum}: ${predictedResult} (${confidence}%)`);
          console.log('Prediction details:', matchData);

          // Check if auto-betting is enabled and limit balance hasn't been reached
          if (!autoBettingEnabled.value) {
            wsMessages.value.push(`⏸️ Auto-betting is disabled`);
            return;
          }

          // Check limit balance
          if (limitBalance.value) {
            const currentBalance = parseFloat(balance.value.replace(/[^0-9.-]/g, ''));
            const limit = parseFloat(limitBalance.value);

            if (!isNaN(currentBalance) && !isNaN(limit) && currentBalance >= limit) {
              autoBettingEnabled.value = false;
              wsMessages.value.push(`🛑 Limit reached! Balance: ${balance.value} >= Limit: $${limit}`);
              status.value = `Auto-betting stopped: Balance limit reached ($${limit})`;
              return;
            }
          }

          // Auto-bet based on prediction
          if (predictedResult === 'MERON') {
            selectedButton.value = 'red';
            wsMessages.value.push(`🤖 Auto-betting MERON...`);
            setTimeout(() => runAutomation(), 500);
          } else if (predictedResult === 'WALA') {
            selectedButton.value = 'blue';
            wsMessages.value.push(`🤖 Auto-betting WALA...`);
            setTimeout(() => runAutomation(), 500);
          }

        } else if (data.event === '.match.ended') {
          // Parse data if needed
          let matchData = data.data;
          if (typeof matchData === 'string') {
            matchData = JSON.parse(matchData);
          }

          // Filter by channel
          if (matchData?.match?.channel_id !== selectedChannel.value) {
            return;
          }

          const fightNum = matchData?.match?.fight_number;
          const result = matchData?.match?.result;
          wsMessages.value.push(`🏁 Fight #${fightNum} ended: ${result}`);
        } else {
          wsMessages.value.push(`📨 ${data.event}: ${JSON.stringify(data.data || {}).substring(0, 50)}`);
        }

        // Keep only last 15 messages
        if (wsMessages.value.length > 15) {
          wsMessages.value.shift();
        }
      } catch (err) {
        wsMessages.value.push(`📨 ${event.data.substring(0, 100)}`);
      }
    };

    pusherWs.onerror = (error) => {
      console.error('Pusher WebSocket error:', error);
      wsStatus.value = 'Error';
      wsMessages.value.push('❌ Connection error');
    };

    pusherWs.onclose = () => {
      console.log('Pusher WebSocket closed');
      wsStatus.value = 'Disconnected';
      wsMessages.value.push('🔌 Disconnected from Pusher');

      // Auto-reconnect after 3 seconds
      setTimeout(() => {

        if (!pusherWs || pusherWs.readyState === WebSocket.CLOSED) {
          wsMessages.value.push('🔄 Reconnecting...');
          connectPusher();
        }
        pusherWs?.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
      }, 3000);
    };
  } catch (err) {
    console.error('Failed to connect to Pusher:', err);
    wsStatus.value = 'Failed';
    wsMessages.value.push(`❌ Failed: ${err}`);
  }
}

function disconnectPusher() {
  if (pusherWs) {
    pusherWs.close();
    pusherWs = null;
  }
}

// Cleanup on unmount
import { onUnmounted } from 'vue';
onUnmounted(() => {
  stopAutoRefresh();
  disconnectPusher();
});

// Connect to Pusher on load
connectPusher();

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
    <div class="channel-selector-container">
      <label class="channel-label">Channel:</label>
      <select v-model="selectedChannel" class="channel-select">
        <option v-for="channel in availableChannels" :key="channel" :value="channel">
          {{ channel }}
        </option>
      </select>
    </div>

    <div class="config-selector-container">
      <label class="config-label">Configuration:</label>
      <select v-model="selectedConfigName" @change="switchConfiguration" class="config-select">
        <option v-for="config in configurations" :key="config.name" :value="config.name">
          {{ config.name }}
        </option>
      </select>
      <div class="config-buttons">
        <button @click="saveCurrentConfiguration" class="config-btn save-btn" title="Save current selectors">
          💾
        </button>
        <button @click="showSaveDialog = true" class="config-btn new-btn" title="Save as new configuration">
          ➕
        </button>
        <button @click="deleteConfiguration" class="config-btn delete-btn" title="Delete configuration">
          🗑️
        </button>
      </div>
    </div>

    <div v-if="showSaveDialog" class="save-dialog">
      <div class="save-dialog-content">
        <h3>Save as New Configuration</h3>
        <input v-model="newConfigName" type="text" placeholder="Enter configuration name" class="config-name-input" />
        <div class="save-dialog-buttons">
          <button @click="saveAsNewConfiguration" class="save-dialog-btn save">Save</button>
          <button @click="showSaveDialog = false; newConfigName = ''" class="save-dialog-btn cancel">Cancel</button>
        </div>
      </div>
    </div>

    <div class="username-display">
      <div class="user-info">
        <div class="info-row">
          <span class="info-label">User:</span>
          <span class="info-value">{{ username }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Balance:</span>
          <span class="info-value balance-value">{{ balance }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">WS:</span>
          <span :class="['ws-status', wsStatus.toLowerCase()]">{{ wsStatus }}</span>
        </div>
        <div class="info-row auto-refresh-row">
          <label class="auto-refresh-label">
            <input type="checkbox" v-model="autoRefresh" class="auto-refresh-checkbox" />
            <span>Auto-refresh (5s)</span>
          </label>
        </div>
      </div>
      <button @click="fetchUsername" class="refresh-button" title="Manual Refresh">
        ↻
      </button>
    </div>

    <div v-if="currentPrediction" class="prediction-box">
      <div class="prediction-header">
        <div class="prediction-header-left">
          <span class="prediction-title">🔮 AI PREDICTION</span>
          <span class="channel-badge">{{ currentPrediction.channel }}</span>
        </div>
        <span class="fight-number">Fight #{{ currentPrediction.fightNumber }}</span>
      </div>
      <div class="prediction-content">
        <div :class="['prediction-result', currentPrediction.result?.toLowerCase()]">
          {{ currentPrediction.result }}
        </div>
        <div class="prediction-confidence">
          <div class="confidence-label">Confidence</div>
          <div class="confidence-value">{{ currentPrediction.confidence }}%</div>
          <div class="confidence-bar">
            <div class="confidence-fill" :style="{ width: currentPrediction.confidence + '%' }"></div>
          </div>
        </div>
      </div>
      <div v-if="currentPrediction.reasoning" class="prediction-reasoning">
        <div class="reasoning-label">Strategy:</div>
        <div class="reasoning-text">{{ currentPrediction.strategy }}</div>
        <div class="reasoning-label">Reasoning:</div>
        <div class="reasoning-text">{{ currentPrediction.reasoning }}</div>
      </div>
      <div v-if="currentPrediction.probabilities" class="prediction-probabilities">
        <div class="prob-item">
          <span>MERON:</span>
          <span class="prob-value">{{ (currentPrediction.probabilities.meron * 100).toFixed(1) }}%</span>
        </div>
        <div class="prob-item">
          <span>WALA:</span>
          <span class="prob-value">{{ (currentPrediction.probabilities.wala * 100).toFixed(1) }}%</span>
        </div>
      </div>
    </div>

    <div v-if="wsMessages.length > 0" class="ws-messages">
      <div class="ws-header">WebSocket Messages:</div>
      <div class="ws-message" v-for="(msg, index) in wsMessages" :key="index">
        {{ msg }}
      </div>
    </div>

    <div class="selectors-toggle">
      <button @click="showSelectors = !showSelectors" class="toggle-button">
        <span>{{ showSelectors ? '▼' : '▶' }}</span>
        <span>{{ showSelectors ? 'Hide' : 'Show' }} Selector Configuration</span>
      </button>
    </div>

    <div v-if="showSelectors" class="selectors-section">
      <div class="form-group">
        <label>Username Selector:</label>
        <input v-model="usernameSelector" type="text" placeholder="CSS selector for username" />
      </div>

      <div class="form-group">
        <label>Balance Selector:</label>
        <input v-model="balanceSelector" type="text" placeholder="CSS selector for balance" />
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
        <label>Limit Balance:</label>
        <input v-model="limitBalance" type="number" step="0.01" placeholder="Enter limit (e.g., 100)" />
        <p class="hint-text">Auto-betting will stop when balance reaches this limit</p>
      </div>

      <div class="form-group">
        <label class="toggle-label">
          <input type="checkbox" v-model="autoBettingEnabled" class="toggle-checkbox" />
          <span>Enable Auto-Betting</span>
        </label>
      </div>

      <div class="form-group">
        <label>MERON Button Selector:</label>
        <input v-model="meronButtonSelector" type="text" placeholder="button.from-red-600.to-red-900" />
      </div>

      <div class="form-group">
        <label>WALA Button Selector:</label>
        <input v-model="walaButtonSelector" type="text" placeholder="button.from-blue-600.to-blue-900" />
      </div>

      <div class="form-group">
        <label>Select Button:</label>
        <div class="button-selector">
          <button @click="selectedButton = 'red'; updateButtonSelector()"
            :class="['bet-option', 'red-bet', { active: selectedButton === 'red' }]" type="button">
            🔴 MERON (Red)
          </button>
          <button @click="selectedButton = 'blue'; updateButtonSelector()"
            :class="['bet-option', 'blue-bet', { active: selectedButton === 'blue' }]" type="button">
            🔵 WALA (Blue)
          </button>
        </div>
      </div>

      <button @click="runAutomation" class="run-button">
        Run Automation
      </button>
    </div>

    <div v-if="status" class="status">{{ status }}</div>

    <div v-if="debugMessages.length > 0" class="debug-panel">
      <div class="debug-header">Debug Info:</div>
      <div class="debug-messages">
        <div v-for="(msg, index) in debugMessages" :key="index" class="debug-message">
          {{ msg }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.popup-container {
  width: 400px;
  padding: 20px;
  font-family: Arial, sans-serif;
}

.channel-selector-container {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
  padding: 12px 15px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(245, 87, 108, 0.3);
}

.channel-label {
  font-size: 13px;
  font-weight: 700;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.channel-select {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.channel-select:hover {
  background: white;
  border-color: rgba(255, 255, 255, 0.6);
}

.channel-select:focus {
  outline: none;
  border-color: white;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.2);
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
  gap: 12px;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  min-width: 60px;
}

.info-value {
  font-size: 15px;
  font-weight: 700;
  color: white;
}

.balance-value {
  color: #ffd700;
  font-size: 16px;
}

.auto-refresh-row {
  margin-top: 4px;
}

.auto-refresh-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  user-select: none;
}

.auto-refresh-checkbox {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: #ffd700;
}

.auto-refresh-label span {
  font-weight: 500;
}

.ws-status {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.ws-status.connected {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.ws-status.connecting {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.ws-status.disconnected,
.ws-status.error,
.ws-status.failed {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.prediction-box {
  margin-top: 15px;
  margin-bottom: 15px;
  border: 2px solid #8b5cf6;
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.prediction-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: rgba(0, 0, 0, 0.2);
}

.prediction-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.prediction-title {
  font-weight: 700;
  font-size: 14px;
  color: white;
  letter-spacing: 1px;
}

.channel-badge {
  font-size: 10px;
  color: white;
  background: rgba(255, 215, 0, 0.3);
  border: 1px solid rgba(255, 215, 0, 0.6);
  padding: 3px 8px;
  border-radius: 8px;
  font-weight: 600;
  text-transform: uppercase;
}

.fight-number {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 600;
}

.prediction-content {
  padding: 15px;
  display: flex;
  gap: 15px;
  align-items: center;
}

.prediction-result {
  flex-shrink: 0;
  font-size: 32px;
  font-weight: 900;
  padding: 15px 25px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  letter-spacing: 1px;
}

.prediction-result.meron {
  background: linear-gradient(135deg, #dc2626, #991b1b);
  color: white;
}

.prediction-result.wala {
  background: linear-gradient(135deg, #2563eb, #1e3a8a);
  color: white;
}

.prediction-confidence {
  flex: 1;
}

.confidence-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.confidence-value {
  font-size: 24px;
  font-weight: 700;
  color: white;
  margin: 5px 0;
}

.confidence-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #ffd700);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.prediction-reasoning {
  padding: 12px 15px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.reasoning-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 600;
  text-transform: uppercase;
  margin-top: 8px;
  margin-bottom: 4px;
}

.reasoning-label:first-child {
  margin-top: 0;
}

.reasoning-text {
  font-size: 11px;
  color: white;
  line-height: 1.4;
}

.prediction-probabilities {
  display: flex;
  gap: 10px;
  padding: 10px 15px;
  background: rgba(0, 0, 0, 0.15);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.prob-item {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}

.prob-value {
  color: #ffd700;
  font-weight: 700;
}

.ws-messages {
  margin-top: 15px;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  background-color: #f8f9fa;
  max-height: 150px;
  overflow-y: auto;
}

.ws-header {
  background-color: #343a40;
  color: white;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
}

.ws-message {
  font-family: 'Courier New', monospace;
  font-size: 9px;
  padding: 4px 10px;
  border-bottom: 1px solid #e9ecef;
  color: #495057;
}

.ws-message:last-child {
  border-bottom: none;
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

/* Configuration selector styles */
.config-selector-container {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 15px;
  padding: 12px 15px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.config-label {
  font-size: 12px;
  font-weight: 700;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.config-select {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.config-select:hover {
  background: white;
  border-color: rgba(255, 255, 255, 0.6);
}

.config-select:focus {
  outline: none;
  border-color: white;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.2);
}

.config-buttons {
  display: flex;
  gap: 6px;
}

.config-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.2);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.config-btn:hover {
  background: rgba(255, 255, 255, 0.4);
  border-color: rgba(255, 255, 255, 0.6);
  transform: scale(1.05);
}

.config-btn:active {
  transform: scale(0.95);
}

.save-dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.save-dialog-content {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  width: 300px;
}

.save-dialog-content h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #333;
}

.config-name-input {
  width: 100%;
  padding: 10px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  box-sizing: border-box;
  margin-bottom: 15px;
}

.config-name-input:focus {
  outline: none;
  border-color: #667eea;
}

.save-dialog-buttons {
  display: flex;
  gap: 10px;
}

.save-dialog-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.save-dialog-btn.save {
  background: #667eea;
  color: white;
}

.save-dialog-btn.save:hover {
  background: #5568d3;
}

.save-dialog-btn.cancel {
  background: #e0e0e0;
  color: #666;
}

.save-dialog-btn.cancel:hover {
  background: #d0d0d0;
}

.selectors-toggle {
  margin: 15px 0;
}

.toggle-button {
  width: 100%;
  padding: 12px 15px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.toggle-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.toggle-button:active {
  transform: translateY(0);
}

.toggle-button span:first-child {
  font-size: 10px;
  transition: transform 0.2s;
}

.selectors-section {
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hint-text {
  font-size: 11px;
  color: #666;
  margin-top: 4px;
  font-style: italic;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  padding: 8px 0;
}

.toggle-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #667eea;
}

.toggle-label span {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}
</style>