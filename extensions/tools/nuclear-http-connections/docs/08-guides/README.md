---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [../02-architecture/overview.md, ../../../../vscode/docs/08-guides/workspace.md, ../../../../jetbrains/docs/08-guides/README.md, ../../../../../nuclearlang/docs/07-reference/projects.md]
---
# HTTP Connections

An HTTP and WebSocket client like Postman or Bruno, inside the editor. It already knows every endpoint of your
projects, because it reads them from the contract the compiler writes. You do not type them. It speaks HTTP (REST)
and WebSockets.

- VS Code: the tool *HTTP Connections* of the Nuclear workspace (`Ctrl+Alt+H`).
- Android Studio / IntelliJ: the *HTTP Connections* tool window, on the left (`Alt+Shift+H`, also under
  *Tools → NuclearLang*).

TODO(human): the tool was never run in a VS Code window or a running IDE. Check this guide against it once.

## What it reads from a project

A project is a folder with `.nuclear/project.json`. The HTTP Connections tool looks for these in the workspace folders, up to
four levels deep, skipping `build`, `node_modules` and hidden folders. In VS Code the projects opened as tabs of
the workspace count too. For each project it reads `.nuclear/contract.json`, which the language server and
`nuclear build` write next to the project card:

- a **backend**'s `controllers`: the routes it exposes;
- a **mobile or web** app's `repositories`: the calls it makes;
- for each endpoint: the verb, the path, the path, query and body parameters, and what it returns;
- whether a backend serves it over WebSockets too, and the events each component pushes.

It never reads your code to find endpoints. If the tree is empty or old, build the project (or open a `.nuc` of it)
so the contract is written again, then press ↻.

## The tree

Platform → project → component → endpoint, colored by verb (GET, POST, PUT, PATCH, DELETE). An endpoint the
backend serves over WebSockets carries a **WS** badge, and the events a component pushes show under it as **EVENT**
rows. A project also shows:

- **Contracts**: the contracts the app declares in its `config.nuc`, each with **↓**. It runs `nuclear contracts
  update <name>`; the ↓ of the group updates them all. The output goes to the *HTTP Connections* output channel.
- **OpenAPI documents**: APIs that are not Nuclear projects, grouped by tag. **+** adds one, as a URL or a file
  path (relative to the workspace folder). The document must be JSON: a YAML file shows up with an error.

At the end of the tree, **WebSockets** lists the ws:// and wss:// urls of servers that are not Nuclear projects.
**+** adds one (it may start with a variable, `{{socketUrl}}`); it is kept in the environment.

In VS Code a backend project's ⇄ action (*Routes in HTTP Connections*) opens this tree.

## Send a request (VS Code)

1. Click an endpoint in the tree. Its component opens as one editor tab, and the endpoint as a tab inside it, so
   the editor's tab bar never fills with requests.
2. Edit the request: the method, the URL (`{{baseUrl}}/path` by default), and the tabs **Params** (path and query),
   **Headers** (*+ header*) and **Body** (JSON; a sample built from the contract's model is filled in).
3. **Send**. The extension sends it, not the page, with a 30 second timeout. The response shows the status, the
   time and the size, the pretty-printed body and the response headers.
4. **copy as curl** copies the request as a `curl` command.

Each tab keeps its request and its last response while the window is open, also when you leave the HTTP Connections tool and
come back. They are not saved to disk.

The JetBrains window works the same way: the tree, a request panel with the pretty-printed JSON response and
*copy as curl*. Its title bar has select environment, add an OpenAPI document, update the contracts and refresh.

## Talk to a WebSocket (VS Code)

1. Click an endpoint with the **WS** badge, an **EVENT**, or a url under **WebSockets**. Served over both HTTP and
   WebSockets, the row opens the HTTP request; click its **WS** badge to open it over the socket. The component opens
   as one editor tab, and its socket as a tab inside it: the routes and events of a component share one socket.
2. The url is your backend's address with its socket path (`{{baseUrl}}/ws` by default; `http` becomes `ws`). Under
   **Headers**, the token headers the backend's guards read are already there: `{{token}}`, or `Bearer {{token}}` in
   `Authorization`. The environment's headers are sent too. They are sent once, when the socket opens; a missing
   token is refused, and the log says the server refused the connection.
3. **Connect**. The dot and the text say *disconnected*, *connecting…* or *connected*.
4. Under **Message**, the chips (*from the contract*) put the message of each endpoint you opened in the box: a route
   as `{ "id": 1, "method": "GET", "path": "/tasks", "headers": {} }` (the app answers it as it answers HTTP:
   `{ "id": 1, "status": 200, "body": … }`), an event as `{ "subscribe": "tasks.created" }` or
   `{ "unsubscribe": "tasks.created" }` (what is published then arrives as `{ "event": …, "data": … }`). Choose **JSON**
   (checked before sending) or **Text**, then **Send** (or `Ctrl+Enter`). The box on the right brings back what you
   sent before.
5. **Messages** shows everything, newest at the bottom: the time, ↑ sent, ↓ received, • the connection, ! an error,
   and the size. Click a row to read its JSON pretty-printed (and **copy** it). Filter by text or by direction;
   **clear** empties it.

Closing the tab closes its socket. Each tab keeps its url, headers, message, history and log while the window is
open, also when you leave the HTTP Connections tool and come back (its socket is then closed: connect again). The
socket needs VS Code 1.101 or newer.

In JetBrains the tree shows the same **WS** marks, events and *WebSockets* (added from the title bar). An endpoint
served only over WebSockets, an event or a url opens the socket panel; a route served over both has **Open over
WebSocket** beside **Send**. One socket is open at a time in the tool window.

## Environments

The environment bar of the pane shows the active environment, with **change**, **edit** and **↻**.

- *change* (*HTTP Connections: Select Environment*): picks another environment, or *New environment…*.
- *edit* (*Edit Environments*): opens the file beside the editor.

They are kept in `.nuclear/http.json` of the first workspace folder; with no folder open, in the extension's own
storage. In JetBrains, in `.nuclear/http.json` of the project.

```json
{
  "active": "local",
  "environments": {
    "local": {
      "vars": { "baseUrl": "http://localhost:8000", "token": "dev" },
      "headers": { "Authorization": "Bearer {{token}}" },
      "baseUrls": { "shop_api": "http://localhost:8000" },
      "openapi": ["https://api.example.com/openapi.json"],
      "sockets": ["wss://echo.example.com/ws"]
    }
  }
}
```

- `vars`: each `{{name}}` in the URL, a header, the body or a message is replaced by its value when it is sent. The
  panel lists the variables it knows.
- `headers`: sent with every request of this environment.
- `baseUrls`: the base URL of a project or of a connection a client declares. An endpoint starts from it, else
  from `{{baseUrl}}`.
- `openapi`: the OpenAPI documents of this environment.
- `sockets`: the WebSocket urls of servers that are not Nuclear projects.

Before the file exists there is one environment, `local`, whose `baseUrl` and `baseUrls` are the addresses where
the backends of the workspace answer (from their project cards).
