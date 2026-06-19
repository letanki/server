/**
 * Named per-battle timers. Replaces the scattered nullable `NodeJS.Timeout` fields (round, finish,
 * empty-removal, per-flag auto-return) and their hand-rolled clearTimeout/null bookkeeping with one
 * keyed registry: arming a name auto-clears the previous timer with that name, a fired timer removes
 * itself, and `clearAll()` tears everything down when a battle ends. Names are plain strings so each
 * service owns its own (e.g. "round", "finish", "emptyRemoval", "flagReturn:RED").
 */
export class BattleTimers {
    private readonly timers = new Map<string, NodeJS.Timeout>();

    /** Arms (or re-arms) a named timer, clearing any existing one with the same name first. */
    public set(name: string, ms: number, fn: () => void): void {
        this.clear(name);
        this.timers.set(name, setTimeout(() => {
            this.timers.delete(name);
            fn();
        }, ms));
    }

    /** Cancels a named timer if it's currently armed. No-op otherwise. */
    public clear(name: string): void {
        const t = this.timers.get(name);
        if (t) {
            clearTimeout(t);
            this.timers.delete(name);
        }
    }

    /** Whether a named timer is currently armed (set and not yet fired/cleared). */
    public has(name: string): boolean {
        return this.timers.has(name);
    }

    /** Cancels every armed timer (battle teardown). */
    public clearAll(): void {
        for (const t of this.timers.values()) clearTimeout(t);
        this.timers.clear();
    }
}
