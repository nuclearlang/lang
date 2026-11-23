"""The known advisories of what an app runs on, per dialect: the Python the checks install (the runtime's
dependencies at the versions of nuclearlang/tools/python/requirements.txt, with pip-audit), the TypeScript runtime
(packages/synapsis-nest and its lock file, with `npm audit`) and a generated project (the package.json `nuclear build`
wrote for store_api, resolved now, with `npm audit`). Each advisory is a finding (`security advisory.<where>:<package>:<id>`):
a new one fails the check until it is fixed or written in known.txt with whether the runtime's use is affected.

Needs the network (the advisory databases of PyPI and npm). Run: python audit.py <work folder> <root of the tree>
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

work, root = Path(sys.argv[1]), Path(sys.argv[2])
backend = root / "nuclear-synapsis-framework/platforms/backend"
found: list[str] = []
failed = False


def run(args: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=600)


def python() -> None:
    global failed
    r = run(["uv", "tool", "run", "--quiet", "pip-audit", "--disable-pip", "--no-deps", "--format", "json", "--progress-spinner", "off",
             "-r", str(root / "nuclearlang/tools/python/requirements.txt")], work)
    try:
        report: dict[str, Any] = json.loads(r.stdout)
    except ValueError:
        print(f"FAIL advisories python: pip-audit gave no report: {(r.stderr or r.stdout).strip()[-300:]}")
        failed = True
        return
    packages = report.get("dependencies", [])
    for p in packages:
        for v in p.get("vulns", []):
            fixed = ", ".join(v.get("fix_versions", [])) or "no fixed version"
            found.append(f"security advisory.python:{p['name']}:{v['id']} | {p['name']} {p['version']} ({' '.join(v.get('aliases', []))}), fixed in {fixed}: {' '.join(str(v.get('description', '')).split())[:200]}")
    print(f"advisories python: {len(packages)} packages of requirements.txt, {sum(len(p.get('vulns', [])) for p in packages)} advisories")


def npm(where: str, folder: Path) -> None:
    global failed
    r = run(["npm", "audit", "--json"], folder)
    try:
        report: dict[str, Any] = json.loads(r.stdout)
    except ValueError:
        print(f"FAIL advisories {where}: npm audit gave no report: {(r.stderr or r.stdout).strip()[-300:]}")
        failed = True
        return
    if "error" in report:
        print(f"FAIL advisories {where}: npm audit: {json.dumps(report['error'])[:300]}")
        failed = True
        return
    vulnerable: dict[str, Any] = report.get("vulnerabilities", {})
    for name, v in sorted(vulnerable.items()):
        own = [via for via in v.get("via", []) if isinstance(via, dict)]
        through = [via for via in v.get("via", []) if isinstance(via, str)]
        for via in own:
            found.append(f"security advisory.{where}:{name}:{str(via.get('url', '')).rsplit('/', 1)[-1]} | {name} {via.get('range')} ({via.get('severity')}; "
                         f"{'a direct dependency' if v.get('isDirect') else 'brought by another package'}): {via.get('title')}")
        if not own:
            found.append(f"security advisory.{where}:{name}:through | {name} ({v.get('severity')}) through {', '.join(through)}")
    total = report.get("metadata", {}).get("dependencies", {}).get("total", "?")
    print(f"advisories {where}: {total} packages, {len(vulnerable)} with an advisory")


def generated() -> None:
    """The package.json of a built project, with the runtime as the folder of this tree (it is not on npm yet)."""
    global failed
    built = next(iter(sorted(work.glob("*-nestjs*/build/package.json"))), None)
    if built is None:
        print("advisories generated: no project built with nestjs in this run")
        return
    folder = work / "audit-generated"
    shutil.rmtree(folder, ignore_errors=True)
    folder.mkdir()
    manifest = json.loads(built.read_text())
    manifest["dependencies"]["synapsis-nest"] = f"file:{backend / 'packages/synapsis-nest'}"
    (folder / "package.json").write_text(json.dumps(manifest, indent=2))
    r = run(["npm", "install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"], folder)
    if r.returncode != 0:
        print(f"FAIL advisories generated: the generated package.json does not resolve: {r.stderr.strip()[-300:]}")
        failed = True
        return
    npm("generated", folder)


python()
npm("synapsis-nest", backend / "packages/synapsis-nest")
generated()
with open(work / "findings", "a", encoding="utf-8") as f:
    for line in dict.fromkeys(found):
        f.write(f"{line}\n")
sys.exit(1 if failed else 0)
