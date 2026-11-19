package dev.nuclearlang.editor;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.intellij.icons.AllIcons;
import com.intellij.notification.NotificationGroupManager;
import com.intellij.notification.NotificationType;
import com.intellij.openapi.actionSystem.ActionManager;
import com.intellij.openapi.actionSystem.ActionUpdateThread;
import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.actionSystem.DefaultActionGroup;
import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.fileEditor.FileEditorManager;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.ui.Messages;
import com.intellij.openapi.vfs.LocalFileSystem;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.openapi.wm.ToolWindow;
import com.intellij.openapi.wm.ToolWindowFactory;
import com.intellij.openapi.wm.ToolWindowManager;
import com.intellij.ui.ColoredTreeCellRenderer;
import com.intellij.ui.JBColor;
import com.intellij.ui.OnePixelSplitter;
import com.intellij.ui.SimpleTextAttributes;
import com.intellij.ui.components.JBScrollPane;
import com.intellij.ui.components.JBTextArea;
import com.intellij.ui.content.ContentFactory;
import com.intellij.ui.table.JBTable;
import com.intellij.ui.treeStructure.Tree;
import org.jetbrains.annotations.NotNull;

import javax.swing.*;
import javax.swing.table.DefaultTableModel;
import javax.swing.tree.DefaultMutableTreeNode;
import javax.swing.tree.DefaultTreeModel;
import javax.swing.tree.TreeSelectionModel;
import java.awt.*;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * The "HTTP Connections" tool window (ADR-synapsis-0006), the same as the VS Code view: every project under the IDE's project
 * (`.nuclear/project.json`) grouped by platform, its components and endpoints read from `.nuclear/contract.json`,
 * the contracts a client declares with an Update action, OpenAPI documents, environments in `.nuclear/http.json`
 * (variables, headers, base urls) and a request panel. What the contract serves over WebSockets (and the ws:// urls of
 * the environment) opens in a socket panel instead, with `java.net.http.WebSocket`. Alt+Shift+H opens it.
 */
public final class HttpConnections {
    private static final Gson PRETTY = new GsonBuilder().setPrettyPrinting().create();
    private static final Set<String> SKIP = Set.of("node_modules", "build", "dist", "target", ".git", ".dart_tool", ".venv", ".idea", "__pycache__");
    private static final Map<String, String> PLATFORMS = new LinkedHashMap<>(Map.of("backend", "Backend", "mobile", "Mobile", "web", "Web"));
    private static final Pattern CONTRACTS = Pattern.compile("^\\s*contracts\\s*\\(([^)]*)\\)", Pattern.MULTILINE);
    private static final Pattern PAIR = Pattern.compile("([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*\"([^\"]*)\"");
    private static final Pattern VAR = Pattern.compile("\\{\\{\\s*([A-Za-z_][A-Za-z0-9_.-]*)\\s*}}");

    // the Chernobyl palette (dark / light): verbs, platforms, projects, components
    static final JBColor GET = new JBColor(new Color(0x64FF00), new Color(0x2E8B57));
    static final JBColor POST = new JBColor(new Color(0x2FE0F0), new Color(0x1E6FD9));
    static final JBColor PUT = new JBColor(new Color(0xFFD600), new Color(0xB8860B));
    static final JBColor PATCH = new JBColor(new Color(0xFFB347), new Color(0xC46A2B));
    static final JBColor DELETE = new JBColor(new Color(0xFF4B4B), new Color(0xD32F2F));
    static final JBColor PLATFORM = new JBColor(new Color(0xA7FF00), new Color(0xB59400));
    static final JBColor PROJECT = new JBColor(new Color(0xC586C0), new Color(0x8A4FAE));
    static final JBColor COMPONENT = new JBColor(new Color(0x9CDCFE), new Color(0x2B6CB0));

    private HttpConnections() {}

    // ---------- data ----------

    record Proj(Path root, String name, String platform, String dialect, JsonObject contract, List<Declared> contracts) {}

    record Declared(String name, String source, String version) {}

    record Param(String name, String type, boolean optional, String def, String in) {}

    /**
     * A backend route, a client call, an OpenAPI operation, a pushed event or a ws:// url: one request the tree offers.
     * `protocol` "websocket" opens it in the socket panel; `socketPath` is set when the contract also serves it there.
     */
    record Endpoint(String project, String kind, String owner, String component, String verb, String path, String description,
                    List<Param> params, String returns, String body, String connection, String protocol, String socketPath, List<String[]> guardHeaders) {}

    record OpenApiDoc(String source, String title, List<Endpoint> endpoints, String error) {}

    record Environment(Map<String, String> vars, Map<String, String> headers, Map<String, String> baseUrls, List<String> openapi, List<String> sockets) {}

    record Environments(String active, Map<String, Environment> environments) {}

    static List<Proj> findProjects(Path base) {
        List<Proj> out = new ArrayList<>();
        walk(base, 0, out);
        out.sort((a, b) -> a.name().compareTo(b.name()));
        return out;
    }

    private static void walk(Path dir, int depth, List<Proj> out) {
        if (Files.exists(dir.resolve(".nuclear/project.json"))) {
            Proj p = readProject(dir);
            if (p != null) out.add(p);
        }
        if (depth >= 4) return;
        try (Stream<Path> entries = Files.list(dir)) {
            for (Path e : entries.toList()) {
                String n = e.getFileName().toString();
                if (Files.isDirectory(e) && !SKIP.contains(n) && !n.startsWith(".")) walk(e, depth + 1, out);
            }
        } catch (IOException ignored) {
        }
    }

    private static Proj readProject(Path root) {
        try {
            JsonObject card = JsonParser.parseString(Files.readString(root.resolve(".nuclear/project.json"))).getAsJsonObject();
            JsonObject contract = null;
            Path c = root.resolve(".nuclear/contract.json");
            if (Files.exists(c)) contract = JsonParser.parseString(Files.readString(c)).getAsJsonObject();
            String platform = card.has("platform") && !card.get("platform").isJsonNull() ? card.get("platform").getAsString() : null;
            return new Proj(root, card.get("name").getAsString(), platform, card.get("dialect").getAsString(), contract, declaredContracts(root));
        } catch (Exception e) {
            return null;
        }
    }

    static List<Declared> declaredContracts(Path root) {
        List<Declared> out = new ArrayList<>();
        String text;
        try {
            text = Files.readString(root.resolve("config.nuc"));
        } catch (IOException e) {
            return out;
        }
        Matcher section = CONTRACTS.matcher(text);
        while (section.find()) {
            Matcher pair = PAIR.matcher(section.group(1));
            while (pair.find()) {
                String version = null;
                try {
                    Path copy = root.resolve("contracts").resolve(pair.group(1)).resolve("contract.json");
                    if (Files.exists(copy)) version = JsonParser.parseString(Files.readString(copy)).getAsJsonObject().get("version").getAsString();
                } catch (Exception ignored) {
                }
                out.add(new Declared(pair.group(1), pair.group(2), version));
            }
        }
        return out;
    }

    private static String str(JsonObject o, String key) {
        return o != null && o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsString() : null;
    }

