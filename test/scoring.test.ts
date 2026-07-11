import assert from "node:assert";
import { test } from "node:test";
import {
    killScore,
    killFlagCarrierScore,
    assistShares,
    deliverFlagShares,
    returnFlagScore,
    pointCaptureScore,
} from "@/features/battle/scoring";

// ---- Kill (8/10 pelo casco da vítima) ----
test("killScore: cascos leves rendem 8, os demais 10", () => {
    assert.equal(killScore("wasp"), 8);
    assert.equal(killScore("hornet"), 8);
    assert.equal(killScore("wasp_m2"), 8); // com modificação
    for (const h of ["hunter", "viking", "dictator", "titan", "mammoth"]) {
        assert.equal(killScore(h), 10, `${h} deveria render 10`);
    }
});

// ---- Matar portador (dobro do kill: 16–20) ----
test("killFlagCarrierScore: dobro do kill normal", () => {
    assert.equal(killFlagCarrierScore("wasp"), 16);
    assert.equal(killFlagCarrierScore("hunter"), 20);
});

// ---- Assistências (15 proporcional ao dano) ----
test("assistShares: divide 15 proporcional ao dano", () => {
    const shares = assistShares(new Map([["a", 50], ["b", 30], ["c", 20]]));
    assert.equal(shares.get("a"), 7.5);
    assert.equal(shares.get("b"), 4.5);
    assert.equal(shares.get("c"), 3);
    // soma = 15
    assert.equal([...shares.values()].reduce((s, v) => s + v, 0), 15);
});

test("assistShares: um único atacante leva os 15", () => {
    const shares = assistShares(new Map([["solo", 137]]));
    assert.equal(shares.get("solo"), 15);
});

test("assistShares: dano total zero → vazio", () => {
    assert.equal(assistShares(new Map([["a", 0]])).size, 0);
    assert.equal(assistShares(new Map()).size, 0);
});

// ---- Entregar bandeira (10 × enemy, split 50/20/30) ----
test("deliverFlagShares: split 50/20/30 (enemy=5, total 50)", () => {
    const s = deliverFlagShares(5, { capturers: ["cap"], baseTakers: ["bt"], carriers: ["c1"] });
    assert.equal(s.get("cap"), 25);
    assert.equal(s.get("bt"), 10);
    assert.equal(s.get("c1"), 15);
});

test("deliverFlagShares: papéis acumuláveis (capturador também tirou da base)", () => {
    const s = deliverFlagShares(5, { capturers: ["x"], baseTakers: ["x"], carriers: [] });
    assert.equal(s.get("x"), 35); // 25 + 10
});

test("deliverFlagShares: papel rateado entre vários (3 carregadores dividem 15)", () => {
    const s = deliverFlagShares(5, { capturers: ["cap"], baseTakers: [], carriers: ["a", "b", "c"] });
    assert.equal(s.get("a"), 5);
    assert.equal(s.get("b"), 5);
    assert.equal(s.get("c"), 5);
    assert.equal(s.get("cap"), 25);
});

// ---- Retornar bandeira (0..5 × enemy por segmento) ----
test("returnFlagScore: segmento pela posição entre as bases (enemy=5)", () => {
    const between = 6000, enemy = 5;
    assert.equal(returnFlagScore(0, between, enemy), 0); // junto da base própria
    assert.equal(returnFlagScore(1000, between, enemy), 5); // seg 1
    assert.equal(returnFlagScore(3000, between, enemy), 15); // seg 3
    assert.equal(returnFlagScore(6000, between, enemy), 25); // junto da base inimiga (seg 5, cap)
    assert.equal(returnFlagScore(5999, between, enemy), 25); // ainda seg 5
});

test("returnFlagScore: distância inválida → 0", () => {
    assert.equal(returnFlagScore(100, 0, 5), 0);
});

// ---- Capturar ponto CP (2 × enemy dividido entre aliados no ponto) ----
test("pointCaptureScore: 2×enemy dividido entre aliados no ponto", () => {
    assert.equal(pointCaptureScore(5, 2), 5); // 10 / 2
    assert.equal(pointCaptureScore(5, 1), 10); // 10 / 1
    assert.equal(pointCaptureScore(3, 3), 2); // 6 / 3
    assert.equal(pointCaptureScore(5, 0), 0); // ninguém no ponto
});
