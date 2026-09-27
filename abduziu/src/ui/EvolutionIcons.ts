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
};

export function evolutionIcon(id: UpgradeId): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[id]}</svg>`;
}
