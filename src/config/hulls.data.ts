// Unified hull config: ONE source of truth per hull modification — garage/shop catalog +
// display stats + movement physics (the TankModelData fields the original server sends). Resource ids
// (preview/model) are derived as hull/<id>/m<mod>/{preview,model}. Movement-physics fields are
// optional: when absent the battle workflow falls back to the old formula (uncaptured mods).
import { ResourceManager } from "@/utils/resource.manager";

export interface HullModConfig {
    rank: number; price: number; nextPrice: number; nextRank: number;
    // display stats (shown in the garage)
    armor: number; speed: number; turnSpeed: number; acceleration: number;
    // physics (from the captured TankModelData; mass also used as the displayed mass)
    mass: number;
    reverseAcceleration?: number; sideAcceleration?: number;
    turnAcceleration?: number; reverseTurnAcceleration?: number; dampingCoeff?: number;
}

export interface HullConfig {
    id: string; name: string; description: string; category: string; index: number; type: number;
    mods: HullModConfig[]; // index === modificationID
}

export const hullsData: HullConfig[] = [
    {
        id: "wasp", name: "Vespa", category: "armor", index: 700, type: 2,
        description: "Leve, econômico, fácil de operar — Vespa é uma carroceria perfeito para iniciantes. Vespa atualizado pode atingir uma alta velocidade, que em combinação com tamanho pequeno dá liberdade de ação no campo de batalha. Devido ao baixo peso, Vespa pode ser facilmente enrolado pelo tiro de um inimigo.",
        mods: [
            { rank: 2, price: 200, nextPrice: 7650, nextRank: 9, armor: 94, speed: 10.8, turnSpeed: 93.9, acceleration: 9.4, mass: 1376 },
            { rank: 9, price: 7650, nextPrice: 62450, nextRank: 16, armor: 121, speed: 11, turnSpeed: 100.84, acceleration: 9.87, mass: 1483, reverseAcceleration: 13.74, sideAcceleration: 18.12, turnAcceleration: 3.04, reverseTurnAcceleration: 5.21, dampingCoeff: 900 },
            { rank: 16, price: 62450, nextPrice: 172600, nextRank: 24, armor: 149, speed: 12, turnSpeed: 123.76, acceleration: 11.33, mass: 1817, reverseAcceleration: 15.26, sideAcceleration: 20.87, turnAcceleration: 3.25, reverseTurnAcceleration: 5.79, dampingCoeff: 900 },
            { rank: 24, price: 172600, nextPrice: 0, nextRank: 24, armor: 180, speed: 13, turnSpeed: 150, acceleration: 13, mass: 2200, reverseAcceleration: 17, sideAcceleration: 24, turnAcceleration: 3.490658503988659, reverseTurnAcceleration: 6.457718232379019, dampingCoeff: 900 },
        ],
    },
    {
        id: "hornet", name: "Zangão", category: "armor", index: 750, type: 2,
        description: "Esta carrocería compacta utilização de materiais compósitos de última geração, o que o torna leve, rápido e garante alta capacidade de sobrevivência mesmo após um golpe direto. Zangão é perfeito para ataques rápidos.",
        mods: [
            { rank: 5, price: 500, nextPrice: 21000, nextRank: 12, armor: 122, speed: 10, turnSpeed: 90.8, acceleration: 10.4, mass: 1409, reverseAcceleration: 16.38, sideAcceleration: 12.8, turnAcceleration: 2.82, reverseTurnAcceleration: 3.85, dampingCoeff: 1250 },
            { rank: 12, price: 21000, nextPrice: 86600, nextRank: 19, armor: 154, speed: 10.7, turnSpeed: 105.2, acceleration: 11.7, mass: 1774, reverseAcceleration: 18.83, sideAcceleration: 15.09, turnAcceleration: 2.88, reverseTurnAcceleration: 4.49, dampingCoeff: 1250 },
            { rank: 19, price: 86600, nextPrice: 215500, nextRank: 27, armor: 187, speed: 11.5, turnSpeed: 119.7, acceleration: 13.1, mass: 2139, reverseAcceleration: 21.26, sideAcceleration: 17.37, turnAcceleration: 2.93, reverseTurnAcceleration: 5.13, dampingCoeff: 1250 },
            { rank: 27, price: 215500, nextPrice: 0, nextRank: 27, armor: 210, speed: 12, turnSpeed: 130, acceleration: 14, mass: 2400, reverseAcceleration: 23, sideAcceleration: 19, turnAcceleration: 2.9670597283903604, reverseTurnAcceleration: 5.585053606381854, dampingCoeff: 1250 },
        ],
    },
    {
        id: "hunter", name: "Caçador", category: "armor", index: 800, type: 2,
        description: "Caçador é a carroceria mais versátil do jogo. Graças ao equilíbrio entre placas de armadura de aço reforçadas e baixo consumo de energia, esta armadura é para todos os fins. É boa para todos, de velocistas a atiradores. Sendo tão versátil, você nunca fique sem emprego em um campo de guerra.",
        mods: [
            { rank: 1, price: 0, nextPrice: 3200, nextRank: 8, armor: 144, speed: 8, turnSpeed: 75.8, acceleration: 9.6, mass: 1700, reverseAcceleration: 10, sideAcceleration: 8.5, turnAcceleration: 2.09, reverseTurnAcceleration: 3.32, dampingCoeff: 1500 },
            { rank: 8, price: 3200, nextPrice: 54400, nextRank: 15, armor: 187, speed: 8.6, turnSpeed: 95.3, acceleration: 11, mass: 2096, reverseAcceleration: 12.43, sideAcceleration: 10.78, turnAcceleration: 2.31, reverseTurnAcceleration: 3.79, dampingCoeff: 1500 },
            { rank: 15, price: 54400, nextPrice: 158300, nextRank: 23, armor: 230, speed: 9.2, turnSpeed: 114.9, acceleration: 12.3, mass: 2491, reverseAcceleration: 14.87, sideAcceleration: 13.07, turnAcceleration: 2.52, reverseTurnAcceleration: 4.27, dampingCoeff: 1500 },
            { rank: 23, price: 158300, nextPrice: 0, nextRank: 23, armor: 285, speed: 10, turnSpeed: 140, acceleration: 14, mass: 3000, reverseAcceleration: 18, sideAcceleration: 16, turnAcceleration: 2.792526803190927, reverseTurnAcceleration: 4.886921905584122, dampingCoeff: 1500 },
        ],
    },
    {
        id: "dictator", name: "Ditador", category: "armor", index: 850, type: 2,
        description: "Devido ao sistema de defesa ativo aprimorado e ao uso dos mais novos materiais compostos, esta blindagem absorve efetivamente a energia de um impacto de quase qualquer arma de calibre. Com o Dictator, você pode lutar na linha de frente de qualquer batalha. Sendo um dos cascos mais rápidos e protegidos no jogo, o Ditador é grande, o que o torna um alvo fácil.",
        mods: [
            { rank: 4, price: 400, nextPrice: 16550, nextRank: 11, armor: 188, speed: 7, turnSpeed: 89, acceleration: 10.9, mass: 2170, reverseAcceleration: 12.04, sideAcceleration: 9.04, turnAcceleration: 1.81, reverseTurnAcceleration: 3.41, dampingCoeff: 2500 },
            { rank: 11, price: 16550, nextPrice: 78550, nextRank: 18, armor: 243, speed: 7.3, turnSpeed: 103.3, acceleration: 12.3, mass: 2722 },
            { rank: 18, price: 78550, nextPrice: 201200, nextRank: 26, armor: 298, speed: 7.7, turnSpeed: 117.7, acceleration: 13.8, mass: 2961, reverseAcceleration: 16.91, sideAcceleration: 13.91, turnAcceleration: 2.13, reverseTurnAcceleration: 4.69, dampingCoeff: 2500 },
            { rank: 26, price: 201200, nextPrice: 0, nextRank: 26, armor: 345, speed: 8, turnSpeed: 130, acceleration: 15, mass: 3300, reverseAcceleration: 19, sideAcceleration: 16, turnAcceleration: 2.2689280275926285, reverseTurnAcceleration: 5.235987755982989, dampingCoeff: 2500 },
        ],
    },
    {
        id: "viking", name: "Viking", category: "armor", index: 900, type: 2,
        description: "Esta blindagem incorpora todas as tecnologias militares modernas. A blindagem reforçada e o motor «Tipo 2» fazem do Viking uma das carrocerias mais versáteis. Ataque o inimigo ou cubra seus companheiros de equipe – esta carroceria provará ser bom e confiável em qualquer situação.",
        mods: [
            { rank: 7, price: 700, nextPrice: 29900, nextRank: 14, armor: 195, speed: 7.8, turnSpeed: 80.6, acceleration: 11.5, mass: 2039, reverseAcceleration: 14.09, sideAcceleration: 10.61, turnAcceleration: 2.28, reverseTurnAcceleration: 3.16, dampingCoeff: 2000 },
            { rank: 14, price: 29900, nextPrice: 102700, nextRank: 21, armor: 244, speed: 8.3, turnSpeed: 92.7, acceleration: 12.6, mass: 2435, reverseAcceleration: 16.52, sideAcceleration: 13.65, turnAcceleration: 2.49, reverseTurnAcceleration: 3.58, dampingCoeff: 2000 },
            { rank: 21, price: 102700, nextPrice: 244200, nextRank: 29, armor: 294, speed: 8.8, turnSpeed: 104.8, acceleration: 14.4, mass: 2830, reverseAcceleration: 18.96, sideAcceleration: 16.7, turnAcceleration: 2.7, reverseTurnAcceleration: 4.01, dampingCoeff: 2000 },
            { rank: 29, price: 244200, nextPrice: 0, nextRank: 29, armor: 315, speed: 9, turnSpeed: 110, acceleration: 15, mass: 3000, reverseAcceleration: 20, sideAcceleration: 18, turnAcceleration: 2.792526803190927, reverseTurnAcceleration: 4.1887902047863905, dampingCoeff: 2000 },
        ],
    },
    {
        id: "titan", name: "Titã", category: "armor", index: 950, type: 2,
        description: "Placas de armadura de liga Titan combinadas com geometria especial tornam esta carroceria altamente eficaz mesmo contra armas de grande calibre. Com o Titan, você pode mergulhar no meio de uma batalha sem qualquer hesitação. Observe que, devido à baixa velocidade, esta carroceria não é adequado para ataques rápidos atrás das linhas inimigas.",
        mods: [
            { rank: 3, price: 300, nextPrice: 12100, nextRank: 10, armor: 224, speed: 5.3, turnSpeed: 55.7, acceleration: 11.7, mass: 3571 },
            { rank: 10, price: 12100, nextPrice: 70500, nextRank: 17, armor: 289, speed: 5.5, turnSpeed: 67.1, acceleration: 13.1, mass: 3783, reverseAcceleration: 12.13, sideAcceleration: 13.91, turnAcceleration: 1.39, reverseTurnAcceleration: 3.34, dampingCoeff: 2100 },
            { rank: 17, price: 70500, nextPrice: 187000, nextRank: 25, armor: 355, speed: 5.8, turnSpeed: 78.6, acceleration: 14.6, mass: 4391, reverseAcceleration: 14.57, sideAcceleration: 16.96, turnAcceleration: 1.65, reverseTurnAcceleration: 3.76, dampingCoeff: 2100 },
            { rank: 25, price: 187000, nextPrice: 0, nextRank: 25, armor: 420, speed: 6, turnSpeed: 90, acceleration: 16, mass: 5000, reverseAcceleration: 17, sideAcceleration: 20, turnAcceleration: 1.9198621771937625, reverseTurnAcceleration: 4.1887902047863905, dampingCoeff: 2100 },
        ],
    },
    {
        id: "mammoth", name: "Mamute", category: "armor", index: 1000, type: 2,
        description: "Este não é um tanque - é uma fortaleza sobre trilhos. Mamute é o carro-chefe entre outras carrocerias. Extremamente pesado, reforçado com superconcreto este casco é lento, o que não impede o Mamute de lutar com sucesso contra vários tanques inimigos.",
        mods: [
            { rank: 6, price: 600, nextPrice: 25450, nextRank: 13, armor: 297, speed: 4.4, turnSpeed: 54, acceleration: 11.3, mass: 3935, reverseAcceleration: 8.09, sideAcceleration: 17.17, turnAcceleration: 1.36, reverseTurnAcceleration: 2.81, dampingCoeff: 2000 },
            { rank: 13, price: 25450, nextPrice: 94650, nextRank: 20, armor: 376, speed: 4.6, turnSpeed: 64.1, acceleration: 12.7, mass: 4543, reverseAcceleration: 9.61, sideAcceleration: 20.22, turnAcceleration: 1.49, reverseTurnAcceleration: 3.07, dampingCoeff: 2000 },
            { rank: 20, price: 94650, nextPrice: 229900, nextRank: 28, armor: 455, speed: 4.9, turnSpeed: 74.2, acceleration: 14.2, mass: 5152, reverseAcceleration: 11.13, sideAcceleration: 23.26, turnAcceleration: 1.65, reverseTurnAcceleration: 3.34, dampingCoeff: 2000 },
            { rank: 28, price: 229900, nextPrice: 0, nextRank: 28, armor: 500, speed: 5, turnSpeed: 80, acceleration: 15, mass: 5500, reverseAcceleration: 12, sideAcceleration: 25, turnAcceleration: 1.7453292519943295, reverseTurnAcceleration: 3.490658503988659, dampingCoeff: 2000 },
        ],
    },
];

