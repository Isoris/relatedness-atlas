// pages/hub/network/_state.js
// =============================================================================
// Page-private state pointer for the Network page. Same shape as the
// inversion-atlas pages/*/page*/_state.js modules. Initialised by the page's
// mount() and cleared in unmount().
// =============================================================================

export let _pageState = null;
export function _setActiveState(s) { _pageState = s; }
