// Weapon simulation table sent whole to the client via WeaponPhysicsPacket (id -2124388778) and
// read by the weapon handlers (.weapons.find by id). Values captured verbatim from the official server
// (log 2026-06-25_11-14_s2-62637.ndjson, 76 weapons incl. xt/demonic/artillery variants). The shaft
// reticleImageId is the only resource-derived field — resolved via OUR ResourceManager (the captured
// number is the original server's idLow). To refresh: re-decode the packet and regenerate.
import { ResourceManager } from "@/utils/resource.manager";

export const weaponPhysicsData = {
  "weapons": [
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 2200,
      "id": "artillery_m0",
      "has_wwd": false,
      "special_entity": {
        "chargingTime": 1,
        "initialTurretAngle": 30,
        "maxShellSpeed": 65,
        "minShellSpeed": 25,
        "shellGravityCoef": 5,
        "shellRadius": 1,
        "speedsCount": 20,
        "impactForce": 5,
        "minSplashDamagePercent": 25,
        "radiusOfMaxSplashDamage": 0,
        "splashDamageRadius": 15
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 2200,
      "id": "artillery_m1",
      "has_wwd": false,
      "special_entity": {
        "chargingTime": 1,
        "initialTurretAngle": 30,
        "maxShellSpeed": 65,
        "minShellSpeed": 25,
        "shellGravityCoef": 5,
        "shellRadius": 1,
        "speedsCount": 20,
        "impactForce": 5,
        "minSplashDamagePercent": 25,
        "radiusOfMaxSplashDamage": 0,
        "splashDamageRadius": 15
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 2200,
      "id": "artillery_m2",
      "has_wwd": false,
      "special_entity": {
        "chargingTime": 1,
        "initialTurretAngle": 30,
        "maxShellSpeed": 65,
        "minShellSpeed": 25,
        "shellGravityCoef": 5,
        "shellRadius": 1,
        "speedsCount": 20,
        "impactForce": 5,
        "minSplashDamagePercent": 25,
        "radiusOfMaxSplashDamage": 0,
        "splashDamageRadius": 15
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 1500,
      "id": "artillery_m3",
      "has_wwd": false,
      "special_entity": {
        "chargingTime": 1,
        "initialTurretAngle": 30,
        "maxShellSpeed": 65,
        "minShellSpeed": 25,
        "shellGravityCoef": 5,
        "shellRadius": 1,
        "speedsCount": 20,
        "impactForce": 5,
        "minSplashDamagePercent": 25,
        "radiusOfMaxSplashDamage": 0,
        "splashDamageRadius": 15
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "flamethrower_xt_m0",
      "max_damage_radius": 5,
      "min_damage_radius": 17,
      "min_damage_percent": 50,
      "has_wwd": true,
      "special_entity": {
        "coneAngle": 0.3490658503988659,
        "range": 17,
        "energyCapacity": 100000,
        "energyDischargeSpeed": 16600,
        "energyRechargeSpeed": 7700,
        "tickIntervalMsec": 500
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "flamethrower_xt_m1",
      "max_damage_radius": 5,
      "min_damage_radius": 19.43,
      "min_damage_percent": 50,
      "has_wwd": true,
      "special_entity": {
        "coneAngle": 0.3490658503988659,
        "range": 19.43,
        "energyCapacity": 100000,
        "energyDischargeSpeed": 16600,
        "energyRechargeSpeed": 8300,
        "tickIntervalMsec": 500
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "flamethrower_xt_m2",
      "max_damage_radius": 5,
      "min_damage_radius": 21.87,
      "min_damage_percent": 50,
      "has_wwd": true,
      "special_entity": {
        "coneAngle": 0.3490658503988659,
        "range": 21.87,
        "energyCapacity": 100000,
        "energyDischargeSpeed": 16600,
        "energyRechargeSpeed": 9000,
        "tickIntervalMsec": 500
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "flamethrower_xt_m3",
      "max_damage_radius": 5,
      "min_damage_radius": 25,
      "min_damage_percent": 50,
      "has_wwd": true,
      "special_entity": {
        "coneAngle": 0.3490658503988659,
        "range": 25,
        "energyCapacity": 100000,
        "energyDischargeSpeed": 16600,
        "energyRechargeSpeed": 10000,
        "tickIntervalMsec": 500
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "isida_xt_m0",
      "has_wwd": false,
      "special_entity": {
        "coneAngle": 0.3490658503988659,
        "capacity": 10000,
        "chargeRate": 930,
        "checkPeriodMsec": 500,
        "dischargeIdleRate": 833,
        "dischargeDamageRate": 1420,
        "dischargeHealingRate": 833,
        "radius": 15.91
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "isida_xt_m1",
      "has_wwd": false,
      "special_entity": {
        "coneAngle": 0.3490658503988659,
        "capacity": 10000,
        "chargeRate": 987,
        "checkPeriodMsec": 500,
        "dischargeIdleRate": 833,
        "dischargeDamageRate": 1420,
        "dischargeHealingRate": 833,
        "radius": 18.04
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "isida_xt_m2",
      "has_wwd": false,
      "special_entity": {
        "coneAngle": 0.3490658503988659,
        "capacity": 10000,
        "chargeRate": 1050,
        "checkPeriodMsec": 500,
        "dischargeIdleRate": 833,
        "dischargeDamageRate": 1420,
        "dischargeHealingRate": 833,
        "radius": 20.17
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "isida_xt_m3",
      "has_wwd": false,
      "special_entity": {
        "coneAngle": 0.3490658503988659,
        "capacity": 10000,
        "chargeRate": 1111,
        "checkPeriodMsec": 500,
        "dischargeIdleRate": 833,
        "dischargeDamageRate": 1420,
        "dischargeHealingRate": 833,
        "radius": 22
      }
    },
    {
      "auto_aiming_down": 0.15707963267948966,
      "auto_aiming_up": 0.1047197551196598,
      "num_rays_down": 2,
      "num_rays_up": 1,
      "reload": 6230,
      "id": "railgun_xt_m0",
      "has_wwd": false,
      "special_entity": {
        "chargingTimeMsec": 1188,
        "weakeningCoeff": 0.18
      }
    },
    {
      "auto_aiming_down": 0.15707963267948966,
      "auto_aiming_up": 0.1047197551196598,
      "num_rays_down": 2,
      "num_rays_up": 1,
      "reload": 5633,
      "id": "railgun_xt_m1",
      "has_wwd": false,
      "special_entity": {
        "chargingTimeMsec": 1145,
        "weakeningCoeff": 0.45
      }
    },
    {
      "auto_aiming_down": 0.15707963267948966,
      "auto_aiming_up": 0.1047197551196598,
      "num_rays_down": 2,
      "num_rays_up": 1,
      "reload": 5037,
      "id": "railgun_xt_m2",
      "has_wwd": false,
      "special_entity": {
        "chargingTimeMsec": 1103,
        "weakeningCoeff": 0.73
      }
    },
    {
      "auto_aiming_down": 0.15707963267948966,
      "auto_aiming_up": 0.1047197551196598,
      "num_rays_down": 2,
      "num_rays_up": 1,
      "reload": 4440,
      "id": "railgun_xt_m3",
      "has_wwd": false,
      "special_entity": {
        "chargingTimeMsec": 1060,
        "weakeningCoeff": 1
      }
    },
    {
      "auto_aiming_down": 0.2094395102393196,
      "auto_aiming_up": 0.15707963267948966,
      "num_rays_down": 2,
      "num_rays_up": 2,
      "reload": 3326,
      "id": "thunder_xt_m0",
      "max_damage_radius": 53.48,
      "min_damage_radius": 106.96,
      "min_damage_percent": 50,
      "has_wwd": true,
      "special_entity": {
        "impactForce": 2.7,
        "radiusOfMaxSplashDamage": 0,
        "minSplashDamagePercent": 25,
        "splashDamageRadius": 12
      }
    },
    {
      "auto_aiming_down": 0.2094395102393196,
      "auto_aiming_up": 0.15707963267948966,
      "num_rays_down": 2,
      "num_rays_up": 2,
      "reload": 3022,
      "id": "thunder_xt_m1",
      "max_damage_radius": 59.57,
      "min_damage_radius": 119.13,
      "min_damage_percent": 50,
      "has_wwd": true,
      "special_entity": {
        "impactForce": 3.91,
        "radiusOfMaxSplashDamage": 0,
        "minSplashDamagePercent": 25,
        "splashDamageRadius": 12
      }
    },
    {
      "auto_aiming_down": 0.2094395102393196,
      "auto_aiming_up": 0.15707963267948966,
      "num_rays_down": 2,
      "num_rays_up": 2,
      "reload": 2717,
      "id": "thunder_xt_m2",
      "max_damage_radius": 65.65,
      "min_damage_radius": 131.3,
      "min_damage_percent": 50,
      "has_wwd": true,
      "special_entity": {
        "impactForce": 5.13,
        "radiusOfMaxSplashDamage": 0,
        "minSplashDamagePercent": 25,
        "splashDamageRadius": 12
      }
    },
    {
      "auto_aiming_down": 0.2094395102393196,
      "auto_aiming_up": 0.15707963267948966,
      "num_rays_down": 2,
      "num_rays_up": 2,
      "reload": 2500,
      "id": "thunder_xt_m3",
      "max_damage_radius": 70,
      "min_damage_radius": 140,
      "min_damage_percent": 50,
      "has_wwd": true,
      "special_entity": {
        "impactForce": 6,
        "radiusOfMaxSplashDamage": 0,
        "minSplashDamagePercent": 25,
        "splashDamageRadius": 12
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 587,
      "id": "ricochet_xt_m0",
      "max_damage_radius": 64.35,
      "min_damage_radius": 76.52,
      "min_damage_percent": 0,
      "has_wwd": true,
      "special_entity": {
        "energyCapacity": 100000,
        "energyPerShot": 13700,
        "energyRechargeSpeed": 10000,
        "maxRicochetCount": 20,
        "shotDistance": 76.52,
        "shellRadius": 0.5,
        "shellSpeed": 88.7
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 542,
      "id": "ricochet_xt_m1",
      "max_damage_radius": 70.43,
      "min_damage_radius": 85.65,
      "min_damage_percent": 0,
      "has_wwd": true,
      "special_entity": {
        "energyCapacity": 100000,
        "energyPerShot": 13000,
        "energyRechargeSpeed": 10000,
        "maxRicochetCount": 20,
        "shotDistance": 85.65,
        "shellRadius": 0.5,
        "shellSpeed": 100.87
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 496,
      "id": "ricochet_xt_m2",
      "max_damage_radius": 76.52,
      "min_damage_radius": 94.78,
      "min_damage_percent": 0,
      "has_wwd": true,
      "special_entity": {
        "energyCapacity": 100000,
        "energyPerShot": 12300,
        "energyRechargeSpeed": 10000,
        "maxRicochetCount": 20,
        "shotDistance": 94.78,
        "shellRadius": 0.5,
        "shellSpeed": 113.04
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 470,
      "id": "ricochet_xt_m3",
      "max_damage_radius": 80,
      "min_damage_radius": 100,
      "min_damage_percent": 0,
      "has_wwd": true,
      "special_entity": {
        "energyCapacity": 1000,
        "energyPerShot": 119,
        "energyRechargeSpeed": 100,
        "maxRicochetCount": 20,
        "shotDistance": 100,
        "shellRadius": 0.5,
        "shellSpeed": 120
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 77,
      "id": "machinegun_xt_m0",
      "max_damage_radius": 32.61,
      "min_damage_radius": 130.43,
      "min_damage_percent": 25,
      "has_wwd": true,
      "special_entity": {
        "spinDownTime": 1500,
        "spinUpTime": 1700,
        "temperatureHittingTime": 4390,
        "weaponTurnDecelerationCoeff": 0.44
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 71,
      "id": "machinegun_xt_m1",
      "max_damage_radius": 38.7,
      "min_damage_radius": 154.78,
      "min_damage_percent": 25,
      "has_wwd": true,
      "special_entity": {
        "spinDownTime": 1500,
        "spinUpTime": 1450,
        "temperatureHittingTime": 5300,
        "weaponTurnDecelerationCoeff": 0.53
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 65,
      "id": "machinegun_xt_m2",
      "max_damage_radius": 44.78,
      "min_damage_radius": 179.13,
      "min_damage_percent": 25,
      "has_wwd": true,
      "special_entity": {
        "spinDownTime": 1500,
        "spinUpTime": 1210,
        "temperatureHittingTime": 6220,
        "weaponTurnDecelerationCoeff": 0.62
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 60,
      "id": "machinegun_xt_m3",
      "max_damage_radius": 50,
      "min_damage_radius": 200,
      "min_damage_percent": 25,
      "has_wwd": true,
      "special_entity": {
        "spinDownTime": 1500,
        "spinUpTime": 1000,
        "temperatureHittingTime": 7000,
        "weaponTurnDecelerationCoeff": 0.7
      }
    },
    {
      "auto_aiming_down": 0.2094395102393196,
      "auto_aiming_up": 0.15707963267948966,
      "num_rays_down": 2,
      "num_rays_up": 2,
      "reload": 2000,
      "id": "smoky_m0",
      "max_damage_radius": 40,
      "min_damage_radius": 120,
      "min_damage_percent": 10,
      "has_wwd": true,
      "special_entity": {}
    },
    {
      "auto_aiming_down": 0.2094395102393196,
      "auto_aiming_up": 0.15707963267948966,
      "num_rays_down": 2,
      "num_rays_up": 2,
      "reload": 1787,
      "id": "smoky_m1",
      "max_damage_radius": 46.09,
      "min_damage_radius": 138.26,
      "min_damage_percent": 10,
      "has_wwd": true,
      "special_entity": {}
    },
    {
      "auto_aiming_down": 0.2094395102393196,
      "auto_aiming_up": 0.15707963267948966,
      "num_rays_down": 2,
      "num_rays_up": 2,
      "reload": 1574,
      "id": "smoky_m2",
      "max_damage_radius": 52.17,
      "min_damage_radius": 156.52,
      "min_damage_percent": 10,
      "has_wwd": true,
      "special_entity": {}
    },
    {
      "auto_aiming_down": 0.2094395102393196,
      "auto_aiming_up": 0.15707963267948966,
      "num_rays_down": 2,
      "num_rays_up": 2,
      "reload": 1300,
      "id": "smoky_m3",
      "max_damage_radius": 60,
      "min_damage_radius": 180,
      "min_damage_percent": 10,
      "has_wwd": true,
      "special_entity": {}
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "flamethrower_m0",
      "max_damage_radius": 5,
      "min_damage_radius": 17,
      "min_damage_percent": 50,
      "has_wwd": true,
      "special_entity": {
        "coneAngle": 0.3490658503988659,
        "range": 17,
        "energyCapacity": 100000,
        "energyDischargeSpeed": 16600,
        "energyRechargeSpeed": 7700,
        "tickIntervalMsec": 500
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "flamethrower_m1",
      "max_damage_radius": 5,
      "min_damage_radius": 19.43,
      "min_damage_percent": 50,
      "has_wwd": true,
      "special_entity": {
        "coneAngle": 0.3490658503988659,
        "range": 19.43,
        "energyCapacity": 100000,
        "energyDischargeSpeed": 16600,
        "energyRechargeSpeed": 8300,
        "tickIntervalMsec": 500
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "flamethrower_m2",
      "max_damage_radius": 5,
      "min_damage_radius": 21.87,
      "min_damage_percent": 50,
      "has_wwd": true,
      "special_entity": {
        "coneAngle": 0.3490658503988659,
        "range": 21.87,
        "energyCapacity": 100000,
        "energyDischargeSpeed": 16600,
        "energyRechargeSpeed": 9000,
        "tickIntervalMsec": 500
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "flamethrower_m3",
      "max_damage_radius": 5,
      "min_damage_radius": 25,
      "min_damage_percent": 50,
      "has_wwd": true,
      "special_entity": {
        "coneAngle": 0.3490658503988659,
        "range": 25,
        "energyCapacity": 100000,
        "energyDischargeSpeed": 16600,
        "energyRechargeSpeed": 10000,
        "tickIntervalMsec": 500
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 294,
      "id": "ricochet_demonic_m0",
      "max_damage_radius": 64.35,
      "min_damage_radius": 76.52,
      "min_damage_percent": 0,
      "has_wwd": true,
      "special_entity": {
        "energyCapacity": 1000,
        "energyPerShot": 80,
        "energyRechargeSpeed": 166,
        "maxRicochetCount": 20,
        "shotDistance": 76.52,
        "shellRadius": 0.5,
        "shellSpeed": 88.7
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 271,
      "id": "ricochet_demonic_m1",
      "max_damage_radius": 70.43,
      "min_damage_radius": 85.65,
      "min_damage_percent": 0,
      "has_wwd": true,
      "special_entity": {
        "energyCapacity": 1000,
        "energyPerShot": 72,
        "energyRechargeSpeed": 166,
        "maxRicochetCount": 20,
        "shotDistance": 85.65,
        "shellRadius": 0.5,
        "shellSpeed": 100.87
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 248,
      "id": "ricochet_demonic_m2",
      "max_damage_radius": 76.52,
      "min_damage_radius": 94.78,
      "min_damage_percent": 0,
      "has_wwd": true,
      "special_entity": {
        "energyCapacity": 1000,
        "energyPerShot": 64,
        "energyRechargeSpeed": 166,
        "maxRicochetCount": 20,
        "shotDistance": 94.78,
        "shellRadius": 0.5,
        "shellSpeed": 113.04
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 235,
      "id": "ricochet_demonic_m3",
      "max_damage_radius": 80,
      "min_damage_radius": 100,
      "min_damage_percent": 0,
      "has_wwd": true,
      "special_entity": {
        "energyCapacity": 1000,
        "energyPerShot": 60,
        "energyRechargeSpeed": 166,
        "maxRicochetCount": 20,
        "shotDistance": 100,
        "shellRadius": 0.5,
        "shellSpeed": 120
      }
    },
    {
      "auto_aiming_down": 0.2792526803190927,
      "auto_aiming_up": 0.22689280275926285,
      "num_rays_down": 3,
      "num_rays_up": 2,
      "reload": 250,
      "id": "twins_m0",
      "max_damage_radius": 15,
      "min_damage_radius": 60.87,
      "min_damage_percent": 1.83,
      "has_wwd": true,
      "special_entity": {
        "distance": 60.87,
        "shellRadius": 0.5,
        "speed": 60.87
      }
    },
    {
      "auto_aiming_down": 0.2792526803190927,
      "auto_aiming_up": 0.22689280275926285,
      "num_rays_down": 3,
      "num_rays_up": 2,
      "reload": 250,
      "id": "twins_m1",
      "max_damage_radius": 15,
      "min_damage_radius": 66.96,
      "min_damage_percent": 7.61,
      "has_wwd": true,
      "special_entity": {
        "distance": 66.96,
        "shellRadius": 0.5,
        "speed": 66.96
      }
    },
    {
      "auto_aiming_down": 0.2792526803190927,
      "auto_aiming_up": 0.22689280275926285,
      "num_rays_down": 3,
      "num_rays_up": 2,
      "reload": 250,
      "id": "twins_m2",
      "max_damage_radius": 15,
      "min_damage_radius": 73.04,
      "min_damage_percent": 13.39,
      "has_wwd": true,
      "special_entity": {
        "distance": 73.04,
        "shellRadius": 0.5,
        "speed": 73.04
      }
    },
    {
      "auto_aiming_down": 0.2792526803190927,
      "auto_aiming_up": 0.22689280275926285,
      "num_rays_down": 3,
      "num_rays_up": 2,
      "reload": 250,
      "id": "twins_m3",
      "max_damage_radius": 15,
      "min_damage_radius": 80,
      "min_damage_percent": 20,
      "has_wwd": true,
      "special_entity": {
        "distance": 80,
        "shellRadius": 0.5,
        "speed": 80
      }
    },
    {
      "auto_aiming_down": 0.15707963267948966,
      "auto_aiming_up": 0.1047197551196598,
      "num_rays_down": 2,
      "num_rays_up": 1,
      "reload": 6230,
      "id": "railgun_m0",
      "has_wwd": false,
      "special_entity": {
        "chargingTimeMsec": 1188,
        "weakeningCoeff": 0.18
      }
    },
    {
      "auto_aiming_down": 0.15707963267948966,
      "auto_aiming_up": 0.1047197551196598,
      "num_rays_down": 2,
      "num_rays_up": 1,
      "reload": 5633,
      "id": "railgun_m1",
      "has_wwd": false,
      "special_entity": {
        "chargingTimeMsec": 1145,
        "weakeningCoeff": 0.45
      }
    },
    {
      "auto_aiming_down": 0.15707963267948966,
      "auto_aiming_up": 0.1047197551196598,
      "num_rays_down": 2,
      "num_rays_up": 1,
      "reload": 5037,
      "id": "railgun_m2",
      "has_wwd": false,
      "special_entity": {
        "chargingTimeMsec": 1103,
        "weakeningCoeff": 0.73
      }
    },
    {
      "auto_aiming_down": 0.15707963267948966,
      "auto_aiming_up": 0.1047197551196598,
      "num_rays_down": 2,
      "num_rays_up": 1,
      "reload": 4440,
      "id": "railgun_m3",
      "has_wwd": false,
      "special_entity": {
        "chargingTimeMsec": 1060,
        "weakeningCoeff": 1
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "isida_m0",
      "has_wwd": false,
      "special_entity": {
        "coneAngle": 0.3490658503988659,
        "capacity": 10000,
        "chargeRate": 930,
        "checkPeriodMsec": 500,
        "dischargeIdleRate": 833,
        "dischargeDamageRate": 1420,
        "dischargeHealingRate": 833,
        "radius": 15.91
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "isida_m1",
      "has_wwd": false,
      "special_entity": {
        "coneAngle": 0.3490658503988659,
        "capacity": 10000,
        "chargeRate": 987,
        "checkPeriodMsec": 500,
        "dischargeIdleRate": 833,
        "dischargeDamageRate": 1420,
        "dischargeHealingRate": 833,
        "radius": 18.04
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "isida_m2",
      "has_wwd": false,
      "special_entity": {
        "coneAngle": 0.3490658503988659,
        "capacity": 10000,
        "chargeRate": 1050,
        "checkPeriodMsec": 500,
        "dischargeIdleRate": 833,
        "dischargeDamageRate": 1420,
        "dischargeHealingRate": 833,
        "radius": 20.17
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "isida_m3",
      "has_wwd": false,
      "special_entity": {
        "coneAngle": 0.3490658503988659,
        "capacity": 10000,
        "chargeRate": 1111,
        "checkPeriodMsec": 500,
        "dischargeIdleRate": 833,
        "dischargeDamageRate": 1420,
        "dischargeHealingRate": 833,
        "radius": 22
      }
    },
    {
      "auto_aiming_down": 0.2094395102393196,
      "auto_aiming_up": 0.15707963267948966,
      "num_rays_down": 2,
      "num_rays_up": 2,
      "reload": 3326,
      "id": "thunder_m0",
      "max_damage_radius": 53.48,
      "min_damage_radius": 106.96,
      "min_damage_percent": 50,
      "has_wwd": true,
      "special_entity": {
        "impactForce": 2.7,
        "radiusOfMaxSplashDamage": 0,
        "minSplashDamagePercent": 25,
        "splashDamageRadius": 12
      }
    },
    {
      "auto_aiming_down": 0.2094395102393196,
      "auto_aiming_up": 0.15707963267948966,
      "num_rays_down": 2,
      "num_rays_up": 2,
      "reload": 3022,
      "id": "thunder_m1",
      "max_damage_radius": 59.57,
      "min_damage_radius": 119.13,
      "min_damage_percent": 50,
      "has_wwd": true,
      "special_entity": {
        "impactForce": 3.91,
        "radiusOfMaxSplashDamage": 0,
        "minSplashDamagePercent": 25,
        "splashDamageRadius": 12
      }
    },
    {
      "auto_aiming_down": 0.2094395102393196,
      "auto_aiming_up": 0.15707963267948966,
      "num_rays_down": 2,
      "num_rays_up": 2,
      "reload": 2717,
      "id": "thunder_m2",
      "max_damage_radius": 65.65,
      "min_damage_radius": 131.3,
      "min_damage_percent": 50,
      "has_wwd": true,
      "special_entity": {
        "impactForce": 5.13,
        "radiusOfMaxSplashDamage": 0,
        "minSplashDamagePercent": 25,
        "splashDamageRadius": 12
      }
    },
    {
      "auto_aiming_down": 0.2094395102393196,
      "auto_aiming_up": 0.15707963267948966,
      "num_rays_down": 2,
      "num_rays_up": 2,
      "reload": 2500,
      "id": "thunder_m3",
      "max_damage_radius": 70,
      "min_damage_radius": 140,
      "min_damage_percent": 50,
      "has_wwd": true,
      "special_entity": {
        "impactForce": 6,
        "radiusOfMaxSplashDamage": 0,
        "minSplashDamagePercent": 25,
        "splashDamageRadius": 12
      }
    },
    {
      "auto_aiming_down": 0.2094395102393196,
      "auto_aiming_up": 0.15707963267948966,
      "num_rays_down": 2,
      "num_rays_up": 2,
      "reload": 2257,
      "id": "shotgun_m0",
      "max_damage_radius": 46.74,
      "min_damage_radius": 51.74,
      "min_damage_percent": 0,
      "has_wwd": true,
      "special_entity": {
        "coneHorizontalAngle": 0.12217304763960307,
        "coneVerticalAngle": 0.08726646259971647,
        "pelletCount": 21,
        "magazineReloadTime": 6360,
        "magazineSize": 3
      }
    },
    {
      "auto_aiming_down": 0.2094395102393196,
      "auto_aiming_up": 0.15707963267948966,
      "num_rays_down": 2,
      "num_rays_up": 2,
      "reload": 2104,
      "id": "shotgun_m1",
      "max_damage_radius": 52.83,
      "min_damage_radius": 57.83,
      "min_damage_percent": 0,
      "has_wwd": true,
      "special_entity": {
        "coneHorizontalAngle": 0.12217304763960307,
        "coneVerticalAngle": 0.08726646259971647,
        "pelletCount": 21,
        "magazineReloadTime": 5500,
        "magazineSize": 3
      }
    },
    {
      "auto_aiming_down": 0.2094395102393196,
      "auto_aiming_up": 0.15707963267948966,
      "num_rays_down": 2,
      "num_rays_up": 2,
      "reload": 1952,
      "id": "shotgun_m2",
      "max_damage_radius": 58.91,
      "min_damage_radius": 63.91,
      "min_damage_percent": 0,
      "has_wwd": true,
      "special_entity": {
        "coneHorizontalAngle": 0.12217304763960307,
        "coneVerticalAngle": 0.08726646259971647,
        "pelletCount": 21,
        "magazineReloadTime": 4650,
        "magazineSize": 3
      }
    },
    {
      "auto_aiming_down": 0.2094395102393196,
      "auto_aiming_up": 0.15707963267948966,
      "num_rays_down": 2,
      "num_rays_up": 2,
      "reload": 1800,
      "id": "shotgun_m3",
      "max_damage_radius": 65,
      "min_damage_radius": 70,
      "min_damage_percent": 0,
      "has_wwd": true,
      "special_entity": {
        "coneHorizontalAngle": 0.12217304763960307,
        "coneVerticalAngle": 0.08726646259971647,
        "pelletCount": 21,
        "magazineReloadTime": 3800,
        "magazineSize": 3
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "freeze_m0",
      "max_damage_radius": 5,
      "min_damage_radius": 18.39,
      "min_damage_percent": 30,
      "has_wwd": true,
      "special_entity": {
        "damageAreaConeAngle": 0.3490658503988659,
        "damageAreaRange": 18.39,
        "energyCapacity": 100000,
        "energyRechargeSpeed": 8000,
        "energyDischargeSpeed": 11100,
        "tickIntervalMsec": 500
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "freeze_m1",
      "max_damage_radius": 5,
      "min_damage_radius": 20.83,
      "min_damage_percent": 30,
      "has_wwd": true,
      "special_entity": {
        "damageAreaConeAngle": 0.3490658503988659,
        "damageAreaRange": 20.83,
        "energyCapacity": 100000,
        "energyRechargeSpeed": 8600,
        "energyDischargeSpeed": 11100,
        "tickIntervalMsec": 500
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "freeze_m2",
      "max_damage_radius": 5,
      "min_damage_radius": 23.26,
      "min_damage_percent": 30,
      "has_wwd": true,
      "special_entity": {
        "damageAreaConeAngle": 0.3490658503988659,
        "damageAreaRange": 23.26,
        "energyCapacity": 100000,
        "energyRechargeSpeed": 9333,
        "energyDischargeSpeed": 11100,
        "tickIntervalMsec": 500
      }
    },
    {
      "auto_aiming_down": 0,
      "auto_aiming_up": 0,
      "num_rays_down": 0,
      "num_rays_up": 0,
      "reload": 0,
      "id": "freeze_m3",
      "max_damage_radius": 5,
      "min_damage_radius": 25,
      "min_damage_percent": 30,
      "has_wwd": true,
      "special_entity": {
        "damageAreaConeAngle": 0.3490658503988659,
        "damageAreaRange": 25,
        "energyCapacity": 100000,
        "energyRechargeSpeed": 10000,
        "energyDischargeSpeed": 11100,
        "tickIntervalMsec": 500
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 587,
      "id": "ricochet_m0",
      "max_damage_radius": 64.35,
      "min_damage_radius": 76.52,
      "min_damage_percent": 0,
      "has_wwd": true,
      "special_entity": {
        "energyCapacity": 100000,
        "energyPerShot": 13700,
        "energyRechargeSpeed": 10000,
        "maxRicochetCount": 20,
        "shotDistance": 76.52,
        "shellRadius": 0.5,
        "shellSpeed": 88.7
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 542,
      "id": "ricochet_m1",
      "max_damage_radius": 70.43,
      "min_damage_radius": 85.65,
      "min_damage_percent": 0,
      "has_wwd": true,
      "special_entity": {
        "energyCapacity": 100000,
        "energyPerShot": 13000,
        "energyRechargeSpeed": 10000,
        "maxRicochetCount": 20,
        "shotDistance": 85.65,
        "shellRadius": 0.5,
        "shellSpeed": 100.87
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 496,
      "id": "ricochet_m2",
      "max_damage_radius": 76.52,
      "min_damage_radius": 94.78,
      "min_damage_percent": 0,
      "has_wwd": true,
      "special_entity": {
        "energyCapacity": 100000,
        "energyPerShot": 12300,
        "energyRechargeSpeed": 10000,
        "maxRicochetCount": 20,
        "shotDistance": 94.78,
        "shellRadius": 0.5,
        "shellSpeed": 113.04
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 470,
      "id": "ricochet_m3",
      "max_damage_radius": 80,
      "min_damage_radius": 100,
      "min_damage_percent": 0,
      "has_wwd": true,
      "special_entity": {
        "energyCapacity": 1000,
        "energyPerShot": 119,
        "energyRechargeSpeed": 100,
        "maxRicochetCount": 20,
        "shotDistance": 100,
        "shellRadius": 0.5,
        "shellSpeed": 120
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 77,
      "id": "machinegun_m0",
      "max_damage_radius": 32.61,
      "min_damage_radius": 130.43,
      "min_damage_percent": 25,
      "has_wwd": true,
      "special_entity": {
        "spinDownTime": 1500,
        "spinUpTime": 1700,
        "temperatureHittingTime": 4390,
        "weaponTurnDecelerationCoeff": 0.44
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 71,
      "id": "machinegun_m1",
      "max_damage_radius": 38.7,
      "min_damage_radius": 154.78,
      "min_damage_percent": 25,
      "has_wwd": true,
      "special_entity": {
        "spinDownTime": 1500,
        "spinUpTime": 1450,
        "temperatureHittingTime": 5300,
        "weaponTurnDecelerationCoeff": 0.53
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 65,
      "id": "machinegun_m2",
      "max_damage_radius": 44.78,
      "min_damage_radius": 179.13,
      "min_damage_percent": 25,
      "has_wwd": true,
      "special_entity": {
        "spinDownTime": 1500,
        "spinUpTime": 1210,
        "temperatureHittingTime": 6220,
        "weaponTurnDecelerationCoeff": 0.62
      }
    },
    {
      "auto_aiming_down": 0.3141592653589793,
      "auto_aiming_up": 0.2617993877991494,
      "num_rays_down": 3,
      "num_rays_up": 3,
      "reload": 60,
      "id": "machinegun_m3",
      "max_damage_radius": 50,
      "min_damage_radius": 200,
      "min_damage_percent": 25,
      "has_wwd": true,
      "special_entity": {
        "spinDownTime": 1500,
        "spinUpTime": 1000,
        "temperatureHittingTime": 7000,
        "weaponTurnDecelerationCoeff": 0.7
      }
    },
    {
      "auto_aiming_down": 0.2617993877991494,
      "auto_aiming_up": 0.2094395102393196,
      "num_rays_down": 3,
      "num_rays_up": 2,
      "reload": 3740,
      "id": "shaft_m0",
      "max_damage_radius": 100,
      "min_damage_radius": 100,
      "min_damage_percent": 100,
      "has_wwd": true,
      "special_entity": {
        "max_energy": 1000,
        "charge_rate": 82.61,
        "discharge_rate": 234.78,
        "elevation_angle_up": 0.2094395102393196,
        "elevation_angle_down": 0.2617993877991494,
        "vertical_targeting_speed": 0.13,
        "horizontal_targeting_speed": 0.27,
        "initial_fov": 0.6981317007977318,
        "minimum_fov": 0.4014257279586958,
        "shrubs_hiding_radius_min": 20,
        "shrubs_hiding_radius_max": 80,
        "afterShotPause": 500,
        "aimingImpact": 4.3,
        "fastShotEnergy": 219.17,
        "minAimedShotEnergy": 1000,
        "rotationCoeffKmin": 1,
        "rotationCoeffT1": 0,
        "rotationCoeffT2": 0.95,
        "targetingAcceleration": 0.47123889803846897,
        "targetingTransitionTime": 500,
        "reticleImageId": ResourceManager.getIdlowById("turret/shaft/m0/reticle"),
        "weakeningCoeff": 0.3,
        "fadeInTimeMs": 3000,
        "laserPointerBlueColor": 48127,
        "laserPointerRedColor": 16711680,
        "locallyVisible": false
      }
    },
    {
      "auto_aiming_down": 0.2617993877991494,
      "auto_aiming_up": 0.2094395102393196,
      "num_rays_down": 3,
      "num_rays_up": 2,
      "reload": 3430,
      "id": "shaft_m1",
      "max_damage_radius": 100,
      "min_damage_radius": 100,
      "min_damage_percent": 100,
      "has_wwd": true,
      "special_entity": {
        "max_energy": 1000,
        "charge_rate": 85.65,
        "discharge_rate": 275.36,
        "elevation_angle_up": 0.2094395102393196,
        "elevation_angle_down": 0.2617993877991494,
        "vertical_targeting_speed": 0.19,
        "horizontal_targeting_speed": 0.37,
        "initial_fov": 0.6981317007977318,
        "minimum_fov": 0.4014257279586958,
        "shrubs_hiding_radius_min": 20,
        "shrubs_hiding_radius_max": 80,
        "afterShotPause": 500,
        "aimingImpact": 5.83,
        "fastShotEnergy": 203.04,
        "minAimedShotEnergy": 1000,
        "rotationCoeffKmin": 1,
        "rotationCoeffT1": 0,
        "rotationCoeffT2": 0.95,
        "targetingAcceleration": 0.47123889803846897,
        "targetingTransitionTime": 500,
        "reticleImageId": ResourceManager.getIdlowById("turret/shaft/m1/reticle"),
        "weakeningCoeff": 0.43,
        "fadeInTimeMs": 3000,
        "laserPointerBlueColor": 48127,
        "laserPointerRedColor": 16711680,
        "locallyVisible": false
      }
    },
    {
      "auto_aiming_down": 0.2617993877991494,
      "auto_aiming_up": 0.2094395102393196,
      "num_rays_down": 3,
      "num_rays_up": 2,
      "reload": 3130,
      "id": "shaft_m2",
      "max_damage_radius": 100,
      "min_damage_radius": 100,
      "min_damage_percent": 100,
      "has_wwd": true,
      "special_entity": {
        "max_energy": 1000,
        "charge_rate": 88.7,
        "discharge_rate": 315.94,
        "elevation_angle_up": 0.2094395102393196,
        "elevation_angle_down": 0.2617993877991494,
        "vertical_targeting_speed": 0.24364796357840843,
        "horizontal_targeting_speed": 0.48,
        "initial_fov": 0.6981317007977318,
        "minimum_fov": 0.4014257279586958,
        "shrubs_hiding_radius_min": 20,
        "shrubs_hiding_radius_max": 80,
        "afterShotPause": 500,
        "aimingImpact": 7.35,
        "fastShotEnergy": 186.91,
        "minAimedShotEnergy": 1000,
        "rotationCoeffKmin": 1,
        "rotationCoeffT1": 0,
        "rotationCoeffT2": 0.95,
        "targetingAcceleration": 0.47123889803846897,
        "targetingTransitionTime": 500,
        "reticleImageId": ResourceManager.getIdlowById("turret/shaft/m2/reticle"),
        "weakeningCoeff": 0.55,
        "fadeInTimeMs": 3000,
        "laserPointerBlueColor": 48127,
        "laserPointerRedColor": 16711680,
        "locallyVisible": false
      }
    },
    {
      "auto_aiming_down": 0.2617993877991494,
      "auto_aiming_up": 0.2094395102393196,
      "num_rays_down": 3,
      "num_rays_up": 2,
      "reload": 3000,
      "id": "shaft_m3",
      "max_damage_radius": 100,
      "min_damage_radius": 100,
      "min_damage_percent": 100,
      "has_wwd": true,
      "special_entity": {
        "max_energy": 1000,
        "charge_rate": 90,
        "discharge_rate": 333.33,
        "elevation_angle_up": 0.2094395102393196,
        "elevation_angle_down": 0.2617993877991494,
        "vertical_targeting_speed": 0.2617993877991494,
        "horizontal_targeting_speed": 0.5235987755982988,
        "initial_fov": 0.6981317007977318,
        "minimum_fov": 0.4014257279586958,
        "shrubs_hiding_radius_min": 20,
        "shrubs_hiding_radius_max": 80,
        "afterShotPause": 500,
        "aimingImpact": 8,
        "fastShotEnergy": 180,
        "minAimedShotEnergy": 1000,
        "rotationCoeffKmin": 1,
        "rotationCoeffT1": 0,
        "rotationCoeffT2": 0.95,
        "targetingAcceleration": 0.47123889803846897,
        "targetingTransitionTime": 500,
        "reticleImageId": ResourceManager.getIdlowById("turret/shaft/m3/reticle"),
        "weakeningCoeff": 0.6,
        "fadeInTimeMs": 3000,
        "laserPointerBlueColor": 48127,
        "laserPointerRedColor": 16711680,
        "locallyVisible": false
      }
    }
  ]
};
