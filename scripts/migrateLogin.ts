/**
 * One-off migration for the new `login` field (lowercase of `username`, the unique/indexed auth key).
 *
 *   ts-node -r tsconfig-paths/register scripts/migrateLogin.ts
 *
 * It first checks for case-insensitive COLLISIONS (e.g. "Dan" and "dan"): those can't both get the
 * same unique `login`, so the migration aborts and lists them for an admin to rename one. With no
 * collisions it backfills `login` for every user and creates the unique index.
 */
import "dotenv/config";
import { connectToDatabase, disconnectFromDatabase } from "../src/database";
import User from "../src/shared/models/user.model";

async function main(): Promise<void> {
    await connectToDatabase();

    const docs = await User.collection.find({}, { projection: { username: 1 } }).toArray();
    console.log(`Found ${docs.length} users.`);

    // Detect case-insensitive collisions on the desired login.
    const byLogin = new Map<string, string[]>();
    for (const d of docs) {
        const login = String(d.username).toLowerCase();
        const list = byLogin.get(login) ?? [];
        list.push(String(d.username));
        byLogin.set(login, list);
    }
    const collisions = [...byLogin.entries()].filter(([, names]) => names.length > 1);
    if (collisions.length) {
        console.error(`\nABORTED — ${collisions.length} case-insensitive username collision(s). Rename one of each, then re-run:`);
        for (const [login, names] of collisions) console.error(`  ${login}: ${names.join(", ")}`);
        await disconnectFromDatabase();
        process.exit(1);
    }

    // Backfill login on every user (raw, to skip hooks/validation).
    const ops = docs.map((d: any) => ({
        updateOne: { filter: { _id: d._id }, update: { $set: { login: String(d.username).toLowerCase() } } },
    }));
    if (ops.length) {
        const res = await User.collection.bulkWrite(ops);
        console.log(`Backfilled login on ${res.modifiedCount} users.`);
    }

    await User.collection.createIndex({ login: 1 }, { unique: true });
    console.log("Created unique index on { login: 1 }.");

    // Drop the now-redundant (case-sensitive) unique index on username, if it exists.
    try {
        await User.collection.dropIndex("username_1");
        console.log("Dropped old unique index username_1.");
    } catch {
        console.log("No old username_1 index to drop.");
    }

    await disconnectFromDatabase();
    console.log("Migration complete.");
}

main().catch(async (e) => {
    console.error("Migration failed:", e);
    await disconnectFromDatabase().catch(() => {});
    process.exit(1);
});
