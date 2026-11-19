// The Builder's stub of the vscode API, plus what the device module needs at load time.
export * from '../../nuclear-builder/test/vscode-stub';
export class EventEmitter<T> {
  private fns: ((v: T) => void)[] = [];
  event = (fn: (v: T) => void) => (this.fns.push(fn), { dispose: () => undefined });
  fire(v: T): void {
    for (const f of this.fns) f(v);
  }
}