    static List<Endpoint> endpointsOf(Proj p) {
        List<Endpoint> out = new ArrayList<>();
        if (p.contract() == null) return out;
        boolean backend = "backend".equals(p.platform());
        JsonObject apis = p.contract().getAsJsonObject(backend ? "controllers" : "repositories");
        if (apis == null) return out;
        JsonObject models = p.contract().getAsJsonObject("models");
        String socketPath = socketPathOf(p.contract());
        Map<String, List<Endpoint>> events = new LinkedHashMap<>();
        if (backend && socketPath != null) {
            for (String[] ev : eventsOf(p.contract())) {
                events.computeIfAbsent(ev[1], c -> new ArrayList<>()).add(new Endpoint(p.name(), "event", "", ev[1], "event", ev[0],
                        ev[3], List.of(), ev[2], null, null, "websocket", socketPath, guardHeadersOf(p.contract(), null)));
            }
        }
        for (String owner : apis.keySet()) {
            JsonObject api = apis.getAsJsonObject(owner);
            String base = str(api, "path") == null ? "" : str(api, "path");
            String component = str(api, "component");
            if (component == null || component.isEmpty()) component = "shared";
            List<String[]> guards = guardHeadersOf(p.contract(), api);
            Set<String> transports = transportsOf(api);
            boolean ws = transports.contains("websocket");
            String connection = backend ? null : str(api, "connection");
            for (JsonElement r : api.getAsJsonArray("routes")) {
                JsonObject route = r.getAsJsonObject();
                List<Param> params = new ArrayList<>();
                String body = null;
                for (JsonElement pe : route.getAsJsonArray("params")) {
                    JsonObject pm = pe.getAsJsonObject();
                    String in = str(pm, "in");
                    params.add(new Param(str(pm, "name"), str(pm, "type"), pm.has("optional"), pm.has("default") ? pm.get("default").toString() : null, in));
                    if ("body".equals(in)) body = PRETTY.toJson(sampleOf(str(pm, "type"), models, 0));
                }
                String full = "/" + String.join("/", Stream.of(base, str(route, "path") == null ? "" : str(route, "path"))
                        .map(s -> s.replaceAll("^/|/$", "")).filter(s -> !s.isEmpty()).toList());
                full = full.replaceAll(":([A-Za-z_][A-Za-z0-9_]*)", "{$1}");
                out.add(new Endpoint(p.name(), backend ? "route" : "call", owner, component, str(route, "verb"), full,
                        str(route, "description"), params, str(route, "returns"), body, connection,
                        ws && !transports.contains("http") ? "websocket" : null, ws ? (socketPath == null ? "/ws" : socketPath) : null, ws ? guards : null));
            }
            // the topics the app publishes, after the routes of the component that publishes them
            List<Endpoint> own = events.remove(component);
            if (own != null) out.addAll(own);
        }
        events.values().forEach(out::addAll);
        return out;
    }

    // ---------- the WebSocket fields of the contract (ADR-synapsis-0008, projects.md §1.2; absent = HTTP only) ----------

    /** A controller's `transports`; absent: HTTP only. */
    static Set<String> transportsOf(JsonObject api) {
        Set<String> out = new java.util.HashSet<>();
        if (api.has("transports") && api.get("transports").isJsonArray()) {
            for (JsonElement x : api.getAsJsonArray("transports")) {
                String t = x.isJsonPrimitive() ? x.getAsString() : "";
                if (t.equals("http") || t.equals("websocket")) out.add(t);
            }
        }
        return out.isEmpty() ? Set.of("http") : out;
    }

    /** The contract's `events`: {topic, component, payload, "{ fields }" or null}. */
    static List<String[]> eventsOf(JsonObject contract) {
        List<String[]> out = new ArrayList<>();
        if (!contract.has("events") || !contract.get("events").isJsonObject()) return out;
        JsonObject all = contract.getAsJsonObject("events");
        for (String topic : all.keySet()) {
            JsonObject e = all.get(topic).isJsonObject() ? all.getAsJsonObject(topic) : new JsonObject();
            String component = str(e, "component");
            String payload = str(e, "payload");
            String fields = null;
            if (e.has("fields") && e.get("fields").isJsonArray()) {
                List<String> fs = new ArrayList<>();
                e.getAsJsonArray("fields").forEach(f -> fs.add(f.getAsString()));
                fields = "{ " + String.join(", ", fs) + " }";
            }
            out.add(new String[]{topic, component == null || component.isEmpty() ? "shared" : component, payload == null ? "any" : payload, fields});
        }
        return out;
    }

    /** `webSocket`: the path of the app's socket, or null when it has none. */
    static String socketPathOf(JsonObject contract) {
        String p = str(contract, "webSocket");
        return p == null || p.isEmpty() ? null : p.startsWith("/") ? p : "/" + p;
    }

    /** The headers the token guards read, the app's then the controller's, with the value to fill ({{token}}; Bearer in Authorization). */
    static List<String[]> guardHeadersOf(JsonObject contract, JsonObject api) {
        List<String[]> out = new ArrayList<>();
        for (JsonObject owner : new JsonObject[]{contract, api}) {
            if (owner == null || !owner.has("guards") || !owner.get("guards").isJsonArray()) continue;
            for (JsonElement g : owner.getAsJsonArray("guards")) {
                if (!g.isJsonObject() || !"token".equals(str(g.getAsJsonObject(), "guard"))) continue;
                String h = str(g.getAsJsonObject(), "header");
                String header = h == null || h.isEmpty() ? "Authorization" : h;
                if (out.stream().anyMatch(x -> x[0].equalsIgnoreCase(header))) continue;
                out.add(new String[]{header, header.equalsIgnoreCase("Authorization") ? "Bearer {{token}}" : "{{token}}"});
            }
        }
        return out;
    }

    /** A sample value of a Nuclear type from the contract's models (what a request body looks like). */
    static JsonElement sampleOf(String type, JsonObject models, int depth) {
        String t = type == null ? "any" : type.replaceAll("\\?$", "");
        if (t.endsWith("[]")) {
            JsonArray a = new JsonArray();
            a.add(sampleOf(t.substring(0, t.length() - 2), models, depth + 1));
            return a;
        }
        if (t.startsWith("<")) return new JsonObject();
        switch (t) {
            case "int", "double", "number" -> { return new com.google.gson.JsonPrimitive(0); }
            case "string" -> { return new com.google.gson.JsonPrimitive(""); }
            case "boolean", "bool" -> { return new com.google.gson.JsonPrimitive(false); }
            case "DateTime" -> { return new com.google.gson.JsonPrimitive(java.time.Instant.now().toString()); }
            default -> { }
        }
        JsonObject model = models == null ? null : models.getAsJsonObject(t.split("<")[0]);
        if (model == null || depth > 3) return com.google.gson.JsonNull.INSTANCE;
        JsonObject out = new JsonObject();
        for (JsonElement fe : model.getAsJsonArray("fields")) {
            JsonObject f = fe.getAsJsonObject();
            if (f.has("optional") && !f.has("default")) continue;
            String key = str(f, "json") != null ? str(f, "json") : str(f, "name");
            out.add(key, f.has("default") ? f.get("default") : sampleOf(str(f, "type"), models, depth + 1));
        }
        return out;
    }

