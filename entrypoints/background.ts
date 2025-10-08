export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });

  // Register content script on install/update
  browser.runtime.onInstalled.addListener(async () => {
    console.log('Extension installed/updated, registering content scripts...');

    try {
      // Unregister existing content scripts first
      const existingScripts = await browser.scripting.getRegisteredContentScripts();
      if (existingScripts.length > 0) {
        await browser.scripting.unregisterContentScripts();
      }

      // Register the content script
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
});
