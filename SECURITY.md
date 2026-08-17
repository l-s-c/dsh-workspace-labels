# Security

## Data and permissions

`dsh-workspace-labels` is a UI-only DeepSeek Harness plugin.

- It reads the workspace registry projection needed to map a visible workspace row to its canonical path.
- It calls the public `ctx.workspaces.openPath(path)` capability only after the user selects **Open workspace**.
- It does not read conversation messages.
- It does not modify workspace files.
- It does not send network requests.
- It does not store user data.

The Host opens the selected path with the operating system's default file manager. This is a local side effect explicitly initiated by the user.

## Reporting vulnerabilities

Please report a vulnerability through GitHub Security Advisories after the public repository is created. Do not include secrets or private workspace paths in a public issue.
