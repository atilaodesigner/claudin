/** Generic pool. Objects are created up-front (warm) to avoid GC spikes during gameplay. */
export class ObjectPool<T> {
  private readonly free: T[] = [];
  private readonly all: T[] = [];

  constructor(
    private readonly factory: () => T,
    initialSize = 0,
    private readonly maxSize = Infinity,
  ) {
    for (let i = 0; i < initialSize; i++) {
      const item = factory();
      this.all.push(item);
      this.free.push(item);
    }
  }

  acquire(): T | null {
    const item = this.free.pop();
    if (item !== undefined) return item;
    if (this.all.length >= this.maxSize) return null;
    const created = this.factory();
    this.all.push(created);
    return created;
  }

  release(item: T): void {
    this.free.push(item);
  }

  get size(): number {
    return this.all.length;
  }

  get available(): number {
    return this.free.length;
  }

  get inUse(): number {
    return this.all.length - this.free.length;
  }

  forEach(fn: (item: T) => void): void {
    for (const item of this.all) fn(item);
  }
}
