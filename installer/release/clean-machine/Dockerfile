# A clean Linux machine to try NuclearLang as a new user does: nothing of NuclearLang inside, a user `dev` who can sudo,
# and systemd as on a real machine, so Ollama's installer and the AI set-up register their services the usual way.
# Node.js, Python and git are there, as on any developer's machine.
#
#   installer/release/package.sh x86_64-unknown-linux-musl      # the archive the installer downloads, in installer/dist/
#   docker build -t nuclear-clean installer/release/clean-machine
#   docker run -d --name nuclear-clean --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
#     -v "$PWD/installer/dist:/mirror:ro" nuclear-clean
#   docker exec -it nuclear-clean su - dev                      # a terminal of the new user
#   docker rm -f nuclear-clean                                  # the machine is gone: run it again for a new one
FROM node:24-trixie
RUN apt-get update && apt-get install -y --no-install-recommends \
      systemd systemd-sysv dbus dbus-user-session libpam-systemd sudo \
      ca-certificates curl git unzip xz-utils zstd less python3 python3-venv \
    && rm -rf /var/lib/apt/lists/* \
    && usermod -l dev -d /home/dev -m node && groupmod -n dev node \
    && echo 'dev ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/dev \
    && mkdir -p /var/lib/systemd/linger && touch /var/lib/systemd/linger/dev
# the installer reads the archive mounted at /mirror instead of a GitHub release (its NUCLEAR_DOWNLOAD)
RUN echo 'export NUCLEAR_DOWNLOAD=file:///mirror' > /etc/profile.d/nuclear-mirror.sh
STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
