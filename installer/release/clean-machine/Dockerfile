# A clean Linux machine to try NuclearLang as a new user does: nothing of NuclearLang inside, a user `dev` who can sudo,
# and systemd as on a real machine, so Ollama's installer and the AI set-up register their services the usual way.
# git is there, as on any developer's machine; no Python and no Node.js (the AI services and their set-up bring their
# own Python, ADR-installer-0003; only Nuclear Builder's pipeline still runs on node, spec 009 phase 3).
#
#   installer/release/package.sh x86_64-unknown-linux-musl      # the archive the installer downloads, in installer/dist/
#   installer/release/ai-runtime.sh                             # the AI services' archive, beside it
#   docker build -t nuclear-clean installer/release/clean-machine
#   docker run -d --name nuclear-clean --cgroupns=private --security-opt writable-cgroups=true \
#     --tmpfs /run --tmpfs /run/lock --tmpfs /tmp -v "$PWD/installer/dist:/mirror:ro" nuclear-clean
#   docker exec -it nuclear-clean su - dev                      # a terminal of the new user
#   docker rm -f nuclear-clean                                  # the machine is gone: run it again for a new one
#
# Never --privileged, --cgroupns=host or a bind of /sys/fs/cgroup: the container's systemd then takes the host's
# cgroups, ttys and devices and brings the desktop session down.
FROM debian:trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      systemd systemd-sysv dbus dbus-user-session libpam-systemd sudo \
      ca-certificates curl git unzip xz-utils zstd less procps \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -s /bin/bash dev \
    && echo 'dev ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/dev \
    && mkdir -p /var/lib/systemd/linger && touch /var/lib/systemd/linger/dev \
    && systemctl mask getty@.service console-getty.service serial-getty@.service systemd-udevd.service \
      systemd-udev-trigger.service systemd-udevd-control.socket systemd-udevd-kernel.socket
# the installer reads the archive mounted at /mirror instead of a GitHub release (its NUCLEAR_DOWNLOAD)
RUN echo 'export NUCLEAR_DOWNLOAD=file:///mirror' > /etc/profile.d/nuclear-mirror.sh
STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
