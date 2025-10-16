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
  let isManualBet = false;
  let limitBalance = '25';
  let selectedChannel = 'cockfight.channel.2';
  let selectedConfigName = 'Option 1';
  let configurations: any[] = [];
  let lastPlayerUpdate: any = null;
  let lastBetPlacement: any = null;
  let currentSelectors: any = {
    checkboxSelector: '#auto',
    inputSelector: 'input[placeholder="Enter Amount"]',
    meronButtonSelector: 'button.from-red-600.to-red-900',
    walaButtonSelector: 'button.from-blue-600.to-blue-900',
    usernameSelector: 'p.text-sm.text-right.pr-1.leading-none',
    balanceSelector: 'p.text-vk884g-primary-color',
    inputValue: '2',
  };

  // Load configurations from storage
  async function loadConfigurations() {
    try {
      const result = await browser.storage.local.get(['selectorConfigs', 'limitBalance', 'autoBettingEnabled', 'isManualBet', 'selectedChannel', 'selectedConfigName', 'inputValue']);

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
            hamburgerButtonSelector: 'button.inline-flex.items-center.justify-center.p-1.rounded-md',
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
      if (result.isManualBet !== undefined) {
        isManualBet = result.isManualBet;
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
      currentSelectors.hamburgerButtonSelector = config.hamburgerButtonSelector;
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

  // Click hamburger button to refresh UI
  async function clickHamburgerButton() {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id && currentSelectors.hamburgerButtonSelector) {
        const response = await browser.tabs.sendMessage(tabs[0].id, {
          action: 'clickHamburgerButton',
          hamburgerButtonSelector: currentSelectors.hamburgerButtonSelector,
        });
        return response?.success || false;
      }
      return false;
    } catch (error) {
      console.error('Failed to click hamburger button:', error);
      return false;
    }
  }

  // Sleep helper function
  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Submit player data to API
  async function submitPlayerData() {
    console.log('🚀 submitPlayerData() called');
    console.log('Current state:', {
      username: currentUsername,
      balance: currentBalance,
      inputValue: currentSelectors.inputValue,
      limitBalance: limitBalance,
      autoBettingEnabled: autoBettingEnabled,
      selectedChannel: selectedChannel,
      selectedConfigName: selectedConfigName
    });

    try {
      // Check if username is available
      if (currentUsername === 'Not found' || !currentUsername) {
        console.log('⚠️ Username not found, attempting to fetch...');
        addWsMessage(`🔄 Username not found, fetching again...`);
        await fetchBalance();
        console.log('After fetchBalance:', { username: currentUsername, balance: currentBalance });

        // If still not found and using Option 2, try hamburger button
        if ((currentUsername === 'Not found' || !currentUsername) && selectedConfigName === 'Option 2') {
          console.log('Trying hamburger button for Option 2...');
          addWsMessage(`🔄 Trying hamburger button to refresh username...`);
          const clicked = await clickHamburgerButton();

          if (clicked) {
            await sleep(1500); // Wait for UI to update
            await fetchBalance();
            console.log('After hamburger click:', { username: currentUsername, balance: currentBalance });
            addWsMessage(`🔄 Username refreshed: ${currentUsername}`);
          }
        }
      }

      // Skip if username still not found
      if (currentUsername === 'Not found' || !currentUsername) {
        console.log('❌ Username still not found, aborting submission');
        addWsMessage(`⚠️ Cannot submit player data: username not found`);
        return false;
      }

      // Format current date as YYYY-MM-DD
      const now = new Date();
      const playDate = now.toISOString().split('T')[0];

      // Parse numeric values
      const balanceNum = parseFloat(currentBalance.replace(/[^0-9.-]/g, '')) || 0;
      const betAmountNum = parseFloat(currentSelectors.inputValue) || 0;
      const limitBalanceNum = parseFloat(limitBalance) || 0;

      // Format option name to lowercase
      const optionName = selectedConfigName.toLowerCase();

      // Prepare data payload
      const playerData = {
        play_date: playDate,
        username: currentUsername,
        balance: balanceNum,
        bet_amount: betAmountNum,
        limit_balance: limitBalanceNum,
        is_auto_bet: autoBettingEnabled,
        is_manual_bet: isManualBet, // Use value from server sync
        channel_id: selectedChannel,
        option: optionName
      };

      console.log('📤 Prepared player data:', JSON.stringify(playerData, null, 2));
      addWsMessage(`📤 Submitting player data: ${currentUsername}...`);

      // Submit to API
      console.log('Sending POST request to https://fun-analyzer.kravanh.dev/api/players');
      const response = await fetch('https://fun-analyzer.kravanh.dev/api/players', {
        method: 'POST',
        headers: {
          'key': 'dataforme',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(playerData),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const responseData = await response.text();
        console.log('✅ Success! Response data:', responseData);
        addWsMessage(`✅ Player data submitted successfully`);
        console.log('Player data submitted:', playerData);
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ API returned error status:', response.status);
        console.error('Error response body:', errorText);
        addWsMessage(`❌ Failed to submit player data: ${response.status}`);
        console.error('API error:', errorText);
        return false;
      }
    } catch (error) {
      console.error('❌ Exception in submitPlayerData:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      addWsMessage(`❌ Error submitting player data: ${error}`);
      console.error('Failed to submit player data:', error);
      return false;
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
          if (tabs[0]?.id) {
            await browser.tabs.reload(tabs[0].id);
            addWsMessage(`🔄 Page refreshed`);
          }
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

        // Subscribe to cockfight-matches channel
        const subscribeMatchesMsg = {
          event: 'pusher:subscribe',
          data: { channel: 'cockfight-matches' }
        };
        pusherWs?.send(JSON.stringify(subscribeMatchesMsg));
        addWsMessage('📢 Subscribing to cockfight-matches');

        // Subscribe to players channel
        const subscribePlayersMsg = {
          event: 'pusher:subscribe',
          data: { channel: 'players' }
        };
        pusherWs?.send(JSON.stringify(subscribePlayersMsg));
        addWsMessage('📢 Subscribing to players');

        // Subscribe to bets channel
        const subscribeBetsMsg = {
          event: 'pusher:subscribe',
          data: { channel: 'bets' }
        };
        pusherWs?.send(JSON.stringify(subscribeBetsMsg));
        addWsMessage('📢 Subscribing to bets');
      };

      pusherWs.onmessage = async (event) => {
        console.log('Pusher message:', event.data);
        try {
          const data = JSON.parse(event.data);

          // Debug: Log the event type
          if (data.event) {
            console.log('📋 Event type:', data.event);
          }

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

                // If username is "Not found" and we're using Option 2, try to refresh it
                if (currentUsername === 'Not found' && selectedConfigName === 'Option 2') {
                  addWsMessage(`🔄 Username not found, clicking hamburger to refresh...`);
                  const clicked = await clickHamburgerButton();

                  if (clicked) {
                    addWsMessage(`✅ Hamburger button clicked, waiting for UI update...`);
                    await sleep(1500); // Wait for UI to update

                    // Fetch username again
                    await fetchBalance();
                    addWsMessage(`🔄 Username refreshed: ${currentUsername}`);
                  } else {
                    addWsMessage(`❌ Failed to click hamburger button`);
                  }
                }

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
          } else if (data.event === 'match.ended' || data.event === '.match.ended') {
            console.log('🎯 MATCH ENDED HANDLER TRIGGERED!');
            addWsMessage(`🎯 Match ended event detected: ${data.event}`);
            console.log('Raw event:', data.event);

            let matchData = data.data;
            console.log('Raw matchData (before parse):', matchData);
            if (typeof matchData === 'string') matchData = JSON.parse(matchData);
            console.log('Parsed matchData:', matchData);

            console.log('📢 Match ended event received:', matchData);
            console.log('Channel check:', {
              matchChannel: matchData?.match?.channel_id,
              selectedChannel: selectedChannel,
              matches: matchData?.match?.channel_id === selectedChannel
            });

            addWsMessage(`📋 Channel: ${matchData?.match?.channel_id} (Selected: ${selectedChannel})`);

            if (matchData?.match?.channel_id !== selectedChannel) {
              console.log('⏭️ Skipping match from different channel');
              addWsMessage(`⏭️ Skipped: Different channel`);
              return;
            }

            const fightNum = matchData?.match?.fight_number;
            const result = matchData?.match?.result;
            console.log(`🏁 Match #${fightNum} ended with result: ${result}`);
            addWsMessage(`🏁 Fight #${fightNum} ended: ${result}`);

            // Submit player data and refresh page after match ends (wait 5 seconds)
            console.log('⏰ Setting 5-second timeout for player data submission and page refresh');
            addWsMessage(`⏰ Waiting 5 seconds before submission...`);
            setTimeout(async () => {
              try {
                console.log('⏰ Timeout triggered, starting player data submission...');
                addWsMessage(`⏰ 5 seconds elapsed, starting submission...`);

                // Submit player data to API
                await submitPlayerData();
                console.log('✅ Player data submission completed');

                // Refresh page
                console.log('🔄 Starting page refresh...');
                const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                if (tabs[0]?.id) {
                  await browser.tabs.reload(tabs[0].id);
                  addWsMessage(`🔄 Page refreshed after match end`);
                  console.log('✅ Page refresh completed');
                } else {
                  console.log('❌ No active tab found for refresh');
                  addWsMessage(`❌ No active tab for refresh`);
                }
              } catch (error) {
                console.error('❌ Error in match end handler:', error);
                addWsMessage(`❌ Error in match end handler: ${error}`);
                console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
              }
            }, 5000);
          } else if (data.event === 'player.updated' || data.event === '.player.updated') {
            console.log('👤 PLAYER UPDATED EVENT RECEIVED!');

            let eventData = data.data;
            if (typeof eventData === 'string') eventData = JSON.parse(eventData);

            const player = eventData.player;
            const message = eventData.message;

            console.log('Player update message:', message);
            console.log('Player data:', player);

            // Store last player update
            lastPlayerUpdate = {
              player: player,
              message: message,
              timestamp: new Date().toISOString()
            };

            // Fetch username if not available
            if (currentUsername === 'Not found' || !currentUsername) {
              console.log('⚠️ Username not found, attempting to fetch before sync check...');
              console.log('Current configuration:', selectedConfigName);
              console.log('Username selector:', currentSelectors.usernameSelector);
              addWsMessage(`🔄 Fetching username for sync check (config: ${selectedConfigName})...`);

              // For Option 2, click hamburger button FIRST before fetching
              if (selectedConfigName === 'Option 2') {
                console.log('Option 2 detected - clicking hamburger button FIRST...');
                console.log('Hamburger selector:', currentSelectors.hamburgerButtonSelector);
                addWsMessage(`🍔 Clicking hamburger button (Option 2)...`);
                const clicked = await clickHamburgerButton();

                if (clicked) {
                  console.log('Hamburger button clicked, waiting 1.5s for menu to open...');
                  await sleep(1500); // Wait for UI to update
                  addWsMessage(`✅ Hamburger menu opened`);
                } else {
                  console.log('❌ Hamburger button click failed');
                  addWsMessage(`❌ Failed to click hamburger button`);
                }
              }

              // Now fetch the username
              await fetchBalance();
              console.log('After fetchBalance:', {
                username: currentUsername,
                balance: currentBalance
              });

              // If still not found with Option 1, log it
              if ((currentUsername === 'Not found' || !currentUsername) && selectedConfigName === 'Option 1') {
                console.log('⚠️ Username still not found with Option 1 selector');
                addWsMessage(`⚠️ Option 1: Username not found on page`);
              }

              // If still not found, log detailed warning
              if (currentUsername === 'Not found' || !currentUsername) {
                console.log('⚠️ Username still not found after fetch attempts');
                console.log('Tried selector:', currentSelectors.usernameSelector);
                console.log('Configuration:', selectedConfigName);
                addWsMessage(`⚠️ Cannot sync: username unavailable`);
                addWsMessage(`   Using selector: ${currentSelectors.usernameSelector}`);
              } else {
                console.log('✅ Username successfully fetched:', currentUsername);
                addWsMessage(`✅ Username found: ${currentUsername}`);
              }
            }

            // Check if this update is for the current user
            console.log('Username check:', {
              eventUsername: player.username,
              currentUsername: currentUsername,
              matches: player.username === currentUsername
            });

            // If username is still "Not found", we'll sync anyway but store the username from the event
            const shouldSync = player.username === currentUsername ||
                              (currentUsername === 'Not found' || !currentUsername);

            if (shouldSync) {
              // If we don't have a username yet, use the one from the event
              if (currentUsername === 'Not found' || !currentUsername) {
                console.log('📝 Using username from player.updated event:', player.username);
                addWsMessage(`📝 Setting username from server: ${player.username}`);
                currentUsername = player.username;
                // Update popup
                broadcastToPopup({
                  type: 'balanceUpdate',
                  username: currentUsername,
                  balance: currentBalance,
                });
              }
              console.log('🔄 Username matches! Syncing settings from server...');
              addWsMessage(`🔄 Syncing settings from server for ${player.username}...`);

              // Track changes for logging
              const changes: string[] = [];

              // Sync bet_amount
              const oldBetAmount = currentSelectors.inputValue;
              const newBetAmount = player.bet_amount?.toString() || oldBetAmount;
              if (oldBetAmount !== newBetAmount) {
                currentSelectors.inputValue = newBetAmount;
                changes.push(`Bet Amount: ${oldBetAmount} → ${newBetAmount}`);
                console.log(`✏️ Updated bet_amount: ${oldBetAmount} → ${newBetAmount}`);
              }

              // Sync limit_balance
              const oldLimitBalance = limitBalance;
              const newLimitBalance = player.limit_balance?.toString() || oldLimitBalance;
              if (oldLimitBalance !== newLimitBalance) {
                limitBalance = newLimitBalance;
                changes.push(`Limit Balance: ${oldLimitBalance} → ${newLimitBalance}`);
                console.log(`✏️ Updated limit_balance: ${oldLimitBalance} → ${newLimitBalance}`);
              }

              // Sync channel_id
              const oldChannel = selectedChannel;
              const newChannel = player.channel_id || oldChannel;
              if (oldChannel !== newChannel) {
                selectedChannel = newChannel;
                changes.push(`Channel: ${oldChannel} → ${newChannel}`);
                console.log(`✏️ Updated channel_id: ${oldChannel} → ${newChannel}`);
              }

              // Sync option (convert to proper case: "option 1" → "Option 1")
              const oldOption = selectedConfigName;
              let newOption = oldOption;
              if (player.option) {
                // Capitalize first letter of each word
                newOption = player.option
                  .split(' ')
                  .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ');
              }
              if (oldOption !== newOption) {
                selectedConfigName = newOption;
                switchConfiguration(); // Apply new configuration
                changes.push(`Option: ${oldOption} → ${newOption}`);
                console.log(`✏️ Updated option: ${oldOption} → ${newOption}`);
              }

              // Sync is_auto_bet
              const oldAutoBet = autoBettingEnabled;
              const newAutoBet = player.is_auto_bet ?? oldAutoBet;
              if (oldAutoBet !== newAutoBet) {
                autoBettingEnabled = newAutoBet;
                changes.push(`Auto-Bet: ${oldAutoBet} → ${newAutoBet}`);
                console.log(`✏️ Updated is_auto_bet: ${oldAutoBet} → ${newAutoBet}`);
              }

              // Sync is_manual_bet
              const oldManualBet = isManualBet;
              const newManualBet = player.is_manual_bet ?? oldManualBet;
              if (oldManualBet !== newManualBet) {
                isManualBet = newManualBet;
                changes.push(`Manual-Bet: ${oldManualBet} → ${newManualBet}`);
                console.log(`✏️ Updated is_manual_bet: ${oldManualBet} → ${newManualBet}`);
              }

              // Save all updated settings to storage
              await browser.storage.local.set({
                inputValue: currentSelectors.inputValue,
                limitBalance: limitBalance,
                selectedChannel: selectedChannel,
                selectedConfigName: selectedConfigName,
                autoBettingEnabled: autoBettingEnabled,
                isManualBet: isManualBet
              });
              console.log('💾 Settings saved to storage');

              // Log summary of changes
              if (changes.length > 0) {
                addWsMessage(`✅ Synced ${changes.length} setting(s) from server`);
                changes.forEach(change => {
                  addWsMessage(`   ${change}`);
                  console.log(`   ${change}`);
                });
              } else {
                addWsMessage(`✅ Settings already up to date`);
                console.log('✅ No settings changes needed');
              }

              // Submit updated player data back to server to confirm sync
              addWsMessage(`📤 Submitting synced data back to server...`);
              await submitPlayerData();

              // Broadcast settings sync to popup
              broadcastToPopup({
                type: 'settingsSynced',
                settings: {
                  inputValue: currentSelectors.inputValue,
                  limitBalance: limitBalance,
                  selectedChannel: selectedChannel,
                  selectedConfigName: selectedConfigName,
                  autoBettingEnabled: autoBettingEnabled
                },
                changes: changes
              });
            } else {
              console.log('⏭️ Username does not match current user, skipping sync');
              addWsMessage(`👤 Player update for ${player.username} (not current user)`);
            }

            // Add to WebSocket messages
            addWsMessage(`👤 ${message}`);
            addWsMessage(`   Username: ${player.username}, Balance: $${player.balance}`);

            // Broadcast to popup
            broadcastToPopup({
              type: 'playerUpdate',
              player: player,
              message: message
            });

            console.log('Player update details:', {
              id: player.id,
              username: player.username,
              balance: player.balance,
              bet_amount: player.bet_amount,
              limit_balance: player.limit_balance,
              is_auto_bet: player.is_auto_bet,
              is_manual_bet: player.is_manual_bet,
              channel_id: player.channel_id,
              option: player.option,
              play_date: player.play_date,
              updated_at: player.updated_at
            });
          } else if (data.event === 'bet.placed' || data.event === '.bet.placed') {
            console.log('🎰 BET PLACED EVENT RECEIVED!');

            let eventData = data.data;
            if (typeof eventData === 'string') eventData = JSON.parse(eventData);

            const betType = eventData.bet_type;
            const players = eventData.players;
            const totalBetAmount = eventData.total_bet_amount;
            const validBettersCount = eventData.valid_betters_count;
            const totalPlayersCount = eventData.total_players_count;
            const timestamp = eventData.timestamp;
            const message = eventData.message;

            console.log('Bet placement message:', message);
            console.log('Bet type:', betType);
            console.log('Total bet amount:', totalBetAmount);
            console.log('Valid betters:', validBettersCount, '/', totalPlayersCount);
            console.log('Players:', players);

            // Store last bet placement
            lastBetPlacement = {
              bet_type: betType,
              players: players,
              total_bet_amount: totalBetAmount,
              valid_betters_count: validBettersCount,
              total_players_count: totalPlayersCount,
              timestamp: timestamp,
              message: message
            };

            // Add to WebSocket messages
            addWsMessage(`🎰 ${message}`);
            addWsMessage(`   ${betType}: $${totalBetAmount} (${validBettersCount} betters)`);

            // Broadcast to popup
            broadcastToPopup({
              type: 'betPlaced',
              bet_type: betType,
              players: players,
              total_bet_amount: totalBetAmount,
              valid_betters_count: validBettersCount,
              total_players_count: totalPlayersCount,
              message: message
            });

            // Sync settings if current user is in the players array
            // Fetch username if not available
            if (currentUsername === 'Not found' || !currentUsername) {
              console.log('⚠️ Username not found for bet.placed, attempting to fetch...');
              console.log('Current configuration:', selectedConfigName);
              addWsMessage(`🔄 Fetching username for bet sync check...`);

              // For Option 2, click hamburger button FIRST before fetching
              if (selectedConfigName === 'Option 2') {
                console.log('Option 2 detected - clicking hamburger button FIRST...');
                addWsMessage(`🍔 Clicking hamburger button (Option 2)...`);
                const clicked = await clickHamburgerButton();

                if (clicked) {
                  console.log('Hamburger button clicked, waiting 1.5s for menu to open...');
                  await sleep(1500);
                  addWsMessage(`✅ Hamburger menu opened`);
                } else {
                  console.log('❌ Hamburger button click failed');
                  addWsMessage(`❌ Failed to click hamburger button`);
                }
              }

              // Now fetch the username
              await fetchBalance();
              console.log('After fetchBalance for bet.placed:', {
                username: currentUsername,
                balance: currentBalance
              });
            }

            // Find current user in players array
            let currentUserInBet = null;
            if (players && Array.isArray(players)) {
              // Try to match by username
              currentUserInBet = players.find((p: any) => p.username === currentUsername);

              // If not found and currentUsername is "Not found", try to find any player and use as fallback
              if (!currentUserInBet && (currentUsername === 'Not found' || !currentUsername) && players.length > 0) {
                console.log('⚠️ Username not found, checking first player in array');
                currentUserInBet = players[0];
                console.log('📝 Using player from bet event:', currentUserInBet.username);
                addWsMessage(`📝 Setting username from bet event: ${currentUserInBet.username}`);
                currentUsername = currentUserInBet.username;
                // Update popup
                broadcastToPopup({
                  type: 'balanceUpdate',
                  username: currentUsername,
                  balance: currentBalance,
                });
              }
            }

            if (currentUserInBet) {
              console.log('✅ Current user found in bet.placed players:', currentUserInBet);
              addWsMessage(`🔄 Syncing from bet.placed event for ${currentUserInBet.username}...`);

              // Track changes for logging
              const changes: string[] = [];

              // Sync bet_amount from the bet
              const oldBetAmount = currentSelectors.inputValue;
              const newBetAmount = currentUserInBet.bet_amount?.toString() || oldBetAmount;
              if (oldBetAmount !== newBetAmount) {
                currentSelectors.inputValue = newBetAmount;
                changes.push(`Bet Amount: ${oldBetAmount} → ${newBetAmount}`);
                console.log(`✏️ Updated bet_amount from bet: ${oldBetAmount} → ${newBetAmount}`);
              }

              // Update balance if available
              if (currentUserInBet.balance !== undefined) {
                const newBalance = currentUserInBet.balance.toString();
                if (currentBalance !== newBalance) {
                  currentBalance = newBalance;
                  console.log(`✏️ Updated balance from bet: ${newBalance}`);
                  broadcastToPopup({
                    type: 'balanceUpdate',
                    username: currentUsername,
                    balance: currentBalance,
                  });
                }
              }

              // Save updated settings to storage
              if (changes.length > 0) {
                await browser.storage.local.set({
                  inputValue: currentSelectors.inputValue,
                });
                console.log('💾 Bet settings saved to storage');

                // Log summary of changes
                addWsMessage(`✅ Synced ${changes.length} setting(s) from bet.placed`);
                changes.forEach(change => {
                  addWsMessage(`   ${change}`);
                  console.log(`   ${change}`);
                });

                // Submit updated player data back to server to confirm sync
                addWsMessage(`📤 Submitting synced data after bet...`);
                await submitPlayerData();

                // Broadcast settings sync to popup
                broadcastToPopup({
                  type: 'settingsSynced',
                  settings: {
                    inputValue: currentSelectors.inputValue,
                    limitBalance: limitBalance,
                    selectedChannel: selectedChannel,
                    selectedConfigName: selectedConfigName,
                    autoBettingEnabled: autoBettingEnabled
                  },
                  changes: changes
                });
              } else {
                console.log('✅ No bet settings changes needed');
              }
            } else {
              console.log('⏭️ Current user not found in bet.placed players array');
              addWsMessage(`👤 Bet placed (not by current user)`);
            }
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
        isManualBet,
        limitBalance,
        selectedChannel,
        selectedConfigName,
        inputValue: currentSelectors.inputValue,
        lastPlayerUpdate: lastPlayerUpdate,
        lastBetPlacement: lastBetPlacement,
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

    if (message.action === 'testHamburgerClick') {
      addWsMessage(`🧪 Testing hamburger button click...`);
      clickHamburgerButton().then((success) => {
        if (success) {
          addWsMessage(`✅ Hamburger button clicked successfully`);
          // Wait and refetch balance
          setTimeout(async () => {
            await fetchBalance();
            addWsMessage(`🔄 Balance refreshed after hamburger click`);
          }, 1500);
        } else {
          addWsMessage(`❌ Failed to click hamburger button`);
        }
        sendResponse({ success });
      });
      return true;
    }

    if (message.action === 'testSubmitPlayerData') {
      addWsMessage(`🧪 Manual test: Submitting player data...`);
      submitPlayerData().then((success) => {
        if (success) {
          addWsMessage(`✅ Player data submitted successfully (manual test)`);
        } else {
          addWsMessage(`❌ Player data submission failed (manual test)`);
        }
        sendResponse({ success });
      });
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
