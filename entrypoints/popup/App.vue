<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';

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

// UI State
const configurations = ref<SelectorConfig[]>([]);
const selectedConfigName = ref('Option 1');
const newConfigName = ref('');
const showSaveDialog = ref(false);
const showSelectors = ref(false);

// Individual selector refs (for editing)
const checkboxSelector = ref('#auto');
const inputSelector = ref('input[placeholder="Enter Amount"]');
const meronButtonSelector = ref('button.from-red-600.to-red-900');
const walaButtonSelector = ref('button.from-blue-600.to-blue-900');
const usernameSelector = ref('p.text-sm.text-right.pr-1.leading-none');
const balanceSelector = ref('p.text-vk884g-primary-color');
const inputValue = ref('5');
const limitBalance = ref('45');
const autoBettingEnabled = ref(true);
const selectedButton = ref('red');

// Display data (from background)
const username = ref('Loading...');
const balance = ref('...');
const wsStatus = ref('Disconnected');
const wsMessages = ref<string[]>([]);
const currentPrediction = ref<any>(null);
const selectedChannel = ref('cockfight.channel.2');
const status = ref('');
const debugMessages = ref<string[]>([]);

const availableChannels = [
  'cockfight.channel.1',
  'cockfight.channel.2',
  'cockfight.channel.3',
  'cockfight.channel.4',
];

// Get initial state from background
async function loadStateFromBackground() {
  try {
    const state = await browser.runtime.sendMessage({ action: 'getState' });
    if (state) {
      username.value = state.username || 'Not found';
      balance.value = state.balance || 'Not found';
      currentPrediction.value = state.prediction;
      wsStatus.value = state.wsStatus || 'Disconnected';
      wsMessages.value = state.wsMessages || [];
      autoBettingEnabled.value = state.autoBettingEnabled ?? true;
      limitBalance.value = state.limitBalance || '45';
      selectedChannel.value = state.selectedChannel || 'cockfight.channel.2';
      selectedConfigName.value = state.selectedConfigName || 'Option 1';
      inputValue.value = state.inputValue || '5';
    }
  } catch (error) {
    console.error('Failed to load state from background:', error);
  }
}

// Listen for updates from background
function setupBackgroundListener() {
  browser.runtime.onMessage.addListener((message) => {
    console.log('Popup received message:', message);

    if (message.type === 'balanceUpdate') {
      username.value = message.username || 'Not found';
      balance.value = message.balance || 'Not found';
    }

    if (message.type === 'predictionUpdate') {
      currentPrediction.value = message.prediction;
    }

    if (message.type === 'wsMessage') {
      if (message.messages) {
        wsMessages.value = message.messages;
      } else if (message.message) {
        wsMessages.value.push(message.message);
        if (wsMessages.value.length > 15) {
          wsMessages.value.shift();
        }
      }
    }

    if (message.type === 'autoBettingDisabled') {
      autoBettingEnabled.value = false;
      status.value = `Auto-betting stopped: ${message.reason}`;
    }
  });
}

// Send settings updates to background
async function updateBackgroundSettings() {
  await browser.runtime.sendMessage({
    action: 'updateSettings',
    autoBettingEnabled: autoBettingEnabled.value,
    limitBalance: limitBalance.value,
    selectedChannel: selectedChannel.value,
    selectedConfigName: selectedConfigName.value,
    inputValue: inputValue.value,
  });
}

// Watch for changes and sync to background
function watchChanges() {
  // Channel change
  const originalChannel = selectedChannel.value;
  setInterval(() => {
    if (selectedChannel.value !== originalChannel) {
      updateBackgroundSettings();
    }
  }, 500);
}

// Configuration management
async function loadConfigurations() {
  try {
    const result = await browser.storage.local.get('selectorConfigs');
    if (result.selectorConfigs && Array.isArray(result.selectorConfigs)) {
      configurations.value = result.selectorConfigs;
    } else {
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
          balanceSelector: 'button.bg-black.rounded-full span.text-white',
        },
      ];
      await browser.storage.local.set({ selectorConfigs: configurations.value });
    }
  } catch (error) {
    console.error('Failed to load configurations:', error);
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
  }
  updateBackgroundSettings();
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

  browser.storage.local.set({ selectorConfigs: configurations.value });
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
  browser.storage.local.set({ selectorConfigs: configurations.value });
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
    browser.storage.local.set({ selectorConfigs: configurations.value });
    status.value = `Configuration "${deletedName}" deleted`;
    setTimeout(() => { status.value = ''; }, 2000);
  }
}

