package dev.nuclearlang.editor;

import com.intellij.ide.plugins.IdeaPluginDescriptor;
import com.intellij.ide.plugins.PluginManagerCore;
import com.intellij.ide.util.PropertiesComponent;
import com.intellij.openapi.extensions.PluginId;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;

/** Application-wide settings of the plugin and the files it ships (server binary, dialects, TextMate bundle). */
public final class NuclearSettings {
    public static final String PLUGIN_ID = "dev.nuclearlang";
    private static final String DIALECT = "nuclear.dialect";
    private static final String SERVER_PATH = "nuclear.server.path";
    private static final String FOLLOW = "nuclear.debug.followInNuclear";
    private static final String EXPLAIN = "nuclear.debug.explainErrors";

    private NuclearSettings() {}

    public static String dialect() {
        return PropertiesComponent.getInstance().getValue(DIALECT, "flutter");
    }

    public static void setDialect(String value) {
        PropertiesComponent.getInstance().setValue(DIALECT, value, "flutter");
    }

    public static String serverPath() {
        return PropertiesComponent.getInstance().getValue(SERVER_PATH, "");
    }

    public static void setServerPath(String value) {
        PropertiesComponent.getInstance().setValue(SERVER_PATH, value, "");
    }

    /** When a Synapsis app pauses, show and highlight the `.nuc` line of the paused code. */
    public static boolean followInNuclear() {
        return PropertiesComponent.getInstance().getBoolean(FOLLOW, true);
    }

    public static void setFollowInNuclear(boolean value) {
        PropertiesComponent.getInstance().setValue(FOLLOW, value, true);
    }

    /** Mark Dart run-time errors at their `.nuc` line and explain them in the "Nuclear Error" tool window. */
    public static boolean explainErrors() {
        return PropertiesComponent.getInstance().getBoolean(EXPLAIN, true);
    }

    public static void setExplainErrors(boolean value) {
        PropertiesComponent.getInstance().setValue(EXPLAIN, value, true);
    }

    /** Root directory of the installed plugin. */
    public static Path pluginPath() {
        IdeaPluginDescriptor plugin = PluginManagerCore.getPlugin(PluginId.getId(PLUGIN_ID));
        return plugin == null ? null : plugin.getPluginPath();
    }

    /**
     * The nuclear-lsp binary: setting → the installer's (this system's own build) → PATH → bundled with the plugin.
     * The bundled one may be another system's build, so it is the last resort.
     */
    public static String findServer() {
        String configured = serverPath();
        if (!configured.isBlank()) {
            return configured;
        }
        boolean windows = System.getProperty("os.name").toLowerCase().contains("win");
        String exe = windows ? "nuclear-lsp.exe" : "nuclear-lsp";
        String install = System.getenv("NUCLEAR_INSTALL");
        if (install == null || install.isBlank()) {
            String local = System.getenv("LOCALAPPDATA");
            install = windows && local != null ? Path.of(local, "nuclearlang").toString()
                : Path.of(System.getProperty("user.home"), ".local", "share", "nuclearlang").toString();
        }
        Path installed = Path.of(install, "bin", exe);
        if (Files.isExecutable(installed)) {
            return installed.toString();
        }
        String path = System.getenv("PATH");
        if (path != null) {
            for (String dir : path.split(File.pathSeparator)) {
                Path candidate = Path.of(dir, exe);
                if (Files.isExecutable(candidate)) {
                    return candidate.toString();
                }
            }
        }
        Path root = pluginPath();
        if (root != null) {
            Path bundled = root.resolve("server").resolve(exe);
            if (Files.isRegularFile(bundled)) {
                bundled.toFile().setExecutable(true);
                return bundled.toString();
            }
        }
        return null;
    }
}
