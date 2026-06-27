/**
 * Target dummies: spins up N bot clients that create/login accounts, join a battle and stand still as
 * shooting targets so you can test weapons (single- and multi-target) against live tanks. Unlike the
 * stress test, they DON'T spam movement — they spawn, "land" on the floor (the spawn point sits ~200u
 * above ground) and then hold position until you command them. Runs OUTSIDE the server (raw TCP).
 *
 *   npm run targets            # 5 dummies into "Batalha para Novatos"
 *   TARGETS_BOTS=8 npm run targets
 *
 * IN-BATTLE COMMANDS — type these in the battle CHAT (they start with "."). A "/" goes only to the
 * server; a "." is relayed as a normal chat line, so the bots hear it. The sender (you) is the anchor:
 *   .fila      line up in a row centred on you, perpendicular to your aim (great for spread/cone weapons)
 *   .vem       gather on top of you (cluster, for single-target testing)
 *   .spawn     walk back to their spawn points
 *   .parar     stop where they are
 *   .ajuda     one bot prints the command list to chat
 * Bots MOVE to the target (they don't teleport). Aliases: .alinhar=.fila, .voltar=.spawn, .stop=.parar.
 *
 * Env: TARGETS_HOST (127.0.0.1), TARGETS_PORT (PORT|1337), TARGETS_BOTS (5),
 *      TARGETS_BATTLE ("Batalha para Novatos"), TARGETS_PASSWORD, TARGETS_GAP (400 units between bots),
 *      TARGETS_SPEED (600 units/s), TARGETS_DEBUG (1).
 */
import * as net from "net";

const HOST = process.env.TARGETS_HOST || "127.0.0.1";
const PORT = Number(process.env.TARGETS_PORT || process.env.PORT || 1337);
const BOTS = Number(process.env.TARGETS_BOTS || 5);
const BATTLE_NAME = process.env.TARGETS_BATTLE || "Batalha para Novatos";
const PASSWORD = process.env.TARGETS_PASSWORD || "alvo123";
const GAP = Number(process.env.TARGETS_GAP || 400); // spacing between dummies when lining up
const SPEED = Number(process.env.TARGETS_SPEED || 600); // travel speed, units/second
const DEBUG = process.env.TARGETS_DEBUG === "1";

const TICK_MS = 50;               // movement tick
const IDLE_KEEPALIVE_MS = 1000;   // resend position this often while idle
const SPAWN_HEIGHT = 200;         // server places the spawn ~200u above the floor; we drop by this to land
const NAME_PREFIX = "alvo";

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
    KILL: -42520728,
    BATTLE_CHAT: 1259981343,
    FULL_MOVE: 1516578027,
    MOVE_RELAY: -64696933,
    TURRET_ROTATION: 1927704181,
};

interface Vec3 { x: number; y: number; z: number; }

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
    private encKeys: number[];
    private decKeys: number[];
    private encPos = 0;
    private decPos = 0;

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

function readOptVec3(b: Buffer, o: { p: number }): Vec3 | null {
    const isNull = b.readUInt8(o.p); o.p += 1;
    if (isNull === 1) return null;
    const x = b.readFloatBE(o.p); o.p += 4;
    const y = b.readFloatBE(o.p); o.p += 4;
    const z = b.readFloatBE(o.p); o.p += 4;
    return { x, y, z };
}