// Manual refresh
async function fetchBalance() {
  try {
    await browser.runtime.sendMessage({ action: 'fetchBalance' });
  } catch (error) {
    console.error('Failed to fetch balance:', error);
  }
}

// Manual test betting
async function testBet(betType: 'red' | 'blue') {
  try {
    await browser.runtime.sendMessage({
      action: 'testBet',
      betType: betType
    });
    status.value = `Test bet triggered: ${betType === 'red' ? 'MERON' : 'WALA'}`;
    setTimeout(() => { status.value = ''; }, 2000);
  } catch (error) {
    console.error('Failed to trigger test bet:', error);
  }
}

// Initialize
onMounted(async () => {
  await loadConfigurations();
  await loadStateFromBackground();

  // Auto-select based on domain
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const url = new URL(tab.url);
      if (url.hostname.includes('fun88kh.com')) {
        selectedConfigName.value = 'Option 2';
        switchConfiguration();
      } else {
        switchConfiguration();
      }
    }
  } catch (err) {
    console.error('Error checking domain:', err);
  }

  setupBackgroundListener();
});

onUnmounted(() => {
  // Cleanup if needed
});
</script>

<template>
  <div class="popup-container">
    <div class="channel-selector-container">
      <label class="channel-label">Channel:</label>
      <select v-model="selectedChannel" @change="updateBackgroundSettings" class="channel-select">
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

    <div class="selectors-toggle">
      <button @click="showSelectors = !showSelectors" class="toggle-button">
        <span>{{ showSelectors ? '▼' : '▶' }}</span>
        <span>{{ showSelectors ? 'Hide' : 'Show' }} Selector Configuration</span>
      </button>
    </div>

    <div v-if="showSelectors" class="selectors-section">
      <div class="form-row">
        <div class="form-group">
          <label>Bet Amount:</label>
          <input v-model="inputValue" type="text" placeholder="5" @change="updateBackgroundSettings" />
        </div>

        <div class="form-group">
          <label>Limit Balance:</label>
          <input v-model="limitBalance" type="number" step="0.01" placeholder="Enter limit (e.g., 100)" @change="updateBackgroundSettings" />
        </div>
      </div>
      <p class="hint-text">Auto-betting will stop when balance reaches the limit</p>

      <div class="form-group">
        <label class="toggle-label">
          <input type="checkbox" v-model="autoBettingEnabled" @change="updateBackgroundSettings" class="toggle-checkbox" />
          <span>Enable Auto-Betting</span>
        </label>
      </div>

      <div class="form-group">
        <label>Test Betting (Manual Trigger):</label>
        <div class="test-bet-buttons">
          <button @click="testBet('red')" class="test-bet-btn meron-btn">
            🔴 Test MERON
          </button>
          <button @click="testBet('blue')" class="test-bet-btn wala-btn">
            🔵 Test WALA
          </button>
        </div>
      </div>

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
        <label>MERON Button Selector:</label>
        <input v-model="meronButtonSelector" type="text" placeholder="button.from-red-600.to-red-900" />
      </div>

      <div class="form-group">
        <label>WALA Button Selector:</label>
        <input v-model="walaButtonSelector" type="text" placeholder="button.from-blue-600.to-blue-900" />
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
      </div>
      <button @click="fetchBalance" class="refresh-button" title="Manual Refresh">
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
      <div class="ws-header">WebSocket Messages (Background):</div>
      <div class="ws-message" v-for="(msg, index) in wsMessages" :key="index">
        {{ msg }}
      </div>
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

.form-row {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.form-row .form-group {
  flex: 1;
  margin-bottom: 0;
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

.test-bet-buttons {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

.test-bet-btn {
  flex: 1;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.test-bet-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

.test-bet-btn:active {
  transform: translateY(0);
}

.test-bet-btn.meron-btn {
  background: linear-gradient(135deg, #dc2626, #991b1b);
  color: white;
}

.test-bet-btn.meron-btn:hover {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.test-bet-btn.wala-btn {
  background: linear-gradient(135deg, #2563eb, #1e3a8a);
  color: white;
}

.test-bet-btn.wala-btn:hover {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}
</style>
