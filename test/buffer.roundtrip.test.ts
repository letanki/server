import assert from "node:assert/strict";
import { test } from "node:test";

import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";

import * as ChatPackets from "@/features/chat/chat.packets";
import * as ProfilePackets from "@/features/profile/profile.packets";
import * as BattlePackets from "@/features/battle/battle.packets";
import * as QuestsPackets from "@/features/quests/quests.packets";
import { PacketService } from "@/packets/packet.service";

// These tests pin the exact wire format produced by BufferWriter / consumed by
// BufferReader, so the planned BufferWriter rewrite can be verified byte-stable.

test("every default-constructable packet is write/read/write symmetric", () => {
    const ps = new PacketService();
    const map = (ps as any).packets as Map<number, new () => any>;
    const failures: string[] = [];

    for (const [id, Cls] of map) {
        let first: Buffer;
        try {
            first = new Cls().write();
        } catch {
            continue; // requires constructor args or has side effects; skip
        }
        let decoded: any;
        try {
            decoded = new Cls();
            decoded.read(first);
        } catch {
            continue; // read() intentionally unsupported (server-to-client only); skip
        }
        try {
            const second: Buffer = decoded.write();
            if (second.toString("hex") !== first.toString("hex")) {
                failures.push(`${Cls.name} (${id}): write/read/write mismatch`);
            }
        } catch (e: any) {
            failures.push(`${Cls.name} (${id}): re-write failed: ${e.message}`);
        }
    }

    assert.equal(failures.length, 0, "asymmetric packets:\n" + failures.join("\n"));
});

test("primitive integers round-trip", () => {
    const w = new BufferWriter();
    w.writeUInt8(200);
    w.writeInt8(-50);
    w.writeInt16BE(-12345);
    w.writeInt32BE(1234567890);
    w.writeResource(987654);

    const r = new BufferReader(w.getBuffer());
    assert.equal(r.readUInt8(), 200);
    assert.equal(r.readInt8(), -50);
    assert.equal(r.readInt16BE(), -12345);
    assert.equal(r.readInt32BE(), 1234567890);
    assert.equal(r.readResource(), 987654);
    assert.equal(r.hasRemaining, false);
});

test("float round-trips exactly for float32-representable values", () => {
    const w = new BufferWriter();
    w.writeFloatBE(1.5);
    w.writeFloatBE(-2.25);
    const r = new BufferReader(w.getBuffer());
    assert.equal(r.readFloatBE(), 1.5);
    assert.equal(r.readFloatBE(), -2.25);
});

test("optional string: value (with multibyte), null, and empty", () => {
    const w = new BufferWriter();
    w.writeOptionalString("Olá-世界");
    w.writeOptionalString(null);
    w.writeOptionalString("");
    const r = new BufferReader(w.getBuffer());
    assert.equal(r.readOptionalString(), "Olá-世界");
    assert.equal(r.readOptionalString(), null);
    assert.equal(r.readOptionalString(), "");
});

test("string arrays round-trip (optional + plain + empty)", () => {
    const w = new BufferWriter();
    w.writeOptionalStringArray(["a", "bb", "ccc"]);
    w.writeOptionalStringArray([]); // empty -> reads back as []
    w.writeStringArray(["x", "y"]);
    const r = new BufferReader(w.getBuffer());
    assert.deepEqual(r.readStringArray(), ["a", "bb", "ccc"]);
    assert.deepEqual(r.readStringArray(), []);
    assert.deepEqual(r.readStringArray(), ["x", "y"]);
});

test("int16 array round-trips", () => {
    const w = new BufferWriter();
    w.writeInt16Array([1, -2, 300, -32768]);
    const r = new BufferReader(w.getBuffer());
    assert.deepEqual(r.readInt16Array(), [1, -2, 300, -32768]);
});

test("optional vector3 and vector3 array round-trip", () => {
    const w = new BufferWriter();
    w.writeOptionalVector3({ x: 1.5, y: -2.5, z: 0 });
    w.writeOptionalVector3(null);
    w.writeVector3Array([{ x: 1, y: 2, z: 3 }, null]);
    const r = new BufferReader(w.getBuffer());
    assert.deepEqual(r.readOptionalVector3(), { x: 1.5, y: -2.5, z: 0 });
    assert.equal(r.readOptionalVector3(), null);
    assert.deepEqual(r.readVector3Array(), [{ x: 1, y: 2, z: 3 }, null]);
});

