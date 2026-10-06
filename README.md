# GitHub 中文化（油猴脚本）

把 GitHub 的**界面词汇**翻译成中文的 Tampermonkey（油猴）脚本。
只翻界面，不碰代码、文件名、README / 议题正文、提交信息和用户名——比浏览器整页机翻干净得多。

- 脚本文件：`GitHub-中文化.user.js`（v1.2.0）
- 仓库：https://github.com/cddd-yin/github-zh

## 为什么不用浏览器翻译？

浏览器整页翻译会把代码、文件路径、Issue 正文、用户名一起翻掉：语法高亮里的 `const` 会变成「常量」，报错信息翻得没法搜索，链接也可能被改坏。本脚本采用**整节点精确匹配**：只有整个文本恰好是界面词汇时才翻译，并主动跳过代码、文件名、正文等区域。

## 安装

### 前置要求（Chrome 138+）

Chrome 新版默认**禁止油猴执行脚本**：请在 `chrome://extensions` 中找到「篡改猴 / Tampermonkey」→「详情」→ 打开「**允许用户脚本**」开关（或者打开扩展页右上角的「开发者模式」）。否则**任何**油猴脚本都不会运行（本脚本、其他汉化脚本都一样）。

### 方式一：本地 URL 安装（本机推荐）

1. 在项目根目录启动本地服务（只监听 127.0.0.1）：

   ```powershell
   powershell -ExecutionPolicy Bypass -File tests\serve.ps1
   ```

2. 在浏览器打开 `http://127.0.0.1:8787/GitHub-中文化.user.js`
3. 油猴会拦截并弹出安装页，点「安装」即可。

> 仓库当前为**私有**（个人使用）：`raw.githubusercontent.com` 的链接需要登录才能访问，所以「从 GitHub 安装 + 自动更新」在仓库公开前不可用（不影响本机使用）。将仓库设为公开后，安装与 `@updateURL` 自动更新即可正常工作。

### 方式二：手动安装

油猴面板 → 「添加新脚本」→ 粘贴 `GitHub-中文化.user.js` 全文 → Ctrl+S 保存。

## 功能

- 导航、仓库页签、按钮、设置、Actions、Issues / PR 等界面词汇翻译；
- 动态句式：`48,917 Commits → 48,917 个提交`、`This branch is 3 commits ahead of main. → 此分支领先 main 3 个提交。`；
- 悬停提示、输入框占位符、无障碍标签（`title` / `placeholder` / `aria-label` / `alt`）同步翻译；
- 适配 GitHub 无刷新导航（Turbo / PJAX），新加载的内容自动翻译；
- 油猴菜单可随时开关，关闭时**还原**成英文。

## 不会翻译的区域（设计如此）

- 代码、diff、行内代码（`code` / `pre` / `.highlight` / 新版代码视图）
- README、Issue / 评论正文（`.markdown-body`）
- 文件名、目录名、面包屑路径
- Issue / PR 标题、提交信息、用户名
- 搜索筛选框（防止 `is:open` 被改成 `is:打开`）

## 测试与验证

| 测试 | 运行方式 | 实测结果（2026-10-06） |
| --- | --- | --- |
| 单元断言 ×43 | 启动 `tests\serve.ps1` 后打开 `http://127.0.0.1:8787/tests/test.html` | ✅ 43 / 43 通过 |
| 模拟页面预览 | `http://127.0.0.1:8787/tests/demo.html` | 界面词变中文；代码、README 正文、文件名保持英文 |
| 端到端（真实 GitHub） | `powershell -ExecutionPolicy Bypass -File tests\e2e\run.ps1` | ✅ nodejs/node：导航 / 按钮 / 占位符全部中文；README 长度不变；代码、文件名、正文探针均未被改动；开关可还原 |

- `tests/test.html` 加载与发布版**同一份**脚本，覆盖词库匹配、动态句式、跳过区域、属性翻译、开关还原、标题翻译；
- `tests/e2e/run.ps1` 用无头 Chrome + CDP 注入脚本，在真实页面上执行 `checks.js` 并输出 JSON 报告与截图。

## 目录结构

```
GitHub-中文化.user.js    主脚本（安装这个）
tests/
  test.html              43 项自动化断言
  demo.html              模拟 GitHub 页面（可视化预览）
  serve.ps1              本地静态服务器（127.0.0.1:8787）
  e2e/
    run.ps1              CDP 端到端测试（真实 GitHub 页面）
    checks.js            页面内校验逻辑
README.md
LICENSE
```

## 自定义

- **加词 / 改词**：编辑脚本里的 `DICT` 对象（`英文: 中文`），保存后刷新页面；
- **某区域不翻译**：给该元素加属性 `data-ghzh-skip`；
- **调试入口**：控制台可用 `window.__ghzh.setEnabled(false)`、`window.__ghzh.translateRoot(document)`、`window.__ghzh.translateCore('Issues')` 等。

## 更新日志

- **v1.2.0**：词库扩充至 450 条（新增智能体 / 安全与质量 / 代码审查 / 大纲 等）；动态句式增加相对时间（`33 minutes ago → 33 分钟前`）、归档提示、关注 / 贡献计数；加载后分阶段补扫 + 聚焦 / 可见性补扫，减少个别标签偶发回退英文；E2E 测试脚本容忍长加载页面，更健壮。
- **v1.1.0**：修复输入框 `placeholder` 未翻译的问题（表单控件自身放行）；补充词库（概览 / 仓库 / 发行版 / Actions 等）；新增 `tests/` 自动化测试与模拟预览页；接入 GitHub 仓库与更新地址。
- **v1.0.0**：初版。

## License

[MIT](LICENSE)
