# dsh-workspace-labels

[![CI](https://github.com/l-s-c/dsh-workspace-labels/actions/workflows/ci.yml/badge.svg)](https://github.com/l-s-c/dsh-workspace-labels/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

非官方 DeepSeek Harness 社区插件：使用颜色、文字标签、筛选视图和快捷菜单组织左侧工作区与会话。

## 功能

- 工作区三点菜单：**打开工作区**、**复制工作区路径**。
- 工作区和会话颜色：每次点击“切换颜色”依次循环 8 色，最后清除。
- 工作区和会话文字标签：逗号分隔输入，标签直接显示在左侧行内。
- 筛选：支持普通文字和 `#标签`，例如 `支付 #紧急`。
- 保存视图：保存当前筛选条件并快速切换。
- Host 设置持久化；远程/不可写设置环境回退到浏览器 `localStorage`。
- 中英文界面随 DSH 语言切换。
- 不读取会话正文，不修改项目文件，不访问第三方网络。

## 安装

```sh
dsh plugin --profile web add \
  https://github.com/l-s-c/dsh-workspace-labels/releases/download/v0.6.0/dsh-workspace-labels-0.6.0.tgz
```

重启当前 `dsh web` 进程并刷新页面。不要额外启动第二个 Web 实例，以免监听地址冲突。

## 使用

### 工作区

点击左侧工作区名称后的 `⋯`：

- 打开工作区
- 复制工作区路径
- 切换工作区颜色
- 管理工作区标签

### 会话

点击会话后的 `⋯`：

- 切换会话颜色
- 管理会话标签

### 筛选与视图

左侧列表顶部的筛选框支持：

```text
项目名称
#工作
支付 #紧急
```

输入条件后点击“保存视图”，为它命名即可复用。

## 数据与权限

- 本地 GUI 下，元数据存储于 DSH `workspace-labels` 设置命名空间。
- 设置服务不可写时，回退到当前浏览器的 `dsh.workspaceLabels.v1`。
- “打开工作区”只在 Loopback Host 声明 `canOpenPath` 时显示。
- “复制工作区路径”使用浏览器 Clipboard API。
- 插件调用 DSH 同源 Client→Host API，不向第三方服务发送请求。

## 兼容性

针对 DSH `0.1.0-rc.6` 开发和测试。该版本没有公开工作区/会话三点菜单扩展 Slot，因此菜单和行内装饰使用 rc.6 的语义化 DOM 与 CSS 类片段。DSH Developer Preview 更新侧栏结构后可能需要适配。

标题重复且无法唯一解析时，插件会拒绝注入对应菜单项，避免操作错误对象。

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
