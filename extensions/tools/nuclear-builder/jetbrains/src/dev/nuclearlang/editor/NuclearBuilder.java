package dev.nuclearlang.editor;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.intellij.icons.AllIcons;
import com.intellij.openapi.actionSystem.ActionUpdateThread;
import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.actionSystem.AnActionEvent;
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
import com.intellij.ui.treeStructure.Tree;
import org.jetbrains.annotations.NotNull;

import javax.swing.*;
import javax.swing.tree.DefaultMutableTreeNode;
import javax.swing.tree.DefaultTreeModel;
import javax.swing.tree.TreeSelectionModel;
import java.awt.*;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/**
 * The "Nuclear Builder" tool window (ADR-platform-0003, spec 011): the specs (`specs/<id>/spec.md`) and runs
 * (`.nuclear/builder/runs/*.json`) of every project, each run as its stations and steps with the role, the employee, the
 * provider and the model of each, and actions that run the software factory as a process, as the VS Code Builder does:
 * `nuclear-builder run <spec> --team <id> --events` (JSON lines out, the answers as JSON lines in, exit 3 when it waits),
 * `run --resume`, `retry --from`, the server stages and the CI export. What a station asks is answered in dialogs: a
 * gate (approve, ask for a change, later), QA's plan (the user's checks marked), the spending (two questions, the second
 * with the amount and the providers). Alt+Shift+P opens it.
 */
public final class NuclearBuilder {
    static final JBColor PASSED = new JBColor(new Color(0x64FF00), new Color(0x2E8B57));
    static final JBColor FAILED = new JBColor(new Color(0xFF4B4B), new Color(0xD32F2F));
    static final JBColor RUNNING = new JBColor(new Color(0xFFD600), new Color(0xB8860B));

    private NuclearBuilder() {}

    /** A node of the tree: what it shows and what a click opens. */
    record Item(String text, String detail, String status, Path file, String log, HttpConnections.Proj project, Path spec, String run) {
        @Override
        public String toString() {
            return text;
        }
    }

    public static final class Window implements ToolWindowFactory {
        @Override
        public void createToolWindowContent(@NotNull Project project, @NotNull ToolWindow window) {
            Panel panel = new Panel(project);
            window.getContentManager().addContent(ContentFactory.getInstance().createContent(panel, "", false));
            window.setTitleActions(List.of(
                    panel.action("New Spec", AllIcons.General.Add, panel::newSpec),
                    panel.action("Run the Spec with a Team…", AllIcons.Actions.Execute, panel::runSpec),
                    panel.action("Go On (a run that waits)", AllIcons.Actions.Resume, panel::resume),
                    panel.action("Run a Station Again…", AllIcons.Actions.Rerun, panel::retry),
                    panel.action("Server Stages (nuclear-builder ci)", AllIcons.Actions.Compile, panel::ci),
                    panel.action("Export CI", AllIcons.Actions.Upload, panel::export),
                    panel.action("Stop", AllIcons.Actions.Suspend, panel::stop),
                    panel.action("Refresh", AllIcons.Actions.Refresh, panel::refresh)));
        }
    }

