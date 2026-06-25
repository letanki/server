/**
 * Per-turret TankModelData physics: kickback (recoil) + turret-turn acceleration. Per-modification
 * tuning constants decoded from captured TankModelData (id -1643824092); items not listed fall back
 * to the old formula in battle.workflow. Keys are `<base>_m<mod>` (e.g. "railgun_m2"); angular values
 * in RADIANS. (Hull physics moved into the unified hulls.data.ts; turrets to follow.)
 */
export interface TurretPhysics {
    kickback: number;
    turretTurnAcceleration: number; // radians
}


export const turretPhysicsData: Record<string, TurretPhysics> = {
    // m0
    flamethrower_m0: { kickback: 0, turretTurnAcceleration: 2.63 },
    isida_m0: { kickback: 0, turretTurnAcceleration: 2.64 },
    ricochet_m0: { kickback: 1.45, turretTurnAcceleration: 1.26 },
    railgun_m0: { kickback: 1.9, turretTurnAcceleration: 1.11 },
    smoky_m0: { kickback: 1.1, turretTurnAcceleration: 2 },
    twins_m0: { kickback: 0.31, turretTurnAcceleration: 2.56 },
    thunder_m0: { kickback: 1.56, turretTurnAcceleration: 1.71 },
    shaft_m0: { kickback: 2.11, turretTurnAcceleration: 1.46 },
    // m1
    thunder_m1: { kickback: 2.02, turretTurnAcceleration: 2.11 },
    freeze_m1: { kickback: 0, turretTurnAcceleration: 3.67 },
    shotgun_m1: { kickback: 2.17, turretTurnAcceleration: 2.47 },
    railgun_m1: { kickback: 2.27, turretTurnAcceleration: 1.33 },
    isida_m1: { kickback: 0, turretTurnAcceleration: 3.06 },
    ricochet_m1: { kickback: 1.67, turretTurnAcceleration: 1.68 },
    machinegun_m1: { kickback: 0.6, turretTurnAcceleration: 2.06 },
    flamethrower_m1: { kickback: 0, turretTurnAcceleration: 3.09 },
    shaft_m1: { kickback: 2.47, turretTurnAcceleration: 1.76 },
    // m2
    railgun_m2: { kickback: 2.63, turretTurnAcceleration: 1.54 },
    smoky_m2: { kickback: 1.95, turretTurnAcceleration: 2.9 },
    twins_m2: { kickback: 0.43, turretTurnAcceleration: 3.38 },
    thunder_m2: { kickback: 2.47, turretTurnAcceleration: 2.51 },
    shotgun_m2: { kickback: 2.53, turretTurnAcceleration: 2.83 },
    isida_m2: { kickback: 0, turretTurnAcceleration: 3.45 },
    ricochet_m2: { kickback: 1.88, turretTurnAcceleration: 2.12 },
    machinegun_m2: { kickback: 0.8, turretTurnAcceleration: 2.24 },
    flamethrower_m2: { kickback: 0, turretTurnAcceleration: 3.55 },
    // m3 — full set
    smoky_m3: { kickback: 2.5, turretTurnAcceleration: 3.4800119955514934 },
    twins_m3: { kickback: 0.5, turretTurnAcceleration: 3.8500217969742923 },
    railgun_m3: { kickback: 3, turretTurnAcceleration: 1.7599900177110819 },
    isida_m3: { kickback: 0, turretTurnAcceleration: 3.8500217969742923 },
    thunder_m3: { kickback: 2.8, turretTurnAcceleration: 2.800031718974503 },
    thunder_xt_m3: { kickback: 2.8, turretTurnAcceleration: 2.800031718974503 },
    shotgun_m3: { kickback: 2.9, turretTurnAcceleration: 3.200061183531603 },
    freeze_m3: { kickback: 0, turretTurnAcceleration: 4.439943084148375 },
    ricochet_m3: { kickback: 2, turretTurnAcceleration: 2.3701571242083004 },
    machinegun_m3: { kickback: 0.96, turretTurnAcceleration: 2.4000022544174024 },
    flamethrower_m3: { kickback: 0, turretTurnAcceleration: 4.13992098573055 },
    shaft_m3: { kickback: 3, turretTurnAcceleration: 2.1600194822681824 },
};
