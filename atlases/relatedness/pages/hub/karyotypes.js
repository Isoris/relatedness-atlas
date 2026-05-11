// atlases/relatedness/pages/hub/karyotypes.js
// =============================================================================
// Karyotypes page — sub-tab #2. The dedicated, full-12-rows × full-chromosome
// view of the karyotype matrix. The inline 5-row preview at the top of the
// Network page reuses the same shared renderer.
// =============================================================================

import { DEMO } from '../../shared/demo_data.js';
import { renderKaryotypeTable } from '../../shared/karyotype_table.js';
import { on } from '../../shared/page_hooks.js';
import { _setActiveState } from './karyotypes/_state.js';

export function renderKaryotypesFull() {
  renderKaryotypeTable('#karyoTableSlotFull', {
    rows: DEMO.individuals,
    columns: ['Chr01','Chr02','Chr03','Chr04','Chr05',
              'Chr06','Chr07','Chr08', null,
              'Chr17','Chr18', null, 'Chr28'],
  });
}

let _unsubInd = null, _unsubChr = null;

export async function mount(root, atlasState, registry) {
  _setActiveState({ atlasState, registry });
  renderKaryotypesFull();
  _unsubInd = on('individual_changed', () => renderKaryotypesFull());
  _unsubChr = on('chromosome_changed', () => renderKaryotypesFull());
}

export async function unmount(root) {
  _setActiveState(null);
  if (_unsubInd) _unsubInd();
  if (_unsubChr) _unsubChr();
  _unsubInd = _unsubChr = null;
}
