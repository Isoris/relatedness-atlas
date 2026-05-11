// atlases/relatedness/shared/pop_tree.js
// =============================================================================
// Population Browser tree (left column). Extracted from legacy
// Relatedness_atlas.js §4 (lines 609-774).
//
// Renders the tree under #popTree, wires the #treeSearch input, and exposes
// selectIndividual() so other modules can drive the focus.
//
// Cross-page hooks:
//   - selectIndividual() calls renderInspector() (from shared/inspector.js)
//                        and triggers re-render of the currently-mounted page
//                        via the optional callback registered at module init.
//
// Round 1 (2026-05-11): the cross-page re-render uses a global registry of
// page-private re-render hooks (the shared/page_hooks.js mini-bus). When a
// page mounts it registers; when it unmounts it deregisters. Tree clicks emit
// 'individual_changed' which every registered page picks up.
// =============================================================================

import { $, $$, el } from './utils.js';
import { DEMO } from './demo_data.js';
import { state } from './state.js';
import { emit } from './page_hooks.js';

export function renderPopTree() {
  const root = $('#popTree');
  if (!root) return;
  root.innerHTML = '';

  // Population (root)
  const popNode = el('div', { class: 'tree-node', 'data-tree-key': 'population' },
    el('span', { class: 'tree-toggle expanded', text: '▶' }),
    el('span', { class: 'tree-icon population', text: '⚇' }),
    el('span', { class: 'tree-label', text: 'Population' }),
    el('span', { class: 'tree-count', text: 'n = ' + DEMO.individuals.length })
  );
  const popKids = el('div', { class: 'tree-children' });
  popNode.addEventListener('click', () => toggleTree(popNode, popKids));
  root.appendChild(popNode);
  root.appendChild(popKids);

  DEMO.families.forEach((fam) => {
    const isFam1 = fam.family_id === 'Family 1';
    const famNode = el('div', { class: 'tree-node' },
      el('span', { class: 'tree-toggle' + (isFam1 ? ' expanded' : ''), text: '▶' }),
      el('span', { class: 'tree-icon family', text: '⚇' }),
      el('span', { class: 'tree-label',
                   text: fam.family_id + (fam.hub_individual ? ' (hub)' : '') }),
      el('span', { class: 'tree-count', text: 'n = ' + fam.n })
    );
    popKids.appendChild(famNode);

    const famKids = el('div', { class: 'tree-children' + (isFam1 ? '' : ' collapsed') });
    popKids.appendChild(famKids);
    famNode.addEventListener('click', e => {
      e.stopPropagation();
      toggleTree(famNode, famKids);
      state.selected_family = fam.family_id;
      const bc = $('#bcFamily'); if (bc) bc.textContent = fam.family_id;
    });

    if (fam.hub_individual) {
      const hubNode = el('div', { class: 'tree-node selected' },
        el('span', { class: 'tree-toggle expanded', text: '▶' }),
        el('span', { class: 'tree-icon hub', text: '◉' }),
        el('span', { class: 'tree-label', text: 'Hub: ' + fam.hub_individual })
      );
      famKids.appendChild(hubNode);
      const hubKids = el('div', { class: 'tree-children' });
      famKids.appendChild(hubKids);

      hubNode.addEventListener('click', e => {
        e.stopPropagation();
        toggleTree(hubNode, hubKids);
        selectIndividual(fam.hub_individual);
      });

      DEMO.chromosomes.slice(0, 4).forEach(ch => {
        const chNode = el('div', { class: 'tree-node dimmed' },
          el('span', { class: 'tree-toggle empty', text: '▶' }),
          el('span', { class: 'tree-icon chromosome', text: '⌬' }),
          el('span', { class: 'tree-label', text: ch })
        );
        chNode.addEventListener('click', e => {
          e.stopPropagation();
          state.selected_chromosome = ch;
          const cf = $('#chrFilter'); if (cf) cf.value = ch;
          emit('chromosome_changed', ch);
        });
        hubKids.appendChild(chNode);
      });
      hubKids.appendChild(el('div', {
        class: 'tree-node dimmed',
        style: { fontStyle: 'italic', fontSize: '10px', color: 'var(--ink-dimmer)' }
      },
        el('span', { class: 'tree-toggle empty', text: '▶' }),
        el('span', { class: 'tree-icon chromosome', text: '⌬' }),
        el('span', { class: 'tree-label', text: 'Chr28' })
      ));
    }

    fam.members.filter(m => m !== fam.hub_individual).forEach(member => {
      const m_n = el('div', { class: 'tree-node dimmed' },
        el('span', { class: 'tree-toggle', text: '▶' }),
        el('span', { class: 'tree-icon individual', text: '○' }),
        el('span', { class: 'tree-label', text: member })
      );
      m_n.addEventListener('click', e => {
        e.stopPropagation();
        selectIndividual(member);
      });
      famKids.appendChild(m_n);
    });
  });

  const ambN = DEMO.ambiguous_clusters.reduce((s, c) => s + c.members.length, 0);
  const ambNode = el('div', { class: 'tree-node' },
    el('span', { class: 'tree-toggle', text: '▶' }),
    el('span', { class: 'tree-icon family', text: '◇' }),
    el('span', { class: 'tree-label', text: 'Ambiguous clusters' }),
    el('span', { class: 'tree-count', text: 'n = ' + ambN })
  );
  popKids.appendChild(ambNode);
  const ambKids = el('div', { class: 'tree-children collapsed' });
  popKids.appendChild(ambKids);
  ambNode.addEventListener('click', e => {
    e.stopPropagation(); toggleTree(ambNode, ambKids);
  });

  popKids.appendChild(el('div', { class: 'tree-node' },
    el('span', { class: 'tree-toggle empty', text: '▶' }),
    el('span', { class: 'tree-icon individual', text: '?' }),
    el('span', { class: 'tree-label', text: 'Unassigned' }),
    el('span', { class: 'tree-count', text: 'n = 1' })
  ));

  // Wire the search box (idempotent — clears the listener-binding state if rerendered).
  const search = $('#treeSearch');
  if (search && !search.dataset.wired) {
    search.dataset.wired = '1';
    search.addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      $$('.tree-node').forEach(n => {
        const lbl = n.querySelector('.tree-label');
        if (!lbl) return;
        if (!q) { n.style.display = ''; return; }
        n.style.display = lbl.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }
}

export function toggleTree(node, kidsContainer) {
  if (!kidsContainer) return;
  const collapsed = kidsContainer.classList.contains('collapsed');
  kidsContainer.classList.toggle('collapsed', !collapsed);
  const toggle = node.querySelector('.tree-toggle');
  if (toggle && !toggle.classList.contains('empty')) {
    toggle.classList.toggle('expanded', collapsed);
  }
}

export function selectIndividual(ind) {
  state.selected_individual = ind;
  state.inspector_pair = { a: 'Ind_001', b: ind === 'Ind_001' ? 'Ind_044' : ind };
  $$('.tree-node').forEach(n => {
    const lbl = n.querySelector('.tree-label');
    if (!lbl) return;
    const matches = lbl.textContent.includes(ind);
    n.classList.toggle('selected', matches && !n.classList.contains('dimmed'));
  });
  const bc = $('#bcLeaf');
  if (bc) bc.textContent = ind === DEMO.families[0].hub_individual
    ? 'Hub: ' + ind : ind;
  emit('individual_changed', ind);
}
