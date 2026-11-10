import { randomUUID } from 'node:crypto';

type Event = { component: string; stage: string; span: string; state: string; elapsedMs: number; txId?: string; errorType?: string };
type Options = { enabled?: boolean; sink?: (event: Event) => void; heartbeatMs?: number };
const stages = new Set(['proveTx', 'balanceTx', 'submitTx', 'watchForTxData', 'watchForDeployTxData']);

/** Observe boundaries only. Never log arguments, witnesses, HTTP bodies or SDK error messages.
 * A pending observation does not cancel, retry or declare the transaction failed.
 */
export function instrumentProvider<T extends object>(provider: T, component: string, options: Options = {}): T {
  if (!(options.enabled ?? process.env.CHART_DIAGNOSTICS === 'true')) return provider;
  return new Proxy(provider, {
    get(target, property) {
      const method = Reflect.get(target, property, target);
      if (typeof method !== 'function' || !stages.has(String(property))) return typeof method === 'function' ? method.bind(target) : method;
      return async (...args: unknown[]) => {
        const started = Date.now();
        const span = randomUUID();
        let txId: string | undefined;
        if (property === 'watchForTxData' && typeof args[0] === 'string') txId = args[0];
        if (property === 'submitTx') {
          try { txId = (args[0] as { identifiers(): string[] }).identifiers().at(-1); } catch { /* Optional public metadata only. */ }
        }
        if (txId && !/^(?:[a-f0-9]{64}|[a-f0-9]{66}|0x[a-f0-9]{64})$/i.test(txId)) txId = undefined;
        const emit = (state: string, errorType?: string) => {
          const event: Event = { component, stage: String(property), span, state, elapsedMs: Date.now() - started, ...(txId ? { txId } : {}), ...(errorType ? { errorType } : {}) };
          try { (options.sink ?? (e => console.log(JSON.stringify({ chartDiagnostic: e }))))(event); } catch { /* Observability must not change transaction behavior. */ }
        };
        emit('started');
        const heartbeat = setInterval(() => emit('pending'), options.heartbeatMs ?? 15_000);
        heartbeat.unref();
        try { const result = await method.apply(target, args); emit('completed'); return result; }
        catch (error) { emit('failed', error instanceof Error && /^[A-Z][A-Za-z0-9]{0,50}$/.test(error.name) ? error.name : 'Error'); throw error; }
        finally { clearInterval(heartbeat); }
      };
    },
  });
}