/** Shared view of every tank we've seen move, so any bot can anchor a command on the sender. */
interface TankInfo { pos: Vec3; hullYaw: number; turretYaw: number; }
const tracked = new Map<string, TankInfo>();
function trackPos(nick: string | null, pos: Vec3 | null, hullYaw?: number): void {
    if (!nick || !pos) return;
    const info = tracked.get(nick) ?? { pos, hullYaw: 0, turretYaw: 0 };
    info.pos = pos;
    if (hullYaw !== undefined) info.hullYaw = hullYaw;
    tracked.set(nick, info);
}
function trackTurret(nick: string | null, yaw: number): void {
    if (!nick) return;
    const info = tracked.get(nick);
    if (info) info.turretYaw = yaw;
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
    private active = false;
    private t = 0;
    private incarnation = 1;
    private sent = 0;
    private idleAccum = 0;

    private pos: Vec3 = { x: 0, y: 0, z: 0 };
    private home: Vec3 = { x: 0, y: 0, z: 0 };
    private homeYaw = 0;
    private target: Vec3 = { x: 0, y: 0, z: 0 };
    private yaw = 0;
    private moving = false;

    constructor(public name: string, private index: number) {
        this.socket = net.connect({ host: HOST, port: PORT }, () => log(`${name}: connected`));
        this.socket.on("data", (d) => this.onData(d));
        this.socket.on("error", (e) => log(`${name}: socket error ${e.message}`));
        this.socket.on("close", () => log(`${name}: closed (sent ${this.sent} cmds)`));
        setInterval(() => this.tick(), TICK_MS);
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
            try { this.handle(id, body); } catch (e: any) { if (DEBUG) log(`${this.name}: handle ${id} err ${e.message}`); }
        }
    }

    private handle(id: number, body: Buffer): void {
        if (DEBUG) log(`${this.name}: <- id=${id} size=${body.length}`);
        if (!this.gotProtection && id === ID.PROTECTION) {
            const len = body.readInt32BE(0);
            const keys: number[] = [];
            for (let i = 0; i < len; i++) keys.push(body.readInt8(4 + i));
            this.cipher = new Cipher(keys);
            this.gotProtection = true;
            this.send(ID.SET_LANG, new W().str("pt_BR").buf());
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
                readOptString(body, o);
                const cb = body.readInt32BE(o.p);
                this.send(ID.DEPS_LOADED, new W().i32(cb).buf());
                break;
            }
            case ID.ON_RESOURCE_LOADED:
                if (!this.loggedIn) {
                    this.loggedIn = true;
                    this.send(ID.CREATE_ACCOUNT, new W().str(this.name).str(PASSWORD).u8(0).buf());
                    log(`${this.name}: -> CreateAccount`);
                }
                break;
            case ID.BATTLE_ITEMS:
                this.onBattleList(body);
                break;
            case ID.END_LAYOUT_SWITCH:
                if (this.inBattle && !this.spawnReq) { this.spawnReq = true; this.send(ID.READY_TO_SPAWN, Buffer.alloc(0)); }
                break;
            case ID.PREPARE_SPAWN:
                this.onPrepareSpawn(body);
                break;
            case ID.SPAWN:
                this.onSpawn(body);
                break;
            case ID.KILL:
                this.onKill(body);
                break;
            case ID.BATTLE_CHAT:
                this.onChat(body);
                break;
            case ID.FULL_MOVE: {
                const o = { p: 0 };
                const nick = readOptString(body, o);
                readOptVec3(body, o);                 // angularVelocity
                o.p += 1;                             // control (i8)
                readOptVec3(body, o);                 // linearVelocity
                const orient = readOptVec3(body, o);  // orientation
                const pos = readOptVec3(body, o);     // position
                trackPos(nick, pos, orient?.z);
                break;
            }
            case ID.MOVE_RELAY: {
                const o = { p: 0 };
                const nick = readOptString(body, o);
                readOptVec3(body, o);                 // angularVelocity
                o.p += 1;                             // control (i8)
                readOptVec3(body, o);                 // linearVelocity
                const orient = readOptVec3(body, o);  // orientation
                const pos = readOptVec3(body, o);     // position
                trackPos(nick, pos, orient?.z);
                break;
            }
            case ID.TURRET_ROTATION: {
                const o = { p: 0 };
                const nick = readOptString(body, o);
                const angle = body.readFloatBE(o.p); o.p += 4;
                trackTurret(nick, angle);
                break;
            }
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
        if (!battle) { log(`${this.name}: battle "${BATTLE_NAME}" not found`); return; }
        this.inBattle = true;
        log(`${this.name}: joining ${battle.battleId} (${battle.name})`);
        this.send(ID.SELECT_BATTLE, new W().str(battle.battleId).buf());
        this.send(ID.ENTER_BATTLE, new W().i32(1).buf());
    }

    private onPrepareSpawn(body: Buffer): void {
        const o = { p: 0 };
        const position = readOptVec3(body, o);
        const rotation = readOptVec3(body, o);
        if (position) {
            // The spawn point is sent ~SPAWN_HEIGHT above the floor; our home is the landed spot below it.
            this.home = { x: position.x, y: position.y, z: position.z - SPAWN_HEIGHT };
            this.pos = { ...position };
            this.target = { ...this.home };
            this.moving = true;
        }
        if (rotation) { this.homeYaw = rotation.z; this.yaw = rotation.z; }
        if (!this.placeReq) { this.placeReq = true; this.send(ID.READY_TO_PLACE, Buffer.alloc(0)); }
    }

    private onSpawn(body: Buffer): void {
        const o = { p: 0 };
        const nick = readOptString(body, o);
        if (nick === this.name) {
            o.p += 4;                                 // team (i32)
            readOptVec3(body, o);                     // position
            readOptVec3(body, o);                     // orientation
            o.p += 2;                                 // health (i16)
            this.incarnation = body.readInt16BE(o.p); // incarnation (i16)
        }
        if (!this.activateReq) {
            this.activateReq = true;
            this.active = true;
            this.send(ID.READY_TO_ACTIVATE, Buffer.alloc(0));
            log(`${this.name}: spawned -> landing on the floor`);
        }
    }

    private onKill(body: Buffer): void {
        const o = { p: 0 };
        const victim = readOptString(body, o);
        readOptString(body, o);                       // killer
        const delay = body.readInt32BE(o.p);
        if (victim !== this.name) return;
        this.active = false;
        this.moving = false;
        // Respawn: re-arm the handshake and ask to spawn again after the death timer.
        setTimeout(() => {
            this.spawnReq = false; this.placeReq = false; this.activateReq = false;
            this.send(ID.READY_TO_SPAWN, Buffer.alloc(0));
        }, Math.max(0, delay) + 200);
    }

    private onChat(body: Buffer): void {
        const o = { p: 0 };
        const sender = readOptString(body, o);
        const message = readOptString(body, o);
        if (!message || !message.startsWith(".")) return;
        if (sender && sender.startsWith(NAME_PREFIX)) return; // ignore other bots
        this.runCommand(sender, message.slice(1).trim().toLowerCase());
    }

    private runCommand(sender: string | null, cmd: string): void {
        const anchor = sender ? tracked.get(sender) : undefined;
        switch (cmd) {
            case "fila":
            case "alinhar": {
                if (!anchor) { log(`${this.name}: don't know where ${sender} is yet (move a bit first)`); return; }
                const yaw = anchor.turretYaw || anchor.hullYaw || 0;
                const px = -Math.sin(yaw), py = Math.cos(yaw); // perpendicular to aim, in the ground plane
                const off = (this.index - (BOTS - 1) / 2) * GAP;
                this.setTarget({ x: anchor.pos.x + px * off, y: anchor.pos.y + py * off, z: anchor.pos.z });
                break;
            }
            case "vem":
            case "aqui": {
                if (!anchor) { log(`${this.name}: don't know where ${sender} is yet`); return; }
                // small ring so they don't perfectly overlap
                const a = (this.index / BOTS) * Math.PI * 2;
                this.setTarget({ x: anchor.pos.x + Math.cos(a) * 120, y: anchor.pos.y + Math.sin(a) * 120, z: anchor.pos.z });
                break;
            }
            case "spawn":
            case "voltar":
                this.setTarget({ ...this.home });
                break;
            case "parar":
            case "stop":
                this.target = { ...this.pos };
                this.moving = false;
                break;
            case "ajuda":
                if (this.index === 0) this.sayHelp(); // only one bot answers, to avoid spam
                break;
        }
    }

    private sayHelp(): void {
        // 945463181 = SendBattleChatMessage { message(string), team(bool) }
        const help = "Comandos: .fila  .vem  .spawn  .parar";
        this.send(945463181, new W().str(help).u8(0).buf());
    }

    private setTarget(t: Vec3): void {
        this.target = t;
        this.moving = true;
    }

    private tick(): void {
        if (!this.active) return;
        this.t += TICK_MS;

        if (this.moving) {
            const dx = this.target.x - this.pos.x;
            const dy = this.target.y - this.pos.y;
            const dz = this.target.z - this.pos.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const step = SPEED * (TICK_MS / 1000);
            if (dist <= step || dist < 1) {
                this.pos = { ...this.target };
                this.moving = false;
                this.sendMove(0, 0, 0);
            } else {
                const ux = dx / dist, uy = dy / dist, uz = dz / dist;
                this.pos = { x: this.pos.x + ux * step, y: this.pos.y + uy * step, z: this.pos.z + uz * step };
                if (Math.abs(dx) > 1 || Math.abs(dy) > 1) this.yaw = Math.atan2(dy, dx);
                this.sendMove(ux * SPEED, uy * SPEED, uz * SPEED);
            }
            this.idleAccum = 0;
        } else {
            // Idle keepalive so the server/clients keep us at the held position.
            this.idleAccum += TICK_MS;
            if (this.idleAccum >= IDLE_KEEPALIVE_MS) { this.idleAccum = 0; this.sendMove(0, 0, 0); }
        }
    }

    private sendMove(vx: number, vy: number, vz: number): void {
        this.send(ID.MOVE, new W()
            .i32(this.t).i16(this.incarnation)
            .vec3(0, 0, 0)               // angularVelocity
            .i8(0)                       // control (no keys; position is authoritative)
            .vec3(vx, vy, vz)            // linearVelocity
            .vec3(0, 0, this.yaw)        // orientation (hull yaw)
            .vec3(this.pos.x, this.pos.y, this.pos.z)
            .buf());
        this.sent++;
    }
}

function log(msg: string) { console.log(`[${new Date().toISOString().slice(11, 23)}] ${msg}`); }

log(`Target dummies: ${BOTS} bots -> ${HOST}:${PORT}, battle "${BATTLE_NAME}"`);
log(`Chat commands: .fila (line up)  .vem (gather)  .spawn (return)  .parar (stop)`);
const stamp = Date.now().toString(36).slice(-5);
for (let i = 0; i < BOTS; i++) {
    setTimeout(() => new Bot(`${NAME_PREFIX}${stamp}${i}`, i), i * 400);
}

process.on("SIGINT", () => { log("stopping"); process.exit(0); });
