import { UserDocument } from "@/shared/models/user.model";
import logger from "@/utils/logger";
import { itemBlueprints } from "./garage.data";

export class GarageService {
    public async purchaseItem(user: UserDocument, fullItemId: string, quantity: number, expectedPrice: number): Promise<{ newExperience: number } | void> {
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
                user.supplies.set(baseId, currentCount + quantity);
                await user.save();
                logger.info(`User ${user.username} bought ${quantity}x supply ${baseId} (now ${currentCount + quantity}).`);
                return;
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
                if (!user.paints.includes(baseId)) throw new Error("Você não possui esta pintura.");
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

        itemBlueprints.paints.forEach((paintBlueprint) => {
            const userHasPaint = userInventory.paints?.includes(paintBlueprint.id);
            const formattedPaint = formatPaint(paintBlueprint);
            if (userHasPaint) {
                garageItems.push(formattedPaint);
            } else {
                shopItems.push(formattedPaint);
            }
        });

        const userSupplies: Map<string, number> | undefined = userInventory.supplies;
        const formatSupply = (supply: any, count?: number) => ({
            id: supply.id,
            name: supply.name,
            description: supply.description,
            isInventory: true,
            index: supply.index,
            next_price: supply.price,
            next_rank: supply.rank,
            type: supply.type,
            baseItemId: supply.idlow,
            previewResourceId: supply.idlow,
            rank: supply.rank,
            category: "inventory",
            properts: [],
            discount: { percent: 0, timeLeftInSeconds: -1751196680, timeToStartInSeconds: -1751196680 },
            grouped: false,
            isForRent: false,
            price: supply.price,
            remainingTimeInSec: -1,
            ...(count !== undefined ? { count } : {}),
        });

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

        return undefined;
    }
}