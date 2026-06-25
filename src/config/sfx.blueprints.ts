import { ResourceId } from "@/generated/resourceTypes";

export const sfxBlueprints: { [key: string]: any } = {
  flamethrower_m0: {
    fireTexture: "effects/flamethrower/fire_texture" as ResourceId,
    flameSound: "sounds/flamethrower/flame" as ResourceId,
    muzzlePlaneTexture: "effects/flamethrower/m0/muzzle_plane_texture" as ResourceId,
    lighting: [
      {
        name: "start",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 16746496, intensity: 0, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 200 },
        ],
      },
      {
        name: "loop",
        light: [
          { attenuationBegin: 50, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 0 },
          { attenuationBegin: 150, attenuationEnd: 800, color: 16746496, intensity: 1, time: 100 },
          { attenuationBegin: 100, attenuationEnd: 1500, color: 16746496, intensity: 1, time: 200 },
          { attenuationBegin: 150, attenuationEnd: 800, color: 16746496, intensity: 1, time: 300 },
          { attenuationBegin: 50, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 400 },
        ],
      },
      {
        name: "startFire",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 16746496, intensity: 0, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 200 },
        ],
      },
      {
        name: "loopFire",
        light: [
          { attenuationBegin: 50, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 0 },
          { attenuationBegin: 150, attenuationEnd: 800, color: 16746496, intensity: 1, time: 100 },
          { attenuationBegin: 100, attenuationEnd: 1500, color: 16746496, intensity: 1, time: 200 },
          { attenuationBegin: 150, attenuationEnd: 800, color: 16746496, intensity: 1, time: 300 },
          { attenuationBegin: 50, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 400 },
        ],
      },
    ],
    bcsh: [],
    colorTransform: [
      { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1, redOffset: 100, greenOffset: 150, blueOffset: 100, alphaOffset: 0, t: 0 },
      { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1, redOffset: 50, greenOffset: 100, blueOffset: 60, alphaOffset: 0, t: 0.05 },
      { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1, redOffset: 100, greenOffset: 100, blueOffset: 40, alphaOffset: 0, t: 0.1 },
      { redMultiplier: 0.5, greenMultiplier: 0.3, blueMultiplier: 0.3, alphaMultiplier: 1, redOffset: 50, greenOffset: 80, blueOffset: 50, alphaOffset: 0, t: 0.65 },
      { redMultiplier: 0, greenMultiplier: 0, blueMultiplier: 0, alphaMultiplier: 1, redOffset: 50, greenOffset: 50, blueOffset: 50, alphaOffset: 0, t: 0.75 },
      { redMultiplier: 0, greenMultiplier: 0, blueMultiplier: 0, alphaMultiplier: 0, redOffset: 20, greenOffset: 20, blueOffset: 20, alphaOffset: 0, t: 1 },
    ],
  },
  flamethrower_m1: {
    fireTexture: "effects/flamethrower/fire_texture" as ResourceId,
    flameSound: "sounds/flamethrower/flame" as ResourceId,
    muzzlePlaneTexture: "effects/flamethrower/m1/muzzle_plane_texture" as ResourceId,
    lighting: [
      {
        name: "start",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 16746496, intensity: 0, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 200 },
        ],
      },
      {
        name: "loop",
        light: [
          { attenuationBegin: 50, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 0 },
          { attenuationBegin: 150, attenuationEnd: 800, color: 16746496, intensity: 1, time: 100 },
          { attenuationBegin: 100, attenuationEnd: 1500, color: 16746496, intensity: 1, time: 200 },
          { attenuationBegin: 150, attenuationEnd: 800, color: 16746496, intensity: 1, time: 300 },
          { attenuationBegin: 50, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 400 },
        ],
      },
      {
        name: "startFire",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 16746496, intensity: 0, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 200 },
        ],
      },
      {
        name: "loopFire",
        light: [
          { attenuationBegin: 50, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 0 },
          { attenuationBegin: 150, attenuationEnd: 800, color: 16746496, intensity: 1, time: 100 },
          { attenuationBegin: 100, attenuationEnd: 1500, color: 16746496, intensity: 1, time: 200 },
          { attenuationBegin: 150, attenuationEnd: 800, color: 16746496, intensity: 1, time: 300 },
          { attenuationBegin: 50, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 400 },
        ],
      },
    ],
    bcsh: [],
    colorTransform: [
      { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1, redOffset: 100, greenOffset: 150, blueOffset: 100, alphaOffset: 0, t: 0 },
      { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1, redOffset: 50, greenOffset: 100, blueOffset: 60, alphaOffset: 0, t: 0.05 },
      { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1, redOffset: 100, greenOffset: 100, blueOffset: 40, alphaOffset: 0, t: 0.1 },
      { redMultiplier: 0.5, greenMultiplier: 0.3, blueMultiplier: 0.3, alphaMultiplier: 1, redOffset: 180, greenOffset: 80, blueOffset: 40, alphaOffset: 0, t: 0.65 },
      { redMultiplier: 0, greenMultiplier: 0, blueMultiplier: 0, alphaMultiplier: 1, redOffset: 50, greenOffset: 50, blueOffset: 50, alphaOffset: 0, t: 0.75 },
      { redMultiplier: 0, greenMultiplier: 0, blueMultiplier: 0, alphaMultiplier: 0, redOffset: 20, greenOffset: 20, blueOffset: 20, alphaOffset: 0, t: 1 },
    ],
  },
  flamethrower_m2: {
    fireTexture: "effects/flamethrower/fire_texture" as ResourceId,
    flameSound: "sounds/flamethrower/flame" as ResourceId,
    muzzlePlaneTexture: "effects/flamethrower/m2/muzzle_plane_texture" as ResourceId,
    lighting: [
      {
        name: "start",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 16746496, intensity: 0, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 200 },
        ],
      },
      {
        name: "loop",
        light: [
          { attenuationBegin: 50, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 0 },
          { attenuationBegin: 150, attenuationEnd: 800, color: 16746496, intensity: 1, time: 100 },
          { attenuationBegin: 100, attenuationEnd: 1500, color: 16746496, intensity: 1, time: 200 },
          { attenuationBegin: 150, attenuationEnd: 800, color: 16746496, intensity: 1, time: 300 },
          { attenuationBegin: 50, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 400 },
        ],
      },
      {
        name: "startFire",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 16746496, intensity: 0, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 200 },
        ],
      },
      {
        name: "loopFire",
        light: [
          { attenuationBegin: 50, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 0 },
          { attenuationBegin: 150, attenuationEnd: 800, color: 16746496, intensity: 1, time: 100 },
          { attenuationBegin: 100, attenuationEnd: 1500, color: 16746496, intensity: 1, time: 200 },
          { attenuationBegin: 150, attenuationEnd: 800, color: 16746496, intensity: 1, time: 300 },
          { attenuationBegin: 50, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 400 },
        ],
      },
    ],
    bcsh: [],
    colorTransform: [
      { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1, redOffset: 100, greenOffset: 150, blueOffset: 100, alphaOffset: 0, t: 0 },
      { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 0.8047619, alphaMultiplier: 1, redOffset: 107, greenOffset: 100, blueOffset: 0, alphaOffset: 0, t: 0.05 },
      { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 0.83809525, alphaMultiplier: 1, redOffset: 100, greenOffset: 100, blueOffset: 22, alphaOffset: 0, t: 0.1 },
      { redMultiplier: 0.6818182, greenMultiplier: 0.25, blueMultiplier: 0.42045453, alphaMultiplier: 1, redOffset: 180, greenOffset: 109, blueOffset: 40, alphaOffset: 0, t: 0.65 },
      { redMultiplier: 0, greenMultiplier: 0, blueMultiplier: 0, alphaMultiplier: 1, redOffset: 50, greenOffset: 50, blueOffset: 50, alphaOffset: 0, t: 0.75 },
      { redMultiplier: 0, greenMultiplier: 0, blueMultiplier: 0, alphaMultiplier: 0, redOffset: 20, greenOffset: 20, blueOffset: 20, alphaOffset: 0, t: 1 },
    ],
  },
  flamethrower_m3: {
    fireTexture: "effects/flamethrower/fire_texture" as ResourceId,
    flameSound: "sounds/flamethrower/flame" as ResourceId,
    muzzlePlaneTexture: "effects/flamethrower/m3/muzzle_plane_texture" as ResourceId,
    lighting: [
      {
        name: "start",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 16746496, intensity: 0, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 200 },
        ],
      },
      {
        name: "loop",
        light: [
          { attenuationBegin: 50, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 0 },
          { attenuationBegin: 150, attenuationEnd: 800, color: 16746496, intensity: 1, time: 100 },
          { attenuationBegin: 100, attenuationEnd: 1500, color: 16746496, intensity: 1, time: 200 },
          { attenuationBegin: 150, attenuationEnd: 800, color: 16746496, intensity: 1, time: 300 },
          { attenuationBegin: 50, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 400 },
        ],
      },
      {
        name: "startFire",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 16746496, intensity: 0, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 200 },
        ],
      },
      {
        name: "loopFire",
        light: [
          { attenuationBegin: 50, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 0 },
          { attenuationBegin: 150, attenuationEnd: 800, color: 16746496, intensity: 1, time: 100 },
          { attenuationBegin: 100, attenuationEnd: 1500, color: 16746496, intensity: 1, time: 200 },
          { attenuationBegin: 150, attenuationEnd: 800, color: 16746496, intensity: 1, time: 300 },
          { attenuationBegin: 50, attenuationEnd: 1000, color: 16746496, intensity: 1, time: 400 },
        ],
      },
    ],
    bcsh: [],
    colorTransform: [
      { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1, redOffset: 100, greenOffset: 100, blueOffset: 100, alphaOffset: 0, t: 0 },
      { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 0, alphaMultiplier: 1, redOffset: 73, greenOffset: 100, blueOffset: 60, alphaOffset: 0, t: 0.05 },
      { redMultiplier: 1, greenMultiplier: 0.5904762, blueMultiplier: 0.5761905, alphaMultiplier: 1, redOffset: 180, greenOffset: 140, blueOffset: 42, alphaOffset: 0, t: 0.1 },
      { redMultiplier: 0.5, greenMultiplier: 0.3, blueMultiplier: 0.3, alphaMultiplier: 1, redOffset: 84, greenOffset: 70, blueOffset: 40, alphaOffset: 0, t: 0.65 },
      { redMultiplier: 0, greenMultiplier: 0, blueMultiplier: 0, alphaMultiplier: 1, redOffset: 40, greenOffset: 40, blueOffset: 40, alphaOffset: 0, t: 0.75 },
      { redMultiplier: 0, greenMultiplier: 0, blueMultiplier: 0, alphaMultiplier: 0, redOffset: 20, greenOffset: 20, blueOffset: 20, alphaOffset: 0, t: 1 },
    ],
  },
  freeze_m0: {
    particleSpeed: 3000,
    particleTextureResource: "effects/freeze/particle_texture" as ResourceId,
    planeTextureResource: "effects/freeze/plane_texture" as ResourceId,
    shotSoundResource: "sounds/freeze/shot" as ResourceId,
    lighting: [
      {
        name: "start",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 65535, intensity: 0, time: 0 },
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 200 },
        ],
      },
      {
        name: "loop",
        light: [
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 0 },
          { attenuationBegin: 150, attenuationEnd: 1000, color: 65535, intensity: 0.3, time: 200 },
          { attenuationBegin: 100, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 400 },
          { attenuationBegin: 150, attenuationEnd: 1000, color: 65535, intensity: 0.3, time: 600 },
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 800 },
        ],
      },
      {
        name: "startFire",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 65535, intensity: 0, time: 0 },
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 200 },
        ],
      },
      {
        name: "loopFire",
        light: [
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 0 },
          { attenuationBegin: 150, attenuationEnd: 1000, color: 65535, intensity: 0.3, time: 200 },
          { attenuationBegin: 100, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 400 },
          { attenuationBegin: 150, attenuationEnd: 1000, color: 65535, intensity: 0.3, time: 600 },
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 800 },
        ],
      },
    ],
    bcsh: [],
  },
  freeze_m1: {
    particleSpeed: 3000,
    particleTextureResource: "effects/freeze/particle_texture" as ResourceId,
    planeTextureResource: "effects/freeze/plane_texture" as ResourceId,
    shotSoundResource: "sounds/freeze/shot" as ResourceId,
    lighting: [
      {
        name: "start",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 65535, intensity: 0, time: 0 },
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 200 },
        ],
      },
      {
        name: "loop",
        light: [
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 0 },
          { attenuationBegin: 150, attenuationEnd: 1000, color: 65535, intensity: 0.3, time: 200 },
          { attenuationBegin: 100, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 400 },
          { attenuationBegin: 150, attenuationEnd: 1000, color: 65535, intensity: 0.3, time: 600 },
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 800 },
        ],
      },
      {
        name: "startFire",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 65535, intensity: 0, time: 0 },
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 200 },
        ],
      },
      {
        name: "loopFire",
        light: [
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 0 },
          { attenuationBegin: 150, attenuationEnd: 1000, color: 65535, intensity: 0.3, time: 200 },
          { attenuationBegin: 100, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 400 },
          { attenuationBegin: 150, attenuationEnd: 1000, color: 65535, intensity: 0.3, time: 600 },
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 800 },
        ],
      },
    ],
    bcsh: [],
  },
  freeze_m2: {
    particleSpeed: 3000,
    particleTextureResource: "effects/freeze/particle_texture" as ResourceId,
    planeTextureResource: "effects/freeze/plane_texture" as ResourceId,
    shotSoundResource: "sounds/freeze/shot" as ResourceId,
    lighting: [
      {
        name: "start",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 65535, intensity: 0, time: 0 },
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 200 },
        ],
      },
      {
        name: "loop",
        light: [
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 0 },
          { attenuationBegin: 150, attenuationEnd: 1000, color: 65535, intensity: 0.3, time: 200 },
          { attenuationBegin: 100, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 400 },
          { attenuationBegin: 150, attenuationEnd: 1000, color: 65535, intensity: 0.3, time: 600 },
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 800 },
        ],
      },
      {
        name: "startFire",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 65535, intensity: 0, time: 0 },
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 200 },
        ],
      },
      {
        name: "loopFire",
        light: [
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 0 },
          { attenuationBegin: 150, attenuationEnd: 1000, color: 65535, intensity: 0.3, time: 200 },
          { attenuationBegin: 100, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 400 },
          { attenuationBegin: 150, attenuationEnd: 1000, color: 65535, intensity: 0.3, time: 600 },
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 800 },
        ],
      },
    ],
    bcsh: [],
  },
  freeze_m3: {
    particleSpeed: 3000,
    particleTextureResource: "effects/freeze/particle_texture" as ResourceId,
    planeTextureResource: "effects/freeze/plane_texture" as ResourceId,
    shotSoundResource: "sounds/freeze/shot" as ResourceId,
    lighting: [
      {
        name: "start",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 65535, intensity: 0, time: 0 },
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 200 },
        ],
      },
      {
        name: "loop",
        light: [
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 0 },
          { attenuationBegin: 150, attenuationEnd: 1000, color: 65535, intensity: 0.3, time: 200 },
          { attenuationBegin: 100, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 400 },
          { attenuationBegin: 150, attenuationEnd: 1000, color: 65535, intensity: 0.3, time: 600 },
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 800 },
        ],
      },
      {
        name: "startFire",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 65535, intensity: 0, time: 0 },
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 200 },
        ],
      },
      {
        name: "loopFire",
        light: [
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 0 },
          { attenuationBegin: 150, attenuationEnd: 1000, color: 65535, intensity: 0.3, time: 200 },
          { attenuationBegin: 100, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 400 },
          { attenuationBegin: 150, attenuationEnd: 1000, color: 65535, intensity: 0.3, time: 600 },
          { attenuationBegin: 50, attenuationEnd: 1500, color: 65535, intensity: 0.3, time: 800 },
        ],
      },
    ],
    bcsh: [],
  },
  isida_m0: {
    damagingBall: "effects/isida/damaging_ball" as ResourceId,
    damagingRay: "effects/isida/damaging_ray" as ResourceId,
    damagingSound: "sounds/isida/damaging" as ResourceId,
    healingBall: "effects/isida/healing_ball" as ResourceId,
    healingRay: "effects/isida/healing_ray" as ResourceId,
    healingSound: "sounds/isida/healing" as ResourceId,
    idleSound: "sounds/isida/idle" as ResourceId,
    lighting: [
      {
        name: "enemyStart",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 16640272, intensity: 0, time: 0 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 16640272, intensity: 0.1, time: 200 },
        ],
      },
      {
        name: "enemyLoop",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 16640272, intensity: 0.3, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 16640272, intensity: 0.2, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 16640272, intensity: 0.3, time: 400 },
        ],
      },
      {
        name: "start",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 4308715, intensity: 0, time: 0 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 4308715, intensity: 0.2, time: 200 },
        ],
      },
      {
        name: "loop",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 4308715, intensity: 0.3, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 4308715, intensity: 0.2, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 4308715, intensity: 0.3, time: 400 },
        ],
      },
      {
        name: "friendStart",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 65535, intensity: 0, time: 0 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 65535, intensity: 0.2, time: 200 },
        ],
      },
      {
        name: "friendLoop",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 8255999, intensity: 0.3, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 8255999, intensity: 0.2, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 8255999, intensity: 0.3, time: 400 },
        ],
      },
      {
        name: "enemyBeam",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 16640272, intensity: 0.2, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 16640272, intensity: 0.15, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 16640272, intensity: 0.2, time: 400 },
        ],
      },
      {
        name: "friendBeam",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 8255999, intensity: 0.2, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 8255999, intensity: 0.15, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 8255999, intensity: 0.2, time: 400 },
        ],
      },
    ],
    bcsh: [
      { brightness: 0, contrast: -1.77, saturation: 0, hue: 0, key: "hss" },
      { brightness: 0, contrast: -1.77, saturation: 0, hue: 0, key: "hs" },
      { brightness: 22.566, contrast: -2.655, saturation: 0, hue: 15.93, key: "dss" },
      { brightness: 22.566, contrast: -2.655, saturation: 0, hue: 15.93, key: "ds" },
    ],
  },
  isida_m1: {
    damagingBall: "effects/isida/damaging_ball" as ResourceId,
    damagingRay: "effects/isida/damaging_ray" as ResourceId,
    damagingSound: "sounds/isida/damaging" as ResourceId,
    healingBall: "effects/isida/healing_ball" as ResourceId,
    healingRay: "effects/isida/healing_ray" as ResourceId,
    healingSound: "sounds/isida/healing" as ResourceId,
    idleSound: "sounds/isida/idle" as ResourceId,
    lighting: [
      {
        name: "enemyStart",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 16640272, intensity: 0, time: 0 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 16640272, intensity: 0.1, time: 200 },
        ],
      },
      {
        name: "enemyLoop",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 16640272, intensity: 0.3, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 16640272, intensity: 0.2, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 16640272, intensity: 0.3, time: 400 },
        ],
      },
      {
        name: "start",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 4308715, intensity: 0, time: 0 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 4308715, intensity: 0.2, time: 200 },
        ],
      },
      {
        name: "loop",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 4308715, intensity: 0.3, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 4308715, intensity: 0.2, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 4308715, intensity: 0.3, time: 400 },
        ],
      },
      {
        name: "friendStart",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 2405089, intensity: 0, time: 0 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 2405089, intensity: 0.2, time: 200 },
        ],
      },
      {
        name: "friendLoop",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 2405089, intensity: 0.3, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 2405089, intensity: 0.2, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 2405089, intensity: 0.3, time: 400 },
        ],
      },
      {
        name: "enemyBeam",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 15782695, intensity: 0.2, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 15782695, intensity: 0.15, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 15782695, intensity: 0.2, time: 400 },
        ],
      },
      {
        name: "friendBeam",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 2405089, intensity: 0.2, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 2405089, intensity: 0.15, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 2405089, intensity: 0.2, time: 400 },
        ],
      },
    ],
    bcsh: [
      { brightness: 19.181, contrast: -1.77, saturation: 8.85, hue: 316.99, key: "hss" },
      { brightness: 19.181, contrast: -1.77, saturation: 8.85, hue: 316.99, key: "hs" },
      { brightness: 28.208, contrast: -3.54, saturation: 53.097, hue: 340.88, key: "dss" },
      { brightness: 28.208, contrast: -3.54, saturation: 53.097, hue: 340.88, key: "ds" },
    ],
  },
  isida_m2: {
    damagingBall: "effects/isida/damaging_ball" as ResourceId,
    damagingRay: "effects/isida/damaging_ray" as ResourceId,
    damagingSound: "sounds/isida/damaging" as ResourceId,
    healingBall: "effects/isida/healing_ball" as ResourceId,
    healingRay: "effects/isida/healing_ray" as ResourceId,
    healingSound: "sounds/isida/healing" as ResourceId,
    idleSound: "sounds/isida/idle" as ResourceId,
    lighting: [
      {
        name: "enemyStart",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 16758811, intensity: 0, time: 0 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 16758811, intensity: 0.1, time: 200 },
        ],
      },
      {
        name: "enemyLoop",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 16758811, intensity: 0.3, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 16758811, intensity: 0.2, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 16758811, intensity: 0.3, time: 400 },
        ],
      },
      {
        name: "start",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 4308715, intensity: 0, time: 0 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 4308715, intensity: 0.2, time: 200 },
        ],
      },
      {
        name: "loop",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 4308715, intensity: 0.3, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 4308715, intensity: 0.2, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 4308715, intensity: 0.3, time: 400 },
        ],
      },
      {
        name: "friendStart",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 65535, intensity: 0, time: 0 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 65535, intensity: 0.2, time: 200 },
        ],
      },
      {
        name: "friendLoop",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 8255999, intensity: 0.3, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 8255999, intensity: 0.2, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 8255999, intensity: 0.3, time: 400 },
        ],
      },
      {
        name: "enemyBeam",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 16763392, intensity: 0.2, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 16763392, intensity: 0.15, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 16763392, intensity: 0.2, time: 400 },
        ],
      },
      {
        name: "friendBeam",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 8255999, intensity: 0.2, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 8255999, intensity: 0.15, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 8255999, intensity: 0.2, time: 400 },
        ],
      },
    ],
    bcsh: [
      { brightness: 4.513, contrast: -1.77, saturation: 8.85, hue: 299.47, key: "hss" },
      { brightness: 4.513, contrast: -1.77, saturation: 8.85, hue: 299.47, key: "hs" },
      { brightness: 19.181, contrast: 3.54, saturation: 61.947, hue: 329.73, key: "dss" },
      { brightness: 19.181, contrast: 3.54, saturation: 61.947, hue: 329.73, key: "ds" },
    ],
  },
  isida_m3: {
    damagingBall: "effects/isida/damaging_ball" as ResourceId,
    damagingRay: "effects/isida/damaging_ray" as ResourceId,
    damagingSound: "sounds/isida/damaging" as ResourceId,
    healingBall: "effects/isida/healing_ball" as ResourceId,
    healingRay: "effects/isida/healing_ray" as ResourceId,
    healingSound: "sounds/isida/healing" as ResourceId,
    idleSound: "sounds/isida/idle" as ResourceId,
    lighting: [
      {
        name: "enemyStart",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 16733773, intensity: 0, time: 0 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 16733773, intensity: 0.1, time: 200 },
        ],
      },
      {
        name: "enemyLoop",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 16733773, intensity: 0.3, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 16733773, intensity: 0.2, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 16733773, intensity: 0.3, time: 400 },
        ],
      },
      {
        name: "start",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 4308715, intensity: 0, time: 0 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 4308715, intensity: 0.2, time: 200 },
        ],
      },
      {
        name: "loop",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 4308715, intensity: 0.3, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 4308715, intensity: 0.2, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 4308715, intensity: 0.3, time: 400 },
        ],
      },
      {
        name: "friendStart",
        light: [
          { attenuationBegin: 1, attenuationEnd: 2, color: 3338397, intensity: 0, time: 0 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 3338397, intensity: 0.2, time: 200 },
        ],
      },
      {
        name: "friendLoop",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 3338397, intensity: 0.3, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 3338397, intensity: 0.2, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 3338397, intensity: 0.3, time: 400 },
        ],
      },
      {
        name: "enemyBeam",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 16735565, intensity: 0.2, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 16735565, intensity: 0.15, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 16735565, intensity: 0.2, time: 400 },
        ],
      },
      {
        name: "friendBeam",
        light: [
          { attenuationBegin: 250, attenuationEnd: 700, color: 12382365, intensity: 0.2, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 600, color: 12382365, intensity: 0.15, time: 200 },
          { attenuationBegin: 250, attenuationEnd: 700, color: 12382365, intensity: 0.2, time: 400 },
        ],
      },
    ],
    bcsh: [
      { brightness: 2.257, contrast: 1.77, saturation: 26.549, hue: 267.61, key: "hss" },
      { brightness: 2.257, contrast: 1.77, saturation: 26.549, hue: 267.61, key: "hs" },
      { brightness: 20.31, contrast: -2.655, saturation: 70.796, hue: 310.62, key: "dss" },
      { brightness: 20.31, contrast: -2.655, saturation: 70.796, hue: 310.62, key: "ds" },
    ],
  },
  machinegun_m0: {
    chainStartSound: "sounds/machinegun/chain_start" as ResourceId,
    crumbsTexture: "effects/machinegun/crumbs_texture" as ResourceId,
    dustTexture: "effects/machinegun/dust_texture" as ResourceId,
    fireAcrossTexture: "effects/machinegun/fire_across_texture" as ResourceId,
    fireAlongTexture: "effects/machinegun/fire_along_texture" as ResourceId,
    hitSound: "sounds/machinegun/hit" as ResourceId,
    longFailSound: "sounds/machinegun/long_fail" as ResourceId,
    shootEndSound: "sounds/machinegun/shoot_end" as ResourceId,
    shootSound: "sounds/machinegun/shoot" as ResourceId,
    smokeTexture: "effects/machinegun/smoke_texture" as ResourceId,
    sparklesTexture: "effects/machinegun/sparkles_texture" as ResourceId,
    tankHitSound: "sounds/machinegun/tank_hit" as ResourceId,
    tankSparklesTexture: "effects/machinegun/tank_sparkles_texture" as ResourceId,
    tracerTexture: "effects/machinegun/tracer_texture" as ResourceId,
    turbineStartSound: "sounds/machinegun/turbine_start" as ResourceId,
    lighting: [
      {
        name: "loopFire",
        light: [
          { attenuationBegin: 200, attenuationEnd: 600, color: 16746496, intensity: 0.6, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16746496, intensity: 0, time: 75 },
        ],
      },
    ],
    bcsh: [],
  },
  machinegun_m1: {
    chainStartSound: "sounds/machinegun/chain_start" as ResourceId,
    crumbsTexture: "effects/machinegun/crumbs_texture" as ResourceId,
    dustTexture: "effects/machinegun/dust_texture" as ResourceId,
    fireAcrossTexture: "effects/machinegun/fire_across_texture" as ResourceId,
    fireAlongTexture: "effects/machinegun/fire_along_texture" as ResourceId,
    hitSound: "sounds/machinegun/hit" as ResourceId,
    longFailSound: "sounds/machinegun/long_fail" as ResourceId,
    shootEndSound: "sounds/machinegun/shoot_end" as ResourceId,
    shootSound: "sounds/machinegun/shoot" as ResourceId,
    smokeTexture: "effects/machinegun/smoke_texture" as ResourceId,
    sparklesTexture: "effects/machinegun/sparkles_texture" as ResourceId,
    tankHitSound: "sounds/machinegun/tank_hit" as ResourceId,
    tankSparklesTexture: "effects/machinegun/tank_sparkles_texture" as ResourceId,
    tracerTexture: "effects/machinegun/tracer_texture" as ResourceId,
    turbineStartSound: "sounds/machinegun/turbine_start" as ResourceId,
    lighting: [
      {
        name: "loopFire",
        light: [
          { attenuationBegin: 200, attenuationEnd: 600, color: 16746496, intensity: 0.6, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16746496, intensity: 0, time: 75 },
        ],
      },
    ],
    bcsh: [],
  },
  machinegun_m2: {
    chainStartSound: "sounds/machinegun/chain_start" as ResourceId,
    crumbsTexture: "effects/machinegun/crumbs_texture" as ResourceId,
    dustTexture: "effects/machinegun/dust_texture" as ResourceId,
    fireAcrossTexture: "effects/machinegun/fire_across_texture" as ResourceId,
    fireAlongTexture: "effects/machinegun/fire_along_texture" as ResourceId,
    hitSound: "sounds/machinegun/hit" as ResourceId,
    longFailSound: "sounds/machinegun/long_fail" as ResourceId,
    shootEndSound: "sounds/machinegun/shoot_end" as ResourceId,
    shootSound: "sounds/machinegun/shoot" as ResourceId,
    smokeTexture: "effects/machinegun/smoke_texture" as ResourceId,
    sparklesTexture: "effects/machinegun/sparkles_texture" as ResourceId,
    tankHitSound: "sounds/machinegun/tank_hit" as ResourceId,
    tankSparklesTexture: "effects/machinegun/tank_sparkles_texture" as ResourceId,
    tracerTexture: "effects/machinegun/tracer_texture" as ResourceId,
    turbineStartSound: "sounds/machinegun/turbine_start" as ResourceId,
    lighting: [
      {
        name: "loopFire",
        light: [
          { attenuationBegin: 200, attenuationEnd: 600, color: 16746496, intensity: 0.6, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16746496, intensity: 0, time: 75 },
        ],
      },
    ],
    bcsh: [],
  },
  machinegun_m3: {
    chainStartSound: "sounds/machinegun/chain_start" as ResourceId,
    crumbsTexture: "effects/machinegun/crumbs_texture" as ResourceId,
    dustTexture: "effects/machinegun/dust_texture" as ResourceId,
    fireAcrossTexture: "effects/machinegun/fire_across_texture" as ResourceId,
    fireAlongTexture: "effects/machinegun/fire_along_texture" as ResourceId,
    hitSound: "sounds/machinegun/hit" as ResourceId,
    longFailSound: "sounds/machinegun/long_fail" as ResourceId,
    shootEndSound: "sounds/machinegun/shoot_end" as ResourceId,
    shootSound: "sounds/machinegun/shoot" as ResourceId,
    smokeTexture: "effects/machinegun/smoke_texture" as ResourceId,
    sparklesTexture: "effects/machinegun/sparkles_texture" as ResourceId,
    tankHitSound: "sounds/machinegun/tank_hit" as ResourceId,
    tankSparklesTexture: "effects/machinegun/tank_sparkles_texture" as ResourceId,
    tracerTexture: "effects/machinegun/tracer_texture" as ResourceId,
    turbineStartSound: "sounds/machinegun/turbine_start" as ResourceId,
    lighting: [
      {
        name: "loopFire",
        light: [
          { attenuationBegin: 200, attenuationEnd: 600, color: 16746496, intensity: 0.6, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16746496, intensity: 0, time: 75 },
        ],
      },
    ],
    bcsh: [],
  },
  railgun_m0: {
    chargingPart1: "effects/railgun/charging_part1" as ResourceId,
    chargingPart2: "effects/railgun/charging_part2" as ResourceId,
    chargingPart3: "effects/railgun/charging_part3" as ResourceId,
    hitMarkTexture: "effects/railgun/hit_mark_texture" as ResourceId,
    powTexture: "effects/railgun/pow_texture" as ResourceId,
    ringsTexture: "effects/railgun/rings_texture" as ResourceId,
    shotSound: "sounds/railgun/shot" as ResourceId,
    smokeImage: "effects/railgun/smoke_image" as ResourceId,
    sphereTexture: "effects/railgun/sphere_texture" as ResourceId,
    trailImage: "effects/railgun/trail_image" as ResourceId,
    lighting: [
      {
        name: "charge",
        light: [
          { attenuationBegin: 200, attenuationEnd: 200, color: 5883129, intensity: 0.7, time: 0 },
          { attenuationBegin: 200, attenuationEnd: 800, color: 5883129, intensity: 0.3, time: 600 },
        ],
      },
      {
        name: "shot",
        light: [
          { attenuationBegin: 100, attenuationEnd: 600, color: 5883129, intensity: 0.7, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 5883129, intensity: 0, time: 300 },
        ],
      },
      {
        name: "hit",
        light: [
          { attenuationBegin: 200, attenuationEnd: 600, color: 5883129, intensity: 0.7, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 5883129, intensity: 0, time: 300 },
        ],
      },
      {
        name: "rail",
        light: [
          { attenuationBegin: 100, attenuationEnd: 500, color: 5883129, intensity: 0.5, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 5883129, intensity: 0, time: 1800 },
        ],
      },
    ],
    bcsh: [
      { brightness: 0, contrast: 0, saturation: 0, hue: 0, key: "trail" },
      { brightness: 0, contrast: 0, saturation: 0, hue: 0, key: "charge" },
    ],
  },
  railgun_m1: {
    chargingPart1: "effects/railgun/charging_part1" as ResourceId,
    chargingPart2: "effects/railgun/charging_part2" as ResourceId,
    chargingPart3: "effects/railgun/charging_part3" as ResourceId,
    hitMarkTexture: "effects/railgun/hit_mark_texture" as ResourceId,
    powTexture: "effects/railgun/pow_texture" as ResourceId,
    ringsTexture: "effects/railgun/rings_texture" as ResourceId,
    shotSound: "sounds/railgun/shot" as ResourceId,
    smokeImage: "effects/railgun/smoke_image" as ResourceId,
    sphereTexture: "effects/railgun/sphere_texture" as ResourceId,
    trailImage: "effects/railgun/trail_image" as ResourceId,
    lighting: [
      {
        name: "charge",
        light: [
          { attenuationBegin: 200, attenuationEnd: 200, color: 5286399, intensity: 0.7, time: 0 },
          { attenuationBegin: 200, attenuationEnd: 800, color: 5286399, intensity: 0.3, time: 600 },
        ],
      },
      {
        name: "shot",
        light: [
          { attenuationBegin: 100, attenuationEnd: 600, color: 5286399, intensity: 0.7, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 5286399, intensity: 0, time: 300 },
        ],
      },
      {
        name: "hit",
        light: [
          { attenuationBegin: 200, attenuationEnd: 600, color: 5286399, intensity: 0.7, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 5286399, intensity: 0, time: 300 },
        ],
      },
      {
        name: "rail",
        light: [
          { attenuationBegin: 100, attenuationEnd: 500, color: 5286399, intensity: 0.5, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 5286399, intensity: 0, time: 1800 },
        ],
      },
    ],
    bcsh: [
      { brightness: 10.155, contrast: -2.655, saturation: 61.947, hue: 344.07, key: "trail" },
      { brightness: 10.155, contrast: -2.655, saturation: 44.248, hue: 340.88, key: "charge" },
    ],
  },
  railgun_m2: {
    chargingPart1: "effects/railgun/charging_part1" as ResourceId,
    chargingPart2: "effects/railgun/charging_part2" as ResourceId,
    chargingPart3: "effects/railgun/charging_part3" as ResourceId,
    hitMarkTexture: "effects/railgun/hit_mark_texture" as ResourceId,
    powTexture: "effects/railgun/pow_texture" as ResourceId,
    ringsTexture: "effects/railgun/rings_texture" as ResourceId,
    shotSound: "sounds/railgun/shot" as ResourceId,
    smokeImage: "effects/railgun/smoke_image" as ResourceId,
    sphereTexture: "effects/railgun/sphere_texture" as ResourceId,
    trailImage: "effects/railgun/trail_image" as ResourceId,
    lighting: [
      {
        name: "charge",
        light: [
          { attenuationBegin: 200, attenuationEnd: 200, color: 13597945, intensity: 0.7, time: 0 },
          { attenuationBegin: 200, attenuationEnd: 800, color: 13597945, intensity: 0.3, time: 600 },
        ],
      },
      {
        name: "shot",
        light: [
          { attenuationBegin: 100, attenuationEnd: 600, color: 13597945, intensity: 0.7, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 13597945, intensity: 0, time: 300 },
        ],
      },
      {
        name: "hit",
        light: [
          { attenuationBegin: 200, attenuationEnd: 600, color: 13597945, intensity: 0.7, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 13597945, intensity: 0, time: 300 },
        ],
      },
      {
        name: "rail",
        light: [
          { attenuationBegin: 100, attenuationEnd: 500, color: 13597945, intensity: 0.5, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 13597945, intensity: 0, time: 1800 },
        ],
      },
    ],
    bcsh: [
      { brightness: 7.898, contrast: -2.655, saturation: 35.398, hue: 78.05, key: "trail" },
      { brightness: 7.898, contrast: -2.655, saturation: 35.398, hue: 78.05, key: "charge" },
    ],
  },
  railgun_m3: {
    chargingPart1: "effects/railgun/charging_part1" as ResourceId,
    chargingPart2: "effects/railgun/charging_part2" as ResourceId,
    chargingPart3: "effects/railgun/charging_part3" as ResourceId,
    hitMarkTexture: "effects/railgun/hit_mark_texture" as ResourceId,
    powTexture: "effects/railgun/pow_texture" as ResourceId,
    ringsTexture: "effects/railgun/rings_texture" as ResourceId,
    shotSound: "sounds/railgun/shot" as ResourceId,
    smokeImage: "effects/railgun/smoke_image" as ResourceId,
    sphereTexture: "effects/railgun/sphere_texture" as ResourceId,
    trailImage: "effects/railgun/trail_image" as ResourceId,
    lighting: [
      {
        name: "charge",
        light: [
          { attenuationBegin: 200, attenuationEnd: 200, color: 16765017, intensity: 0.7, time: 0 },
          { attenuationBegin: 200, attenuationEnd: 800, color: 16765017, intensity: 0.3, time: 600 },
        ],
      },
      {
        name: "shot",
        light: [
          { attenuationBegin: 100, attenuationEnd: 600, color: 16765017, intensity: 0.7, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16765017, intensity: 0, time: 300 },
        ],
      },
      {
        name: "hit",
        light: [
          { attenuationBegin: 200, attenuationEnd: 600, color: 16765017, intensity: 0.7, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16765017, intensity: 0, time: 300 },
        ],
      },
      {
        name: "rail",
        light: [
          { attenuationBegin: 100, attenuationEnd: 500, color: 16765017, intensity: 0.5, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16765017, intensity: 0, time: 1800 },
        ],
      },
    ],
    bcsh: [
      { brightness: 9.027, contrast: -3.54, saturation: 44.248, hue: 208.67, key: "trail" },
      { brightness: 9.027, contrast: -3.54, saturation: 44.248, hue: 208.67, key: "charge" },
    ],
  },
  ricochet_m0: {
    bumpFlashTexture: "effects/ricochet/bump_flash_texture" as ResourceId,
    explosionTexture: "effects/ricochet/explosion_texture" as ResourceId,
    explosionSound: "sounds/ricochet/explosion" as ResourceId,
    ricochetSound: "sounds/ricochet/ricochet" as ResourceId,
    shotFlashTexture: "effects/ricochet/shot_flash_texture" as ResourceId,
    shotSound: "sounds/ricochet/shot" as ResourceId,
    shotTexture: "effects/ricochet/shot_texture" as ResourceId,
    tailTrailTexutre: "effects/ricochet/tail_trail_texutre" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 200, attenuationEnd: 500, color: 16754944, intensity: 0.5, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16754944, intensity: 0, time: 600 },
        ],
      },
      {
        name: "ricochet",
        light: [
          { attenuationBegin: 100, attenuationEnd: 400, color: 16754944, intensity: 0.5, time: 0 },
          { attenuationBegin: 50, attenuationEnd: 200, color: 16754944, intensity: 0, time: 600 },
        ],
      },
      {
        name: "hit",
        light: [
          { attenuationBegin: 300, attenuationEnd: 600, color: 16754944, intensity: 0.5, time: 0 },
          { attenuationBegin: 300, attenuationEnd: 600, color: 16754944, intensity: 0, time: 600 },
        ],
      },
      { name: "bullet", light: [{ attenuationBegin: 100, attenuationEnd: 350, color: 16754944, intensity: 0.5, time: 0 }] },
    ],
    bcsh: [
      { brightness: 14.668, contrast: 0, saturation: -8.85, hue: 6.37, key: "shot" },
      { brightness: 14.668, contrast: 0, saturation: -8.85, hue: 6.37, key: "expl" },
      { brightness: 14.668, contrast: 0, saturation: -8.85, hue: 6.37, key: "trail" },
    ],
  },
  ricochet_m1: {
    bumpFlashTexture: "effects/ricochet/bump_flash_texture" as ResourceId,
    explosionTexture: "effects/ricochet/explosion_texture" as ResourceId,
    explosionSound: "sounds/ricochet/explosion" as ResourceId,
    ricochetSound: "sounds/ricochet/ricochet" as ResourceId,
    shotFlashTexture: "effects/ricochet/shot_flash_texture" as ResourceId,
    shotSound: "sounds/ricochet/shot" as ResourceId,
    shotTexture: "effects/ricochet/shot_texture" as ResourceId,
    tailTrailTexutre: "effects/ricochet/tail_trail_texutre" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 200, attenuationEnd: 500, color: 16741656, intensity: 0.5, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16741656, intensity: 0, time: 600 },
        ],
      },
      {
        name: "ricochet",
        light: [
          { attenuationBegin: 100, attenuationEnd: 400, color: 16741656, intensity: 0.5, time: 0 },
          { attenuationBegin: 50, attenuationEnd: 200, color: 16741656, intensity: 0, time: 600 },
        ],
      },
      {
        name: "hit",
        light: [
          { attenuationBegin: 300, attenuationEnd: 600, color: 16741656, intensity: 0.5, time: 0 },
          { attenuationBegin: 300, attenuationEnd: 600, color: 16741656, intensity: 0, time: 600 },
        ],
      },
      { name: "bullet", light: [{ attenuationBegin: 100, attenuationEnd: 350, color: 16741656, intensity: 0.5, time: 0 }] },
    ],
    bcsh: [
      { brightness: 1.128, contrast: 0, saturation: 0, hue: 345.66, key: "shot" },
      { brightness: 1.128, contrast: 0, saturation: 0, hue: 345.66, key: "expl" },
      { brightness: 1.128, contrast: 0, saturation: 0, hue: 345.66, key: "trail" },
    ],
  },
  ricochet_m2: {
    bumpFlashTexture: "effects/ricochet/bump_flash_texture" as ResourceId,
    explosionTexture: "effects/ricochet/explosion_texture" as ResourceId,
    explosionSound: "sounds/ricochet/explosion" as ResourceId,
    ricochetSound: "sounds/ricochet/ricochet" as ResourceId,
    shotFlashTexture: "effects/ricochet/shot_flash_texture" as ResourceId,
    shotSound: "sounds/ricochet/shot" as ResourceId,
    shotTexture: "effects/ricochet/shot_texture" as ResourceId,
    tailTrailTexutre: "effects/ricochet/tail_trail_texutre" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 200, attenuationEnd: 500, color: 16750336, intensity: 0.5, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16750336, intensity: 0, time: 600 },
        ],
      },
      {
        name: "ricochet",
        light: [
          { attenuationBegin: 100, attenuationEnd: 400, color: 16750336, intensity: 0.5, time: 0 },
          { attenuationBegin: 50, attenuationEnd: 200, color: 16750336, intensity: 0, time: 600 },
        ],
      },
      {
        name: "hit",
        light: [
          { attenuationBegin: 300, attenuationEnd: 600, color: 16750336, intensity: 0.5, time: 0 },
          { attenuationBegin: 300, attenuationEnd: 600, color: 16750336, intensity: 0, time: 600 },
        ],
      },
      { name: "bullet", light: [{ attenuationBegin: 100, attenuationEnd: 350, color: 16750336, intensity: 0.5, time: 0 }] },
    ],
    bcsh: [
      { brightness: 1.128, contrast: 0, saturation: 0, hue: 1.59, key: "shot" },
      { brightness: 1.128, contrast: 0, saturation: 0, hue: 1.59, key: "expl" },
      { brightness: 1.128, contrast: 0, saturation: 0, hue: 1.59, key: "trail" },
    ],
  },
  ricochet_m3: {
    bumpFlashTexture: "effects/ricochet/bump_flash_texture" as ResourceId,
    explosionTexture: "effects/ricochet/explosion_texture" as ResourceId,
    explosionSound: "sounds/ricochet/explosion" as ResourceId,
    ricochetSound: "sounds/ricochet/ricochet" as ResourceId,
    shotFlashTexture: "effects/ricochet/shot_flash_texture" as ResourceId,
    shotSound: "sounds/ricochet/shot" as ResourceId,
    shotTexture: "effects/ricochet/shot_texture" as ResourceId,
    tailTrailTexutre: "effects/ricochet/tail_trail_texutre" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 200, attenuationEnd: 500, color: 16741656, intensity: 0.5, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16741656, intensity: 0, time: 600 },
        ],
      },
      {
        name: "ricochet",
        light: [
          { attenuationBegin: 100, attenuationEnd: 400, color: 16741656, intensity: 0.5, time: 0 },
          { attenuationBegin: 50, attenuationEnd: 200, color: 16741656, intensity: 0, time: 600 },
        ],
      },
      {
        name: "hit",
        light: [
          { attenuationBegin: 300, attenuationEnd: 600, color: 16741656, intensity: 0.5, time: 0 },
          { attenuationBegin: 300, attenuationEnd: 600, color: 16741656, intensity: 0, time: 600 },
        ],
      },
      { name: "bullet", light: [{ attenuationBegin: 100, attenuationEnd: 350, color: 16741656, intensity: 0.5, time: 0 }] },
    ],
    bcsh: [
      { brightness: 1.128, contrast: 0, saturation: 0, hue: 353.63, key: "shot" },
      { brightness: 1.128, contrast: 0, saturation: 0, hue: 353.63, key: "expl" },
      { brightness: 1.128, contrast: 0, saturation: 0, hue: 353.63, key: "trail" },
    ],
  },
  shaft_m0: {
    explosionSound: "sounds/shaft/explosion" as ResourceId,
    explosionTexture: "effects/shaft/explosion_texture" as ResourceId,
    hitMarkTexture: "effects/shaft/hit_mark_texture" as ResourceId,
    muzzleFlashTexture: "effects/shaft/muzzle_flash_texture" as ResourceId,
    shotSound: "sounds/shaft/shot" as ResourceId,
    targetingSound: "sounds/shaft/targeting" as ResourceId,
    trailTexture: "effects/shaft/trail_texture" as ResourceId,
    zoomModeSound: "sounds/shaft/zoom_mode" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 200, attenuationEnd: 600, color: 15772719, intensity: 0.5, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 15772719, intensity: 0, time: 600 },
        ],
      },
      {
        name: "hit",
        light: [
          { attenuationBegin: 300, attenuationEnd: 700, color: 15772719, intensity: 0.5, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 15772719, intensity: 0, time: 600 },
        ],
      },
    ],
    bcsh: [{ brightness: 0, contrast: 0, saturation: 0, hue: 0, key: "def" }],
  },
  shaft_m1: {
    explosionSound: "sounds/shaft/explosion" as ResourceId,
    explosionTexture: "effects/shaft/explosion_texture" as ResourceId,
    hitMarkTexture: "effects/shaft/hit_mark_texture" as ResourceId,
    muzzleFlashTexture: "effects/shaft/muzzle_flash_texture" as ResourceId,
    shotSound: "sounds/shaft/shot" as ResourceId,
    targetingSound: "sounds/shaft/targeting" as ResourceId,
    trailTexture: "effects/shaft/trail_texture" as ResourceId,
    zoomModeSound: "sounds/shaft/zoom_mode" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 200, attenuationEnd: 600, color: 16756480, intensity: 0.5, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16756480, intensity: 0, time: 600 },
        ],
      },
      {
        name: "hit",
        light: [
          { attenuationBegin: 300, attenuationEnd: 700, color: 16756480, intensity: 0.5, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16756480, intensity: 0, time: 600 },
        ],
      },
    ],
    bcsh: [{ brightness: 18.053, contrast: -2.655, saturation: 44.248, hue: 339.29, key: "def" }],
  },
  shaft_m2: {
    explosionSound: "sounds/shaft/explosion" as ResourceId,
    explosionTexture: "effects/shaft/explosion_texture" as ResourceId,
    hitMarkTexture: "effects/shaft/hit_mark_texture" as ResourceId,
    muzzleFlashTexture: "effects/shaft/muzzle_flash_texture" as ResourceId,
    shotSound: "sounds/shaft/shot" as ResourceId,
    targetingSound: "sounds/shaft/targeting" as ResourceId,
    trailTexture: "effects/shaft/trail_texture" as ResourceId,
    zoomModeSound: "sounds/shaft/zoom_mode" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 200, attenuationEnd: 600, color: 16741376, intensity: 0.5, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16741376, intensity: 0, time: 600 },
        ],
      },
      {
        name: "hit",
        light: [
          { attenuationBegin: 300, attenuationEnd: 700, color: 16741376, intensity: 0.5, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16741376, intensity: 0, time: 600 },
        ],
      },
    ],
    bcsh: [{ brightness: 14.668, contrast: -5.31, saturation: 61.947, hue: 313.81, key: "def" }],
  },
  shaft_m3: {
    explosionSound: "sounds/shaft/explosion" as ResourceId,
    explosionTexture: "effects/shaft/explosion_texture" as ResourceId,
    hitMarkTexture: "effects/shaft/hit_mark_texture" as ResourceId,
    muzzleFlashTexture: "effects/shaft/muzzle_flash_texture" as ResourceId,
    shotSound: "sounds/shaft/shot" as ResourceId,
    targetingSound: "sounds/shaft/targeting" as ResourceId,
    trailTexture: "effects/shaft/trail_texture" as ResourceId,
    zoomModeSound: "sounds/shaft/zoom_mode" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 200, attenuationEnd: 600, color: 16719390, intensity: 0.5, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16719390, intensity: 0, time: 600 },
        ],
      },
      {
        name: "hit",
        light: [
          { attenuationBegin: 300, attenuationEnd: 700, color: 16719390, intensity: 0.5, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16719390, intensity: 0, time: 600 },
        ],
      },
    ],
    bcsh: [{ brightness: 11.283, contrast: -5.31, saturation: 150.442, hue: 302.65, key: "def" }],
  },
  shotgun_m0: {
    magazineReloadSound: "sounds/shotgun/magazine_reload" as ResourceId,
    reloadSound: "sounds/shotgun/reload" as ResourceId,
    shotSound: "sounds/shotgun/shot" as ResourceId,
    explosionMarkTexture0: "effects/shotgun/explosion_mark_texture0" as ResourceId,
    explosionMarkTexture1: "effects/shotgun/explosion_mark_texture1" as ResourceId,
    explosionMarkTexture2: "effects/shotgun/explosion_mark_texture2" as ResourceId,
    explosionMarkTexture3: "effects/shotgun/explosion_mark_texture3" as ResourceId,
    smokeTexture: "effects/shotgun/smoke_texture" as ResourceId,
    sparkleTexture: "effects/shotgun/sparkle_texture" as ResourceId,
    pelletTrailTexture: "effects/shotgun/pellet_trail_texture" as ResourceId,
    shotAlongTexture: "effects/shotgun/shot_along_texture" as ResourceId,
    shotAcrossTexture: "effects/shotgun/shot_across_texture" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 50, attenuationEnd: 700, color: 16431616, intensity: 1, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16431616, intensity: 0, time: 300 },
        ],
      },
    ],
    bcsh: [],
  },
  shotgun_m1: {
    magazineReloadSound: "sounds/shotgun/magazine_reload" as ResourceId,
    reloadSound: "sounds/shotgun/reload" as ResourceId,
    shotSound: "sounds/shotgun/shot" as ResourceId,
    explosionMarkTexture0: "effects/shotgun/explosion_mark_texture0" as ResourceId,
    explosionMarkTexture1: "effects/shotgun/explosion_mark_texture1" as ResourceId,
    explosionMarkTexture2: "effects/shotgun/explosion_mark_texture2" as ResourceId,
    explosionMarkTexture3: "effects/shotgun/explosion_mark_texture3" as ResourceId,
    smokeTexture: "effects/shotgun/smoke_texture" as ResourceId,
    sparkleTexture: "effects/shotgun/sparkle_texture" as ResourceId,
    pelletTrailTexture: "effects/shotgun/pellet_trail_texture" as ResourceId,
    shotAlongTexture: "effects/shotgun/shot_along_texture" as ResourceId,
    shotAcrossTexture: "effects/shotgun/shot_across_texture" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 50, attenuationEnd: 700, color: 16431616, intensity: 1, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16431616, intensity: 0, time: 300 },
        ],
      },
    ],
    bcsh: [],
  },
  shotgun_m2: {
    magazineReloadSound: "sounds/shotgun/magazine_reload" as ResourceId,
    reloadSound: "sounds/shotgun/reload" as ResourceId,
    shotSound: "sounds/shotgun/shot" as ResourceId,
    explosionMarkTexture0: "effects/shotgun/explosion_mark_texture0" as ResourceId,
    explosionMarkTexture1: "effects/shotgun/explosion_mark_texture1" as ResourceId,
    explosionMarkTexture2: "effects/shotgun/explosion_mark_texture2" as ResourceId,
    explosionMarkTexture3: "effects/shotgun/explosion_mark_texture3" as ResourceId,
    smokeTexture: "effects/shotgun/smoke_texture" as ResourceId,
    sparkleTexture: "effects/shotgun/sparkle_texture" as ResourceId,
    pelletTrailTexture: "effects/shotgun/pellet_trail_texture" as ResourceId,
    shotAlongTexture: "effects/shotgun/shot_along_texture" as ResourceId,
    shotAcrossTexture: "effects/shotgun/shot_across_texture" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 50, attenuationEnd: 700, color: 16431616, intensity: 1, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16431616, intensity: 0, time: 300 },
        ],
      },
    ],
    bcsh: [],
  },
  shotgun_m3: {
    magazineReloadSound: "sounds/shotgun/magazine_reload" as ResourceId,
    reloadSound: "sounds/shotgun/reload" as ResourceId,
    shotSound: "sounds/shotgun/shot" as ResourceId,
    explosionMarkTexture0: "effects/shotgun/explosion_mark_texture0" as ResourceId,
    explosionMarkTexture1: "effects/shotgun/explosion_mark_texture1" as ResourceId,
    explosionMarkTexture2: "effects/shotgun/explosion_mark_texture2" as ResourceId,
    explosionMarkTexture3: "effects/shotgun/explosion_mark_texture3" as ResourceId,
    smokeTexture: "effects/shotgun/smoke_texture" as ResourceId,
    sparkleTexture: "effects/shotgun/sparkle_texture" as ResourceId,
    pelletTrailTexture: "effects/shotgun/pellet_trail_texture" as ResourceId,
    shotAlongTexture: "effects/shotgun/shot_along_texture" as ResourceId,
    shotAcrossTexture: "effects/shotgun/shot_across_texture" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 50, attenuationEnd: 700, color: 16431616, intensity: 1, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16431616, intensity: 0, time: 300 },
        ],
      },
    ],
    bcsh: [],
  },
  smoky_m0: {
    criticalHitSize: 375,
    criticalHitTexture: "effects/smoky/critical_hit" as ResourceId,
    explosionMarkTexture: "effects/smoky/explosion_mark" as ResourceId,
    explosionSize: 300,
    explosionSound: "sounds/smoky/explosion" as ResourceId,
    explosionTexture: "effects/smoky/explosion/m0" as ResourceId,
    shotSound: "sounds/smoky/shot" as ResourceId,
    shotTexture: "effects/smoky/shot" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 150, attenuationEnd: 450, color: 16571766, intensity: 0.9, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16571766, intensity: 0, time: 300 },
        ],
      },
      {
        name: "hit",
        light: [
          { attenuationBegin: 100, attenuationEnd: 300, color: 16760576, intensity: 0.7, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 300, color: 16760576, intensity: 0, time: 400 },
        ],
      },
    ],
    bcsh: [],
  },
  smoky_m1: {
    criticalHitSize: 375,
    criticalHitTexture: "effects/smoky/critical_hit" as ResourceId,
    explosionMarkTexture: "effects/smoky/explosion_mark" as ResourceId,
    explosionSize: 300,
    explosionSound: "sounds/smoky/explosion" as ResourceId,
    explosionTexture: "effects/smoky/explosion/m1" as ResourceId,
    shotSound: "sounds/smoky/shot" as ResourceId,
    shotTexture: "effects/smoky/shot" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 150, attenuationEnd: 450, color: 16571766, intensity: 0.9, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16571766, intensity: 0, time: 300 },
        ],
      },
      {
        name: "hit",
        light: [
          { attenuationBegin: 100, attenuationEnd: 300, color: 16760576, intensity: 0.7, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 300, color: 16760576, intensity: 0, time: 400 },
        ],
      },
    ],
    bcsh: [],
  },
  smoky_m2: {
    criticalHitSize: 375,
    criticalHitTexture: "effects/smoky/critical_hit" as ResourceId,
    explosionMarkTexture: "effects/smoky/explosion_mark" as ResourceId,
    explosionSize: 300,
    explosionSound: "sounds/smoky/explosion" as ResourceId,
    explosionTexture: "effects/smoky/explosion/m2" as ResourceId,
    shotSound: "sounds/smoky/shot" as ResourceId,
    shotTexture: "effects/smoky/shot" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 150, attenuationEnd: 450, color: 16571766, intensity: 0.9, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16571766, intensity: 0, time: 300 },
        ],
      },
      {
        name: "hit",
        light: [
          { attenuationBegin: 100, attenuationEnd: 300, color: 16760576, intensity: 0.7, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 300, color: 16760576, intensity: 0, time: 400 },
        ],
      },
    ],
    bcsh: [],
  },
  smoky_m3: {
    criticalHitSize: 375,
    criticalHitTexture: "effects/smoky/critical_hit" as ResourceId,
    explosionMarkTexture: "effects/smoky/explosion_mark" as ResourceId,
    explosionSize: 300,
    explosionSound: "sounds/smoky/explosion" as ResourceId,
    explosionTexture: "effects/smoky/explosion/m3" as ResourceId,
    shotSound: "sounds/smoky/shot" as ResourceId,
    shotTexture: "effects/smoky/shot" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 150, attenuationEnd: 450, color: 16571766, intensity: 0.9, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16571766, intensity: 0, time: 300 },
        ],
      },
      {
        name: "hit",
        light: [
          { attenuationBegin: 100, attenuationEnd: 300, color: 16760576, intensity: 0.7, time: 0 },
          { attenuationBegin: 100, attenuationEnd: 300, color: 16760576, intensity: 0, time: 400 },
        ],
      },
    ],
    bcsh: [],
  },
  thunder_m0: {
    explosionMarkTexture: "effects/thunder/explosion_mark" as ResourceId,
    explosionSize: 1000,
    explosionSound: "sounds/thunder/explosion" as ResourceId,
    explosionTexture: "effects/thunder/explosion/m0" as ResourceId,
    shotSound: "sounds/thunder/shot" as ResourceId,
    shotTexture: "effects/thunder/shot" as ResourceId,
    lighting: [
      {
        name: "hit",
        light: [
          { attenuationBegin: 200, attenuationEnd: 800, color: 16741656, intensity: 0.8, time: 0 },
          { attenuationBegin: 200, attenuationEnd: 800, color: 16741656, intensity: 0, time: 700 },
        ],
      },
      {
        name: "shot",
        light: [
          { attenuationBegin: 100, attenuationEnd: 500, color: 16741656, intensity: 0.9, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16741656, intensity: 0, time: 250 },
        ],
      },
      { name: "shellLightAnimation", light: [{ attenuationBegin: 100, attenuationEnd: 350, color: 16741656, intensity: 0.5, time: 0 }] },
    ],
    bcsh: [],
  },
  thunder_m1: {
    explosionMarkTexture: "effects/thunder/explosion_mark" as ResourceId,
    explosionSize: 1000,
    explosionSound: "sounds/thunder/explosion" as ResourceId,
    explosionTexture: "effects/thunder/explosion/m1" as ResourceId,
    shotSound: "sounds/thunder/shot" as ResourceId,
    shotTexture: "effects/thunder/shot" as ResourceId,
    lighting: [
      {
        name: "hit",
        light: [
          { attenuationBegin: 200, attenuationEnd: 800, color: 16741656, intensity: 0.8, time: 0 },
          { attenuationBegin: 200, attenuationEnd: 800, color: 16741656, intensity: 0, time: 700 },
        ],
      },
      {
        name: "shot",
        light: [
          { attenuationBegin: 100, attenuationEnd: 500, color: 16741656, intensity: 0.9, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16741656, intensity: 0, time: 250 },
        ],
      },
      { name: "shellLightAnimation", light: [{ attenuationBegin: 100, attenuationEnd: 350, color: 16741656, intensity: 0.5, time: 0 }] },
    ],
    bcsh: [],
  },
  thunder_m2: {
    explosionMarkTexture: "effects/thunder/explosion_mark" as ResourceId,
    explosionSize: 1000,
    explosionSound: "sounds/thunder/explosion" as ResourceId,
    explosionTexture: "effects/thunder/explosion/m2" as ResourceId,
    shotSound: "sounds/thunder/shot" as ResourceId,
    shotTexture: "effects/thunder/shot" as ResourceId,
    lighting: [
      {
        name: "hit",
        light: [
          { attenuationBegin: 200, attenuationEnd: 800, color: 16741656, intensity: 0.8, time: 0 },
          { attenuationBegin: 200, attenuationEnd: 800, color: 16741656, intensity: 0, time: 700 },
        ],
      },
      {
        name: "shot",
        light: [
          { attenuationBegin: 100, attenuationEnd: 500, color: 16741656, intensity: 0.9, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16741656, intensity: 0, time: 250 },
        ],
      },
      { name: "shellLightAnimation", light: [{ attenuationBegin: 100, attenuationEnd: 350, color: 16741656, intensity: 0.5, time: 0 }] },
    ],
    bcsh: [],
  },
  thunder_m3: {
    explosionMarkTexture: "effects/thunder/explosion_mark" as ResourceId,
    explosionSize: 1000,
    explosionSound: "sounds/thunder/explosion" as ResourceId,
    explosionTexture: "effects/thunder/explosion/m3" as ResourceId,
    shotSound: "sounds/thunder/shot" as ResourceId,
    shotTexture: "effects/thunder/shot" as ResourceId,
    lighting: [
      {
        name: "hit",
        light: [
          { attenuationBegin: 200, attenuationEnd: 800, color: 16741656, intensity: 0.8, time: 0 },
          { attenuationBegin: 200, attenuationEnd: 800, color: 16741656, intensity: 0, time: 700 },
        ],
      },
      {
        name: "shot",
        light: [
          { attenuationBegin: 100, attenuationEnd: 500, color: 16741656, intensity: 0.9, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 16741656, intensity: 0, time: 250 },
        ],
      },
      { name: "shellLightAnimation", light: [{ attenuationBegin: 100, attenuationEnd: 350, color: 16741656, intensity: 0.5, time: 0 }] },
    ],
    bcsh: [],
  },
  twins_m0: {
    explosionTexture: "effects/twins/explosion" as ResourceId,
    hitMarkTexture: "effects/twins/hit_mark" as ResourceId,
    muzzleFlashTexture: "effects/twins/muzzle_flash" as ResourceId,
    shotSound: "sounds/twins/shot" as ResourceId,
    shotTexture: "effects/twins/shot" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 300, attenuationEnd: 500, color: 65535, intensity: 0.3, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 65535, intensity: 0, time: 300 },
        ],
      },
      { name: "bullet", light: [{ attenuationBegin: 100, attenuationEnd: 300, color: 65535, intensity: 0.5, time: 0 }] },
      {
        name: "hit",
        light: [
          { attenuationBegin: 200, attenuationEnd: 400, color: 65535, intensity: 0.3, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 65535, intensity: 0, time: 300 },
        ],
      },
    ],
    bcsh: [
      { brightness: 0, contrast: 0, saturation: 0, hue: 0, key: "flash" },
      { brightness: 0, contrast: 0, saturation: 0, hue: 0, key: "shot" },
      { brightness: 0, contrast: 0, saturation: 0, hue: 0, key: "expl" },
    ],
  },
  twins_m1: {
    explosionTexture: "effects/twins/explosion" as ResourceId,
    hitMarkTexture: "effects/twins/hit_mark" as ResourceId,
    muzzleFlashTexture: "effects/twins/muzzle_flash" as ResourceId,
    shotSound: "sounds/twins/shot" as ResourceId,
    shotTexture: "effects/twins/shot" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 300, attenuationEnd: 500, color: 6700287, intensity: 0.3, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 6700287, intensity: 0, time: 300 },
        ],
      },
      { name: "bullet", light: [{ attenuationBegin: 100, attenuationEnd: 300, color: 6700287, intensity: 0.5, time: 0 }] },
      {
        name: "hit",
        light: [
          { attenuationBegin: 200, attenuationEnd: 400, color: 6700287, intensity: 0.3, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 6700287, intensity: 0, time: 300 },
        ],
      },
    ],
    bcsh: [
      { brightness: 0, contrast: 0, saturation: 0, hue: 46.19, key: "flash" },
      { brightness: 0, contrast: 0, saturation: 0, hue: 46.19, key: "shot" },
      { brightness: 0, contrast: 0, saturation: 0, hue: 46.19, key: "expl" },
    ],
  },
  twins_m2: {
    explosionTexture: "effects/twins/explosion" as ResourceId,
    hitMarkTexture: "effects/twins/hit_mark" as ResourceId,
    muzzleFlashTexture: "effects/twins/muzzle_flash" as ResourceId,
    shotSound: "sounds/twins/shot" as ResourceId,
    shotTexture: "effects/twins/shot" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 300, attenuationEnd: 500, color: 7694305, intensity: 0.3, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 7694305, intensity: 0, time: 300 },
        ],
      },
      { name: "bullet", light: [{ attenuationBegin: 100, attenuationEnd: 300, color: 14742338, intensity: 0.5, time: 0 }] },
      {
        name: "hit",
        light: [
          { attenuationBegin: 200, attenuationEnd: 400, color: 14742338, intensity: 0.3, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 14742338, intensity: 0, time: 300 },
        ],
      },
    ],
    bcsh: [
      { brightness: 30.465, contrast: 2.655, saturation: -17.699, hue: 73.27, key: "flash" },
      { brightness: 30.465, contrast: 2.655, saturation: -8.85, hue: 226.19, key: "shot" },
      { brightness: 30.465, contrast: 2.655, saturation: -8.85, hue: 226.19, key: "expl" },
    ],
  },
  twins_m3: {
    explosionTexture: "effects/twins/explosion" as ResourceId,
    hitMarkTexture: "effects/twins/hit_mark" as ResourceId,
    muzzleFlashTexture: "effects/twins/muzzle_flash" as ResourceId,
    shotSound: "sounds/twins/shot" as ResourceId,
    shotTexture: "effects/twins/shot" as ResourceId,
    lighting: [
      {
        name: "shot",
        light: [
          { attenuationBegin: 300, attenuationEnd: 500, color: 7241215, intensity: 0.3, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 7241215, intensity: 0, time: 300 },
        ],
      },
      { name: "bullet", light: [{ attenuationBegin: 100, attenuationEnd: 300, color: 65280, intensity: 0.5, time: 0 }] },
      {
        name: "hit",
        light: [
          { attenuationBegin: 200, attenuationEnd: 400, color: 65280, intensity: 0.3, time: 0 },
          { attenuationBegin: 1, attenuationEnd: 2, color: 65280, intensity: 0, time: 300 },
        ],
      },
    ],
    bcsh: [
      { brightness: 10.155, contrast: 1.77, saturation: -17.699, hue: 73.27, key: "flash" },
      { brightness: 10.155, contrast: 1.77, saturation: -8.85, hue: 297.88, key: "shot" },
      { brightness: 10.155, contrast: 1.77, saturation: -8.85, hue: 297.88, key: "expl" },
    ],
  },
};
