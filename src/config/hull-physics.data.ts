/**
 * Extra tank physics sent in the TankModelData JSON (not in SetSpecification): reverse/side/turn
 * accelerations, damping, mass (hull) and kickback / turret-turn acceleration (turret).
 *
 * In the original server these are per-modification tuning constants, NOT derivable from the
 * speed/turn values. Our battle.workflow used hardcoded/approximated values, which made movement
 * feel wrong. Entries here are the EXACT values decoded from captured TankModelData packets; any
 * item NOT listed falls back to the old formula/defaults in battle.workflow until we capture it.
 *
 * Keys are `<base>_m<mod>` (e.g. "wasp_m2"). Angular values are in RADIANS (as sent on the wire).
 * To add more: decode TankModelData (id -1643824092) for the item and copy the fields verbatim.
 */
export interface HullPhysics {
    reverseAcceleration: number;
    sideAcceleration: number;
    turnAcceleration: number; // radians
    reverseTurnAcceleration: number; // radians
    dampingCoeff: number;
    mass: number; // overrides garage HULL_MASS where the capture disagrees
}

export interface TurretPhysics {
    kickback: number;
    turretTurnAcceleration: number; // radians
}

export const hullPhysicsData: Record<string, HullPhysics> = {
    // m0
    dictator_m0: { reverseAcceleration: 12.04, sideAcceleration: 9.04, turnAcceleration: 1.81, reverseTurnAcceleration: 3.41, dampingCoeff: 2500, mass: 2170 },
    mammoth_m0: { reverseAcceleration: 8.09, sideAcceleration: 17.17, turnAcceleration: 1.36, reverseTurnAcceleration: 2.81, dampingCoeff: 2000, mass: 3935 },
    hornet_m0: { reverseAcceleration: 16.38, sideAcceleration: 12.8, turnAcceleration: 2.82, reverseTurnAcceleration: 3.85, dampingCoeff: 1250, mass: 1409 },
    hunter_m0: { reverseAcceleration: 10, sideAcceleration: 8.5, turnAcceleration: 2.09, reverseTurnAcceleration: 3.32, dampingCoeff: 1500, mass: 1700 },
    viking_m0: { reverseAcceleration: 14.09, sideAcceleration: 10.61, turnAcceleration: 2.28, reverseTurnAcceleration: 3.16, dampingCoeff: 2000, mass: 2039 },
    // m1
    wasp_m1: { reverseAcceleration: 13.74, sideAcceleration: 18.12, turnAcceleration: 3.04, reverseTurnAcceleration: 5.21, dampingCoeff: 900, mass: 1483 },
    hornet_m1: { reverseAcceleration: 18.83, sideAcceleration: 15.09, turnAcceleration: 2.88, reverseTurnAcceleration: 4.49, dampingCoeff: 1250, mass: 1774 },
    hunter_m1: { reverseAcceleration: 12.43, sideAcceleration: 10.78, turnAcceleration: 2.31, reverseTurnAcceleration: 3.79, dampingCoeff: 1500, mass: 2096 },
    viking_m1: { reverseAcceleration: 16.52, sideAcceleration: 13.65, turnAcceleration: 2.49, reverseTurnAcceleration: 3.58, dampingCoeff: 2000, mass: 2435 },
    titan_m1: { reverseAcceleration: 12.13, sideAcceleration: 13.91, turnAcceleration: 1.39, reverseTurnAcceleration: 3.34, dampingCoeff: 2100, mass: 3783 },
    mammoth_m1: { reverseAcceleration: 9.61, sideAcceleration: 20.22, turnAcceleration: 1.49, reverseTurnAcceleration: 3.07, dampingCoeff: 2000, mass: 4543 },
    // m2
    wasp_m2: { reverseAcceleration: 15.26, sideAcceleration: 20.87, turnAcceleration: 3.25, reverseTurnAcceleration: 5.79, dampingCoeff: 900, mass: 1817 },
    hornet_m2: { reverseAcceleration: 21.26, sideAcceleration: 17.37, turnAcceleration: 2.93, reverseTurnAcceleration: 5.13, dampingCoeff: 1250, mass: 2139 },
    hunter_m2: { reverseAcceleration: 14.87, sideAcceleration: 13.07, turnAcceleration: 2.52, reverseTurnAcceleration: 4.27, dampingCoeff: 1500, mass: 2491 },
    viking_m2: { reverseAcceleration: 18.96, sideAcceleration: 16.7, turnAcceleration: 2.7, reverseTurnAcceleration: 4.01, dampingCoeff: 2000, mass: 2830 },
    dictator_m2: { reverseAcceleration: 16.91, sideAcceleration: 13.91, turnAcceleration: 2.13, reverseTurnAcceleration: 4.69, dampingCoeff: 2500, mass: 2961 },
    titan_m2: { reverseAcceleration: 14.57, sideAcceleration: 16.96, turnAcceleration: 1.65, reverseTurnAcceleration: 3.76, dampingCoeff: 2100, mass: 4391 },
    mammoth_m2: { reverseAcceleration: 11.13, sideAcceleration: 23.26, turnAcceleration: 1.65, reverseTurnAcceleration: 3.34, dampingCoeff: 2000, mass: 5152 },
    // m3 — full set
    wasp_m3: { reverseAcceleration: 17, sideAcceleration: 24, turnAcceleration: 3.490658503988659, reverseTurnAcceleration: 6.457718232379019, dampingCoeff: 900, mass: 2200 },
    hornet_m3: { reverseAcceleration: 23, sideAcceleration: 19, turnAcceleration: 2.9670597283903604, reverseTurnAcceleration: 5.585053606381854, dampingCoeff: 1250, mass: 2400 },
    hunter_m3: { reverseAcceleration: 18, sideAcceleration: 16, turnAcceleration: 2.792526803190927, reverseTurnAcceleration: 4.886921905584122, dampingCoeff: 1500, mass: 3000 },
    viking_m3: { reverseAcceleration: 20, sideAcceleration: 18, turnAcceleration: 2.792526803190927, reverseTurnAcceleration: 4.1887902047863905, dampingCoeff: 2000, mass: 3000 },
    dictator_m3: { reverseAcceleration: 19, sideAcceleration: 16, turnAcceleration: 2.2689280275926285, reverseTurnAcceleration: 5.235987755982989, dampingCoeff: 2500, mass: 3300 },
    titan_m3: { reverseAcceleration: 17, sideAcceleration: 20, turnAcceleration: 1.9198621771937625, reverseTurnAcceleration: 4.1887902047863905, dampingCoeff: 2100, mass: 5000 },
    mammoth_m3: { reverseAcceleration: 12, sideAcceleration: 25, turnAcceleration: 1.7453292519943295, reverseTurnAcceleration: 3.490658503988659, dampingCoeff: 2000, mass: 5500 },
};

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
