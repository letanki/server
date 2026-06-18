/**
 * Stress test: spins up N bot clients that create/login accounts, join the
 * "Batalha para Novatos" battle, and spam movement + turret-rotation commands as
 * fast as possible. Runs OUTSIDE the server (talks raw TCP), e.g. `npm run stress`.
 *
 * Env: STRESS_HOST (127.0.0.1), STRESS_PORT (PORT|1337), STRESS_BOTS (5),
 *      STRESS_BATTLE ("Batalha para Novatos"), STRESS_RATE_MS (25), STRESS_PASSWORD.
 */
import * as net from "net";

const HOST = process.env.STRESS_HOST || "127.0.0.1";
const PORT = Number(process.env.STRESS_PORT || process.env.PORT || 1337);
const BOTS = Number(process.env.STRESS_BOTS || 5);
const BATTLE_NAME = process.env.STRESS_BATTLE || "Batalha para Novatos";
const RATE_MS = Number(process.env.STRESS_RATE_MS || 25);
const PASSWORD = process.env.STRESS_PASSWORD || "stress123";
const DEBUG = process.env.STRESS_DEBUG === "1";

const HEADER = 8;
const KEY_LENGTH = 8, DECRYPT_XOR = 87, MASK = 7;

const ID = {
    PROTECTION: 2001736388,
    SET_LANG: -1864333717,
    CREATE_ACCOUNT: 427083290,
    PING: -555602629, PONG: 1484572481,
    BATTLE_PING: 34068208, BATTLE_PONG: 2074243318,
    LOAD_DEPS: -1797047325, DEPS_LOADED: -82304134,
    ON_RESOURCE_LOADED: -1282173466,
    NEXT_TIP: -1376947245,
    BATTLE_ITEMS: 552006706,
    SELECT_BATTLE: 2092412133,
    ENTER_BATTLE: -1284211503,
    END_LAYOUT_SWITCH: -593368100,
    PREPARE_SPAWN: -157204477,
    SPAWN: 875259457,
    READY_TO_SPAWN: 268832557,
    READY_TO_PLACE: -1378839846,
    READY_TO_ACTIVATE: 1178028365,
    MOVE: 329279865,
    ROTATE_TURRET: -114968993,
    MOVE_CONTROL: -1749108178,
};

// ---- tiny encoder ----
class W {
    private parts: Buffer[] = [];
    u8(v: number) { this.parts.push(Buffer.from([v & 0xff])); return this; }
    i8(v: number) { const b = Buffer.alloc(1); b.writeInt8(v, 0); this.parts.push(b); return this; }
    i16(v: number) { const b = Buffer.alloc(2); b.writeInt16BE(v, 0); this.parts.push(b); return this; }
    i32(v: number) { const b = Buffer.alloc(4); b.writeInt32BE(v, 0); this.parts.push(b); return this; }
    f32(v: number) { const b = Buffer.alloc(4); b.writeFloatBE(v, 0); this.parts.push(b); return this; }
    str(s: string | null) { if (s == null) { this.u8(1); return this; } this.u8(0); const sb = Buffer.from(s, "utf8"); this.i32(sb.length); this.parts.push(sb); return this; }
    vec3(x: number, y: number, z: number) { this.u8(0).f32(x).f32(y).f32(z); return this; }
    buf(): Buffer { return Buffer.concat(this.parts); }
}

// ---- client-side cipher (mirror of the server with swapped keys) ----
class Cipher {
    private encKeys: number[]; // used to DECRYPT server->client (mirror of server encrypt_keys)
    private decKeys: number[]; // used to ENCRYPT client->server (mirror of server decrypt_keys)
    private encPos = 0; // for decrypting
    private decPos = 0; // for encrypting

    constructor(keyList: number[]) {
        const base = keyList.reduce((a, k) => a ^ k, 0);
        this.encKeys = []; this.decKeys = [];
        for (let i = 0; i < KEY_LENGTH; i++) {
            const key = base ^ (i << 3);
            this.encKeys[i] = key;
            this.decKeys[i] = key ^ DECRYPT_XOR;
        }
    }

