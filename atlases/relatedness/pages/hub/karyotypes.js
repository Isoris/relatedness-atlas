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
import { probeModeB, renderModeBBadge, distinctCount } from '../../../../core/mode_b_badge.js';

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

  // Mode-B probe — non-blocking. Parallel-resolves the primary
  // inversion_karyotypes layer (drives the table) and the optional
  // ancestry_q layer (drives the ancestry stripe). Round-1 disk state
  // is empty, so today's badge says "○ data pending"; flips to ●
  // when ngsPedigree / Inversion-Atlas exports land at the templated
  // paths.
  _renderKaryotypesModeBBadge(registry).catch((e) => {
    console.warn('karyotypes.mount: Mode-B probe threw —', e);
  });
}

async function _renderKaryotypesModeBBadge(registry) {
  const [karProbe, qProbe] = await Promise.all([
    probeModeB(registry, 'inversion_karyotypes', {}),
    probeModeB(registry, 'ancestry_q', {}, {
      // ancestry_q is documented as drawing the ancestry stripe; the
      // payload shape isn't a row array — Q-matrix rows are one per
      // sample. Project to per-sample entries when present.
      extractRows: (p) => {
        if (!p) return null;
        if (Array.isArray(p)) return p;
        if (Array.isArray(p.samples)) return p.samples;
        if (Array.isArray(p.rows))    return p.rows;
        return null;
      },
    }),
  ]);

  const ancestryTag = qProbe.ok
    ? `ancestry_q ${qProbe.n} samples`
    : (qProbe.reason === 'stub-payload'
        ? 'ancestry stripe: data pending'
        : 'ancestry stripe: —');

  renderModeBBadge('karModeBBadge', karProbe, {
    label:    'karyotype matrix',
    layerKey: 'inversion_karyotypes',
    compare:  (probeResult) => {
      // Long-format: one row per (sample_id × inversion_id) with
      // karyotype ∈ {0/0, 0/1, 1/1, NA} per the file registry doc.
      const samples    = distinctCount(probeResult.rows, 'sample_id');
      const inversions = distinctCount(probeResult.rows, 'inversion_id');
      const kar = {};
      for (const r of probeResult.rows) {
        const k = r && (r.karyotype || r.kar || 'NA');
        kar[k] = (kar[k] || 0) + 1;
      }
      const kChips = ['0/0', '0/1', '1/1', 'NA']
        .filter((k) => kar[k] > 0)
        .map((k) => `${k}=${kar[k]}`)
        .join(' · ');
      return {
        pass: samples > 0 && inversions > 0,
        summary: `${samples} samples × ${inversions} inversions = ${probeResult.n} cells (${kChips || 'no karyotype col'}) · ${ancestryTag}`,
      };
    },
  });
}

export async function unmount(root) {
  _setActiveState(null);
  if (_unsubInd) _unsubInd();
  if (_unsubChr) _unsubChr();
  _unsubInd = _unsubChr = null;
}