    static Environments environments(Path base) {
        Environments fallback = new Environments("local", new LinkedHashMap<>(Map.of("local",
                new Environment(new LinkedHashMap<>(Map.of("baseUrl", "http://localhost:3000")), new LinkedHashMap<>(), new LinkedHashMap<>(), new ArrayList<>(), new ArrayList<>()))));
        Path file = base.resolve(".nuclear/http.json");
        if (!Files.exists(file)) return fallback;
        try {
            JsonObject read = JsonParser.parseString(Files.readString(file)).getAsJsonObject();
            Map<String, Environment> envs = new LinkedHashMap<>();
            JsonObject all = read.getAsJsonObject("environments");
            if (all != null) {
                for (String name : all.keySet()) {
                    JsonObject e = all.getAsJsonObject(name);
                    List<String> openapi = new ArrayList<>();
                    if (e.has("openapi")) for (JsonElement x : e.getAsJsonArray("openapi")) openapi.add(x.getAsString());
                    List<String> sockets = new ArrayList<>();
                    if (e.has("sockets")) for (JsonElement x : e.getAsJsonArray("sockets")) sockets.add(x.getAsString());
                    envs.put(name, new Environment(strings(e.getAsJsonObject("vars")), strings(e.getAsJsonObject("headers")), strings(e.getAsJsonObject("baseUrls")), openapi, sockets));
                }
            }
            if (envs.isEmpty()) return fallback;
            String active = str(read, "active");
            if (active == null || !envs.containsKey(active)) active = envs.keySet().iterator().next();
            return new Environments(active, envs);
        } catch (Exception e) {
            return fallback;
        }
    }

    private static Map<String, String> strings(JsonObject o) {
        Map<String, String> out = new LinkedHashMap<>();
        if (o != null) for (String k : o.keySet()) out.put(k, o.get(k).getAsString());
        return out;
    }

    static void writeEnvironments(Path base, Environments envs) throws IOException {
        JsonObject root = new JsonObject();
        root.addProperty("active", envs.active());
        JsonObject all = new JsonObject();
        for (Map.Entry<String, Environment> e : envs.environments().entrySet()) {
            JsonObject o = new JsonObject();
            o.add("vars", PRETTY.toJsonTree(e.getValue().vars()));
            o.add("headers", PRETTY.toJsonTree(e.getValue().headers()));
            o.add("baseUrls", PRETTY.toJsonTree(e.getValue().baseUrls()));
            o.add("openapi", PRETTY.toJsonTree(e.getValue().openapi()));
            o.add("sockets", PRETTY.toJsonTree(e.getValue().sockets()));
            all.add(e.getKey(), o);
        }
        root.add("environments", all);
        Files.createDirectories(base.resolve(".nuclear"));
        Files.writeString(base.resolve(".nuclear/http.json"), PRETTY.toJson(root) + "\n");
    }

