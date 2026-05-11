// atlases/relatedness/shared/chrome.js
// =============================================================================
// Atlas-chrome bindings — theme toggle, section collapse, pill clicks, reload.
// Extracted from legacy Relatedness_atlas.js §3 (lines 517-606).
//
// NOTE: legacy §3 also wired the sub-tab routing (Network / Karyotypes /
// Inversions / Mendelian / Compatibility). In the atlas-core era that routing
// is owned by core/atlas_router.js — the sub-tabs are pages, the URL hash
// becomes #/relatedness/<page>, and atlas_router.navigate() mounts the right
// module. So the sub-tab wiring is intentionally omitted from this module.
//
// What remains:
//   - theme toggle (☀ light / 📜 academic / 🌙 dark)
//   - .col-section .collapsed toggle (left + right column accordion)
//   - .pill click stubs (open file picker — round 2)
//   - #reloadBtn handler (refresh loaded_at timestamp)
// =============================================================================

import { $, $$ } from './utils.js';
import { state } from './state.js';

const THEME_KEY = 'relatedness_atlas_v0.1.theme';

export function wireChrome() {
  // Theme toggle — three-way cycle.
  const themeBtn = $('#themeToggleBtn');
  if (themeBtn && !themeBtn.dataset.wired) {
    themeBtn.dataset.wired = '1';
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved && ['dark','light','academic'].includes(saved)) {
        applyTheme(saved, themeBtn);
      } else {
        applyTheme('light', themeBtn);
      }
    } catch (_) { applyTheme('light', themeBtn); }
    themeBtn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = cur === 'dark' ? 'light' : (cur === 'light' ? 'academic' : 'dark');
      applyTheme(next, themeBtn);
    });
  }

  // Section collapse/expand toggles.
  $$('[data-toggle-section]').forEach(btn => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const section = btn.closest('.col-section');
      if (!section) return;
      section.classList.toggle('collapsed');
      btn.textContent = section.classList.contains('collapsed') ? '⌃' : '⌄';
    });
  });

  // Pill stubs — round 2 will open a real file picker per .pill[data-pill].
  $$('.pill').forEach(p => {
    if (p.dataset.wired) return;
    p.dataset.wired = '1';
    p.addEventListener('click', () => {
      const kind = p.getAttribute('data-pill');
      console.log('[RA] pill click:', kind, '— would open file picker for', kind);
    });
  });

  // Reload — refresh the loaded_at timestamp.
  const reload = $('#reloadBtn');
  if (reload && !reload.dataset.wired) {
    reload.dataset.wired = '1';
    reload.addEventListener('click', () => {
      state.loaded_at = new Date().toLocaleString();
      const ts = $('#loadedAt');
      if (ts) ts.textContent = 'Loaded: ' + state.loaded_at;
    });
  }
}

function applyTheme(theme, themeBtn) {
  if (theme === 'dark') {
    document.documentElement.removeAttribute('data-theme');
    themeBtn.textContent = '☀ light';
  } else {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light')    themeBtn.textContent = '📜 academic';
    if (theme === 'academic') themeBtn.textContent = '🌙 dark';
  }
  try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
}
