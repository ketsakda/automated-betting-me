export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });

  // Telegram configuration
  const TELEGRAM_BOT_TOKEN = '5426678611:AAHrBdiyxWcpNpxIjNol5RXjbHuz8h5FXi8';
  const TELEGRAM_CHAT_ID = '-1002055714349';

  // State management
  let pusherWs: WebSocket | null = null;
  let currentBalance = '';
  let currentUsername = '';
  let currentPrediction: any = null;
  let wsStatus = 'Disconnected';
  let wsMessages: string[] = [];
  let autoBettingEnabled = true;
  let limitBalance = '45';
  let selectedChannel = 'cockfight.channel.2';
  let selectedConfigName = 'Option 1';
  let configurations: any[] = [];
  let currentSelectors: any = {
    checkboxSelector: '#auto',
    inputSelector: 'input[placeholder="Enter Amount"]',
    meronButtonSelector: 'button.from-red-600.to-red-900',
    walaButtonSelector: 'button.from-blue-600.to-blue-900',
    usernameSelector: 'p.text-sm.text-right.pr-1.leading-none',
    balanceSelector: 'p.text-vk884g-primary-color',
    inputValue: '5',
  };

  // Load configurations from storage
  async function loadConfigurations() {
    try {
      const result = await browser.storage.local.get(['selectorConfigs', 'limitBalance', 'autoBettingEnabled', 'selectedChannel', 'selectedConfigName', 'inputValue']);

      if (result.selectorConfigs && Array.isArray(result.selectorConfigs)) {
        configurations = result.selectorConfigs;
      } else {
        // Initialize with default configurations
        configurations = [
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
        await browser.storage.local.set({ selectorConfigs: configurations });
      }

      if (result.limitBalance !== undefined) {
        limitBalance = result.limitBalance;
      }
      if (result.autoBettingEnabled !== undefined) {
        autoBettingEnabled = result.autoBettingEnabled;
      }
      if (result.selectedChannel) {
        selectedChannel = result.selectedChannel;
      }
      if (result.selectedConfigName) {
        selectedConfigName = result.selectedConfigName;
      }
      if (result.inputValue !== undefined) {
        currentSelectors.inputValue = result.inputValue;
      }

      // Load current configuration
      switchConfiguration();
    } catch (error) {
      console.error('Failed to load configurations:', error);
    }
  }

  function switchConfiguration() {
    const config = configurations.find(c => c.name === selectedConfigName);
    if (config) {
      currentSelectors.checkboxSelector = config.checkboxSelector;
      currentSelectors.inputSelector = config.inputSelector;
      currentSelectors.meronButtonSelector = config.meronButtonSelector;
      currentSelectors.walaButtonSelector = config.walaButtonSelector;
      currentSelectors.usernameSelector = config.usernameSelector;
      currentSelectors.balanceSelector = config.balanceSelector;
    }
  }

  // Send Telegram notification
  async function sendTelegramMessage(message: string) {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      if (response.ok) {
        console.log('Telegram notification sent successfully');
        addWsMessage('📱 Telegram notification sent');
        return true;
      } else {
        const error = await response.text();
        console.error('Failed to send Telegram message:', error);
        addWsMessage('❌ Failed to send Telegram notification');
        return false;
      }
    } catch (error) {
      console.error('Error sending Telegram message:', error);
      addWsMessage('❌ Telegram notification error');
      return false;
    }
  }

  // Fetch balance from active tab
  async function fetchBalance() {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        const response = await browser.tabs.sendMessage(tabs[0].id, {
          action: 'getUsername',
          usernameSelector: currentSelectors.usernameSelector,
          balanceSelector: currentSelectors.balanceSelector,
        });

        if (response) {
          currentUsername = response.username || 'Not found';
          currentBalance = response.balance || 'Not found';

          // Broadcast to popup if open
          broadcastToPopup({
            type: 'balanceUpdate',
            username: currentUsername,
            balance: currentBalance,
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  }

  // Run automation (place bet)
  async function runAutomation(betType: 'red' | 'blue') {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        console.error('No active tab found');
        return;
      }

      const buttonSelector = betType === 'red'
        ? currentSelectors.meronButtonSelector
        : currentSelectors.walaButtonSelector;

      await browser.tabs.sendMessage(tabs[0].id, {
        action: 'automate',
        checkboxSelector: currentSelectors.checkboxSelector,
        inputSelector: currentSelectors.inputSelector,
        buttonSelector: buttonSelector,
        inputValue: currentSelectors.inputValue,
      });

      console.log(`Bet placed: ${betType === 'red' ? 'MERON' : 'WALA'}`);
      addWsMessage(`✅ Bet placed: ${betType === 'red' ? 'MERON' : 'WALA'}`);

      // Refresh page after bet is placed (wait for automation to complete)
      setTimeout(async () => {
        try {
          await browser.tabs.reload(tabs[0].id);
          addWsMessage(`🔄 Page refreshed`);
        } catch (error) {
          console.error('Failed to refresh page:', error);
        }
      }, 5000); // Wait 5 seconds for bet to be registered
    } catch (error) {
      console.error('Failed to run automation:', error);
      addWsMessage(`❌ Bet failed: ${error}`);
    }
  }

  // Update extension badge based on connection status
  function updateBadge(status: string) {
    if (status === 'Connected') {
      browser.action.setBadgeText({ text: '●' });
      browser.action.setBadgeBackgroundColor({ color: '#00FF00' }); // Green
      browser.action.setTitle({ title: 'WebSocket: Connected' });
    } else if (status === 'Connecting...') {
      browser.action.setBadgeText({ text: '●' });
      browser.action.setBadgeBackgroundColor({ color: '#FFA500' }); // Orange
      browser.action.setTitle({ title: 'WebSocket: Connecting...' });
    } else if (status === 'Disconnected') {
      browser.action.setBadgeText({ text: '●' });
      browser.action.setBadgeBackgroundColor({ color: '#FF0000' }); // Red
      browser.action.setTitle({ title: 'WebSocket: Disconnected' });
    } else if (status === 'Error') {
      browser.action.setBadgeText({ text: '!' });
      browser.action.setBadgeBackgroundColor({ color: '#FF0000' }); // Red
      browser.action.setTitle({ title: 'WebSocket: Error' });
    }
  }

  // WebSocket connection
  function connectPusher() {
    const wsUrl = 'wss://ws-fun-analyzer.kravanh.dev/app/9cpbe4mbozz6fjriingr?protocol=7&client=js&version=8.4.0&flash=false';

    wsStatus = 'Connecting...';
    updateBadge(wsStatus);
    addWsMessage(`📡 Connecting to Pusher...`);

    try {
      pusherWs = new WebSocket(wsUrl);

      pusherWs.onopen = () => {
        console.log('Pusher WebSocket connected');
        wsStatus = 'Connected';
        updateBadge(wsStatus);
        addWsMessage('✅ Connected to Pusher');

        const subscribeMsg = {
          event: 'pusher:subscribe',
          data: { channel: 'cockfight-matches' }
        };
        pusherWs?.send(JSON.stringify(subscribeMsg));
        addWsMessage('📢 Subscribing to cockfight-matches');
      };

      pusherWs.onmessage = async (event) => {
        console.log('Pusher message:', event.data);
        try {
          const data = JSON.parse(event.data);

          // Handle Pusher ping
          if (data.event === 'pusher:ping') {
            pusherWs?.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
            return;
          }

          // Handle Pusher errors
          if (data.event === 'pusher:error') {
            const errorData = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
            addWsMessage(`⚠️ Error: ${errorData.message}`);
            return;
          }

          // Handle events
          if (data.event === 'pusher:connection_established') {
            addWsMessage('✅ Connection established');
          } else if (data.event === 'pusher_internal:subscription_succeeded') {
            addWsMessage('✅ Subscribed to channel');
          } else if (data.event === '.match.betting.opened') {
            let matchData = data.data;
            if (typeof matchData === 'string') matchData = JSON.parse(matchData);
            if (matchData?.match?.channel_id !== selectedChannel) return;

            const fightNum = matchData?.match?.fight_number;
            addWsMessage(`🎲 Betting opened: Fight #${fightNum}`);
          } else if (data.event === '.match.betting.closed') {
            let matchData = data.data;
            if (typeof matchData === 'string') matchData = JSON.parse(matchData);
            if (matchData?.match?.channel_id !== selectedChannel) return;

            const fightNum = matchData?.match?.fight_number;
            addWsMessage(`🚫 Betting closed: Fight #${fightNum}`);
          } else if (data.event === 'match.predicted' || data.event === '.match.predicted') {
            let matchData = data.data;
            if (typeof matchData === 'string') matchData = JSON.parse(matchData);

            const match = matchData?.match;
            const prediction = matchData?.prediction;
            const channelId = match?.channel_id;

            if (channelId !== selectedChannel) {
              console.log(`Ignoring prediction from ${channelId}`);
              return;
            }

            const fightNum = match?.fight_number;
            const predictedResult = match?.predicted_result?.toUpperCase();
            const confidence = match?.prediction_confidence || prediction?.confidence;

            currentPrediction = {
              fightNumber: fightNum,
              result: predictedResult,
              confidence: parseFloat(confidence),
              strategy: prediction?.strategy,
              reasoning: prediction?.reasoning,
              probabilities: prediction?.probabilities,
              channel: channelId || 'Unknown'
            };

            addWsMessage(`🔮 Fight #${fightNum}: ${predictedResult} (${confidence}%)`);
            broadcastToPopup({ type: 'predictionUpdate', prediction: currentPrediction });

            // Auto-bet logic
            if (!autoBettingEnabled) {
              addWsMessage(`⏸️ Auto-betting is disabled`);
              return;
            }

            // Fetch current balance
            await fetchBalance();

            // Check limit balance
            if (limitBalance) {
              const currentBalanceNum = parseFloat(currentBalance.replace(/[^0-9.-]/g, ''));
              const limit = parseFloat(limitBalance);

              if (!isNaN(currentBalanceNum) && !isNaN(limit) && currentBalanceNum >= limit) {
                autoBettingEnabled = false;
                await browser.storage.local.set({ autoBettingEnabled: false });
                addWsMessage(`🛑 Limit reached! Balance: ${currentBalance} >= Limit: $${limit}`);
                broadcastToPopup({ type: 'autoBettingDisabled', reason: 'Limit reached' });

                // Send Telegram notification
                const telegramMessage = `🛑 <b>Betting Limit Reached!</b>\n\n` +
                  `👤 User: ${currentUsername}\n` +
                  `💰 Current Balance: ${currentBalance}\n` +
                  `📊 Limit: $${limit}\n` +
                  `⏰ Time: ${new Date().toLocaleString()}\n\n` +
                  `Auto-betting has been disabled.`;
                await sendTelegramMessage(telegramMessage);

                return;
              }
            }

            // Place bet
            if (predictedResult === 'MERON') {
              addWsMessage(`🤖 Auto-betting MERON...`);
              setTimeout(() => runAutomation('red'), 500);
            } else if (predictedResult === 'WALA') {
              addWsMessage(`🤖 Auto-betting WALA...`);
              setTimeout(() => runAutomation('blue'), 500);
            }
          } else if (data.event === '.match.ended') {
            let matchData = data.data;
            if (typeof matchData === 'string') matchData = JSON.parse(matchData);
            if (matchData?.match?.channel_id !== selectedChannel) return;

            const fightNum = matchData?.match?.fight_number;
            const result = matchData?.match?.result;
            addWsMessage(`🏁 Fight #${fightNum} ended: ${result}`);

            // Refresh page after match ends (wait 5 seconds)
            setTimeout(async () => {
              try {
                const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                if (tabs[0]?.id) {
                  await browser.tabs.reload(tabs[0].id);
                  addWsMessage(`🔄 Page refreshed after match end`);
                }
              } catch (error) {
                console.error('Failed to refresh page:', error);
              }
            }, 5000);
          }
        } catch (err) {
          console.error('Error processing message:', err);
        }
      };

      pusherWs.onerror = (error) => {
        console.error('Pusher WebSocket error:', error);
        wsStatus = 'Error';
        updateBadge(wsStatus);
        addWsMessage('❌ Connection error');
      };

      pusherWs.onclose = () => {
        console.log('Pusher WebSocket closed');
        wsStatus = 'Disconnected';
        updateBadge(wsStatus);
        addWsMessage('🔌 Disconnected from Pusher');

        // Auto-reconnect
        setTimeout(() => {
          if (!pusherWs || pusherWs.readyState === WebSocket.CLOSED) {
            addWsMessage('🔄 Reconnecting...');
            connectPusher();
          }
        }, 3000);
      };
    } catch (err) {
      console.error('Failed to connect to Pusher:', err);
      wsStatus = 'Error';
      updateBadge(wsStatus);
      addWsMessage(`❌ Failed: ${err}`);
    }
  }

  function addWsMessage(message: string) {
    wsMessages.push(message);
    if (wsMessages.length > 15) {
      wsMessages.shift();
    }
    broadcastToPopup({ type: 'wsMessage', message, messages: wsMessages });
  }

  // Broadcast updates to popup
  function broadcastToPopup(data: any) {
    browser.runtime.sendMessage(data).catch(() => {
      // Popup might be closed, ignore error
    });
  }

  // Handle messages from popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);

    if (message.action === 'getState') {
      sendResponse({
        balance: currentBalance,
        username: currentUsername,
        prediction: currentPrediction,
        wsStatus,
        wsMessages,
        autoBettingEnabled,
        limitBalance,
        selectedChannel,
        selectedConfigName,
        inputValue: currentSelectors.inputValue,
      });
      return true;
    }

    if (message.action === 'updateSettings') {
      if (message.autoBettingEnabled !== undefined) {
        autoBettingEnabled = message.autoBettingEnabled;
        browser.storage.local.set({ autoBettingEnabled });
      }
      if (message.limitBalance !== undefined) {
        limitBalance = message.limitBalance;
        browser.storage.local.set({ limitBalance });
      }
      if (message.selectedChannel !== undefined) {
        selectedChannel = message.selectedChannel;
        browser.storage.local.set({ selectedChannel });
      }
      if (message.selectedConfigName !== undefined) {
        selectedConfigName = message.selectedConfigName;
        browser.storage.local.set({ selectedConfigName });
        switchConfiguration();
      }
      if (message.inputValue !== undefined) {
        currentSelectors.inputValue = message.inputValue;
        browser.storage.local.set({ inputValue: message.inputValue });
      }
      sendResponse({ success: true });
      return true;
    }

    if (message.action === 'fetchBalance') {
      fetchBalance().then(() => {
        sendResponse({ balance: currentBalance, username: currentUsername });
      });
      return true;
    }

    if (message.action === 'testBet') {
      const betType = message.betType || 'red';
      addWsMessage(`🧪 Test bet triggered: ${betType === 'red' ? 'MERON' : 'WALA'}`);
      runAutomation(betType);
      sendResponse({ success: true });
      return true;
    }
  });

  // Register content script on install/update
  browser.runtime.onInstalled.addListener(async () => {
    console.log('Extension installed/updated, registering content scripts...');

    try {
      const existingScripts = await browser.scripting.getRegisteredContentScripts();
      if (existingScripts.length > 0) {
        await browser.scripting.unregisterContentScripts();
      }

      await browser.scripting.registerContentScripts([
        {
          id: 'form-automation-content',
          matches: ['<all_urls>'],
          js: ['content-scripts/content.js'],
          runAt: 'document_idle',
        },
      ]);

      console.log('Content script registered successfully!');
    } catch (error) {
      console.error('Failed to register content script:', error);
    }
  });

  // Initialize
  loadConfigurations().then(() => {
    connectPusher();
    // Start periodic balance checking every 10 seconds
    setInterval(() => {
      fetchBalance();
    }, 10000);
  });
});
