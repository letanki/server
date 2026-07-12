import { UserDocument } from "@/shared/models/user.model";
import logger from "@/utils/logger";
import { ResourceManager } from "@/utils/resource.manager";
import { itemBlueprints, supplyPreviewResources, passPreviewResources, passPriceForRank, PREMIUM_PAINT_IDS } from "./garage.data";
import { isActive, isPremiumActive, secondsLeft } from "@/shared/models/passes";

export class GarageService {
    private static readonly EQUIP_COOLDOWN_MS = 15 * 60 * 1000; // 15 min per equipment category (re-arm battles)
    // userId -> per-category cooldown-end epoch ms (armor=hull, weapon=turret, color=paint). Kept in
    // server memory so it SURVIVES a client disconnect/reconnect ("close & reopen the game" keeps the
    // cooldown); cleared only when the player EXPLICITLY leaves a battle ("leave & return" resets it).
    private readonly equipCooldowns = new Map<string, { armor?: number; weapon?: number; color?: number }>();

    /** The re-arm cooldown key for an item id: "armor" (hull) / "weapon" (turret) / "color" (paint), or null. */
    public equipCooldownKey(fullItemId: string): "armor" | "weapon" | "color" | null {
        const { baseId } = this._parseItemId(fullItemId);
        const cat = this._findItemBlueprint(baseId)?.category;
        return cat === "armor" ? "armor" : cat === "weapon" ? "weapon" : cat === "paint" ? "color" : null;
    }

    /** Remaining equip cooldown for a category, in whole seconds (0 = ready). */
    public getEquipCooldownSec(userId: string, key: "armor" | "weapon" | "color"): number {
        const end = this.equipCooldowns.get(userId)?.[key];
        return end ? Math.max(0, Math.ceil((end - Date.now()) / 1000)) : 0;
    }

    /** Arms the 15-min cooldown for a category after an equip change (re-arm battles only). */
    public startEquipCooldown(userId: string, key: "armor" | "weapon" | "color"): void {
        const entry = this.equipCooldowns.get(userId) ?? {};
        entry[key] = Date.now() + GarageService.EQUIP_COOLDOWN_MS;
        this.equipCooldowns.set(userId, entry);
    }

    /** Clears every equip cooldown for a user — called ONLY on an explicit battle leave (not on disconnect). */
    public clearEquipCooldowns(userId: string): void {
        this.equipCooldowns.delete(userId);
    }

