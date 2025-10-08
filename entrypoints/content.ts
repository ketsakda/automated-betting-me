export default defineContentScript({
  matches: ["<all_urls>"], // Match all URLs for testing
  main() {
    console.log("🚀 Form Automation Helper - Content Script Loaded!");
    console.log("Browser runtime ID:", browser?.runtime?.id);

    // Example: Auto-fill form helper
    function checkCheckbox(selector: string): boolean {
      const checkbox = document.querySelector(selector) as HTMLInputElement;
      if (checkbox && checkbox.type === "checkbox") {
        if (!checkbox.checked) {
          checkbox.checked = true;
          // Trigger change event in case the page ligit initstens to it
          checkbox.dispatchEvent(new Event("change", { bubbles: true }));
          console.log("Checkbox checked");
        }
        return checkbox.checked;
      }
      return false;
    }

    function fillTextInput(selector: string, value: string): boolean {
      const input = document.querySelector(selector) as HTMLInputElement;
      if (input && (input.type === "text" || input.type === "number")) {
        input.value = value;
        // Trigger input and change events
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        console.log(`Input filled with: ${value}`);
        return true;
      }
      return false;
    }

    function clickButton(selector: string): boolean {
      const button = document.querySelector(selector) as HTMLButtonElement;
      if (button) {
        if (button.disabled) {
          console.warn("Button is disabled, attempting to enable it first...");
          button.disabled = false;
        }
        button.click();
        console.log("Button clicked");
        return true;
      }
      console.error("Button not found with selector:", selector);
      return false;
    }

    // Listen for messages from popup to trigger automation
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      console.log("Message received:", message.action);

      if (message.action === "automate") {
        console.log("Running automation...");

        // Example automation sequence
        const checkboxSelector = message.checkboxSelector ||
          'input[type="checkbox"]';
        const inputSelector = message.inputSelector || 'input[type="number"]';
        const buttonSelector = message.buttonSelector || "button";
        const inputValue = message.inputValue || "5";

        // Step 1: Check the checkbox
        const checked = checkCheckbox(checkboxSelector);

        if (checked) {
          // Step 2: Fill the input
          setTimeout(() => {
            const filled = fillTextInput(inputSelector, inputValue);

            if (filled) {
              // Step 3: Click the button
              setTimeout(() => {
                clickButton(buttonSelector);
              }, 500);
            }
          }, 500);
        }

        sendResponse({ success: true });
        return true;
      }

      if (message.action === "getUsername") {
        const debug: string[] = [];
        debug.push("🔍 Searching for username and balance...");

        const usernameSelector = message.usernameSelector || 'p.text-sm.text-right.pr-1.leading-none';
        const balanceSelector = message.balanceSelector || 'p.text-sm, p.text-base';

        debug.push(`Username selector: ${usernameSelector}`);
        debug.push(`Balance selector: ${balanceSelector}`);

        let username = 'Not found';
        let balance = 'Not found';

        // Try to find username
        const usernameElement = document.querySelector(usernameSelector);
        if (usernameElement) {
          username = usernameElement.textContent?.trim() || 'Not found';
          debug.push(`✓ Username found: "${username}"`);
        } else {
          debug.push(`❌ Username element not found with selector: ${usernameSelector}`);
        }

        // Try to find balance
        const balanceElement = document.querySelector(balanceSelector);
        if (balanceElement) {
          balance = balanceElement.textContent?.trim() || 'Not found';
          debug.push(`✓ Balance found: "${balance}"`);
        } else {
          debug.push(`❌ Balance element not found with selector: ${balanceSelector}`);
        }

        console.log('Sending response:', { username, balance, debugCount: debug.length });

        // Send response synchronously
        try {
          sendResponse({ username, balance, debug });
          console.log('Response sent successfully');
        } catch (err) {
          console.error('Error sending response:', err);
        }

        // IMPORTANT: Return true to indicate we will send a response
        return true;
      }

      console.log("Unknown action:", message.action);
      // Return false for unknown actions
      return false;
    });

    // Helper function to inspect elements on the page
    function inspectPage() {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      const inputs = document.querySelectorAll(
        'input[type="text"], input[type="number"]',
      );
      const buttons = document.querySelectorAll("button");

      console.log("=== Page Inspection ===");
      console.log("Checkboxes found:", checkboxes.length);
      checkboxes.forEach((cb, i) => {
        console.log(`  Checkbox ${i}:`, cb);
      });

      console.log("Inputs found:", inputs.length);
      inputs.forEach((input, i) => {
        console.log(`  Input ${i}:`, input);
      });

      console.log("Buttons found:", buttons.length);
      buttons.forEach((btn, i) => {
        console.log(`  Button ${i}:`, btn.textContent);
      });
    }

    // Run inspection on load
    inspectPage();
  },
});
