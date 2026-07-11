import { UserDocument } from "@/shared/models/user.model";
import { isCrystalAbonementActive } from "@/shared/models/passes";

type PriceInfo = { price: number; currency: string };
type PricingData = Record<string, Record<string, PriceInfo>>;

const pricingData: PricingData = {
    BR: {
        premium_pack_1: { price: 3.59, currency: "BRL" },
        crystalls_pack_1: { price: 3.59, currency: "BRL" },
        crystalls_pack_2: { price: 7.69, currency: "BRL" },
        premium_pack_2: { price: 14.99, currency: "BRL" },
        crystalls_pack_3: { price: 22.99, currency: "BRL" },
        premium_pack_3: { price: 37.99, currency: "BRL" },
        crystalls_pack_4: { price: 47.99, currency: "BRL" },
        premium_pack_4: { price: 89.99, currency: "BRL" },
        crystalls_pack_5: { price: 89.99, currency: "BRL" },
        crystalls_pack_6: { price: 225.99, currency: "BRL" },
    },
    US: {
        premium_pack_1: { price: 0.99, currency: "USD" },
        crystalls_pack_1: { price: 0.99, currency: "USD" },
        crystalls_pack_2: { price: 1.99, currency: "USD" },
        premium_pack_2: { price: 3.99, currency: "USD" },
        crystalls_pack_3: { price: 5.99, currency: "USD" },
        premium_pack_3: { price: 9.99, currency: "USD" },
        crystalls_pack_4: { price: 12.99, currency: "USD" },
        premium_pack_4: { price: 24.99, currency: "USD" },
        crystalls_pack_5: { price: 24.99, currency: "USD" },
        crystalls_pack_6: { price: 59.99, currency: "USD" },
    },
};

export class ShopService {
    private getPriceInfo(itemId: string, countryCode: string): PriceInfo | null {
        const countryPrices = pricingData[countryCode.toUpperCase()] || pricingData["US"];
        return countryPrices[itemId] || null;
    }

    public getShopData(user: UserDocument, countryCode: string): string {
        const baseShopStructure = {
            categories: [
                {
                    category_id: "crystalls",
                    header_text: { RU: "Кристаллы", EN: "Crystals", pt_BR: "Cristais", UA: "Кристали" },
                    description: { RU: "Здесь вы можете купить кристаллы, чтобы использовать их для приобретения нужных вам вещей в гараже", EN: "This is where you can buy Crystals. They are to buy equipment in your garage.", pt_BR: "Aqui que você pode comprar Cristais. Eles são para comprar equipamentos em sua garagem.", UA: "Тут ви можете купити кристали, щоб використовувати їх для придбання потрібних вам речей у гаражі." },
                },
                {
                    category_id: "premium",
                    header_text: { RU: "Премиум аккаунт", EN: "Premuim Account", pt_BR: "Conta Premium", UA: "Преміум аккаунт" },
                    description: {
                        RU: "Приобретая премиум аккаунт, вы получаете целый ряд приемуществ - на 100 % больше кристаллов и на 50 % больше опыта за каждый бой, уникальную премиум краску, возможность создавать PRO битвы и принимать в них участие.",
                        EN: "Purchase as Premuim Account to unlock, a whole range of advantages. With Premuim, every battle will bring you double the crystals, and 50% more experience point. You'll also receive a unique Premium paint!",
                        pt_BR: "Compre Conta Premuim para desbloquear, toda uma gama de vantagens. Com o Premuim, cada batalha trará o dobro de cristais e 50% a mais de pontos de experiência. Você também receberá uma pintura Premium exclusiva!",
                        UA: "Придбаючи преміум аккаунт, ви отримуєте цілий ряд переваг - на 100% більше кристалів і на 50% більше досвіду за кожний бій, унікальну преміум фарбу, можливість створювати PRO битви та брати в них участь.",
                    },
                },
                { category_id: "other", header_text: { RU: "Другое", EN: "Others", pt_BR: "Outros", UA: "Інше" }, description: { RU: "Прочие товары", EN: "Miscellaneous staff", pt_BR: "Pessoal diverso", UA: "Інші товари" } },
            ],
            items: [
                { item_id: "promocodes", category_id: "other", additional_data: {} },
                { item_id: "premium_pack_1", category_id: "premium", additional_data: { premium_duration: 1 } },
                { item_id: "crystalls_pack_1", category_id: "crystalls", additional_data: { crystalls_count: 1500, premium_duration: 0, bonus_crystalls: 0 } },
                { item_id: "crystalls_pack_2", category_id: "crystalls", additional_data: { crystalls_count: 5000, premium_duration: 0, bonus_crystalls: 1250 } },
                { item_id: "premium_pack_2", category_id: "premium", additional_data: { premium_duration: 7 } },
                { item_id: "crystalls_pack_3", category_id: "crystalls", additional_data: { crystalls_count: 15000, premium_duration: 0, bonus_crystalls: 7500 } },
                { item_id: "premium_pack_3", category_id: "premium", additional_data: { premium_duration: 30 } },
                { item_id: "crystalls_pack_4", category_id: "crystalls", additional_data: { crystalls_count: 30000, premium_duration: 1, bonus_crystalls: 22500 } },
                { item_id: "premium_pack_4", category_id: "premium", additional_data: { premium_duration: 90 } },
                { item_id: "crystalls_pack_5", category_id: "crystalls", additional_data: { crystalls_count: 60000, premium_duration: 3, bonus_crystalls: 60000 } },
                { item_id: "crystalls_pack_6", category_id: "crystalls", additional_data: { crystalls_count: 150000, premium_duration: 7, bonus_crystalls: 225000 } },
            ],
        };

        const shopForCountry = JSON.parse(JSON.stringify(baseShopStructure));

        shopForCountry.items.forEach((item: any) => {
            if (item.item_id !== "promocodes") {
                const priceInfo = this.getPriceInfo(item.item_id, countryCode);
                if (priceInfo) {
                    item.additional_data.price = priceInfo.price;
                    item.additional_data.currency = priceInfo.currency;
                }
            }
        });

        const payload = {
            // Dobro de cristais nas DOAÇÕES (o cliente exibe os valores dobrados): ativo pelo perk
            // permanente ou pelo abonement temporizado.
            have_double_crystals: isCrystalAbonementActive(user),
            data: JSON.stringify(shopForCountry),
        };

        return JSON.stringify(payload);
    }
}