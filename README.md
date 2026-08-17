# dsh-workspace-labels

[![CI](https://github.com/l-s-c/dsh-workspace-labels/actions/workflows/ci.yml/badge.svg)](https://github.com/l-s-c/dsh-workspace-labels/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dsh-workspace-labels.svg)](https://www.npmjs.com/package/dsh-workspace-labels)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

DeepSeek Harness Web 左侧工作区增强插件。首个功能是在工作区原有的 `⋯` 菜单中增加 **打开工作区**。

## 功能

- 在工作区文件夹行现有的三点菜单中增加 **打开工作区 / Open workspace**。
- 通过 DSH 官方 `workspaces.openPath()` 能力，在宿主系统的 Finder、文件资源管理器或默认文件管理器中打开目录。
- 不读取会话内容、不修改工作区文件、不保存用户数据、不发送网络请求。

## 安装

```sh
dsh plugin --profile web add dsh-workspace-labels@0.1.0
```

重启当前 `dsh web` 进程并刷新页面。不要额外启动第二个 Web 实例，否则会与现有的 `127.0.0.1:3080` 端口冲突。

## 使用

在左侧工作区名称后点击 `⋯`，选择 **打开工作区**。

## 本地开发

```sh
pnpm install
pnpm run check
dsh plugin --profile web add "link:$PWD"
```

开发版完成修改后重新运行 `pnpm run build`，再重启当前 DSH Web 进程。

## 兼容性

首版针对 DeepSeek Harness `0.1.0-rc.6`。

当前 DSH 尚未公开工作区行菜单扩展 Slot，因此插件使用语义化 DOM（`role=treeitem/menu/menuitem`）进行兼容增强，同时通过官方 `ctx.workspaces.openPath()` 执行实际操作。DSH 改动工作区侧栏结构后，插件可能需要同步适配；未来出现正式菜单 Slot 时将迁移到公开扩展点。

为避免打开错误目录，当多个工作区拥有完全相同的显示名称且无法唯一识别时，插件不会注入菜单项。

## 权限与隐私

- 读取可见工作区列表中的 ID、显示名称和规范路径。
- 仅在用户点击菜单项后调用 DSH Host `openPath` API。
- 不创建额外数据文件。
- 不访问外部网络。
- 不读取会话消息。

详见 [SECURITY.md](SECURITY.md)。

## 卸载

```sh
dsh plugin --profile web remove dsh-workspace-labels
```

然后重启当前 `dsh web` 进程并刷新页面。

## License

MIT
