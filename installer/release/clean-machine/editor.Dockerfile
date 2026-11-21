# The clean machine with an editor: the same new user and systemd as ./Dockerfile, plus VS Code and a virtual display,
# so the public installer puts the extension in it and the extension can be driven as the user does (its pages over
# VS Code's debugging port, published to the host). Nothing of NuclearLang inside.
#
#   docker build -t nuclear-clean installer/release/clean-machine
#   docker build -t nuclear-clean-editor -f installer/release/clean-machine/editor.Dockerfile installer/release/clean-machine
#   docker run -d --name nuclear-editor --cgroupns=private --security-opt writable-cgroups=true --cpus 2 --memory 4g \
#     --tmpfs /run --tmpfs /run/lock --tmpfs /tmp -p 127.0.0.1:9444:9444 nuclear-clean-editor
#   docker exec nuclear-editor su - dev -c 'curl -fsSL https://nuclearlang.github.io/install.sh | sh'
#   docker exec -d nuclear-editor su - dev -c 'xvfb-run -a -s "-screen 0 1600x1000x24" /usr/share/code/code \
#     --no-sandbox --disable-gpu --remote-debugging-port=9443 ~/projects'
#   docker exec -d nuclear-editor socat TCP-LISTEN:9444,fork,reuseaddr TCP:127.0.0.1:9443   (Electron listens on 127.0.0.1)
#   docker rm -f nuclear-editor
#
# Never --privileged, --cgroupns=host or a bind of /sys/fs/cgroup (see ./Dockerfile).
FROM nuclear-clean
RUN apt-get update && apt-get install -y --no-install-recommends wget gpg socat xvfb xauth libasound2t64 libgbm1 libnss3 \
      libxkbfile1 libsecret-1-0 libgtk-3-0t64 fonts-dejavu-core \
    && wget -qO /tmp/code.deb 'https://update.code.visualstudio.com/latest/linux-deb-x64/stable' \
    && apt-get install -y --no-install-recommends /tmp/code.deb && rm /tmp/code.deb \
    && rm -rf /var/lib/apt/lists/*
# the public installer from the internet (not the mirror of ./Dockerfile): the machine of a new user; the trust
# question and VS Code's dialogs drawn in its window (native windows cannot be driven over the debugging port)
RUN rm -f /etc/profile.d/nuclear-mirror.sh \
    && mkdir -p /home/dev/.config/Code/User \
    && printf '{"security.workspace.trust.enabled": false, "window.dialogStyle": "custom"}\n' > /home/dev/.config/Code/User/settings.json \
    && chown -R dev:dev /home/dev/.config
