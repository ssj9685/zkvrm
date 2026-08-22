# Lightweight GCP operations

This setup deliberately uses only Bun, Git, systemd, and curl. It adds no
resident deployment agent, container runtime, or process manager.

## Runtime pin

Production uses the exact binary at:

```text
/home/ssj2648597/.local/opt/bun/1.4.0/bun
```

The global `~/.bun/bin/bun` remains available for immediate rollback.

## Release layout

```text
~/services/zkvrm/
  current  -> releases/<git-commit>
  previous -> releases/<git-commit>
  releases/<git-commit>/
```

The SQLite database and `.env` remain under `~/zkvrm/`; releases only contain
code and installed dependencies.

## Deploy and rollback

Deploy an exact Git ref after fetching it into `~/zkvrm`:

```bash
bash ~/services/zkvrm/bin/deploy-zkvrm.sh origin/main
```

The script installs from the frozen lockfile, starts a loopback-only canary on
port 3001, checks it, atomically switches `current`, restarts systemd, and rolls
back automatically if the live health check fails.

Rollback to the previous release:

```bash
bash ~/services/zkvrm/bin/rollback-zkvrm.sh
```

Rollback to a specific release:

```bash
bash ~/services/zkvrm/bin/rollback-zkvrm.sh ~/services/zkvrm/releases/<commit>
```
