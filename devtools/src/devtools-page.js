/**
 * DevTools page script - creates the Veda panel
 */

chrome.devtools.panels.create(
  'Veda',
  '', // icon path (empty for now)
  'panel.html',
  function(panel) {
    console.log('[Veda DevTools] Panel created');
  }
);