    public async purchaseItem(user: UserDocument, fullItemId: string, quantity: number, expectedPrice: number): Promise<{ newExperience: number } | { supplyId: string; newCount: number; hadSuppliesBefore: boolean } | { passId: string } | void> {
        const { baseId, modification: clientRefMod } = this._parseItemId(fullItemId);
        const itemBlueprint = this._findItemBlueprint(baseId);

        if (!itemBlueprint) throw new Error("Item não encontrado.");

        let effectivePrice: number;
        let finalModId: number = 0;

        switch (itemBlueprint.category) {
            case "weapon":
            case "armor": {
                if (quantity !== 1) throw new Error("Equipamentos só podem ser comprados em quantidade de 1.");

                const inventoryMap = itemBlueprint.category === "weapon" ? user.turrets : user.hulls;
                const currentUserMod = inventoryMap.get(baseId);

                if (currentUserMod === undefined) {
                    if (clientRefMod !== 0) throw new Error("A primeira compra de um item deve ser a modificação M0.");
                    finalModId = 0;
                } else {
                    if (clientRefMod !== currentUserMod) throw new Error("Tentativa de upgrade para um item que não corresponde à sua modificação atual.");
                    finalModId = currentUserMod + 1;
                }

                const targetModData = itemBlueprint.modifications.find((m: any) => m.modificationID === finalModId);
                if (!targetModData) throw new Error("A próxima modificação para este item não está disponível.");

                if (user.rank < targetModData.rank) throw new Error("Rank insuficiente para comprar esta atualização.");

                effectivePrice = targetModData.price;
                if (effectivePrice !== expectedPrice) throw new Error("O preço do item não confere. Tente novamente.");
                if (user.crystals < effectivePrice) throw new Error("Cristais insuficientes.");

                user.crystals -= effectivePrice;
                inventoryMap.set(baseId, finalModId);
                break;
            }
            case "paint": {
                if (quantity !== 1) throw new Error("Pinturas só podem ser compradas em quantidade de 1.");
                if (user.rank < itemBlueprint.rank) throw new Error("Rank insuficiente para comprar este item.");

                effectivePrice = itemBlueprint.price;
                if (effectivePrice !== expectedPrice) throw new Error("O preço do item não confere. Tente novamente.");
                if (user.crystals < effectivePrice) throw new Error("Cristais insuficientes.");

                if (user.paints.includes(baseId)) throw new Error("Você já possui esta pintura.");

                user.crystals -= effectivePrice;
                user.paints.push(baseId);
                break;
            }
            case "inventory": {
                if (quantity < 1) throw new Error("Quantidade inválida.");
                if (user.rank < itemBlueprint.rank) throw new Error("Rank insuficiente para comprar este item.");

                const unitPrice = itemBlueprint.price;
                // The client may send either the unit price or the line total; accept both.
                if (expectedPrice !== unitPrice && expectedPrice !== unitPrice * quantity) {
                    throw new Error("O preço do item não confere. Tente novamente.");
                }

                const totalCost = unitPrice * quantity;
                if (user.crystals < totalCost) throw new Error("Cristais insuficientes.");
                user.crystals -= totalCost;

                if (itemBlueprint.instantScore) {
                    // Consumed instantly: grant experience instead of stacking, and report the new
                    // total so the handler can refresh the client's score with UpdateScore.
                    user.experience += itemBlueprint.instantScore * quantity;
                    await user.save();
                    logger.info(`User ${user.username} bought ${quantity}x ${baseId} (+${itemBlueprint.instantScore * quantity} XP).`);
                    return { newExperience: user.experience };
                }

                const currentCount = user.supplies.get(baseId) ?? 0;
                const hadSuppliesBefore = [...user.supplies.values()].some((c) => c > 0);
                const newCount = currentCount + quantity;
                user.supplies.set(baseId, newCount);
                await user.save();
                logger.info(`User ${user.username} bought ${quantity}x supply ${baseId} (now ${newCount}).`);
                return { supplyId: baseId, newCount, hadSuppliesBefore };
            }
            case "special": {
                // Passe/assinatura: ESTENDE a data de expiração no user (não empilha item).
                if (quantity !== 1) throw new Error("Passes só podem ser comprados em quantidade de 1.");
                if (itemBlueprint.price < 0) throw new Error("Este passe não está à venda.");
                if (user.rank < itemBlueprint.rank) throw new Error("Rank insuficiente para comprar este item.");

                // Preço escala pelo rank do comprador (pro_battle) quando há priceByRank.
                effectivePrice = passPriceForRank(itemBlueprint, user.rank);
                if (effectivePrice !== expectedPrice) throw new Error("O preço do item não confere. Tente novamente.");
                if (user.crystals < effectivePrice) throw new Error("Cristais insuficientes.");

                user.crystals -= effectivePrice;
                // Estende a partir do vencimento atual se ainda ativo, senão a partir de agora.
                const field = itemBlueprint.expiresField as "upScoreExpiresAt" | "premiumExpiresAt" | "newbieExpiresAt" | "proBattleExpiresAt" | "crystalAbonementExpiresAt";
                const current = user[field] as Date | null;
                const startFrom = current && current.getTime() > Date.now() ? current.getTime() : Date.now();
                user[field] = new Date(startFrom + itemBlueprint.durationMs);
                await user.save();
                logger.info(`User ${user.username} bought pass ${baseId} (${field} → ${user[field]?.toISOString()}).`);
                return { passId: baseId };
            }
            default:
                throw new Error("Tipo de item desconhecido ou não comprável.");
        }

        await user.save();
        logger.info(`User ${user.username} processed purchase for ${fullItemId}, resulting in M${finalModId} of ${baseId}.`);
    }

