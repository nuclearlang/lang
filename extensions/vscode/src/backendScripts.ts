import * as fs from 'fs';
import * as path from 'path';

/** A command of a backend project, as npm shows a script of package.json: `nuclear <args>` in the project's folder. */
export interface BackendScript {
  /** The task's name and the row's label. */
  name: string;
  args: string[];
  detail: string;
  /** Serves until stopped (`nuclear run`). */
  background?: boolean;
}

/** The commands every backend dialect has (`[toolchain]` of fastapi and nestjs: install, run, test; the CLI adds
 * build and check), and `migrate` once the project has a `migrations/` folder. */
export function backendScripts(root: string, exists: (p: string) => boolean = fs.existsSync): BackendScript[] {
  const scripts: BackendScript[] = [
    { name: 'run', args: ['run'], detail: 'build, install when needed, then the server (it restarts on every build)', background: true },
    { name: 'test', args: ['test'], detail: 'build, then the tests of test/' },
    { name: 'build', args: ['build'], detail: 'transpile into build/' },
    { name: 'check', args: ['check'], detail: 'the .nuc files and the architecture rules' },
    { name: 'install', args: ['install'], detail: 'the packages of the generated app' },
  ];
  if (exists(path.join(root, 'migrations'))) scripts.push({ name: 'migrate', args: ['migrate'], detail: 'apply the pending migrations of migrations/' });
  return scripts;
}