    /** Alt+Shift+P (plugin.xml): opens the tool window from anywhere. */
    public static final class Open extends AnAction {
        @Override
        public void actionPerformed(@NotNull AnActionEvent e) {
            Project project = e.getProject();
            if (project == null) return;
            ToolWindow w = ToolWindowManager.getInstance(project).getToolWindow("Nuclear Builder");
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
        private final JBTextArea log = new JBTextArea();
        private final Timer poll = new Timer(1500, e -> refresh());
        private Process running;
        /** The question the running process waits on (its `ask`), answered once. */
        private JsonObject asked;
        private boolean restoring;

        Panel(Project project) {
            super(new BorderLayout());
            this.project = project;
            this.base = Path.of(project.getBasePath() == null ? "." : project.getBasePath());
            tree.setRootVisible(false);
            tree.getSelectionModel().setSelectionMode(TreeSelectionModel.SINGLE_TREE_SELECTION);
            tree.setCellRenderer(new ColoredTreeCellRenderer() {
                @Override
                public void customizeCellRenderer(@NotNull JTree t, Object value, boolean sel, boolean exp, boolean leaf, int row, boolean focus) {
                    if (!(((DefaultMutableTreeNode) value).getUserObject() instanceof Item item)) return;
                    JBColor color = switch (item.status() == null ? "" : item.status()) {
                        case "passed" -> PASSED;
                        case "failed" -> FAILED;
                        case "running", "waiting" -> RUNNING;
                        default -> null;
                    };
                    String mark = switch (item.status() == null ? "" : item.status()) {
                        case "passed" -> "✓ ";
                        case "failed" -> "✗ ";
                        case "running" -> "▶ ";
                        case "skipped" -> "· ";
                        case "waiting" -> "? ";
                        default -> "";
                    };
                    append(mark + item.text(), color == null ? SimpleTextAttributes.REGULAR_ATTRIBUTES : new SimpleTextAttributes(SimpleTextAttributes.STYLE_BOLD, color));
                    if (!item.detail().isEmpty()) append("  " + item.detail(), SimpleTextAttributes.GRAYED_ATTRIBUTES);
                }
            });
            tree.addTreeSelectionListener(e -> {
                Item item = selected();
                if (item == null || restoring) return;
                if (item.log() != null) log.setText(item.log());
                if (item.file() != null && Files.isRegularFile(item.file())) open(item.file());
            });
            log.setEditable(false);
            log.setFont(new Font(Font.MONOSPACED, Font.PLAIN, log.getFont().getSize()));
            OnePixelSplitter split = new OnePixelSplitter(true, 0.55f);
            split.setFirstComponent(new JBScrollPane(tree));
            split.setSecondComponent(new JBScrollPane(log));
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

        private Item selected() {
            Object n = tree.getLastSelectedPathComponent();
            return n instanceof DefaultMutableTreeNode d && d.getUserObject() instanceof Item i ? i : null;
        }

        /** The project of the selection, or the only project. */
        private HttpConnections.Proj projectOf() {
            Item item = selected();
            if (item != null && item.project() != null) return item.project();
            List<HttpConnections.Proj> all = HttpConnections.findProjects(base);
            if (all.size() == 1) return all.get(0);
            Messages.showInfoMessage(project, "Select a project, a spec or a run in the Nuclear Builder window first.", "Nuclear Builder");
            return null;
        }

        void refresh() {
            // the selection is kept by its labels: the tree is read again from the files
            List<String> keep = new ArrayList<>();
            if (tree.getSelectionPath() != null) for (Object o : tree.getSelectionPath().getPath()) keep.add(String.valueOf(o));
            DefaultMutableTreeNode root = new DefaultMutableTreeNode();
            for (HttpConnections.Proj p : HttpConnections.findProjects(base)) {
                DefaultMutableTreeNode pn = new DefaultMutableTreeNode(new Item(p.name(), (p.platform() == null ? "" : p.platform() + " · ") + p.dialect(), null, null, null, p, null, null));
                DefaultMutableTreeNode specs = new DefaultMutableTreeNode(new Item("Specs", "", null, null, null, p, null, null));
                for (Path spec : specs(p.root())) {
                    String id = spec.getParent().getFileName().toString();
                    specs.add(new DefaultMutableTreeNode(new Item(id, "", null, spec, null, p, spec, null)));
                }
                pn.add(specs);
                DefaultMutableTreeNode runs = new DefaultMutableTreeNode(new Item("Runs", "", null, null, null, p, null, null));
                for (JsonObject run : runs(p.root())) runs.add(runNode(p, run));
                pn.add(runs);
                root.add(pn);
            }
            restoring = true;
            tree.setModel(new DefaultTreeModel(root));
            for (int i = 0; i < tree.getRowCount() && i < 64; i++) tree.expandRow(i);
            DefaultMutableTreeNode at = root;
            for (String label : keep.subList(Math.min(1, keep.size()), keep.size())) {
                DefaultMutableTreeNode next = null;
                for (int i = 0; i < at.getChildCount() && next == null; i++) {
                    DefaultMutableTreeNode c = (DefaultMutableTreeNode) at.getChildAt(i);
                    if (String.valueOf(c).equals(label)) next = c;
                }
                if (next == null) break;
                at = next;
            }
            if (at != root) tree.setSelectionPath(new javax.swing.tree.TreePath(at.getPath()));
            restoring = false;
            if (running == null || !running.isAlive()) poll.stop();
        }

        private DefaultMutableTreeNode runNode(HttpConnections.Proj p, JsonObject run) {
            JsonObject spec = run.getAsJsonObject("spec");
            Path specFile = p.root().resolve("specs").resolve(str(run, "id")).resolve("spec.md");
            String id = str(run, "id");
            double cost = run.has("costUsd") && !run.get("costUsd").isJsonNull() ? run.get("costUsd").getAsDouble() : 0;
            JsonObject factory = run.has("factory") && run.get("factory").isJsonObject() ? run.getAsJsonObject("factory") : null;
            JsonObject waiting = run.has("waiting") && run.get("waiting").isJsonObject() ? run.getAsJsonObject("waiting") : null;
            String detail = (factory == null ? "earlier engine: run it again from scratch" : "team " + str(factory, "teamName")) + (cost > 0 ? String.format(" · USD %.2f", cost) : "")
                    + (waiting == null ? "" : " · waits for you: " + str(waiting, "question"));
            DefaultMutableTreeNode rn = new DefaultMutableTreeNode(new Item(str(spec, "title"), detail, str(run, "status"), null, waiting == null ? null : str(waiting, "question"), p, specFile, id));
            for (JsonElement se : run.getAsJsonArray("stages")) {
                JsonObject stage = se.getAsJsonObject();
                String who = str(stage, "role").isEmpty() ? "" : str(stage, "role") + " · " + str(stage, "provider") + (str(stage, "model").isEmpty() ? "" : " " + str(stage, "model"));
                DefaultMutableTreeNode sn = new DefaultMutableTreeNode(new Item(str(stage, "title"), who.isEmpty() ? str(stage, "about") : who, str(stage, "status"), null, str(stage, "about"), p, specFile, id));
                for (JsonElement st : stage.getAsJsonArray("steps")) {
                    JsonObject step = st.getAsJsonObject();
                    String file = str(step, "file");
                    StringBuilder text = new StringBuilder();
                    if (step.has("trace")) for (JsonElement t : step.getAsJsonArray("trace")) {
                        JsonObject ti = t.getAsJsonObject();
                        text.append("· ").append(str(ti, "step")).append(": ").append(str(ti, "detail")).append('\n');
                    }
                    if (!str(step, "input").isEmpty()) text.append("\n# input\n").append(str(step, "input")).append('\n');
                    if (!str(step, "code").isEmpty()) text.append("\n# code\n").append(str(step, "code")).append('\n');
                    text.append("\n# output\n").append(str(step, "log"));
                    // who did it: the role, the employee hired for it, the provider and the model (a command: shell; an answer: you)
                    String by = str(step, "provider").isEmpty() ? str(step, "actor")
                            : str(step, "role") + (str(step, "employee").isEmpty() ? "" : " (" + str(step, "employee") + ")") + " · " + str(step, "provider") + (str(step, "model").isEmpty() ? "" : " " + str(step, "model"));
                    if (step.has("files") && step.get("files").isJsonArray()) {
                        text.append("\n# files\n");
                        for (JsonElement f : step.getAsJsonArray("files")) text.append(f.getAsString()).append('\n');
                    }
                    if (file.isEmpty() && step.has("files") && step.get("files").isJsonArray() && !step.getAsJsonArray("files").isEmpty()) file = step.getAsJsonArray("files").get(0).getAsString();
                    sn.add(new DefaultMutableTreeNode(new Item(str(step, "title"), by + (str(step, "summary").isEmpty() ? "" : " — " + str(step, "summary")),
                            str(step, "status"), file.isEmpty() ? null : p.root().resolve(file), text.toString(), p, specFile, id)));
                }
                rn.add(sn);
            }
            return rn;
        }

        private static List<Path> specs(Path root) {
            try (Stream<Path> s = Files.list(root.resolve("specs"))) {
                return s.map(d -> d.resolve("spec.md")).filter(Files::isRegularFile).sorted().toList();
            } catch (IOException e) {
                return List.of();
            }
        }

        private static List<JsonObject> runs(Path root) {
            List<JsonObject> out = new ArrayList<>();
            try (Stream<Path> s = Files.list(root.resolve(".nuclear/builder/runs"))) {
                for (Path f : s.filter(x -> x.toString().endsWith(".json")).toList()) {
                    try {
                        out.add(JsonParser.parseString(Files.readString(f)).getAsJsonObject());
                    } catch (Exception ignored) {
                        // a run being written: the next refresh reads it
                    }
                }
            } catch (IOException ignored) {
            }
            out.sort((a, b) -> Long.compare(b.get("created").getAsLong(), a.get("created").getAsLong()));
            return out;
        }

        private static String str(JsonObject o, String key) {
            return o != null && o.has(key) && !o.get(key).isJsonNull() && o.get(key).isJsonPrimitive() ? o.get(key).getAsString() : "";
        }

        private void open(Path file) {
            VirtualFile vf = LocalFileSystem.getInstance().refreshAndFindFileByNioFile(file);
            if (vf != null) FileEditorManager.getInstance(project).openFile(vf, false);
        }

        void newSpec() {
            HttpConnections.Proj p = projectOf();
            if (p == null) return;
            String title = Messages.showInputDialog(project, "Title of the spec", "New Nuclear Builder Spec", null);
            if (title == null || title.isBlank()) return;
            String id = title.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
            Path file = p.root().resolve("specs").resolve(id.isEmpty() ? "spec" : id).resolve("spec.md");
            try {
                Files.createDirectories(file.getParent());
                if (!Files.exists(file)) Files.writeString(file, "# " + title + "\n\n- Use case: feature\n- Source: local\n\n## Description\n\n\n\n## Acceptance criteria\n\n- [ ] \n");
            } catch (IOException e) {
                Messages.showErrorDialog(project, e.getMessage(), "Nuclear Builder");
                return;
            }
            open(file);
            refresh();
        }

        /** Runs the selected spec with a team of `nuclear-builder team list` (the project's or the default team first). */
        void runSpec() {
            Item item = selected();
            if (item == null || item.spec() == null || !Files.isRegularFile(item.spec())) {
                Messages.showInfoMessage(project, "Select a spec (or a run of it) first.", "Nuclear Builder");
                return;
            }
            HttpConnections.Proj p = item.project();
            List<String> ids = new ArrayList<>(), names = new ArrayList<>(), warnings = new ArrayList<>();
            try {
                for (JsonElement t : JsonParser.parseString(capture(p.root(), List.of("team", "list", "--json"))).getAsJsonArray()) {
                    JsonObject o = t.getAsJsonObject();
                    boolean dflt = o.has("default") && o.get("default").getAsBoolean();
                    ids.add(dflt ? 0 : ids.size(), str(o, "id"));
                    names.add(dflt ? 0 : names.size(), str(o, "name") + (dflt ? " (default)" : ""));
                    // a member that named the local kind, converted on read to an external one (ADR-platform-0013)
                    if (o.has("warnings") && o.get("warnings").isJsonArray()) for (JsonElement w : o.getAsJsonArray("warnings")) if (w.isJsonPrimitive()) warnings.add(str(o, "name") + ": " + w.getAsString());
                }
            } catch (Exception e) {
                // no team yet (or a nuclear-builder older than spec 011): the engine works with its default team
            }
            List<String> args = new ArrayList<>(List.of("run", p.root().relativize(item.spec()).toString()));
            if (!ids.isEmpty()) {
                String[] options = names.toArray(String[]::new);
                int i = Messages.showChooseDialog(project, "The team that works this run (Settings and integrations in VS Code makes and changes them)" + (warnings.isEmpty() ? "" : "\n\n" + String.join("\n", warnings)), "Run the Spec", null, options, options[0]);
                if (i < 0) return;
                args.addAll(List.of("--team", ids.get(i)));
            }
            start(p, args);
        }

        /** A run that waits (it was left at a question, or its editor closed): it goes on and asks again. */
        void resume() {
            Item item = selected();
            if (item == null || item.run() == null) {
                Messages.showInfoMessage(project, "Select a run first.", "Nuclear Builder");
                return;
            }
            start(item.project(), List.of("run", "--resume", item.run()));
        }

        /** A station and every one after it again; what they wrote is undone first. */
        void retry() {
            Item item = selected();
            if (item == null || item.run() == null) {
                Messages.showInfoMessage(project, "Select a run first.", "Nuclear Builder");
                return;
            }
            String[] stations = {"analysis", "design", "tests", "code", "quality", "delivery", "from scratch"};
            int i = Messages.showChooseDialog(project, "Run again from the station", "Run a Station Again", null, stations, stations[3]);
            if (i < 0) return;
            start(item.project(), i == stations.length - 1 ? List.of("restart", item.run()) : List.of("retry", item.run(), "--from", stations[i]));
        }

        void ci() {
            HttpConnections.Proj p = projectOf();
            if (p != null) start(p, List.of("ci"));
        }

        void export() {
            HttpConnections.Proj p = projectOf();
            if (p == null) return;
            String[] providers = {"github", "gitlab", "bitbucket"};
            int i = Messages.showChooseDialog(project, "Where the pipeline runs", "Export CI", null, providers, providers[0]);
            if (i >= 0) start(p, List.of("export", providers[i]));
        }

        /** A run that waits keeps waiting (its stdin is closed); one that works is interrupted (SIGINT): its working
         * steps fail and what they wrote is undone. */
        void stop() {
            if (running == null || !running.isAlive()) return;
            try {
                if (asked != null) running.getOutputStream().close();
                else if (!System.getProperty("os.name").toLowerCase().startsWith("windows")) new ProcessBuilder("kill", "-INT", String.valueOf(running.pid())).start();
                else running.destroy();
            } catch (IOException e) {
                running.destroy();
            }
        }

        /** `nuclear-builder <args>` in the project, for a short call with JSON on stdout (`team list`, `checks`). */
        private static String capture(Path root, List<String> args) throws IOException, InterruptedException {
            List<String> command = new ArrayList<>(List.of("nuclear-builder"));
            command.addAll(args);
            Process p = new ProcessBuilder(command).directory(root.toFile()).redirectError(ProcessBuilder.Redirect.DISCARD).start();
            p.getOutputStream().close();
            String out = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            p.waitFor();
            return out;
        }

        /** `nuclear-builder <args>` in the project. The line's commands (`run`, `retry`, `restart`) run as the factory's
         * process (`--events`): each event a line of the log, each question a dialog whose answer goes on its stdin; the
         * tree follows the run file. The others stream their output into the log. */
        private void start(HttpConnections.Proj p, List<String> args) {
            if (running != null && running.isAlive()) {
                Messages.showInfoMessage(project, "A Builder command is still running (Stop ends it).", "Nuclear Builder");
                return;
            }
            boolean events = List.of("run", "retry", "restart").contains(args.get(0));
            List<String> command = new ArrayList<>();
            command.add("nuclear-builder");
            command.addAll(args);
            if (events) command.add("--events");
            log.setText("$ " + String.join(" ", command) + "\n");
            asked = null;
            try {
                running = new ProcessBuilder(command).directory(p.root().toFile()).redirectErrorStream(!events).start();
            } catch (IOException e) {
                log.append("nuclear-builder is not installed (installer/install.sh of NuclearLang): " + e.getMessage() + "\n");
                return;
            }
            poll.start();
            Process proc = running;
            if (events) ApplicationManager.getApplication().executeOnPooledThread(() -> {
                try (BufferedReader r = new BufferedReader(new InputStreamReader(proc.getErrorStream(), StandardCharsets.UTF_8))) {
                    for (String line; (line = r.readLine()) != null; ) {
                        String l = line;
                        SwingUtilities.invokeLater(() -> log.append(l + "\n"));
                    }
                } catch (IOException ignored) {
                }
            });
            ApplicationManager.getApplication().executeOnPooledThread(() -> {
                try (BufferedReader r = new BufferedReader(new InputStreamReader(proc.getInputStream(), StandardCharsets.UTF_8))) {
                    for (String line; (line = r.readLine()) != null; ) {
                        String l = line;
                        SwingUtilities.invokeLater(() -> {
                            if (events) said(p, proc, l);
                            else log.append(l + "\n");
                        });
                    }
                    int code = proc.waitFor();
                    SwingUtilities.invokeLater(() -> {
                        asked = null;
                        log.append("\nexit " + code + (code == 3 ? ": the run waits for you (Go On asks again)" : "") + "\n");
                        refresh();
                        LocalFileSystem.getInstance().refresh(true);
                    });
                } catch (IOException | InterruptedException e) {
                    SwingUtilities.invokeLater(() -> log.append(e.getMessage() + "\n"));
                }
            });
        }

        /** A line of the factory's process: an event for the log, a question for a dialog, the end. */
        private void said(HttpConnections.Proj p, Process proc, String line) {
            JsonObject m;
            try {
                m = JsonParser.parseString(line).getAsJsonObject();
            } catch (Exception e) {
                log.append(line + "\n");
                return;
            }
            switch (str(m, "type")) {
                case "event" -> {
                    JsonObject e = m.has("event") && m.get("event").isJsonObject() ? m.getAsJsonObject("event") : new JsonObject();
                    String what = str(e, "type");
                    String text = switch (what) {
                        case "tool" -> "tool " + str(e, "tool") + " " + str(e, "input");
                        case "trace", "retry" -> str(e, "step") + ": " + str(e, "detail");
                        case "cost" -> "cost " + str(e, "usd");
                        default -> str(e, "text");
                    };
                    if (!text.isBlank()) log.append("· " + str(m, "step") + "  " + (text.length() > 300 ? text.substring(0, 300) + "…" : text) + "\n");
                }
                case "ask" -> {
                    asked = m;
                    refresh();
                    log.append("\n? " + str(m, "question") + "\n");
                    JsonObject answer = switch (str(m, "kind")) {
                        case "spending" -> spending(m);
                        case "checks" -> checks(p, m);
                        default -> gate(p, m);
                    };
                    if (answer == null) {
                        // later: stdin closed, the run waits (exit 3) and Go On asks again
                        stop();
                        return;
                    }
                    asked = null;
                    try {
                        OutputStream in = proc.getOutputStream();
                        in.write((answer + "\n").getBytes(StandardCharsets.UTF_8));
                        in.flush();
                        log.append("→ " + str(answer, "answer") + (str(answer, "text").isEmpty() ? "" : ": " + str(answer, "text")) + "\n");
                    } catch (IOException e) {
                        log.append(e.getMessage() + "\n");
                    }
                }
                case "done" -> log.append("\n" + str(m, "status") + (m.has("costUsd") && !m.get("costUsd").isJsonNull() && m.get("costUsd").getAsDouble() > 0 ? String.format(" · USD %.3f", m.get("costUsd").getAsDouble()) : "") + "\n");
                default -> log.append(line + "\n");
            }
        }

        private static JsonObject answer(String a, String text) {
            JsonObject o = new JsonObject();
            o.addProperty("answer", a);
            if (text != null) o.addProperty("text", text);
            return o;
        }

        /** A gate: approve, ask for a change (the station works again with it), or later (the run waits). */
        private JsonObject gate(HttpConnections.Proj p, JsonObject m) {
            StringBuilder docs = new StringBuilder();
            if (m.has("documents") && m.get("documents").isJsonArray()) for (JsonElement d : m.getAsJsonArray("documents")) {
                docs.append("\n  ").append(d.getAsString());
                Path f = p.root().resolve(d.getAsString());
                if (Files.isRegularFile(f)) open(f);
            }
            int i = Messages.showDialog(project, str(m, "question") + (docs.length() == 0 ? "" : "\n\nRead first:" + docs), "Nuclear Builder", new String[]{"Approve", "Ask for a Change…", "Later"}, 0, Messages.getQuestionIcon());
            if (i == 0) return answer("approve", null);
            if (i == 1) {
                String text = Messages.showMultilineInputDialog(project, "What should change", "Ask for a Change", "", null, null);
                return text == null || text.isBlank() ? null : answer("change", text.trim());
            }
            return null;
        }

        /** QA's plan: the user's checks that are on are marked (done or failed), then QA runs the rest. */
        private JsonObject checks(HttpConnections.Proj p, JsonObject m) {
            String run = m.has("checks") ? Path.of(str(m, "checks")).getParent().getFileName().toString() : "";
            try {
                for (JsonElement e : JsonParser.parseString(capture(p.root(), List.of("checks", run, "--json"))).getAsJsonArray()) {
                    JsonObject c = e.getAsJsonObject();
                    if (!"user".equals(str(c, "by")) || !c.get("on").getAsBoolean() || !"pending".equals(str(c, "state"))) continue;
                    int i = Messages.showDialog(project, "Your check: " + str(c, "title") + "\n\nRun it, then mark it.", "QA's Plan", new String[]{"Done", "Failed", "Later"}, 0, Messages.getQuestionIcon());
                    if (i < 0 || i == 2) return null;
                    capture(p.root(), List.of("checks", run, "mark", str(c, "id"), i == 0 ? "passed" : "failed", "--json"));
                }
            } catch (Exception e) {
                log.append("checks: " + e.getMessage() + "\n");
            }
            int go = Messages.showDialog(project, str(m, "question"), "QA's Plan", new String[]{"Go On", "Later"}, 0, Messages.getQuestionIcon());
            return go == 0 ? answer("yes", null) : null;
        }

        /** The money (spec 011): asked twice before the first paid call, the second time with the amount and the
         * providers. The engine asks twice; both are answered here, each with its own dialog. */
        private JsonObject spending(JsonObject m) {
            StringBuilder who = new StringBuilder();
            if (m.has("providers") && m.get("providers").isJsonArray()) for (JsonElement e : m.getAsJsonArray("providers")) who.append(who.length() == 0 ? "" : ", ").append(e.getAsString());
            boolean second = "spending-2".equals(str(m, "id"));
            String text = second
                    ? String.format("Spend up to %.2f USD with %s?", m.has("budgetUsd") ? m.get("budgetUsd").getAsDouble() : 5.0, who)
                    : "This run can spend money with " + who + ". Go on?";
            int i = Messages.showYesNoDialog(project, text, second ? "Confirm the Spending" : "Paid Providers", second ? "Spend" : "Go On", "No", Messages.getWarningIcon());
            return answer(i == Messages.YES ? "yes" : "no", null);
        }
    }
}