    public async equipItem(user: UserDocument, fullItemId: string): Promise<UserDocument> {
        const { baseId, modification } = this._parseItemId(fullItemId);
        const itemBlueprint = this._findItemBlueprint(baseId);

        if (!itemBlueprint) throw new Error("Item não encontrado.");

        switch (itemBlueprint.category) {
            case "weapon": {
                const userMod = user.turrets.get(baseId);
                if (userMod !== modification) throw new Error("Você não possui esta modificação para equipar.");
                user.equippedTurret = baseId;
                break;
            }
            case "armor": {
                const userMod = user.hulls.get(baseId);
                if (userMod !== modification) throw new Error("Você não possui esta modificação para equipar.");
                user.equippedHull = baseId;
                break;
            }
            case "paint": {
                // Pinturas premium não ficam em `user.paints`: só podem ser equipadas com premium ATIVO.
                if (PREMIUM_PAINT_IDS.has(baseId)) {
                    if (!isPremiumActive(user)) throw new Error("Esta pintura requer assinatura premium ativa.");
                } else if (!user.paints.includes(baseId)) {
                    throw new Error("Você não possui esta pintura.");
                }
                user.equippedPaint = baseId;
                break;
            }
            default:
                throw new Error("Este item não pode ser equipado.");
        }

        logger.info(`User ${user.username} equipped ${fullItemId}`);
        return await user.save();
    }

    public buildGarageData(userInventory: any) {
        const garageItems: any[] = [];
        const shopItems: any[] = [];

        const allItems = [...itemBlueprints.turrets, ...itemBlueprints.hulls];

        const formatItem = (item: any, modification: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            isInventory: false,
            index: item.index,
            next_price: modification.next_price,
            next_rank: modification.next_rank,
            type: item.type,
            baseItemId: item.baseItemId(),
            previewResourceId: modification.previewResourceId(),
            rank: modification.rank,
            category: item.category,
            properts: modification.properts,
            discount: { percent: 0, timeLeftInSeconds: -1751196680, timeToStartInSeconds: -1751196680 },
            grouped: false,
            isForRent: false,
            price: modification.price,
            remainingTimeInSec: -1,
            modificationID: modification.modificationID,
            object3ds: modification.object3ds(),
        });

        allItems.forEach((itemBlueprint) => {
            const userModification = userInventory[itemBlueprint.id] ?? -1;
            itemBlueprint.modifications.forEach((mod) => {
                const formattedItem = formatItem(itemBlueprint, mod);
                if (mod.modificationID === userModification) {
                    garageItems.push(formattedItem);
                } else {
                    shopItems.push(formattedItem);
                }
            });
        });

        const formatPaint = (paint: any) => ({
            ...paint,
            baseItemId: paint.baseItemId(),
            previewResourceId: paint.previewResourceId(),
            coloring: paint.coloring(),
        });

        const premiumActive = isActive(userInventory.premiumExpiresAt);
        const premiumSecs = secondsLeft(userInventory.premiumExpiresAt);
        itemBlueprints.paints.forEach((paintBlueprint) => {
            const formattedPaint = formatPaint(paintBlueprint);
            // Pintura premium: não é comprável nem fica em `user.paints`. Só aparece no DEPÓSITO enquanto o
            // premium está ativo, mostrando o tempo restante do premium; expirado, some (nem vai ao mercado).
            if (PREMIUM_PAINT_IDS.has(paintBlueprint.id)) {
                if (premiumActive) garageItems.push({ ...formattedPaint, remainingTimeInSec: premiumSecs });
                return;
            }
            const userHasPaint = userInventory.paints?.includes(paintBlueprint.id);
            if (userHasPaint) {
                garageItems.push(formattedPaint);
            } else {
                shopItems.push(formattedPaint);
            }
        });