test("writer grows past initial capacity (large payload)", () => {
    const big = "x".repeat(5000);
    const w = new BufferWriter();
    w.writeInt32BE(42);
    w.writeOptionalString(big);
    for (let i = 0; i < 1000; i++) w.writeInt16BE(i);

    const r = new BufferReader(w.getBuffer());
    assert.equal(r.readInt32BE(), 42);
    assert.equal(r.readOptionalString(), big);
    for (let i = 0; i < 1000; i++) assert.equal(r.readInt16BE(), i);
    assert.equal(r.hasRemaining, false);
});

test("ChatProperties packet round-trips (exercises int16 minWord + arrays)", () => {
    const original = new ChatPackets.ChatProperties({
        admin: false,
        antifloodEnabled: true,
        bufferSize: 60,
        chatEnabled: true,
        chatModeratorLevel: 0,
        linksWhiteList: ["example.com"],
        minChar: 60,
        minWord: 5,
        selfName: "Tester",
        showLinks: true,
        typingSpeedAntifloodEnabled: true,
    });

    const decoded = new ChatPackets.ChatProperties();
    decoded.read(original.write());

    assert.deepEqual(JSON.parse(JSON.stringify(decoded)), JSON.parse(JSON.stringify(original)));
});

test("RankNotifierData packet round-trips (rank as uint8)", () => {
    const original = new ProfilePackets.RankNotifierData(30, "Danlino");
    const decoded = new ProfilePackets.RankNotifierData();
    decoded.read(original.write());
    assert.equal(decoded.rank, 30);
    assert.equal(decoded.nickname, "Danlino");
});

test("UpdateBattleUserDMPacket round-trips (deaths/kills int16, score int32)", () => {
    const original = new BattlePackets.UpdateBattleUserDMPacket({ deaths: 3, kills: 7, score: 12345, nickname: "Danlino" });
    const decoded = new BattlePackets.UpdateBattleUserDMPacket();
    decoded.read(original.write());
    assert.equal(decoded.deaths, 3);
    assert.equal(decoded.kills, 7);
    assert.equal(decoded.score, 12345);
    assert.equal(decoded.nickname, "Danlino");
});

test("UserConnectDMPacket round-trips with nested user list", () => {
    const original = new BattlePackets.UserConnectDMPacket("Danlino", [
        { ChatModeratorLevel: 0, deaths: 2, kills: 5, rank: 15, score: 300, nickname: "Danlino" },
        { ChatModeratorLevel: 1, deaths: 0, kills: 0, rank: 30, score: 0, nickname: "Dan" },
    ]);
    const decoded = new BattlePackets.UserConnectDMPacket(null, []);
    decoded.read(original.write());
    assert.equal(decoded.nickname, "Danlino");
    assert.equal(decoded.usersInfo.length, 2);
    assert.deepEqual(decoded.usersInfo[0], { ChatModeratorLevel: 0, deaths: 2, kills: 5, rank: 15, score: 300, nickname: "Danlino" });
    assert.equal(decoded.usersInfo[1].nickname, "Dan");
});

test("BonusRegionsPacket round-trips with lists + inline vec3 objects", () => {
    const original = new BattlePackets.BonusRegionsPacket({
        bonusRegionResources: [{ bonusResource: 12345, bonusType: 1 }, { bonusResource: 678, bonusType: 3 }],
        bonusRegionData: [{ position: { x: 1.5, y: 2.5, z: -3.5 }, rotation: { x: 0, y: 0.25, z: 1 }, bonusType: 2 }],
    });
    const decoded = new BattlePackets.BonusRegionsPacket();
    decoded.read(original.write());
    assert.deepEqual(decoded.bonusRegionResources, original.bonusRegionResources);
    assert.deepEqual(decoded.bonusRegionData, original.bonusRegionData);
});

test("InitDomPointsPacket round-trips with point list (optVector3 + stringArray)", () => {
    const original = new BattlePackets.InitDomPointsPacket({
        keypointTriggerRadius: 10, keypointVisorHeight: 500, minesRestrictionRadius: 5,
        points: [{ id: 1, name: "A", position: { x: 1.5, y: 0, z: -2.5 }, score: 0.5, scoreChangeRate: 0, state: 2, tankIds: ["Danlino", "Dan"] }],
        bigLetters: 100, blueCircle: 101, bluePedestalTexture: 102, blueRay: 103, blueRayTip: 104,
        neutralCircle: 105, neutralPedestalTexture: 106, pedestal: 107, redCircle: 108, redPedestalTexture: 109,
        redRay: 110, redRayTip: 111, pointCaptureStartNegativeSound: 112, pointCaptureStartPositiveSound: 113,
        pointCaptureStopNegativeSound: 114, pointCaptureStopPositiveSound: 115, pointCapturedNegativeSound: 116,
        pointCapturedPositiveSound: 117, pointNeutralizedNegativeSound: 118, pointNeutralizedPositiveSound: 119,
        pointScoreDecreasingSound: 120, pointScoreIncreasingSound: 121,
    } as any);
    const decoded = new BattlePackets.InitDomPointsPacket();
    decoded.read(original.write());
    assert.equal(decoded.points.length, 1);
    assert.deepEqual(decoded.points[0].position, { x: 1.5, y: 0, z: -2.5 });
    assert.deepEqual(decoded.points[0].tankIds, ["Danlino", "Dan"]);
    assert.equal(decoded.pointScoreIncreasingSound, 121);
    assert.equal(decoded.bigLetters, 100);
});

