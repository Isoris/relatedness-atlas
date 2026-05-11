// atlases/relatedness/shared/loaded_files.js
// =============================================================================
// Loaded files panel (right column, third section). Extracted from legacy
// Relatedness_atlas.js §11 (lines 3049-3068).
//
// Renders state.loaded_files into the #loadedFilesList table.
//
// Future round: the four kinds — res, beagle, prune, inv — become entries in
// registries/data/files.registry.json with concrete path templates; loading
// flips the .loaded flag, the pillBar's status reflects the change, and this
// panel auto-refreshes on file_loaded events.
// =============================================================================

import { $, el } from './utils.js';
import { state } from './state.js';

export function renderLoadedFiles() {
  const root = $('#loadedFilesList');
  if (!root) return;
  root.innerHTML = '';
  for (const f of state.loaded_files) {
    root.appendChild(el('div', { class: 'lf-row' },
      el('div', { class: 'lf-icon', text: f.kind === 'res'    ? '◢'
                                          : f.kind === 'beagle' ? '⏷'
                                          : f.kind === 'prune'  ? '⌬'
                                          : '⌗' }),
      el('div', { class: 'lf-path', text: f.path }),
      el('div', { class: 'lf-status' + (f.loaded ? '' : ' unloaded'),
                   text: f.loaded ? 'Loaded' : 'Not loaded' }),
    ));
  }
  const ts = $('#loadedAt');
  if (ts) ts.textContent = 'Loaded: ' + state.loaded_at;
}
