# dsh-workspace-labels

[![CI](https://github.com/l-s-c/dsh-workspace-labels/actions/workflows/ci.yml/badge.svg)](https://github.com/l-s-c/dsh-workspace-labels/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

非官方 DeepSeek Harness 社区插件：用颜色和文字标签整理左侧工作区与会话。

## 功能

- 工作区三点菜单：**打开工作区**、**复制工作区路径**。
- 在工作区和会话原有三点菜单内直接选择 8 种颜色或清除颜色。
- 在同一菜单内勾选、新建、删除标签，不使用独立弹窗。
- 标签显示在名称右侧、时间与操作按钮左侧。
- 本地 GUI 持久化到 `~/.dsh/workspace-labels.json`；首次加载自动迁移旧浏览器数据。
- Host 路由不可用时保留浏览器 `localStorage` 副本。
- 中英文界面随 DSH 语言切换。
- 不读取会话正文，不修改项目文件，不访问第三方网络。

## 安装

```sh
dsh plugin --profile web add \
  https://github.com/l-s-c/dsh-workspace-labels/releases/download/v0.6.3/dsh-workspace-labels-0.6.3.tgz
```

重启当前 `dsh web` 进程并刷新页面。不要额外启动第二个 Web 实例，以免监听地址冲突。

## 使用

点击工作区或会话名称后的 `⋯`。菜单下方会直接出现：

- 一行颜色圆点，点击立即保存。
- “清除”按钮，用于移除颜色。
- 标签勾选列表。
- 新标签名称输入框与添加按钮。
- 每个标签右侧的删除按钮。

工作区菜单还保留“打开工作区”和“复制工作区路径”。

## 数据与权限

本地 GUI 的元数据保存在：

```text
~/.dsh/workspace-labels.json
```

存储内容包括工作区/会话颜色、标签定义和标签分配关系。插件升级后会将 `localStorage` 键 `dsh.workspaceLabels.v1` 的旧数据迁移到 Host；只有 Host 成功落盘并回传确认后才删除浏览器副本。

DSH `0.1.0-rc.6` 的 Web Settings API 使用内置命名空间白名单，第三方插件无法自行暴露新 namespace，因此插件使用自己的同源 Host 路由持久化，而不是写入 `settings.yaml`。Host 路由不可用时继续保留浏览器副本。
- “打开工作区”只在 Loopback Host 声明 `canOpenPath` 时显示。
- “复制工作区路径”使用浏览器 Clipboard API。
- 插件调用 DSH 同源 Client→Host API，不向第三方服务发送请求。

## 兼容性

针对 DSH `0.1.0-rc.6` 开发和测试。该版本没有公开工作区/会话三点菜单扩展 Slot，因此菜单和行内装饰使用 rc.6 的语义化 DOM 与 CSS 类片段。DSH Developer Preview 更新侧栏结构后可能需要适配。

标题重复且无法唯一解析时，插件会拒绝注入对应菜单，避免操作错误对象。

## 本地开发

```sh
pnpm install
pnpm run check
pnpm run test:pack
dsh plugin --profile web add "link:$PWD"
```

## 卸载

```sh
dsh plugin --profile web remove dsh-workspace-labels
```

重启当前 `dsh web` 进程并刷新页面。

## License

MIT
