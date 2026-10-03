import type { UpgradeId } from '../config/upgrades';

/**
 * 24×24 line icons for the in-run evolutions. Stroke uses currentColor so the
 * chip's category color drives them.
 */
const PATHS: Record<UpgradeId, string> = {
  feixe_duplo: '<ellipse cx="12" cy="5" rx="7" ry="2.4"/><path d="M7 7.5 4 20h6L9 8M17 7.5 20 20h-6l1-12"/>',
  gravidade_bruta: '<path d="M12 3v10M7.5 9 12 13.5 16.5 9"/><path d="M6 16h12l1.5 5h-15z"/>',
  campo_maior: '<circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="12" r="5.6"/><circle cx="12" cy="12" r="9.2" stroke-dasharray="2.4 2.4"/>',
  processamento: '<path d="M4 6l6 6-6 6M12 6l6 6-6 6"/><path d="M20 5v14"/>',
  escudo: '<path d="M12 3 19.5 6v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  pulso_emp: '<circle cx="12" cy="12" r="9"/><path d="M13 5.5 8.5 13h4l-1.5 5.5L16 11h-4z"/>',
  raio_refletor: '<path d="M3 19 12 6l9 13"/><path d="M8.5 11.5 3 7M15.5 11.5 21 7" stroke-dasharray="2 2"/>',
  buraco_negro: '<path d="M12 12c0-1.5 1.8-2 2.8-1 1.4 1.4.4 4.2-2.2 4.4-3.2.2-5-2.9-3.9-5.7 1.3-3.4 5.8-4.4 8.8-2.1 3.5 2.7 3.1 8.3-.8 10.5"/>',
  colheita_cadeia: '<rect x="2.5" y="9" width="9" height="6" rx="3"/><rect x="12.5" y="9" width="9" height="6" rx="3"/><path d="M9 12h6"/>',
  hiperpropulsor: '<path d="M4 17c3-1 5-3 6-6l6-6 3 3-6 6c-3 1-5 3-6 6z"/><path d="M4 20l3-3M8 21l1.5-1.5M3 16l1.5-1.5"/>',
  campo_temporal: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>',
  trator_multiplo: '<path d="M4 4h16"/><path d="M6 6 4.5 18M12 6v12M18 6l1.5 12"/><circle cx="4.5" cy="20" r="1.2"/><circle cx="12" cy="20" r="1.2"/><circle cx="19.5" cy="20" r="1.2"/>',
  casco: '<path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z"/><path d="M12 7.5 16 9.8v4.4L12 16.5 8 14.2V9.8z"/>',
  ima_materia: '<path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4z"/><path d="M6 7.5h4M14 7.5h4"/>',
  nanoreparo: '<path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z"/><path d="M12 8.5v7M8.5 12h7"/>',
  casco_vivo: '<path d="M12 21C6 17 3.5 13.5 3.5 9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8.5 2.5C20.5 13.5 18 17 12 21z"/><path d="M7.5 12h2.5l1.5-3 2 6 1.5-3h1.5"/>',
  ritmo_alien: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  furtividade: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/><path d="M4 20 20 4"/>',
  frenesi_longo: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5M12 2.5v3"/>',
  onda_choque: '<circle cx="12" cy="12" r="2.5"/><path d="M6.5 6.5a7.8 7.8 0 0 0 0 11M17.5 6.5a7.8 7.8 0 0 1 0 11M3.5 3.5a12 12 0 0 0 0 17M20.5 3.5a12 12 0 0 1 0 17"/>',
  turbina_dobra: '<path d="M3 8h9M3 12h13M3 16h9"/><path d="M15 5l6 7-6 7"/>',
  estabilizador: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4"/><circle cx="12" cy="12" r="1.6"/>',
  cacador_cores: '<path d="M12 2.5 19 7v10l-7 4.5L5 17V7z"/><path d="M12 7v10M8 9.5l8 5M16 9.5l-8 5"/>',
  radar_raros: '<path d="M12 12 19 5"/><path d="M20.5 12A8.5 8.5 0 1 1 12 3.5"/><path d="M16.5 12A4.5 4.5 0 1 1 12 7.5"/><path d="M18 15.5l1 2 2 .4-1.5 1.4.4 2-1.9-1-1.9 1 .4-2-1.5-1.4 2-.4z"/>',
  jackpot: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M8 9v6M12 9v6M16 9v6"/><path d="M6.5 9h3M10.5 15h3M14.5 9h3"/>',
  catalogador: '<rect x="4" y="3" width="13" height="18" rx="1.5"/><path d="M7.5 7.5h6M7.5 11h6M7.5 14.5h3.5"/><path d="M17 17l3.5 3.5M15 15.5a2 2 0 1 0 3 0"/>',
  colosso: '<path d="M12 3 21 8v8l-9 5-9-5V8z"/><path d="M12 8 16.5 10.5v3L12 16l-4.5-2.5v-3z"/><path d="M3 8l4.5 2.5M21 8l-4.5 2.5M12 21v-5"/>',
};

export function evolutionIcon(id: UpgradeId): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[id]}</svg>`;
}
