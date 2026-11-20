#!/bin/sh
# The stack an installation must leave running, checked on this real machine (read-only: it changes nothing):
#   installer/tests/stack.sh
# After a first install, a second one and an update over an older release, every one of these must hold:
#   - one job of each service in the system's manager (launchd on macOS, systemd on Linux): the Smart Graph, Nuclear Chat
#   - one process serving each service (no copy of an older version, of a source install or started by hand)
#   - each service answers on the port the machine's file (ai.env) gives it
#   - the MCP server is in at least one AI client, and the editor extension is installed
# The fake-HOME tests (run.sh) cannot start services; this is the check of a real machine (the release runbook, step 7).
set -u
fails=0
ok() { printf '  \342\234\223 %s\n' "$*"; }
bad() { printf '  \342\234\227 %s\n' "$*"; fails=$((fails + 1)); }
case "$(uname -s)" in Darwin) os=macos ;; Linux) os=linux ;; *) echo "stack.sh: Linux or macOS only"; exit 2 ;; esac
env_file="${XDG_CONFIG_HOME:-$HOME/.config}/nuclearlang/ai.env"
port_of() { v=$(sed -n "s/^$1=//p" "$env_file" 2>/dev/null | tail -n 1); printf '%s' "${v:-$2}"; }

# the processes serving a service: the marks of nuclear-builder's SERVICE_MARKS, `serve` as the command, no shell
serving() { ps -axo pid=,command= | grep -E "$1" | grep -E ' serve( |$)' | grep -v '/bin/sh -c' | grep -v grep | awk '{print $1}'; }

for svc in graph chat; do
  case $svc in
    graph) title="Smart Graph"; port=$(port_of NUCLEAR_GRAPH_PORT 7878); path=/v1/health; marks='nuclear_graph\.cli|nuclear-graph serve' ;;
    chat) title="Nuclear Chat"; port=$(port_of NUCLEAR_CHAT_PORT 7880); path=/workspaces; marks='nuclear_chat_system\.cli|nuclear-chat serve' ;;
  esac
  if [ "$os" = macos ]; then
    jobs=$(launchctl list | grep -c "io.github.nuclearlang.$svc\$")
    plists=$(ls "$HOME/Library/LaunchAgents" 2>/dev/null | grep -c "nuclearlang.$svc")
    [ "$plists" = 1 ] && ok "$title: one launch agent file" || bad "$title: $plists launch agent files in ~/Library/LaunchAgents"
  else
    jobs=$(systemctl --user list-units --all --no-legend "nuclear-$svc.service" 2>/dev/null | grep -c "nuclear-$svc")
  fi
  [ "$jobs" = 1 ] && ok "$title: one job in the system's manager" || bad "$title: $jobs jobs in the system's manager"
  procs=$(serving "$marks" | wc -l | tr -d ' ')
  [ "$procs" = 1 ] && ok "$title: one process serving it" || bad "$title: $procs processes serving it ($(serving "$marks" | tr '\n' ' '))"
  code=$(curl -s -m 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port$path" || true)
  case $code in 2*|3*|4[0-9][0-9]) [ "$code" -lt 500 ] && ok "$title answers on 127.0.0.1:$port (ai.env)" || bad "$title: $code on 127.0.0.1:$port" ;;
    *) bad "$title does not answer on 127.0.0.1:$port (the port of ai.env)" ;; esac
done

# the MCP server in an AI client, and the editor extension
mcp=0
for f in "$HOME/.claude.json" "$HOME/.cursor/mcp.json" "$HOME/.gemini/settings.json" "$HOME/.codex/config.toml" "${XDG_CONFIG_HOME:-$HOME/.config}/opencode/opencode.json"; do
  [ -f "$f" ] && grep -q 'nuclear-mcp' "$f" && mcp=1
done
[ "$mcp" = 1 ] && ok "the MCP server is in an AI client" || bad "the MCP server is in no AI client (nuclear-builder setup --clients)"
ext=0
for cli in code cursor codium windsurf; do
  command -v "$cli" >/dev/null 2>&1 && "$cli" --list-extensions 2>/dev/null | grep -qi '^nuclearlang\.nuclearlang$' && ext=1
done
[ "$ext" = 1 ] && ok "the editor extension is installed" || bad "the editor extension is in no editor of this machine"

echo
if [ "$fails" = 0 ]; then echo "the stack is whole: one of each, every service answering"; exit 0; fi
echo "$fails problem(s): run the installer again (it goes on from what failed), then this check"
exit 1
