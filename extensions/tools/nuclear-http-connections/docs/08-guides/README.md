---
status: accepted
owner: Julian Molina
updated: 2026-11-20
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
- a **mobile or web** app's `repositories`: the calls it makes to other services (a weather API...). A call to your own
  backend is not repeated: it is the backend's route, which says which apps call it (`api · app, web`);
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
   the editor's tab bar never fills with requests. The line under the bar says where you are:
   *project › component › endpoint*.
2. Edit the request: the method, the URL (`{{baseUrl}}/path` by default; under it, the URL with its variables filled
   in, an unknown one underlined in red), and the tabs:
   - **Params**: the path and query parameters.
   - **Headers**: a table of rows you can switch off, edit and delete. Some are filled in for you, each with a badge:
     *from code* (the token header the backend's guards read, `Authorization: Bearer {{token}}`), *from body*
     (Content-Type), *from environment*, *from project*, *from component*. A row you delete stays deleted for that
     tab; **Restore defaults** brings them back. A row you add with the same name wins over the filled-in one.
   - **Body**: JSON, colored as you type. A mistake shows its line and column (click it to go there); **Format**
     (`Alt+Shift+F`) indents it, and pasted JSON is indented by itself. A `{{variable}}` counts as a value.
   - **Auth**: below.
   - **After response**: rules that copy a value of every response into a variable (below).
3. **Send** (`Ctrl+Enter`, `Cmd+Enter` on a Mac). The extension sends it, not the page, with a 30 second timeout
   (the setting *HTTP Connections: Timeout Seconds*); while it waits, **Send** becomes **Cancel**.
4. The response shows the status (green 2xx, blue 3xx, yellow 4xx, red 5xx), the time and the size, and its views:
   - **Pretty**: JSON as a tree you open and close (**Expand all**, **Collapse all**, the arrow keys), each node with
     its count of keys or items. Point at a value to **copy** it, **copy its path** (`data.items[0].id`) or
     **save it as a variable**. HTML and XML are colored.
   - **Raw**: the body as it came. **Preview**: an HTML answer drawn as a page (its scripts do not run).
   - **Headers**: the response headers; each can be copied or saved as a variable.
5. The ⧉ button copies the body; the `<>` button copies the request as a `curl` command, with its variables filled in.

The ▯ button in the bar places the response beside the request, under it, or automatically (beside when the page is wide);
drag the line between them to resize (or focus it and use the arrows).

Each tab keeps its request and its last response while the window is open, also when you leave the HTTP Connections
tool and come back. They are not saved to disk.

### Auth

| Type | What is sent |
|---|---|
| Inherit | the rows of **Headers** as they are (the guards' and the variables' headers); the default |
| No auth | no `Authorization` header, even if a row has one |
| Bearer token | `Authorization: Bearer <token>` (`{{token}}` by default) |
| Basic auth | `Authorization: Basic` with the user and password in base64 |
| API key | a header or a query parameter with its name and value |
| OAuth 2.0 | `Authorization: Bearer {{accessToken}}`, after **Get token** |

OAuth 2.0 supports the *client credentials* and *password* grants: fill in the token URL, the client ID and secret
(sent as a Basic header, or in the body), the scope, and the user and password for the password grant. **Get
token** asks the token URL (the extension does, not the page), keeps the access token in its variable
(`accessToken` by default; a refresh token in `refreshToken`) and shows when it expires; get a new one when it says
it expired. The authorization code grant (with PKCE) is not supported yet. Every field accepts `{{variables}}`.

### Variables from a response

- **Automatically**: when a 2xx JSON answer has a token (`access_token`, `accessToken`, `token`, `jwt`, `id_token`,
  `refresh_token`, also inside `data`) and the request used a token variable (`{{token}}`, `{{accessToken}}`,
  `{{jwt}}`…, for example through the guards' header), the variable takes the new token. A notice says where it was
  saved, *Token saved to {{token}} (Project)*, with **Undo**.
- **By hand**: **Save as variable…** on a value of the tree or a response header: choose its name and scope; tick
  *Also after every send* to make it a rule.
- **Rules** (*After response*): each row is a variable, where its value comes from (a JSON path of the body, like
  `data.access_token` or `items[0].id`, or a header name) and its scope. They run after every send; a path that finds
  nothing is told.

A variable is saved where it is already defined, else in the project's scope; the file is written by the extension.

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

Closing the tab closes its socket. Its variables are scoped like the request page's. Each tab keeps its url, headers, message, history and log while the window is
open, also when you leave the HTTP Connections tool and come back (its socket is then closed: connect again). The
socket needs VS Code 1.101 or newer.

In JetBrains the tree shows the same **WS** marks, events and *WebSockets* (added from the title bar). An endpoint
served only over WebSockets, an event or a url opens the socket panel; a route served over both has **Open over
WebSocket** beside **Send**. One socket is open at a time in the tool window.

## Environments

The environment of the requests is picked in the bar of the pane and of the request page (*New environment…* too).

- *change* (*HTTP Connections: Select Environment*): picks another environment, or *New environment…*.
- *edit* (*Edit Environments*): opens the file beside the editor.
- **Variables** in the request page's bar opens the variables editor: three scopes, **Environment** (every request),
  **Project** (the requests of this project) and **Component** (those of this component), each with its variables
  and headers. Add, rename, change or delete a row; the eye marks a variable as secret, so its value is masked (it is
  still written in the file: do not commit secrets). A variable defined in a narrower scope says *overridden by*.
  **Edit http.json** opens the file.

They are kept in `.nuclear/http.json` of the first workspace folder; with no folder open, in the extension's own
storage. In JetBrains, in `.nuclear/http.json` of the project (without the scopes).

```json
{
  "active": "local",
  "environments": {
    "local": {
      "vars": { "baseUrl": "http://localhost:8000", "token": "dev" },
      "headers": { "Authorization": "Bearer {{token}}" },
      "baseUrls": { "shop_api": "http://localhost:8000" },
      "openapi": ["https://api.example.com/openapi.json"],
      "sockets": ["wss://echo.example.com/ws"],
      "projects": {
        "shop_api": {
          "vars": { "token": "shop-dev" },
          "secrets": ["token"],
          "components": { "orders": { "vars": { "orderId": "7" }, "headers": { "X-Tenant": "acme" } } }
        }
      }
    }
  }
}
```

- `vars`: each `{{name}}` in the URL, a header, the body, the auth or a message is replaced by its value when it is
  sent. A component's variable wins over its project's, and a project's over the environment's; headers likewise.
- `headers`: sent with every request of the scope (they show as rows of **Headers**).
- `secrets`: the variables the editor masks.
- `baseUrls`: the base URL of a project or of a connection a client declares. An endpoint starts from it, else
  from `{{baseUrl}}`.
- `openapi`: the OpenAPI documents of this environment.
- `sockets`: the WebSocket urls of servers that are not Nuclear projects.
- `projects`: the scoped variables and headers, by project name and then by component name. Every field is
  optional: a file without them works as before.

Before the file exists there is one environment, `local`, whose `baseUrl` and `baseUrls` are the addresses where
the backends of the workspace answer (from their project cards).
