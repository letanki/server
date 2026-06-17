import assert from "node:assert/strict";
import { test } from "node:test";

import { BufferReader } from "@/utils/buffer/buffer.reader";
import { BufferWriter } from "@/utils/buffer/buffer.writer";

import * as ChatPackets from "@/features/chat/chat.packets";
import * as ProfilePackets from "@/features/profile/profile.packets";
import * as BattlePackets from "@/features/battle/battle.packets";

// These tests pin the exact wire format produced by BufferWriter / consumed by
// BufferReader, so the planned BufferWriter rewrite can be verified byte-stable.

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
