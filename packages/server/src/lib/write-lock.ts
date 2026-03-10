let queue = Promise.resolve();

export function withWriteLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const next = queue.then(fn);
  queue = next.then(() => {}, () => {});  // swallow errors so lock always releases
  return next;
}
