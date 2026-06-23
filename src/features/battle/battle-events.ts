import { EventEmitter } from "events";
import { GameClient } from "@/server/game.client";
import { Battle } from "./battle.model";

/**
 * Per-server typed event bus for battle gameplay, so the entangled concerns (combat, CTF, round
 * lifecycle, lobby preview) react to each other WITHOUT calling each other directly — combat just
 * emits `kill`, CTF emits `flagCaptured`, and the round/flag/preview listeners pick them up. This
 * breaks the kill↔flag↔round cycle so those concerns can live in separate services with no mutual
 * references. EventEmitter is synchronous, so listeners run in registration order (behavior-preserving).
 */
export interface BattleEventMap {
    /** A tank was killed. Emitted by combat AFTER the core scoreboard/kill packet. */
    kill: { battle: Battle; killerClient: GameClient; victimClient: GameClient };
    /** A CTF flag was captured. Emitted by CTF AFTER the flag score broadcast. */
    flagCaptured: { battle: Battle; capturingTeamId: number; newScore: number };
    /** A tank was destroyed by ANY cause (combat kill, suicide, void). For cleanup (mines, points). */
    tankDestroyed: { battle: Battle; client: GameClient };
    /** A finished round restarted. Emitted by the round service so modes can reset their own state. */
    roundRestarted: { battle: Battle };
}

export class BattleEvents {
    private readonly emitter = new EventEmitter();

    public on<K extends keyof BattleEventMap>(event: K, listener: (payload: BattleEventMap[K]) => void): void {
        this.emitter.on(event, listener as (payload: unknown) => void);
    }

    public emit<K extends keyof BattleEventMap>(event: K, payload: BattleEventMap[K]): void {
        this.emitter.emit(event, payload);
    }
}
