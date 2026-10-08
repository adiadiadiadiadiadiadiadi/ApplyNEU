import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { runShutdown, onShutdownSignal } from '../../src/utils/shutdown.ts';

const exit = jest.fn<(code: number) => void>();

beforeEach(() => {
  exit.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
});

describe('runShutdown', () => {
  it('runs every step in order, then exits 0', async () => {
    const order: string[] = [];
    const step = (name: string) => async () => {
      order.push(name);
    };

    await runShutdown([step('server'), step('pool'), step('redis')], { exit });

    expect(order).toEqual(['server', 'pool', 'redis']);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits 1 and skips the remaining steps when one throws', async () => {
    const last = jest.fn(async () => {});

    await runShutdown([async () => { throw new Error('pool end failed'); }, last], { exit });

    expect(last).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('exits 1 when the steps outlast the deadline', async () => {
    jest.useFakeTimers();
    void runShutdown([() => new Promise(() => {})], { timeoutMs: 1000, exit });

    jest.advanceTimersByTime(999);
    expect(exit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('does not fire the deadline after a clean shutdown', async () => {
    jest.useFakeTimers();

    await runShutdown([async () => {}], { timeoutMs: 1000, exit });
    jest.advanceTimersByTime(5000);

    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });
});

describe('onShutdownSignal', () => {
  it('runs the handler once, however many signals arrive', () => {
    const handler = jest.fn();
    const before = { term: process.listenerCount('SIGTERM'), int: process.listenerCount('SIGINT') };

    onShutdownSignal(handler);
    process.emit('SIGTERM');
    process.emit('SIGINT');
    process.emit('SIGTERM');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('SIGTERM');

    process.listeners('SIGTERM').slice(before.term).forEach((l) => process.off('SIGTERM', l as () => void));
    process.listeners('SIGINT').slice(before.int).forEach((l) => process.off('SIGINT', l as () => void));
  });
});
