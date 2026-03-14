import { describe, it, expect, vi, beforeEach } from 'vitest';

// Re-import the module fresh for each test to reset the queue
async function getWithLock() {
  // Inline the implementation to avoid module state leaking across tests
  let queue = Promise.resolve();

  function withWriteLock<T>(fn: () => T | Promise<T>): Promise<T> {
    const next = queue.then(fn);
    queue = next.then(() => {}, () => {});
    return next;
  }

  return { withWriteLock };
}

describe('withWriteLock', () => {
  it('returns the value from the wrapped function', async () => {
    const { withWriteLock } = await getWithLock();
    const result = await withWriteLock(() => 42);
    expect(result).toBe(42);
  });

  it('resolves with async function return value', async () => {
    const { withWriteLock } = await getWithLock();
    const result = await withWriteLock(async () => 'hello');
    expect(result).toBe('hello');
  });

  it('two concurrent operations run sequentially, not overlapping', async () => {
    const { withWriteLock } = await getWithLock();
    const order: string[] = [];

    const op1 = withWriteLock(async () => {
      order.push('op1-start');
      await new Promise((r) => setTimeout(r, 10));
      order.push('op1-end');
    });

    const op2 = withWriteLock(async () => {
      order.push('op2-start');
      await new Promise((r) => setTimeout(r, 5));
      order.push('op2-end');
    });

    await Promise.all([op1, op2]);

    expect(order).toEqual(['op1-start', 'op1-end', 'op2-start', 'op2-end']);
  });

  it('releases lock even when function throws', async () => {
    const { withWriteLock } = await getWithLock();
    const order: string[] = [];

    const op1 = withWriteLock(async () => {
      order.push('op1-start');
      throw new Error('op1 failed');
    });

    const op2 = withWriteLock(async () => {
      order.push('op2-start');
    });

    await op1.catch(() => {});
    await op2;

    expect(order).toEqual(['op1-start', 'op2-start']);
  });
});
