import * as path from 'node:path';

/** The roots of `saved` that are one of `folders` or inside one: a folder's workspace shows only its own projects. */
export function savedInside(saved: string[], folders: string[]): string[] {
  return saved.filter((r) => folders.some((f) => r === f || r.startsWith(f.endsWith(path.sep) ? f : f + path.sep)));
}