    encrypt(plain: Buffer): Buffer {
        const out = Buffer.alloc(plain.length);
        for (let i = 0; i < plain.length; i++) {
            const c = (this.decKeys[this.decPos] & 0xff) ^ plain[i];
            this.decKeys[this.decPos] ^= c;
            this.decPos ^= this.decKeys[this.decPos] & MASK;
            out[i] = c;
        }
        return out;
    }

    decrypt(cipher: Buffer): Buffer {
        const out = Buffer.alloc(cipher.length);
        for (let i = 0; i < cipher.length; i++) {
            const p = (cipher[i] ^ this.encKeys[this.encPos]) & 0xff;
            this.encKeys[this.encPos] = p;
            this.encPos ^= p & MASK;
            out[i] = p;
        }
        return out;
    }
}

function readOptString(b: Buffer, o: { p: number }): string | null {
    const isNull = b.readUInt8(o.p); o.p += 1;
    if (isNull === 1) return null;
    const len = b.readInt32BE(o.p); o.p += 4;
    const s = b.toString("utf8", o.p, o.p + len); o.p += len;
    return s;
}

class Bot {
    private socket: net.Socket;
    private cipher: Cipher | null = null;
    private inbuf = Buffer.alloc(0);
    private gotProtection = false;
    private loggedIn = false;
    private inBattle = false;
    private spawnReq = false;
    private placeReq = false;
    private activateReq = false;
    private firstPacketLogged = false;
    private spamTimer: NodeJS.Timeout | null = null;
    private t = 0;
    private angle = 0;
    private sent = 0;

    constructor(public name: string) {
        this.socket = net.connect({ host: HOST, port: PORT }, () => log(`${name}: connected`));
        this.socket.on("data", (d) => this.onData(d));
        this.socket.on("error", (e) => log(`${name}: socket error ${e.message}`));
        this.socket.on("close", () => { if (this.spamTimer) clearInterval(this.spamTimer); log(`${name}: closed (sent ${this.sent} cmds)`); });
    }

    private send(id: number, body: Buffer): void {
        const payload = this.cipher ? this.cipher.encrypt(body) : body;
        const frame = Buffer.alloc(HEADER + payload.length);
        frame.writeInt32BE(frame.length, 0);
        frame.writeInt32BE(id, 4);
        payload.copy(frame, HEADER);
        this.socket.write(frame);
    }

    private onData(data: Buffer): void {
        this.inbuf = Buffer.concat([this.inbuf, data]);
        while (this.inbuf.length >= HEADER) {
            const size = this.inbuf.readInt32BE(0);
            if (size < HEADER || this.inbuf.length < size) break;
            const id = this.inbuf.readInt32BE(4);
            const rawBody = this.inbuf.subarray(HEADER, size);
            const body = this.gotProtection && this.cipher ? this.cipher.decrypt(Buffer.from(rawBody)) : Buffer.from(rawBody);
            this.inbuf = this.inbuf.subarray(size);
            try { this.handle(id, body); } catch (e: any) { log(`${this.name}: handle ${id} err ${e.message}`); }
        }
    }