    static OpenApiDoc loadOpenApi(Path base, String source) {
        try {
            String text;
            if (source.startsWith("http://") || source.startsWith("https://")) {
                HttpResponse<String> res = HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create(source)).timeout(Duration.ofSeconds(8)).build(), HttpResponse.BodyHandlers.ofString());
                text = res.body();
            } else {
                text = Files.readString(base.resolve(source));
            }
            JsonObject doc = JsonParser.parseString(text).getAsJsonObject();
            String title = doc.has("info") ? str(doc.getAsJsonObject("info"), "title") : null;
            List<Endpoint> endpoints = new ArrayList<>();
            JsonObject paths = doc.getAsJsonObject("paths");
            if (paths != null) {
                for (String p : paths.keySet()) {
                    JsonObject ops = paths.getAsJsonObject(p);
                    for (String verb : ops.keySet()) {
                        if (!List.of("get", "post", "put", "patch", "delete").contains(verb)) continue;
                        JsonObject op = ops.getAsJsonObject(verb);
                        List<Param> params = new ArrayList<>();
                        if (op.has("parameters")) for (JsonElement pe : op.getAsJsonArray("parameters")) {
                            JsonObject pm = pe.getAsJsonObject();
                            String in = str(pm, "in");
                            if (!"path".equals(in) && !"query".equals(in)) continue;
                            String type = pm.has("schema") ? str(pm.getAsJsonObject("schema"), "type") : "string";
                            params.add(new Param(str(pm, "name"), type == null ? "string" : type, !(pm.has("required") && pm.get("required").getAsBoolean()), null, in));
                        }
                        String tag = op.has("tags") && op.getAsJsonArray("tags").size() > 0 ? op.getAsJsonArray("tags").get(0).getAsString() : "default";
                        endpoints.add(new Endpoint(source, "openapi", str(op, "operationId") == null ? "" : str(op, "operationId"), tag, verb, p, str(op, "summary"), params, "", op.has("requestBody") ? "{}" : null, null, null, null, null));
                    }
                }
            }
            return new OpenApiDoc(source, title == null ? source : title, endpoints, null);
        } catch (Exception e) {
            return new OpenApiDoc(source, source, List.of(), e.toString());
        }
    }

    // ---------- the tool window ----------

    public static final class Window implements ToolWindowFactory {
        @Override
        public void createToolWindowContent(@NotNull Project project, @NotNull ToolWindow window) {
            Panel panel = new Panel(project);
            com.intellij.ui.content.Content content = ContentFactory.getInstance().createContent(panel, "", false);
            content.setDisposer(panel.sockets::close);
            window.getContentManager().addContent(content);
            window.setTitleActions(List.of(panel.action("Select Environment", AllIcons.General.Settings, panel::selectEnvironment),
                    panel.action("Add an OpenAPI Document", AllIcons.General.Add, panel::addOpenApi),
                    panel.action("Add a WebSocket Url (ws:// or wss://)", AllIcons.General.Web, panel::addSocket),
                    panel.action("Update Contracts (nuclear contracts update)", AllIcons.Actions.Download, panel::updateContracts),
                    panel.action("Refresh", AllIcons.Actions.Refresh, panel::refresh)));
        }
    }

    /** Alt+Shift+H (plugin.xml): opens the tool window from anywhere. */
    public static final class Open extends AnAction {
        @Override
        public void actionPerformed(@NotNull AnActionEvent e) {
            Project project = e.getProject();
            if (project == null) return;
            ToolWindow w = ToolWindowManager.getInstance(project).getToolWindow("HTTP Connections");
            if (w != null) w.activate(null);
        }

        @Override
        public @NotNull ActionUpdateThread getActionUpdateThread() {
            return ActionUpdateThread.BGT;
        }
    }

    static final class Panel extends JPanel {
        private final Project project;
        private final Path base;
        private final Tree tree = new Tree();
        private final JComboBox<String> method = new JComboBox<>(new String[]{"GET", "POST", "PUT", "PATCH", "DELETE"});
        private final JTextField url = new JTextField();
        private final DefaultTableModel params = new DefaultTableModel(new Object[]{"Parameter", "Value"}, 0);
        private final DefaultTableModel headers = new DefaultTableModel(new Object[]{"Header", "Value"}, 0);
        private final JBTextArea body = new JBTextArea(6, 40);
        private final JLabel status = new JLabel("—");
        private final JBTextArea response = new JBTextArea();
        private final JLabel envLabel = new JLabel();
        private Endpoint current;
        private String baseUrl = "{{baseUrl}}";
        private List<Proj> projects = List.of();
        private final JButton overSocket = new JButton("Open over WebSocket");
        private final CardLayout cards = new CardLayout();
        private final JPanel right = new JPanel(cards);
        final SocketPanel sockets = new SocketPanel(this::env);

        Panel(Project project) {
            super(new BorderLayout());
            this.project = project;
            this.base = Path.of(project.getBasePath() == null ? "." : project.getBasePath());
            tree.setRootVisible(false);
            tree.getSelectionModel().setSelectionMode(TreeSelectionModel.SINGLE_TREE_SELECTION);
            tree.setCellRenderer(new Renderer());
            tree.addTreeSelectionListener(e -> {
                DefaultMutableTreeNode n = (DefaultMutableTreeNode) tree.getLastSelectedPathComponent();
                if (n != null && n.getUserObject() instanceof Endpoint ep) {
                    if ("websocket".equals(ep.protocol())) openSocket(ep);
                    else load(ep);
                }
            });
            OnePixelSplitter split = new OnePixelSplitter(false, 0.38f);
            split.setFirstComponent(new JBScrollPane(tree));
            right.add(requestPanel(), "http");
            right.add(sockets, "ws");
            split.setSecondComponent(right);
            add(split, BorderLayout.CENTER);
            refresh();
        }

        AnAction action(String text, Icon icon, Runnable run) {
            return new AnAction(text, text, icon) {
                @Override
                public void actionPerformed(@NotNull AnActionEvent e) {
                    run.run();
                }

                @Override
                public @NotNull ActionUpdateThread getActionUpdateThread() {
                    return ActionUpdateThread.BGT;
                }
            };
        }

        private JComponent requestPanel() {
            JPanel p = new JPanel(new BorderLayout(6, 6));
            p.setBorder(BorderFactory.createEmptyBorder(6, 8, 6, 8));
            JPanel top = new JPanel(new BorderLayout(6, 0));
            JButton send = new JButton("Send");
            send.addActionListener(e -> send());
            top.add(method, BorderLayout.WEST);
            top.add(url, BorderLayout.CENTER);
            JPanel buttons = new JPanel(new FlowLayout(FlowLayout.RIGHT, 4, 0));
            overSocket.setVisible(false);
            overSocket.setToolTipText("The contract also serves this route over WebSockets");
            overSocket.addActionListener(e -> { if (current != null) openSocket(current); });
            buttons.add(overSocket);
            buttons.add(send);
            top.add(buttons, BorderLayout.EAST);
            JPanel head = new JPanel(new BorderLayout());
            head.add(top, BorderLayout.NORTH);
            envLabel.setForeground(JBColor.GRAY);
            head.add(envLabel, BorderLayout.SOUTH);
            p.add(head, BorderLayout.NORTH);
            JTabbedPane tabs = new JTabbedPane();
            JBTable paramsTable = new JBTable(params);
            params.addTableModelListener(e -> buildUrl());
            tabs.addTab("Params", new JBScrollPane(paramsTable));
            JPanel headersPanel = new JPanel(new BorderLayout());
            headersPanel.add(new JBScrollPane(new JBTable(headers)), BorderLayout.CENTER);
            JButton addHeader = new JButton("+ header");
            addHeader.addActionListener(e -> headers.addRow(new Object[]{"", ""}));
            headersPanel.add(addHeader, BorderLayout.SOUTH);
            tabs.addTab("Headers", headersPanel);
            tabs.addTab("Body", new JBScrollPane(body));
            response.setEditable(false);
            JPanel resp = new JPanel(new BorderLayout(6, 4));
            JPanel respHead = new JPanel(new BorderLayout());
            respHead.add(status, BorderLayout.WEST);
            JButton curl = new JButton("copy as curl");
            curl.addActionListener(e -> copyCurl());
            respHead.add(curl, BorderLayout.EAST);
            resp.add(respHead, BorderLayout.NORTH);
            resp.add(new JBScrollPane(response), BorderLayout.CENTER);
            OnePixelSplitter v = new OnePixelSplitter(true, 0.45f);
            v.setFirstComponent(tabs);
            v.setSecondComponent(resp);
            p.add(v, BorderLayout.CENTER);
            return p;
        }

        // ---------- tree ----------

        void refresh() {
            ApplicationManager.getApplication().executeOnPooledThread(() -> {
                List<Proj> found = findProjects(base);
                Environments envs = environments(base);
                Environment env = envs.environments().get(envs.active());
                List<OpenApiDoc> docs = new ArrayList<>();
                if (env != null) for (String s : env.openapi()) docs.add(loadOpenApi(base, s));
                ApplicationManager.getApplication().invokeLater(() -> {
                    projects = found;
                    envLabel.setText("environment: " + envs.active() + "   variables: " + (env == null ? "" : String.join(" ", env.vars().keySet().stream().map(k -> "{{" + k + "}}").toList())));
                    tree.setModel(new DefaultTreeModel(buildTree(found, docs)));
                    for (int i = 0; i < tree.getRowCount(); i++) tree.expandRow(i);
                });
            });
        }

        private DefaultMutableTreeNode buildTree(List<Proj> found, List<OpenApiDoc> docs) {
            DefaultMutableTreeNode root = new DefaultMutableTreeNode("root");
            for (Map.Entry<String, String> pl : PLATFORMS.entrySet()) {
                List<Proj> ps = found.stream().filter(p -> pl.getKey().equals(p.platform())).toList();
                if (ps.isEmpty()) continue;
                DefaultMutableTreeNode platform = new DefaultMutableTreeNode(new Label(pl.getValue(), "platform"));
                root.add(platform);
                for (Proj p : ps) {
                    DefaultMutableTreeNode pn = new DefaultMutableTreeNode(p);
                    platform.add(pn);
                    if (!p.contracts().isEmpty()) {
                        DefaultMutableTreeNode cn = new DefaultMutableTreeNode(new Label("Contracts", "contracts"));
                        pn.add(cn);
                        for (Declared d : p.contracts()) cn.add(new DefaultMutableTreeNode(d));
                    }
                    Map<String, DefaultMutableTreeNode> components = new LinkedHashMap<>();
                    for (Endpoint e : endpointsOf(p)) {
                        components.computeIfAbsent(e.component(), c -> {
                            DefaultMutableTreeNode n = new DefaultMutableTreeNode(new Label(c, "component"));
                            pn.add(n);
                            return n;
                        }).add(new DefaultMutableTreeNode(e));
                    }
                    if (components.isEmpty() && p.contracts().isEmpty()) pn.add(new DefaultMutableTreeNode(new Label("no endpoints in the contract", "message")));
                }
            }
            if (!docs.isEmpty()) {
                DefaultMutableTreeNode on = new DefaultMutableTreeNode(new Label("OpenAPI documents", "platform"));
                root.add(on);
                for (OpenApiDoc d : docs) {
                    DefaultMutableTreeNode dn = new DefaultMutableTreeNode(d);
                    on.add(dn);
                    Map<String, DefaultMutableTreeNode> tags = new LinkedHashMap<>();
                    for (Endpoint e : d.endpoints()) {
                        tags.computeIfAbsent(e.component(), c -> {
                            DefaultMutableTreeNode n = new DefaultMutableTreeNode(new Label(c, "component"));
                            dn.add(n);
                            return n;
                        }).add(new DefaultMutableTreeNode(e));
                    }
                }
            }
            Environment env = env();
            if (env != null && !env.sockets().isEmpty()) {
                DefaultMutableTreeNode wn = new DefaultMutableTreeNode(new Label("WebSockets", "platform"));
                root.add(wn);
                for (String u : env.sockets()) wn.add(new DefaultMutableTreeNode(new Endpoint("WebSockets", "socket", "", "WebSockets", "ws", u, null, List.of(), "", null, null, "websocket", null, null)));
            }
            if (root.getChildCount() == 0) root.add(new DefaultMutableTreeNode(new Label("No Nuclear project found: build one, or add an OpenAPI document", "message")));
            return root;
        }

        record Label(String text, String kind) {}

        static final class Renderer extends ColoredTreeCellRenderer {
            @Override
            public void customizeCellRenderer(@NotNull JTree tree, Object value, boolean selected, boolean expanded, boolean leaf, int row, boolean hasFocus) {
                Object o = ((DefaultMutableTreeNode) value).getUserObject();
                if (o instanceof Label l) {
                    switch (l.kind()) {
                        case "platform" -> { setIcon(AllIcons.Nodes.Module); append(l.text(), new SimpleTextAttributes(SimpleTextAttributes.STYLE_BOLD, PLATFORM)); }
                        case "component" -> { setIcon(AllIcons.Nodes.Package); append(l.text(), new SimpleTextAttributes(SimpleTextAttributes.STYLE_PLAIN, COMPONENT)); }
                        case "contracts" -> { setIcon(AllIcons.Nodes.PpLib); append(l.text(), new SimpleTextAttributes(SimpleTextAttributes.STYLE_PLAIN, PROJECT)); }
                        default -> { setIcon(AllIcons.General.Information); append(l.text(), SimpleTextAttributes.GRAYED_ATTRIBUTES); }
                    }
                } else if (o instanceof Proj p) {
                    setIcon(AllIcons.Nodes.Folder);
                    append(p.name(), new SimpleTextAttributes(SimpleTextAttributes.STYLE_PLAIN, PROJECT));
                    append("  " + p.dialect(), SimpleTextAttributes.GRAYED_ATTRIBUTES);
                } else if (o instanceof Declared d) {
                    setIcon(d.version() == null ? AllIcons.General.Warning : AllIcons.Actions.Checked);
                    append(d.name(), SimpleTextAttributes.REGULAR_ATTRIBUTES);
                    append("  " + (d.version() == null ? "not fetched" : d.version()) + " · " + d.source(), SimpleTextAttributes.GRAYED_ATTRIBUTES);
                } else if (o instanceof OpenApiDoc d) {
                    setIcon(d.error() == null ? AllIcons.Nodes.PpWeb : AllIcons.General.Warning);
                    append(d.title(), new SimpleTextAttributes(SimpleTextAttributes.STYLE_PLAIN, PLATFORM));
                    append("  " + (d.error() == null ? d.source() : "could not load"), SimpleTextAttributes.GRAYED_ATTRIBUTES);
                } else if (o instanceof Endpoint e) {
                    setIcon(AllIcons.Nodes.Method);
                    append(e.verb().toUpperCase() + " ", new SimpleTextAttributes(SimpleTextAttributes.STYLE_BOLD, verbColor(e.verb())));
                    append(e.path(), SimpleTextAttributes.REGULAR_ATTRIBUTES);
                    if (!"socket".equals(e.kind()) && ("websocket".equals(e.protocol()) || e.socketPath() != null)) append("  WS", new SimpleTextAttributes(SimpleTextAttributes.STYLE_BOLD | SimpleTextAttributes.STYLE_SMALLER, COMPONENT));
                    String side = "event".equals(e.kind()) ? (e.returns() + (e.description() == null ? "" : " " + e.description())) : e.owner() + (e.connection() == null || e.connection().isEmpty() ? "" : " · " + e.connection());
                    append("  " + side, SimpleTextAttributes.GRAYED_ATTRIBUTES);
                } else {
                    append(String.valueOf(o));
                }
            }
        }

        static JBColor verbColor(String verb) {
            return switch (verb) {
                case "post" -> POST;
                case "put" -> PUT;
                case "patch" -> PATCH;
                case "delete" -> DELETE;
                case "event", "ws" -> COMPONENT;
                default -> GET;
            };
        }

        // ---------- request ----------

        private Environment env() {
            Environments envs = environments(base);
            return envs.environments().get(envs.active());
        }

        /** The endpoint in the socket panel: its backend's url with the socket's path, or the environment's ws:// url. */
        private void openSocket(Endpoint e) {
            Environment env = env();
            String url = e.path();
            List<String[]> headers = new ArrayList<>();
            String template = null;
            if (!"socket".equals(e.kind())) {
                String b = "{{baseUrl}}";
                if (env != null) {
                    if (e.connection() != null && env.baseUrls().containsKey(e.connection())) b = env.baseUrls().get(e.connection());
                    else if (env.baseUrls().containsKey(e.project())) b = env.baseUrls().get(e.project());
                }
                url = SocketPanel.toSocketScheme(b.replaceAll("/$", "") + (e.socketPath() == null ? "/ws" : e.socketPath()));
                if (e.guardHeaders() != null) for (String[] g : e.guardHeaders()) {
                    if (env == null || env.headers().keySet().stream().noneMatch(h -> h.equalsIgnoreCase(g[0]))) headers.add(g);
                }
                // the frames of ADR-synapsis-0008: a request through the app, or a subscription
                JsonObject m = new JsonObject();
                if ("event".equals(e.kind())) m.addProperty("subscribe", e.path());
                else {
                    m.addProperty("id", 1);
                    m.addProperty("method", e.verb().toUpperCase());
                    m.addProperty("path", e.path());
                    m.add("headers", new JsonObject());
                    if (e.body() != null) m.add("body", JsonParser.parseString(e.body()));
                }
                template = PRETTY.toJson(m);
            }
            sockets.load(url, headers, template, e.guardHeaders() == null || e.guardHeaders().isEmpty() ? null : String.join(", ", e.guardHeaders().stream().map(g -> g[0]).toList()));
            cards.show(right, "ws");
        }

        private void load(Endpoint e) {
            current = e;
            cards.show(right, "http");
            overSocket.setVisible(e.socketPath() != null);
            Environments envs = environments(base);
            Environment env = envs.environments().get(envs.active());
            baseUrl = "{{baseUrl}}";
            if (env != null) {
                if (e.connection() != null && env.baseUrls().containsKey(e.connection())) baseUrl = env.baseUrls().get(e.connection());
                else if (env.baseUrls().containsKey(e.project())) baseUrl = env.baseUrls().get(e.project());
            }
            method.setSelectedItem(e.verb().toUpperCase());
            params.setRowCount(0);
            for (Param p : e.params()) {
                if ("body".equals(p.in())) continue;
                String sample = "path".equals(p.in()) ? ("int".equals(p.type()) || "integer".equals(p.type()) || "number".equals(p.type()) || "double".equals(p.type()) ? "1" : "") : (p.def() == null ? "" : p.def().replace("\"", ""));
                params.addRow(new Object[]{p.name() + " (" + p.in() + ": " + p.type() + (p.optional() ? "?" : "") + ")", sample});
            }
            headers.setRowCount(0);
            if (env != null) for (Map.Entry<String, String> h : env.headers().entrySet()) headers.addRow(new Object[]{h.getKey(), h.getValue()});
            body.setText(e.body() == null ? "" : e.body());
            status.setText(e.description() == null ? "—" : e.description());
            response.setText("");
            buildUrl();
        }

        private void buildUrl() {
            if (current == null) return;
            String path = current.path();
            List<String> query = new ArrayList<>();
            for (int i = 0; i < params.getRowCount(); i++) {
                String label = String.valueOf(params.getValueAt(i, 0));
                String name = label.split(" ")[0];
                String value = String.valueOf(params.getValueAt(i, 1));
                if (label.contains("(path")) path = path.replace("{" + name + "}", URLEncoder.encode(value, StandardCharsets.UTF_8));
                else if (!value.isEmpty()) query.add(URLEncoder.encode(name, StandardCharsets.UTF_8) + "=" + URLEncoder.encode(value, StandardCharsets.UTF_8));
            }
            url.setText(baseUrl.replaceAll("/$", "") + path + (query.isEmpty() ? "" : "?" + String.join("&", query)));
        }

        private Map<String, String> requestHeaders() {
            Map<String, String> out = new LinkedHashMap<>();
            for (int i = 0; i < headers.getRowCount(); i++) {
                String k = String.valueOf(headers.getValueAt(i, 0)).trim();
                if (!k.isEmpty()) out.put(k, String.valueOf(headers.getValueAt(i, 1)));
            }
            return out;
        }

        private String resolve(String text, Map<String, String> vars) {
            Matcher m = VAR.matcher(text);
            StringBuilder sb = new StringBuilder();
            while (m.find()) m.appendReplacement(sb, Matcher.quoteReplacement(vars.getOrDefault(m.group(1), m.group(0))));
            m.appendTail(sb);
            return sb.toString();
        }

        private void send() {
            Environments envs = environments(base);
            Environment env = envs.environments().get(envs.active());
            Map<String, String> vars = env == null ? Map.of() : env.vars();
            String target = resolve(url.getText(), vars);
            String verb = String.valueOf(method.getSelectedItem());
            String payload = body.getText().isBlank() ? null : resolve(body.getText(), vars);
            Map<String, String> hs = new LinkedHashMap<>();
            for (Map.Entry<String, String> h : requestHeaders().entrySet()) hs.put(h.getKey(), resolve(h.getValue(), vars));
            if (payload != null && hs.keySet().stream().noneMatch(k -> k.equalsIgnoreCase("content-type"))) hs.put("content-type", "application/json");
            status.setText("sending…");
            long started = System.currentTimeMillis();
            ApplicationManager.getApplication().executeOnPooledThread(() -> {
                String text;
                String line;
                try {
                    HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(target)).timeout(Duration.ofSeconds(30));
                    for (Map.Entry<String, String> h : hs.entrySet()) b.header(h.getKey(), h.getValue());
                    b.method(verb, payload == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(payload));
                    HttpResponse<String> res = HttpClient.newHttpClient().send(b.build(), HttpResponse.BodyHandlers.ofString());
                    text = res.body();
                    try {
                        text = PRETTY.toJson(JsonParser.parseString(text));
                    } catch (Exception ignored) {
                    }
                    line = res.statusCode() + "  ·  " + (System.currentTimeMillis() - started) + " ms  ·  " + res.body().length() + " bytes  ·  " + target;
                } catch (Exception ex) {
                    text = ex.toString();
                    line = "failed  ·  " + target;
                }
                String finalText = text;
                String finalLine = line;
                ApplicationManager.getApplication().invokeLater(() -> {
                    status.setText(finalLine);
                    response.setText(finalText);
                    response.setCaretPosition(0);
                });
            });
        }

        private void copyCurl() {
            StringBuilder sb = new StringBuilder("curl -X ").append(method.getSelectedItem());
            for (Map.Entry<String, String> h : requestHeaders().entrySet()) sb.append(" -H '").append(h.getKey()).append(": ").append(h.getValue()).append("'");
            if (!body.getText().isBlank()) sb.append(" -d '").append(body.getText().replace("'", "'\\''")).append("'");
            sb.append(" '").append(url.getText()).append("'");
            Toolkit.getDefaultToolkit().getSystemClipboard().setContents(new java.awt.datatransfer.StringSelection(sb.toString()), null);
            status.setText("copied as curl");
        }

        // ---------- actions ----------

        void selectEnvironment() {
            Environments envs = environments(base);
            List<String> names = new ArrayList<>(envs.environments().keySet());
            names.add("New environment…");
            int i = Messages.showChooseDialog(project, "Environment for the requests (variables, headers, base urls)", "HTTP Connections",
                    null, names.toArray(new String[0]), envs.active());
            if (i < 0) return;
            if (i == names.size() - 1) {
                String name = Messages.showInputDialog(project, "Name of the environment", "HTTP Connections", null, "staging", null);
                if (name == null || name.isBlank()) return;
                envs.environments().put(name, new Environment(new LinkedHashMap<>(Map.of("baseUrl", "https://")), new LinkedHashMap<>(), new LinkedHashMap<>(), new ArrayList<>(), new ArrayList<>()));
                envs = new Environments(name, envs.environments());
                write(envs);
                editEnvironments();
            } else {
                write(new Environments(names.get(i), envs.environments()));
            }
            refresh();
        }

        private void write(Environments envs) {
            try {
                writeEnvironments(base, envs);
            } catch (IOException e) {
                Messages.showErrorDialog(project, e.toString(), "HTTP Connections");
            }
        }

        void editEnvironments() {
            Path file = base.resolve(".nuclear/http.json");
            if (!Files.exists(file)) write(environments(base));
            VirtualFile vf = LocalFileSystem.getInstance().refreshAndFindFileByNioFile(file);
            if (vf != null) FileEditorManager.getInstance(project).openFile(vf, true);
        }

        void addOpenApi() {
            String source = Messages.showInputDialog(project, "OpenAPI document of an API that is not a Nuclear project: a url or a file path", "HTTP Connections", null, "http://localhost:8000/openapi.json", null);
            if (source == null || source.isBlank()) return;
            Environments envs = environments(base);
            Environment env = envs.environments().get(envs.active());
            if (env != null && !env.openapi().contains(source)) env.openapi().add(source);
            write(envs);
            refresh();
        }

        void addSocket() {
            String url = Messages.showInputDialog(project, "WebSocket url of a server that is not a Nuclear project (ws:// or wss://)", "HTTP Connections", null, "ws://localhost:8080", null);
            if (url == null || url.isBlank()) return;
            if (!url.trim().matches("(?i)^(wss?://|\\{\\{).*")) {
                Messages.showErrorDialog(project, "A ws:// or wss:// url (it may start with a {{variable}})", "HTTP Connections");
                return;
            }
            Environments envs = environments(base);
            Environment env = envs.environments().get(envs.active());
            if (env != null && !env.sockets().contains(url.trim())) env.sockets().add(url.trim());
            write(envs);
            refresh();
        }

        void updateContracts() {
            List<Proj> with = projects.stream().filter(p -> !p.contracts().isEmpty()).toList();
            if (with.isEmpty()) {
                Messages.showInfoMessage(project, "No project declares contracts (contracts(name = ...) in config.nuc).", "HTTP Connections");
                return;
            }
            Proj target = with.get(0);
            if (with.size() > 1) {
                int i = Messages.showChooseDialog(project, "Project whose contracts to update", "HTTP Connections", null, with.stream().map(Proj::name).toArray(String[]::new), with.get(0).name());
                if (i < 0) return;
                target = with.get(i);
            }
            Proj chosen = target;
            ApplicationManager.getApplication().executeOnPooledThread(() -> {
                String out;
                boolean ok;
                try {
                    Path local = Path.of(System.getProperty("user.home"), ".local", "bin", "nuclear");
                    Process p = new ProcessBuilder(Files.exists(local) ? local.toString() : "nuclear", "contracts", "update").directory(chosen.root().toFile()).redirectErrorStream(true).start();
                    out = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
                    ok = p.waitFor() == 0;
                } catch (Exception e) {
                    out = e.toString();
                    ok = false;
                }
                String text = out;
                boolean fine = ok;
                ApplicationManager.getApplication().invokeLater(() -> {
                    NotificationGroupManager.getInstance().getNotificationGroup("NuclearLang")
                            .createNotification("Nuclear contracts of " + chosen.name(), text.trim(), fine ? NotificationType.INFORMATION : NotificationType.ERROR)
                            .notify(project);
                    refresh();
                });
            });
        }
    }

    /**
     * The socket panel: one socket at a time, opened by the IDE with `java.net.http.WebSocket` (which sends no `Origin`,
     * so a guard that refuses one lets the tool in), `{{var}}` resolved from the active environment, its headers once at
     * the handshake; the message (JSON or text) with the sent ones as history; the log of both directions, filtered.
     * Closed when the tool window's content is disposed.
     */
    static final class SocketPanel extends JPanel {
        private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm:ss.SSS");
        private static final int LOG_MAX = 500;
        private static final int HISTORY_MAX = 30;

        record Entry(String time, String dir, String text) {}

        private final java.util.function.Supplier<Environment> env;
        private final JTextField url = new JTextField();
        private final JButton connect = new JButton("Connect");
        private final JLabel state = new JLabel("disconnected");
        private final JLabel hint = new JLabel();
        private final DefaultTableModel headers = new DefaultTableModel(new Object[]{"Header", "Value"}, 0);
        private final JBTextArea draft = new JBTextArea(5, 40);
        private final JComboBox<String> format = new JComboBox<>(new String[]{"JSON", "Text"});
        private final JButton send = new JButton("Send");
        private final JComboBox<String> history = new JComboBox<>();
        private final JLabel problem = new JLabel();
        private final JTextField filter = new JTextField(14);
        private final JComboBox<String> dir = new JComboBox<>(new String[]{"all", "received", "sent"});
        private final JBTextArea log = new JBTextArea();
        private final List<Entry> entries = new ArrayList<>();
        private final List<String> sent = new ArrayList<>();
        private WebSocket socket;
        private String status = "closed";

        SocketPanel(java.util.function.Supplier<Environment> env) {
            super(new BorderLayout(6, 6));
            this.env = env;
            setBorder(BorderFactory.createEmptyBorder(6, 8, 6, 8));
            JPanel top = new JPanel(new BorderLayout(6, 0));
            state.setPreferredSize(new Dimension(110, state.getPreferredSize().height));
            top.add(state, BorderLayout.WEST);
            top.add(url, BorderLayout.CENTER);
            top.add(connect, BorderLayout.EAST);
            connect.addActionListener(e -> {
                if ("closed".equals(status)) connect();
                else close();
            });
            JPanel head = new JPanel(new BorderLayout());
            head.add(top, BorderLayout.NORTH);
            hint.setForeground(JBColor.GRAY);
            head.add(hint, BorderLayout.SOUTH);
            add(head, BorderLayout.NORTH);

            JTabbedPane tabs = new JTabbedPane();
            JPanel message = new JPanel(new BorderLayout(4, 4));
            draft.setFont(new Font(Font.MONOSPACED, Font.PLAIN, draft.getFont().getSize()));
            message.add(new JBScrollPane(draft), BorderLayout.CENTER);
            JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT, 4, 0));
            actions.add(format);
            actions.add(send);
            actions.add(history);
            problem.setForeground(JBColor.RED);
            actions.add(problem);
            message.add(actions, BorderLayout.SOUTH);
            tabs.addTab("Message", message);
            JPanel headersPanel = new JPanel(new BorderLayout());
            headersPanel.add(new JBScrollPane(new JBTable(headers)), BorderLayout.CENTER);
            JButton addHeader = new JButton("+ header");
            addHeader.addActionListener(e -> headers.addRow(new Object[]{"", ""}));
            headersPanel.add(addHeader, BorderLayout.SOUTH);
            tabs.addTab("Headers", headersPanel);
            send.addActionListener(e -> send());
            history.addActionListener(e -> {
                int i = history.getSelectedIndex();
                if (i > 0) draft.setText(sent.get(i - 1));
            });

            JPanel logPanel = new JPanel(new BorderLayout(4, 4));
            JPanel logHead = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
            logHead.add(new JLabel("Messages"));
            logHead.add(filter);
            logHead.add(dir);
            JButton clear = new JButton("clear");
            clear.addActionListener(e -> {
                entries.clear();
                render();
            });
            logHead.add(clear);
            logPanel.add(logHead, BorderLayout.NORTH);
            log.setEditable(false);
            log.setFont(new Font(Font.MONOSPACED, Font.PLAIN, log.getFont().getSize()));
            logPanel.add(new JBScrollPane(log), BorderLayout.CENTER);
            filter.getDocument().addDocumentListener(new javax.swing.event.DocumentListener() {
                public void insertUpdate(javax.swing.event.DocumentEvent e) { render(); }
                public void removeUpdate(javax.swing.event.DocumentEvent e) { render(); }
                public void changedUpdate(javax.swing.event.DocumentEvent e) { render(); }
            });
            dir.addActionListener(e -> render());

            OnePixelSplitter v = new OnePixelSplitter(true, 0.4f);
            v.setFirstComponent(tabs);
            v.setSecondComponent(logPanel);
            add(v, BorderLayout.CENTER);
            showStatus();
            renderHistory();
        }

        static String toSocketScheme(String u) {
            return u.replaceFirst("(?i)^http(s?)://", "ws$1://");
        }

        private static String resolve(String text, Map<String, String> vars) {
            Matcher m = VAR.matcher(text);
            StringBuilder sb = new StringBuilder();
            while (m.find()) m.appendReplacement(sb, Matcher.quoteReplacement(vars.getOrDefault(m.group(1), m.group(0))));
            m.appendTail(sb);
            return sb.toString();
        }

        /** A new target: the socket of the previous one is closed; the contract's message goes into the draft. */
        void load(String target, List<String[]> guardHeaders, String template, String guardHeader) {
            if (!target.equals(url.getText())) {
                close();
                url.setText(target);
                headers.setRowCount(0);
                for (String[] h : guardHeaders) headers.addRow(new Object[]{h[0], h[1]});
            }
            Environment e = env.get();
            String vars = e == null ? "" : String.join(" ", e.vars().keySet().stream().map(k -> "{{" + k + "}}").toList());
            hint.setText((guardHeader == null ? "" : "its guards read a token from: " + guardHeader + "   ") + "variables: " + vars);
            if (template != null) {
                draft.setText(template);
                format.setSelectedItem("JSON");
            }
        }

        private void add(String dirName, String text) {
            SwingUtilities.invokeLater(() -> {
                entries.add(new Entry(LocalTime.now().format(TIME), dirName, text));
                if (entries.size() > LOG_MAX) entries.subList(0, entries.size() - LOG_MAX).clear();
                render();
            });
        }

        private void setStatus(String s) {
            SwingUtilities.invokeLater(() -> {
                status = s;
                showStatus();
            });
        }

        private void showStatus() {
            state.setText("open".equals(status) ? "● connected" : "connecting".equals(status) ? "● connecting…" : "○ disconnected");
            state.setForeground("open".equals(status) ? GET : "connecting".equals(status) ? PUT : JBColor.GRAY);
            connect.setText("closed".equals(status) ? "Connect" : "Disconnect");
            url.setEnabled("closed".equals(status));
            send.setEnabled("open".equals(status));
        }

        private void renderHistory() {
            history.removeAllItems();
            history.addItem(sent.isEmpty() ? "Nothing sent yet" : "Sent before (" + sent.size() + ")");
            for (String m : sent) history.addItem(m.replaceAll("\\s+", " ").substring(0, Math.min(60, m.replaceAll("\\s+", " ").length())));
            history.setEnabled(!sent.isEmpty());
        }

        private void render() {
            String q = filter.getText().trim().toLowerCase();
            String d = String.valueOf(dir.getSelectedItem());
            String want = "received".equals(d) ? "in" : "sent".equals(d) ? "out" : null;
            StringBuilder sb = new StringBuilder();
            for (Entry e : entries) {
                if (want != null && !want.equals(e.dir())) continue;
                if (!q.isEmpty() && !e.text().toLowerCase().contains(q)) continue;
                String arrow = switch (e.dir()) {
                    case "in" -> "↓";
                    case "out" -> "↑";
                    case "error" -> "!";
                    default -> "•";
                };
                String text = e.text();
                try {
                    JsonElement j = JsonParser.parseString(text);
                    if (j.isJsonObject() || j.isJsonArray()) text = PRETTY.toJson(j).replace("\n", "\n                   ");
                } catch (Exception ignored) {
                    // not JSON: as it came
                }
                sb.append(e.time()).append("  ").append(arrow).append("  ").append(text).append('\n');
            }
            log.setText(sb.toString());
            log.setCaretPosition(log.getDocument().getLength());
        }

        private void connect() {
            Environment e = env.get();
            Map<String, String> vars = e == null ? Map.of() : e.vars();
            String target = toSocketScheme(resolve(url.getText().trim(), vars));
            if (VAR.matcher(target).find()) {
                add("error", "a variable of " + target + " is not in the environment");
                return;
            }
            if (!target.matches("(?i)^wss?://.+")) {
                add("error", "not a ws:// or wss:// url: " + target);
                return;
            }
            Map<String, String> hs = new LinkedHashMap<>();
            if (e != null) for (Map.Entry<String, String> h : e.headers().entrySet()) hs.put(h.getKey(), resolve(h.getValue(), vars));
            for (int i = 0; i < headers.getRowCount(); i++) {
                String k = String.valueOf(headers.getValueAt(i, 0)).trim();
                if (!k.isEmpty()) hs.put(k, resolve(String.valueOf(headers.getValueAt(i, 1)), vars));
            }
            WebSocket.Builder b = HttpClient.newHttpClient().newWebSocketBuilder().connectTimeout(Duration.ofSeconds(10));
            for (Map.Entry<String, String> h : hs.entrySet()) {
                try {
                    b.header(h.getKey(), h.getValue());
                } catch (IllegalArgumentException ex) {
                    add("error", "header " + h.getKey() + " not allowed: " + ex.getMessage());
                }
            }
            setStatus("connecting");
            add("info", "connecting to " + target + (hs.isEmpty() ? "" : " · headers: " + String.join(", ", hs.keySet())));
            b.buildAsync(URI.create(target), new WebSocket.Listener() {
                private final StringBuilder text = new StringBuilder();

                @Override
                public void onOpen(WebSocket ws) {
                    socket = ws;
                    setStatus("open");
                    add("info", "connected to " + target);
                    ws.request(1);
                }

                @Override
                public CompletionStage<?> onText(WebSocket ws, CharSequence data, boolean last) {
                    text.append(data);
                    if (last) {
                        add("in", text.toString());
                        text.setLength(0);
                    }
                    ws.request(1);
                    return null;
                }

                @Override
                public CompletionStage<?> onBinary(WebSocket ws, java.nio.ByteBuffer data, boolean last) {
                    add("in", "[binary, " + data.remaining() + " bytes]");
                    ws.request(1);
                    return null;
                }

                @Override
                public CompletionStage<?> onClose(WebSocket ws, int code, String reason) {
                    if (socket == ws) socket = null;
                    setStatus("closed");
                    add("info", "closed (" + code + (reason == null || reason.isEmpty() ? "" : " " + reason) + ")");
                    return CompletableFuture.completedFuture(null);
                }

                @Override
                public void onError(WebSocket ws, Throwable error) {
                    if (socket == ws) socket = null;
                    setStatus("closed");
                    add("error", String.valueOf(error.getMessage() == null ? error : error.getMessage()));
                }
            }).whenComplete((ws, error) -> {
                if (error != null) {
                    setStatus("closed");
                    Throwable cause = error.getCause() == null ? error : error.getCause();
                    add("error", String.valueOf(cause.getMessage() == null ? cause : cause.getMessage()));
                }
            });
        }

        private void send() {
            String text = draft.getText();
            if (text.isBlank()) return;
            if ("JSON".equals(format.getSelectedItem())) {
                try {
                    JsonParser.parseString(text);
                    problem.setText("");
                } catch (Exception ex) {
                    problem.setText("Not valid JSON");
                    return;
                }
            }
            WebSocket ws = socket;
            if (ws == null) {
                add("error", "not connected: connect first");
                return;
            }
            Environment e = env.get();
            String resolved = resolve(text, e == null ? Map.of() : e.vars());
            ws.sendText(resolved, true).whenComplete((w, error) -> add(error == null ? "out" : "error", error == null ? resolved : String.valueOf(error.getMessage())));
            sent.remove(text);
            sent.add(0, text);
            if (sent.size() > HISTORY_MAX) sent.remove(sent.size() - 1);
            renderHistory();
        }

        /** Closes the socket (a normal closure), if one is open. */
        void close() {
            WebSocket ws = socket;
            socket = null;
            if (ws != null && !ws.isOutputClosed()) ws.sendClose(WebSocket.NORMAL_CLOSURE, "").exceptionally(error -> {
                ws.abort();
                return null;
            });
            status = "closed";
            showStatus();
        }
    }
}