const byId = new Map(hullsData.map((h) => [h.id, h]));

/** A hull modification's full config (movement physics etc.), keyed like the battle workflow does. */
export function getHullMod(baseId: string, modId: number): HullModConfig | undefined {
    return byId.get(baseId)?.mods[modId];
}

/**
 * Adapts a HullConfig to the legacy garage "blueprint" shape (resource accessors + the `properts`
 * stat rows the client renders). Keeps garage.service/item.utils working unchanged off a single
 * source. Resource ids are derived: hull/<id>/m<mod>/{preview,model}.
 */
export function toHullBlueprint(h: HullConfig) {
    return {
        id: h.id, name: h.name, description: h.description, category: h.category, index: h.index, type: h.type,
        baseItemId: () => ResourceManager.getIdlowById(`hull/${h.id}/m0/preview` as any),
        modifications: h.mods.map((m, modId) => ({
            modificationID: modId,
            next_price: m.nextPrice,
            next_rank: m.nextRank,
            previewResourceId: () => ResourceManager.getIdlowById(`hull/${h.id}/m${modId}/preview` as any),
            rank: m.rank,
            price: m.price,
            object3ds: () => ResourceManager.getIdlowById(`hull/${h.id}/m${modId}/model` as any),
            properts: [
                { property: "HULL_ARMOR", value: String(m.armor), subproperties: null },
                { property: "HULL_SPEED", value: String(m.speed), subproperties: null },
                { property: "HULL_TURN_SPEED", value: String(m.turnSpeed), subproperties: null },
                { property: "HULL_MASS", value: String(m.mass), subproperties: null },
                { property: "HULL_POWER", value: null, subproperties: [{ property: "HULL_ACCELERATION", value: String(m.acceleration), subproperties: null }] },
            ],
        })),
    };
}