test("ShowQuestsWindow round-trips with nested list (quests -> prizes)", () => {
    const original = new QuestsPackets.ShowQuestsWindow();
    original.quests = [
        { canSkipForFree: true, description: "Kill 10", finishCriteria: 10, image: 555,
          prizes: [{ itemCount: 100, itemName: "crystal" }, { itemCount: 1, itemName: "premium" }],
          progress: 3, questId: 42, skipCost: 50 },
    ];
    original.currentQuestLevel = 2;
    original.currentQuestStreak = 1;
    original.doneForToday = false;
    original.questImage = 777;
    original.rewardImage = 888;

    const decoded = new QuestsPackets.ShowQuestsWindow();
    decoded.read(original.write());
    assert.equal(decoded.quests.length, 1);
    assert.deepEqual(decoded.quests[0].prizes, original.quests[0].prizes);
    assert.equal(decoded.quests[0].questId, 42);
    assert.equal(decoded.rewardImage, 888);
});

test("ChatHistory round-trips with optObject source/target (present + null)", () => {
    const original = new ChatPackets.ChatHistory([
        { source: { moderatorLevel: 1, ip: "1.2.3.4", rank: 15, uid: "Danlino" }, isSystem: false, target: null, message: "hi", isWarning: false },
        { source: null, isSystem: true, target: { moderatorLevel: 0, ip: null, rank: 30, uid: "Dan" }, message: "sys", isWarning: true },
    ]);
    const decoded = new ChatPackets.ChatHistory();
    decoded.read(original.write());
    assert.equal(decoded.messages.length, 2);
    assert.deepEqual(decoded.messages[0].source, { moderatorLevel: 1, ip: "1.2.3.4", rank: 15, uid: "Danlino" });
    assert.equal(decoded.messages[0].target, null);
    assert.equal(decoded.messages[1].source, null);
    assert.deepEqual(decoded.messages[1].target, { moderatorLevel: 0, ip: null, rank: 30, uid: "Dan" });
    assert.equal(decoded.messages[1].message, "sys");
});

// Byte-exact checks against known-good wire data captured from the real client,
// validating the declarative schema engine (not just read==write symmetry).
test("schema packets match reference wire bytes exactly", () => {
    assert.equal(
        new ProfilePackets.RankNotifierData(30, "S.E.F").write().toString("hex"),
        "1e0000000005532e452e46"
    );
    assert.equal(
        new ProfilePackets.OnlineNotifierData(true, 1, "S.E.F").write().toString("hex"),
        "01000000010000000005532e452e46"
    );
    assert.equal(
        new ProfilePackets.ClanNotifierData("S.E.F").write().toString("hex"),
        "00010000000005532e452e46"
    );
    assert.equal(
        new BattlePackets.UpdateBattleUserDMPacket({ deaths: 0, kills: 0, score: 0, nickname: "Danlino" }).write().toString("hex"),
        "0000000000000000000000000744616e6c696e6f"
    );
});

test("InitBattleUsersDMPacket round-trips (deaths/kills int32, rank uint8)", () => {
    const users = [
        { chatModeratorLevel: 0, deaths: 1, kills: 2, rank: 15, score: 100, uid: "Danlino" },
        { chatModeratorLevel: 0, deaths: 0, kills: 0, rank: 30, score: 0, uid: "Dan" },
    ];
    const original = new BattlePackets.InitBattleUsersDMPacket(users);
    const decoded = new BattlePackets.InitBattleUsersDMPacket();
    decoded.read(original.write());
    assert.equal(decoded.users.length, 2);
    assert.equal(decoded.users[0].rank, 15);
    assert.equal(decoded.users[0].uid, "Danlino");
    assert.equal(decoded.users[1].deaths, 0);
    assert.equal(decoded.users[1].uid, "Dan");
});