    private handle(id: number, body: Buffer): void {
        if (!this.firstPacketLogged) { this.firstPacketLogged = true; log(`${this.name}: first packet id=${id} size=${body.length} (expected Protection=${ID.PROTECTION})`); }
        if (DEBUG) log(`${this.name}: <- id=${id} size=${body.length}`);
        if (!this.gotProtection && id === ID.PROTECTION) {
            const len = body.readInt32BE(0);
            const keys: number[] = [];
            for (let i = 0; i < len; i++) keys.push(body.readInt8(4 + i));
            this.cipher = new Cipher(keys);
            this.gotProtection = true;
            // Set language; the account is created/logged in only once the login form is
            // ready (after OnResourceLoaded), mirroring the real client.
            this.send(ID.SET_LANG, new W().str("pt_BR").buf());
            log(`${this.name}: protection ok, sent SetLang (waiting for login form)`);
            return;
        }
        switch (id) {
            case ID.PING:
                this.send(ID.PONG, Buffer.alloc(0));
                break;
            case ID.BATTLE_PING: {
                const serverTime = body.length >= 4 ? body.readInt32BE(0) : 0;
                this.send(ID.BATTLE_PONG, new W().i32(this.t).i32(serverTime).buf());
                break;
            }
            case ID.LOAD_DEPS: {
                const o = { p: 0 };
                readOptString(body, o); // json
                const cb = body.readInt32BE(o.p);
                this.send(ID.DEPS_LOADED, new W().i32(cb).buf());
                break;
            }
            case ID.ON_RESOURCE_LOADED:
                if (!this.loggedIn) {
                    this.loggedIn = true;
                    this.send(ID.CREATE_ACCOUNT, new W().str(this.name).str(PASSWORD).u8(0).buf());
                    log(`${this.name}: login form ready -> sent CreateAccount (${this.name}/${PASSWORD})`);
                }
                break;
            case ID.NEXT_TIP:
                break;
            case ID.BATTLE_ITEMS:
                this.onBattleList(body);
                break;
            // Reactive spawn handshake (mirrors the real client's order).
            case ID.END_LAYOUT_SWITCH:
                if (this.inBattle && !this.spawnReq) { this.spawnReq = true; this.send(ID.READY_TO_SPAWN, Buffer.alloc(0)); log(`${this.name}: -> ReadyToSpawn`); }
                break;
            case ID.PREPARE_SPAWN:
                if (!this.placeReq) { this.placeReq = true; this.send(ID.READY_TO_PLACE, Buffer.alloc(0)); log(`${this.name}: -> ReadyToPlace`); }
                break;
            case ID.SPAWN:
                if (!this.activateReq) { this.activateReq = true; this.send(ID.READY_TO_ACTIVATE, Buffer.alloc(0)); log(`${this.name}: spawned -> ReadyToActivate, starting spam`); this.startSpam(); }
                break;
        }
    }

    private onBattleList(body: Buffer): void {
        if (this.inBattle) return;
        const o = { p: 0 };
        const json = readOptString(body, o);
        if (!json) return;
        let parsed: any;
        try { parsed = JSON.parse(json); } catch { return; }
        const battle = (parsed.battles || []).find((b: any) => b.name === BATTLE_NAME);
        if (!battle) { log(`${this.name}: battle "${BATTLE_NAME}" not found in list`); return; }
        this.inBattle = true;
        log(`${this.name}: joining ${battle.battleId} (${battle.name})`);
        this.send(ID.SELECT_BATTLE, new W().str(battle.battleId).buf());
        this.send(ID.ENTER_BATTLE, new W().i32(1).buf());
        // Spawn is driven reactively from server packets (EndLayoutSwitch -> PrepareSpawn -> Spawn).
    }

    private startSpam(): void {
        if (this.spamTimer) return;
        log(`${this.name}: START spamming move/turret every ${RATE_MS}ms`);
        this.spamTimer = setInterval(() => this.spamOnce(), RATE_MS);
    }

    private spamOnce(): void {
        this.t += RATE_MS;
        this.angle = (this.angle + 0.4) % (Math.PI * 2);
        const inc = 1; // incarnation
        const control = (this.t % 200 < 100) ? 1 : 4; // toggle forward / turn bits

        // Move: spin the hull in place (rotating orientation, small angular velocity).
        this.send(ID.MOVE, new W()
            .i32(this.t).i16(inc)
            .vec3(0, 0, 2)            // angularVelocity (spin)
            .i8(control)
            .vec3(0, 0, 0)           // linearVelocity
            .vec3(0, 0, this.angle)  // orientation
            .vec3(0, 0, 100)         // position
            .buf());

        // Rotate turret continuously.
        this.send(ID.ROTATE_TURRET, new W().i32(this.t).f32(this.angle).i8(control).i16(inc).buf());

        // Control state (pressed keys bitmask) — the relayed input.
        this.send(ID.MOVE_CONTROL, new W().i32(this.t).i16(1).i8(control).buf());

        this.sent += 3;
    }
}

function log(msg: string) { console.log(`[${new Date().toISOString().slice(11, 23)}] ${msg}`); }

log(`Stress test: ${BOTS} bots -> ${HOST}:${PORT}, battle "${BATTLE_NAME}", rate ${RATE_MS}ms`);
const stamp = Date.now().toString(36).slice(-5);
for (let i = 0; i < BOTS; i++) {
    setTimeout(() => new Bot(`stress${stamp}${i}`), i * 400); // stagger connections (alphanumeric-only usernames)
}

process.on("SIGINT", () => { log("stopping"); process.exit(0); });
