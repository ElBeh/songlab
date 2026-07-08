// Verifies the reentrant behavior of the remote-update guard.
// A boolean flag would fail the nested and overlapping cases because the
// first inner `finally` would clear it while an outer call is still running.
import { describe, it, expect } from 'vitest';
import { isRemoteUpdate, runAsRemote } from './syncEmitter';

describe('syncEmitter remote guard', () => {
  it('reports remote only inside runAsRemote', async () => {
    expect(isRemoteUpdate()).toBe(false);
    await runAsRemote(() => {
      expect(isRemoteUpdate()).toBe(true);
    });
    expect(isRemoteUpdate()).toBe(false);
  });

  it('stays remote through nested calls', async () => {
    await runAsRemote(async () => {
      expect(isRemoteUpdate()).toBe(true);
      await runAsRemote(async () => {
        expect(isRemoteUpdate()).toBe(true);
      });
      // Still remote after the inner call settles
      expect(isRemoteUpdate()).toBe(true);
    });
    expect(isRemoteUpdate()).toBe(false);
  });

  it('stays remote until the last overlapping call settles', async () => {
    let releaseA!: () => void;
    let releaseB!: () => void;
    const gateA = new Promise<void>((resolve) => { releaseA = resolve; });
    const gateB = new Promise<void>((resolve) => { releaseB = resolve; });

    const a = runAsRemote(async () => { await gateA; });
    const b = runAsRemote(async () => { await gateB; });
    expect(isRemoteUpdate()).toBe(true);

    releaseA();
    await a;
    // B is still in flight, so we must remain remote
    expect(isRemoteUpdate()).toBe(true);

    releaseB();
    await b;
    expect(isRemoteUpdate()).toBe(false);
  });
});
