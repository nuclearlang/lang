# 11. `use` and imports

`use` imports modules and files. There is no `import` nor `export`: everything declared in a file is exported.

```nuclear
use fs/promises{ readFile, writeFile }
use * as path from path
use './setup'

read(file: string) string
  ~readFile(path.join('data', file), 'utf8')
```

```typescript
import { readFile, writeFile } from 'fs/promises';
import * as path from 'path';
import './setup';

export async function read(file: string): Promise<string> {
  return await readFile(path.join('data', file), 'utf8');
}
```

| Form | Imports |
|---|---|
| `use path{ a, b }` | the names `a` and `b` of `path` |
| `use * as name from path` | the whole module with a name |
| `use './file'` | a file (it only runs it) |

The shape of paths and the words that can go after a path (`show`, `hide`...) are defined by each dialect in its
spec.

## A `use` inside a function

A `use` can stand in a function: its names exist to the end of that block, and where the target can (Python) the
module loads only when that line runs, so a command that never runs it starts faster. In a project,
`use './mcp'{ mcpLine }` brings the declarations of that file of the project the same way. TypeScript and Dart load
it at start: the program means the same.

## Auto-imports

Dialects know the libraries of their technology. When the code uses a name of those libraries without importing
it, **the import is added automatically**. For example, in the `dart` dialect using `sqrt` imports `dart:math`,
and in `flutter` using `Text` imports the widgets library. So Nuclear code does not fill up with imports.

A name that is neither declared, imported nor known by the dialect is error `N0106`.
