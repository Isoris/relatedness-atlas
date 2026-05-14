// shared/loaders/index.js
// =============================================================================
// Barrel export for the four loaders that translate ngsPedigree + Inversion
// Atlas outputs into the canonical shapes the relatedness pages consume.
// =============================================================================

export { loadResPairwise }        from './res_pairwise.js';
export { loadFamilyHubRoster }    from './family_hub_roster.js';
export { loadPerChromQc }         from './per_chrom_qc.js';
export { loadInversionKaryotypes } from './inversion_karyotypes.js';
