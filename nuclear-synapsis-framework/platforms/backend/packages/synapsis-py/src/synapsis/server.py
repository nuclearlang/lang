"""Runs the app of a built project (`app.main:app`), as every dialect runs it:

    python -m synapsis.server             # production: HOST (default 127.0.0.1), PORT (default 8000)
    python -m synapsis.server --reload    # development: restarts when a file changes
    python -m synapsis.server --port 8001

The server listens on this machine only unless HOST says otherwise (`HOST=0.0.0.0` in a container); its answers
do not name it (no `Server` header) and the request lines are the app's own (synapsis.edge)."""

from __future__ import annotations

import argparse
import os


def main(argv: list[str] | None = None) -> None:
    import uvicorn

    parser = argparse.ArgumentParser(prog="python -m synapsis.server")
    parser.add_argument("--reload", action="store_true", help="restart when a file changes (development)")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8000")))
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    parser.add_argument("app", nargs="?", default="app.main:app")
    args = parser.parse_args(argv)
    uvicorn.run(args.app, host=args.host, port=args.port, reload=args.reload, server_header=False, access_log=False)


if __name__ == "__main__":
    main()
