# GitHub 中文化（油猴脚本）

把 GitHub 的**界面词汇**翻译成中文的 Tampermonkey（油猴）脚本。
只翻界面，不碰代码、文件名、README / 议题正文、提交信息和用户名——比浏览器整页机翻干净得多。

- 脚本文件：`GitHub-中文化.user.js`（v1.5.0）
- 仓库：https://github.com/cddd-yin/github-zh

## 为什么不用浏览器翻译？

浏览器整页翻译会把代码、文件路径、Issue 正文、用户名一起翻掉：语法高亮里的 `const` 会变成「常量」，报错信息翻得没法搜索，链接也可能被改坏。本脚本采用**整节点精确匹配**：只有整个文本恰好是界面词汇时才翻译，并主动跳过代码、文件名、正文等区域。

## 安装（新手照做即可）

全程三步：**装油猴扩展 → 打开一个开关 → 点一个链接**。装完刷新 GitHub 就是中文界面。

### 第 0 步：安装油猴扩展 Tampermonkey

在浏览器扩展商店里搜索并安装「**Tampermonkey / 篡改猴**」，或直接点对应链接：

- Chrome：[Chrome 商店 - Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- Edge：[Edge 商店 - Tampermonkey](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
- Firefox：[Firefox 附加组件 - Tampermonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/)

### 第 1 步：打开「允许用户脚本」开关（Chrome / Edge 138+ 必做）

Chrome / Edge 新版默认**禁止油猴执行脚本**：在浏览器地址栏输入 `chrome://extensions`（Edge 用 `edge://extensions`）→ 找到「篡改猴 / Tampermonkey」→「详情」→ 打开「**允许用户脚本**」开关（或者打开扩展页右上角的「开发者模式」）。
不开这个开关，**任何**油猴脚本都不会运行（本脚本、其他汉化脚本都一样）。

### 第 2 步：点链接安装

在浏览器打开这个链接，油猴会弹出安装页 → 点「**安装**」：

> [点此安装：GitHub-中文化.user.js](https://raw.githubusercontent.com/cddd-yin/github-zh/main/GitHub-%E4%B8%AD%E6%96%87%E5%8C%96.user.js)

装好后刷新任意 GitHub 页面，界面即为中文。以后脚本有更新时，Tampermonkey 会自动检查并在后台更新（也可在油猴面板的「已安装脚本」里手动点更新）。

### 备用方式：手动粘贴安装（上面的链接打不开时）

点 [脚本文件](GitHub-中文化.user.js) 查看全文并复制（或下载后用记事本打开复制全部内容）→ 浏览器右上角油猴图标 → 「添加新脚本」→ 清空后粘贴全文 → `Ctrl+S` 保存。

### 常见问题

| 现象 | 解决方法 |
| --- | --- |
| 装了脚本 GitHub 还是英文 | 检查第 1 步的「允许用户脚本」开关；确认油猴面板里本脚本已启用；刷新页面 |
| 点安装链接没反应 / 提示下载 | 网络无法访问 GitHub 直链（境内常见），挂代理后重试，或用「备用方式」手动粘贴 |
| 部分界面还是英文 | 词库覆盖不到的新文案，欢迎反馈；也可按下方「自定义」自行加词 |
| 想暂时用回英文 | 点油猴图标 → 脚本菜单里的开关即可，随时切回 |

## 功能

- 导航、仓库页签、按钮、设置、Actions、Issues / PR 等界面词汇翻译；
- 个人主页：屏蔽 / 举报、热门仓库、贡献图（月份、星期、贡献等级）、活动概览与活动列表（`Created 42 commits in 4 repositories → 在 4 个仓库中创建了 42 个提交`）；
- 中文日期与相对时间：`Oct 5, 2026 → 2026年10月5日`、`2 days ago → 2 天前`（含 Shadow DOM 中 `<relative-time>` 组件渲染的时间）；
- 动态句式：`48,917 Commits → 48,917 个提交`、`This branch is 3 commits ahead of main. → 此分支领先 main 3 个提交。`；
- 悬停提示、输入框占位符、无障碍标签（`title` / `placeholder` / `aria-label` / `alt`）同步翻译；
- Actions（操作）页：表头（工作流 / 事件 / 执行者）、运行时长（`3m 40s → 3 分 40 秒`）、工作流运行计数；
- 议题 / 拉取请求列表：全部 / 搜索、各类「按…筛选」、排序与分页提示、`opened`、成员标识；
- 发行版页：`released this`、`Assets`、`Jump to release`、`Tag`、提交签名校验等；
- 全站页脚与站点地图栏目（平台 / 功能 / 资源 / 社交链接等）、`on <日期>` 与带时区的时间戳；
- 适配 GitHub 无刷新导航（Turbo / PJAX），新加载的内容自动翻译；
- 动态更新的提示、无障碍标签与输入框占位符即时补翻；合并重叠的增量扫描，减少重复遍历；
- 油猴菜单可随时开关，关闭时**还原**成英文。

### 更新已安装的脚本

从直链安装后，Tampermonkey 会按 `@updateURL` 自动检查更新（默认每天一次）；也可在油猴面板 →「实用工具 / 已安装脚本」里手动检查更新，更新后刷新 GitHub 页面生效。开发者本地改动脚本后，可启动本地服务（`tests\serve.ps1`，监听 127.0.0.1:8787）在浏览器打开 `http://127.0.0.1:8787/GitHub-中文化.user.js` 完成重装；推送仓库本身不代表已更新本地油猴。

## 不会翻译的区域（设计如此）

- 代码、diff、行内代码（`code` / `pre` / `.highlight` / 新版代码视图）
- README、Issue / 评论正文（`.markdown-body`）
- 文件名、目录名、面包屑路径
- Issue / PR 标题、提交信息、用户名
- 搜索筛选框（防止 `is:open` 被改成 `is:打开`）

## 测试与验证

| 测试 | 运行方式 | 实测结果 |
| --- | --- | --- |
| 单元断言 ×107 | 启动 `tests\serve.ps1` 后运行 `powershell -ExecutionPolicy Bypass -File tests\e2e\run-unit.ps1`；Edge 加 `-Browser Edge -Port 9228` | ✅ Chrome / Edge 均 107 / 107 通过（2026-10-18） |
| 个人主页体检 | `powershell -ExecutionPolicy Bypass -File tests\e2e\probe-profile.ps1 -Url https://github.com/cddd-yin` | ✅ 主页按钮 / 贡献图 / 页脚全部中文；剩余英文仅用户名与版权行（62 → 2） |
| 模拟页面预览 | `http://127.0.0.1:8787/tests/demo.html` | 界面词变中文；代码、README 正文、文件名保持英文 |
| 端到端（真实 GitHub） | `powershell -ExecutionPolicy Bypass -File tests\e2e\run.ps1` | ✅ nodejs/node：导航 / 按钮 / 占位符命中；同步比对 README 全文未改动；代码、文件名、正文探针均未被改动；开关可还原（2026-10-18） |

- `tests/test.html` 加载与发布版**同一份**脚本，覆盖词库匹配、动态句式、跳过区域、属性翻译、开关还原、标题翻译、Shadow DOM；
- `tests/e2e/run-unit.ps1` 用无头 Chrome 自动运行 `test.html` 并输出 JSON 结果；
- `tests/e2e/run.ps1` 用无头 Chrome + CDP 注入脚本，在真实页面上执行 `checks.js` 并输出 JSON 报告与截图；
- `tests/e2e/probe-profile.ps1` + `probe.js`：输出「页面剩余英文」清单（区分词库缺口与时序漏翻），用于个人主页等页面的漏翻体检。

## 目录结构

```
GitHub-中文化.user.js    主脚本（安装这个）
tests/
  test.html              107 项自动化断言（含异步属性更新）
  demo.html              模拟 GitHub 页面（可视化预览）
  serve.ps1              本地静态服务器（127.0.0.1:8787）
  e2e/
    run.ps1              CDP 端到端测试（真实 GitHub 页面）
    run-unit.ps1         无头 Chrome 运行 test.html 并输出 JSON
    probe-profile.ps1    页面剩余英文体检（个人主页 / 仓库页）
    probe.js             体检用的页面内逻辑
    checks.js            页面内校验逻辑
README.md
LICENSE
```

## 自定义

- **加词 / 改词**：编辑脚本里的 `DICT` 对象（`英文: 中文`），保存后刷新页面；
- **某区域不翻译**：给该元素加属性 `data-ghzh-skip`；
- **调试入口**：控制台可用 `window.__ghzh.setEnabled(false)`、`window.__ghzh.translateRoot(document)`、`window.__ghzh.translateCore('Issues')` 等。

## 更新日志

- **v1.5.0**：动态 `title` / `placeholder` / `aria-label` / `alt` 变化即时翻译；关闭时只还原仍保持脚本翻译值的节点，不覆盖框架新内容或恢复已删除属性；复用节点还原到最新英文；不再永久缓存跳过判断，修复节点移出正文后漏翻；Shadow DOM 跨宿主继承正文保护，支持空值 `contenteditable` 编辑区；合并父子增量扫描；Chrome / Edge 107 项断言全部通过。端到端测试新增实际断言与失败退出码，并在同步注入时比对 README 全文，避免异步渲染导致误报。
- **v1.4.0**：在真实 GitHub 页面上体检后定向扩充——词库再增 120+ 条并新增句法/属性规则：Actions 页（工作流 / 事件 / 执行者、运行时长、工作流运行计数）、议题与 PR 列表（全部 / 搜索、各类「按…筛选」、排序、分页、`opened`、成员）、发行版页（`released this`、`Assets`、`Jump to release`、`Tag`、签名校验）、全站页脚与站点地图栏目；新增「`on <日期>`」「`<月 日, 年, 时:分 时区>`」「`3m 40s → 3 分 40 秒`」等句式；单元断言扩至 97 项。
- **v1.3.1**：修复登录态空状态提示（`You don't have any public repositories yet.`、`You don't have any activity yet for this period.` 等）；单元断言 76 项。
- **v1.3.0**：个人主页专项——补齐主页词汇（屏蔽 / 举报、热门仓库、贡献图、活动概览、页脚等）；中文日期与相对时间（`Oct 5, 2026 → 2026年10月5日`、`2 days ago → 2 天前`），支持 Shadow DOM 中 `<relative-time>` 组件渲染的时间；活动列表句式（`Created 42 commits in 4 repositories → 在 4 个仓库中创建了 42 个提交`）；补仓库页词条（`+ 519 releases`、`Sponsor this project` 等）；修复 `1 contribution in the last year` 单数不命中；单元断言扩至 75 项，新增主页体检工具。
- **v1.2.0**：词库扩充至 450 条（新增智能体 / 安全与质量 / 代码审查 / 大纲 等）；动态句式增加相对时间（`33 minutes ago → 33 分钟前`）、归档提示、关注 / 贡献计数；加载后分阶段补扫 + 聚焦 / 可见性补扫，减少个别标签偶发回退英文；E2E 测试脚本容忍长加载页面，更健壮。
- **v1.1.0**：修复输入框 `placeholder` 未翻译的问题（表单控件自身放行）；补充词库（概览 / 仓库 / 发行版 / Actions 等）；新增 `tests/` 自动化测试与模拟预览页；接入 GitHub 仓库与更新地址。
- **v1.0.0**：初版。

## License

[MIT](LICENSE)
