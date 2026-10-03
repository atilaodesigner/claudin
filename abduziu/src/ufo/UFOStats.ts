import { BALANCE } from '../config/gameBalance';
import { META_VALUES, type MetaNodeId } from '../config/meta';
import { UPGRADE_VALUES } from '../config/upgrades';
import type { UpgradeSystem } from '../progression/UpgradeSystem';

export interface StatInputs {
  upgrades: UpgradeSystem;
  meta: Partial<Record<MetaNodeId, number>>;
  /** Continuous tier from total matter. */
  matterTier: number;
  frenzy: boolean;
  chainStacks: number;
  perfectDodgeBuff: boolean;
  stillFactor: number;
  maxBeam: boolean;
}

/** Derived UFO numbers. Recomputed every frame (cheap) from upgrades + meta + progression. */
export class UFOStats {
  scale = 1;
  /** Size ceiling (the online arena lets big players keep growing). */
  maxScale: number = BALANCE.ufo.maxScale;
  radius: number = BALANCE.ufo.baseRadius;
  altitude: number = BALANCE.ufo.baseAltitude;
  speed: number = BALANCE.ufo.baseSpeed;
  acceleration: number = BALANCE.ufo.acceleration;
  maxHull: number = BALANCE.ufo.baseHull;
  maxShield: number = BALANCE.player.shieldBase;
  shieldRegen: number = BALANCE.player.shieldRegenRate;
  beamRadius: number = BALANCE.beam.baseRadius;
  /** Effective beam power, in mass tier units. */
  beamTier = 1;
  /** Beam tier without the transient bonuses (used for HUD class). */
  baseBeamTier = 1;
  capacity: number = BALANCE.beam.baseCapacity;
  absorbSpeed = 1;
  matterMult = 1;
  satellites = 0;
  satelliteRadiusMult: number = UPGRADE_VALUES.feixe_duplo.satelliteRadiusMult;
  pullRadiusMult = 0;
  pullStrength = 0;
  reflectChance = 0;
  timeFieldSlow = 0;
  empCooldown: number = BALANCE.player.empCooldown;
  empRadius: number = BALANCE.player.empRadius;
  autoEmpPeriod = 0;
  dashUnlocked = false;
  dashCooldown: number = BALANCE.player.dashCooldown;
  comboWindowBonus = 0;
  rarityBonus = 0;
  coreBonus = 0;
  orbitAlways = false;
  /** Hull repaired per second (NANORREPARO, Auto-reparo). */
  hullRegen = 0;
  /** Hull repaired per abduction (CASCO VIVO). */
  hullPerAbduction = 0;
  /** Multiplies every threat gain (MODO FURTIVO, Camuflagem, FANTASMA). */
  threatMult = 1;
  /** Multiplies the Abduction Frenzy duration. */
  frenzyDurationMult = 1;
  /** Chance that an abduction is worth triple matter (JACKPOT). */
  jackpotChance = 0;
  /** Extra matter for objects missing from the Coleção (CATALOGADOR). */
  newDexBonus = 0;
  /** Lethal hits this run can survive: FÊNIX (half hull) and Último Suspiro (1 hull). */
  phoenix = false;
  lastStand = false;