        const userSupplies: Map<string, number> | undefined = userInventory.supplies;
        const formatSupply = (supply: any, count?: number) => {
            const previewIdLow = ResourceManager.getIdlowById(supplyPreviewResources[supply.id]);
            return {
            id: supply.id,
            name: supply.name,
            description: supply.description,
            isInventory: true,
            index: supply.index,
            next_price: supply.price,
            next_rank: supply.rank,
            type: supply.type,
            baseItemId: previewIdLow,
            previewResourceId: previewIdLow,
            rank: supply.rank,
            category: "inventory",
            properts: [],
            discount: { percent: 0, timeLeftInSeconds: -1751196680, timeToStartInSeconds: -1751196680 },
            grouped: false,
            isForRent: false,
            price: supply.price,
            remainingTimeInSec: -1,
            ...(count !== undefined ? { count } : {}),
            };
        };

        (itemBlueprints as any).supplies.forEach((supply: any) => {
            const count = supply.instantScore ? 0 : userSupplies?.get(supply.id) ?? 0;
            // Same rule as weapons/paints: owned (count > 0) → depot with a `count`; otherwise it
            // sits in the market with no count. "1000_scores" is consumed instantly so it never
            // stacks and always stays in the market.
            if (count > 0) {
                garageItems.push(formatSupply(supply, count));
            } else {
                shopItems.push(formatSupply(supply));
            }
        });

        // Passes/assinaturas (category "special", type 5): ATIVO → depósito com o tempo restante;
        // senão → mercado. A expiração vem no userInventory (ver garage.workflow).
        (itemBlueprints as any).passes?.forEach((pass: any) => {
            const expiresAt: Date | null | undefined = userInventory[pass.expiresField];
            const ms = expiresAt ? new Date(expiresAt).getTime() : 0;
            const active = ms > Date.now();
            // Preview served by OUR resource server (downloaded to resources/passes/<id>/preview) with
            // our own idLow — never the official 1140/1141/1136.
            const previewIdLow = ResourceManager.getIdlowById(passPreviewResources[pass.id]);
            // Preço pode escalar pelo rank do comprador (pro_battle: 139→9999). newbie mantém -1.
            const price = pass.price < 0 ? pass.price : passPriceForRank(pass, userInventory.rank ?? 1);
            const item = {
                id: pass.id,
                name: pass.name,
                description: pass.description,
                isInventory: true,
                index: pass.index,
                next_price: price,
                next_rank: pass.rank,
                type: pass.type,
                baseItemId: previewIdLow,
                previewResourceId: previewIdLow,
                rank: pass.rank,
                category: "special",
                properts: [],
                discount: { percent: 0, timeLeftInSeconds: -1751196680, timeToStartInSeconds: -1751196680 },
                grouped: false,
                isForRent: false,
                price,
                remainingTimeInSec: active ? Math.round((ms - Date.now()) / 1000) : -1,
            };
            // Active → depósito (com o tempo restante). Senão: só entra no mercado se for comprável
            // (price >= 0). O `newbie` (price -1) é concedido na criação da conta — nunca aparece no
            // mercado, só no depósito de quem o tem.
            if (active) garageItems.push(item);
            else if (pass.price >= 0) shopItems.push(item);
        });

        garageItems.sort((a, b) => a.index - b.index);
        shopItems.sort((a, b) => a.index - b.index || a.modificationID - b.modificationID);

        return { garageItems, shopItems };
    }

    private _parseItemId(fullItemId: string): { baseId: string; modification: number } {
        const parts = fullItemId.split("_m");
        const baseId = parts[0];
        const modification = parts.length > 1 ? parseInt(parts[1], 10) : 0;
        if (isNaN(modification)) {
            throw new Error(`Formato de ID de item inválido: ${fullItemId}`);
        }
        return { baseId, modification };
    }

    private _findItemBlueprint(baseId: string): any | undefined {
        const turret = itemBlueprints.turrets.find((i) => i.id === baseId);
        if (turret) return turret;

        const hull = itemBlueprints.hulls.find((i) => i.id === baseId);
        if (hull) return hull;

        const paint = itemBlueprints.paints.find((i) => i.id === baseId);
        if (paint) return paint;

        const supply = (itemBlueprints as any).supplies.find((i: any) => i.id === baseId);
        if (supply) return { ...supply, category: "inventory" };

        const pass = (itemBlueprints as any).passes?.find((i: any) => i.id === baseId);
        if (pass) return pass; // já traz category: "special"

        return undefined;
    }
}