  compute(i: StatInputs): void {
    const u = i.upgrades;
    const m = (id: MetaNodeId) => i.meta[id] ?? 0;
    const B = BALANCE;
    const F = B.frenzy;

    const startTier = m('nave_tamanho') * META_VALUES.startTierPerLevel;
    const sizeTier = Math.max(0, i.matterTier - 1 + startTier);
    let scale = Math.min(this.maxScale, Math.pow(B.ufo.scaleBase, sizeTier));
    scale *= 1 + u.level('colosso') * UPGRADE_VALUES.colosso.scalePerLevel + m('nave_colosso') * META_VALUES.colossusPerLevel;
    if (i.frenzy) scale *= F.scaleMult;
    this.scale = scale;

    this.radius = B.ufo.baseRadius * scale;
    this.altitude = B.ufo.baseAltitude * Math.pow(scale, B.ufo.altitudeScaleExp);

    const speedMult = 1 + u.level('hiperpropulsor') * UPGRADE_VALUES.hiperpropulsor.speedPerLevel + m('mov_velocidade') * META_VALUES.speedPerLevel;
    this.speed = B.ufo.baseSpeed * Math.pow(scale, B.ufo.speedScaleExp) * speedMult * (i.frenzy ? F.speedMult * (1 + m('mov_frenesi') * META_VALUES.frenzySpeedPerLevel) : 1);
    this.acceleration =
      B.ufo.acceleration *
      (1 + m('nave_aceleracao') * META_VALUES.accelPerLevel + m('mov_estabilizador') * META_VALUES.gyroPerLevel + u.level('estabilizador') * UPGRADE_VALUES.estabilizador.accelPerLevel);

    this.maxHull = B.ufo.baseHull + m('nave_casco') * META_VALUES.hullPerLevel + u.level('casco') * UPGRADE_VALUES.casco.hullPerLevel;
    const shieldMult = 1 + u.level('escudo') * UPGRADE_VALUES.escudo.shieldPerLevel + m('def_escudo') * META_VALUES.shieldPerLevel;
    this.maxShield = B.player.shieldBase * shieldMult * Math.sqrt(scale);
    this.shieldRegen = B.player.shieldRegenRate * Math.sqrt(scale) * (1 + u.level('escudo') * UPGRADE_VALUES.escudo.regenPerLevel + m('def_regen') * META_VALUES.regenPerLevel);

    const radiusMult = 1 + u.level('campo_maior') * UPGRADE_VALUES.campo_maior.radiusPerLevel + m('feixe_raio') * META_VALUES.beamRadiusPerLevel;
    this.beamRadius = B.beam.baseRadius * scale * radiusMult * (i.frenzy ? F.radiusMult : 1) * (i.maxBeam ? 1.6 : 1);

    const strength = u.level('gravidade_bruta') * UPGRADE_VALUES.gravidade_bruta.tiersPerLevel + m('feixe_forca') * META_VALUES.beamTierPerLevel;
    this.baseBeamTier = i.matterTier + startTier + strength;
    let tier = this.baseBeamTier;
    tier += i.chainStacks * UPGRADE_VALUES.colheita_cadeia.tiersPerStack;
    tier += i.stillFactor * B.beam.stillPowerBonus;
    if (i.frenzy) tier += F.powerBonusTiers;
    if (i.perfectDodgeBuff) tier += B.player.perfectDodgePowerBonus * 1.6;
    if (i.maxBeam) tier += 12;
    this.beamTier = tier;

    let capacity = B.beam.baseCapacity + u.level('trator_multiplo') * UPGRADE_VALUES.trator_multiplo.capacityPerLevel + m('feixe_multi') * META_VALUES.capacityPerLevel;
    capacity += u.level('feixe_duplo') * UPGRADE_VALUES.feixe_duplo.capacityPerLevel;
    if (u.has('colheita_industrial')) capacity += 4;
    if (i.frenzy) capacity += F.capacityBonus;
    // bigger ships naturally carry a bit more
    capacity += Math.floor(Math.max(0, sizeTier) / 2.5);
    if (i.maxBeam) capacity += 20;
    this.capacity = capacity;

    this.absorbSpeed = (1 + u.level('processamento') * UPGRADE_VALUES.processamento.speedPerLevel + m('feixe_velocidade') * META_VALUES.absorbSpeedPerLevel) * (i.frenzy ? 1.35 : 1);
    this.matterMult = 1 + u.level('ima_materia') * UPGRADE_VALUES.ima_materia.matterPerLevel + m('eco_materia') * META_VALUES.matterPerLevel;

    this.satellites = u.level('feixe_duplo') * UPGRADE_VALUES.feixe_duplo.satellitesPerLevel + m('feixe_satelite') * META_VALUES.satellitesPerLevel;
    this.satelliteRadiusMult = u.has('colheita_industrial') ? 0.95 : UPGRADE_VALUES.feixe_duplo.satelliteRadiusMult;

    const bn = u.level('buraco_negro');
    this.pullRadiusMult = bn > 0 ? UPGRADE_VALUES.buraco_negro.radiusMult + (bn - 1) * UPGRADE_VALUES.buraco_negro.radiusPerLevel : 0;
    this.pullStrength = bn * UPGRADE_VALUES.buraco_negro.pullPerLevel * (u.has('singularidade') ? 2 : 1);
    if (u.has('singularidade')) this.pullRadiusMult *= 1.35;
    // Gravidade Residual: a light pull even without BURACO NEGRO
    const residual = m('feixe_residual');
    if (bn === 0 && residual > 0) {
      this.pullRadiusMult = 1.6 + residual * 0.2;
      this.pullStrength = residual * META_VALUES.residualPullPerLevel;
    }
    this.orbitAlways = u.has('singularidade');

    this.reflectChance = Math.min(0.75, u.level('raio_refletor') * UPGRADE_VALUES.raio_refletor.chancePerLevel + m('def_reflexo') * META_VALUES.reflectPerLevel);
    this.timeFieldSlow = Math.min(0.75, u.level('campo_temporal') * UPGRADE_VALUES.campo_temporal.slowPerLevel);

    const empLvl = u.level('pulso_emp');
    this.empCooldown = B.player.empCooldown * (1 - m('def_emp') * META_VALUES.empCooldownPerLevel) * (1 - empLvl * UPGRADE_VALUES.pulso_emp.cooldownReduction);
    this.empRadius = B.player.empRadius * Math.pow(scale, 0.7) * (1 + m('def_emp') * META_VALUES.empRadiusPerLevel + u.level('onda_choque') * UPGRADE_VALUES.onda_choque.radiusPerLevel);
    this.autoEmpPeriod = empLvl > 0 ? UPGRADE_VALUES.pulso_emp.basePeriod + (empLvl - 1) * UPGRADE_VALUES.pulso_emp.periodPerLevel : 0;

    const turbine = u.level('turbina_dobra');
    this.dashUnlocked = m('mov_dash') > 0 || turbine > 0;
    this.dashCooldown = B.player.dashCooldown * (1 - m('mov_afterburner') * META_VALUES.dashCooldownPerLevel) * Math.max(0.4, 1 + turbine * UPGRADE_VALUES.turbina_dobra.cooldownPerLevel);
    this.comboWindowBonus = m('eco_combo') * META_VALUES.comboWindowPerLevel + u.level('ritmo_alien') * UPGRADE_VALUES.ritmo_alien.windowPerLevel;
    this.rarityBonus = m('eco_raridade') * META_VALUES.rarityPerLevel + u.level('radar_raros') * UPGRADE_VALUES.radar_raros.rarityPerLevel;
    this.coreBonus = m('eco_cores') * META_VALUES.coresPerLevel + u.level('cacador_cores') * UPGRADE_VALUES.cacador_cores.coresPerLevel;

    this.hullRegen = u.level('nanoreparo') * UPGRADE_VALUES.nanoreparo.hullPerSecondPerLevel + m('nave_reparo') * META_VALUES.hullRegenPerLevel;
    this.hullPerAbduction = u.level('casco_vivo') * UPGRADE_VALUES.casco_vivo.hullPerAbductionPerLevel;
    this.threatMult = Math.max(
      0.3,
      (1 + u.level('furtividade') * UPGRADE_VALUES.furtividade.threatPerLevel) * (1 - m('def_camuflagem') * META_VALUES.camouflagePerLevel) * (u.has('fantasma') ? 0.75 : 1),
    );
    this.frenzyDurationMult =
      (1 + u.level('frenesi_longo') * UPGRADE_VALUES.frenesi_longo.durationPerLevel + m('eco_frenesi') * META_VALUES.frenzyDurationPerLevel) * (u.has('tempo_bala') ? 2 : 1);
    this.jackpotChance = Math.min(0.5, u.level('jackpot') * UPGRADE_VALUES.jackpot.chancePerLevel + m('eco_jackpot') * META_VALUES.jackpotPerLevel);
    this.newDexBonus = u.level('catalogador') * UPGRADE_VALUES.catalogador.newDexMatterPerLevel + m('eco_catalogo') * META_VALUES.catalogPerLevel;
    this.phoenix = u.has('fenix');
    this.lastStand = m('def_ultimo_suspiro') > 0;
  }
}
