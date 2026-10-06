// ==UserScript==
// @name         GitHub 中文化 · 界面翻译
// @name:en      GitHub Chinese UI
// @namespace    https://github.com/cddd-yin/github-zh
// @version      1.3.0
// @homepageURL  https://github.com/cddd-yin/github-zh
// @supportURL   https://github.com/cddd-yin/github-zh/issues
// @updateURL    https://raw.githubusercontent.com/cddd-yin/github-zh/main/GitHub-%E4%B8%AD%E6%96%87%E5%8C%96.user.js
// @downloadURL  https://raw.githubusercontent.com/cddd-yin/github-zh/main/GitHub-%E4%B8%AD%E6%96%87%E5%8C%96.user.js
// @description  只翻译 GitHub 界面词汇与提示，不碰代码、文件名、议题正文和用户名，比浏览器整页机翻干净得多。
// @author       yang
// @match        https://github.com/*
// @match        https://gist.github.com/*
// @icon         https://github.githubassets.com/favicons/favicon.svg
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @noframes
// ==/UserScript==

/* =========================================================================
 * GitHub 中文化（界面翻译）
 * 设计原则：
 *   1. 只翻译「整个文本节点恰好是界面词汇」的情况，避免误伤用户内容；
 *   2. 代码、文件名、README、Issue 正文、用户名所在区域直接跳过；
 *   3. 支持 GitHub 的 Turbo/PJAX 无刷新导航（MutationObserver 增量翻译）；
 *   4. 油猴菜单可随时开关，关闭时还原成英文。
 *
 * 更新记录：
 *   v1.3.0  个人主页专项：补齐主页词汇（屏蔽 / 热门仓库 / 贡献图 / 活动概览 /
 *           页脚等）；月份、星期与中文日期（贡献图坐标、悬停提示、活动时间）；
 *           活动列表句式（在 N 个仓库中创建了 M 个提交 等）；支持 Shadow DOM，
 *           翻译 <relative-time> 组件内的「N 小时前 / 昨天」（仓库列表、动态
 *           时间等）；补仓库页词条（+ N releases、Sponsor this project 等）；
 *           修复「1 contribution in the last year」等单数形式不命中的问题。
 *   v1.2.0  补充词库（智能体 / 安全与质量 / 代码审查 等）与动态句式（相对时间、
 *           归档提示、关注 / 贡献计数等）；加载后分阶段补扫 + 聚焦 / 可见性补扫，
 *           减少个别标签偶发回退英文的情况。
 *   v1.1.0  修复输入框 placeholder 未翻译的问题（表单控件自身放行）；
 *           补充词库；新增 tests/ 自动化测试；接入 GitHub 仓库更新地址。
 * ========================================================================= */

(function () {
  'use strict';

  const SCRIPT_NAME = 'GitHub 中文化';

  /* ==================== 0. 状态存储 ==================== */

  const store = {
    get(key, fallback) {
      try {
        if (typeof GM_getValue === 'function') return GM_getValue(key, fallback);
        const raw = localStorage.getItem('ghzh:' + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        if (typeof GM_setValue === 'function') GM_setValue(key, value);
        else localStorage.setItem('ghzh:' + key, JSON.stringify(value));
      } catch (_) {
        /* 忽略存储失败 */
      }
    },
  };

  let enabled = store.get('enabled', true) !== false;

  /* ==================== 1. 词库 ====================
   * 键为英文界面文字，值为中文翻译。
   * 匹配为「整段文本忽略大小写、忽略首尾空白」的精确匹配，不做句中替换，
   * 因此可以放心写在界面词汇上，不会像整页机翻一样命中代码和正文。
   * --------------------------------------------------------- */

  const DICT = {
    /* ---------- 顶部导航 ---------- */
    'skip to content': '跳到内容',
    'skip to main content': '跳到主要内容',
    'search or jump to...': '搜索或跳转…',
    'type / to search': '输入 / 搜索',
    'search github': '搜索 GitHub',
    'pull requests': '拉取请求',
    'issues': '议题',
    'marketplace': '市场',
    'explore': '探索',
    'notifications': '通知',
    'discussions': '讨论',
    'sponsors': '赞助者',
    'settings': '设置',
    'home': '首页',
    'dashboard': '仪表板',
    'trending': '热门',
    'collections': '集合',
    'topics': '主题',
    'events': '事件',
    'gists': 'Gist',
    'search': '搜索',
    'help': '帮助',
    'upgrade': '升级',
    'feature preview': '功能预览',
    'keyboard shortcuts': '键盘快捷键',
    'command palette': '命令面板',
    'overview': '概览',
    'repositories': '仓库',

    /* ---------- 账户菜单 / 登录 ---------- */
    'signed in as': '已登录为',
    'set status': '设置状态',
    'your profile': '你的个人资料',
    'your repositories': '你的仓库',
    'your projects': '你的项目',
    'your stars': '你的星标',
    'your gists': '你的 Gist',
    'your organizations': '你的组织',
    'your enterprises': '你的企业',
    'your account': '你的账户',
    'new repository': '新建仓库',
    'import repository': '导入仓库',
    'new organization': '新建组织',
    'new project': '新建项目',
    'new gist': '新建 Gist',
    'create new...': '新建…',
    'sign in': '登录',
    'sign up': '注册',
    'sign out': '退出登录',
    'sign in to github': '登录 GitHub',
    'sign in to your account': '登录你的账户',
    'create an account': '创建账户',
    'username or email address': '用户名或邮箱地址',
    'password': '密码',
    'forgot password?': '忘记密码？',
    'new to github?': '初次使用 GitHub？',
    'already have an account?': '已有账户？',

    /* ---------- 仓库页签 / 侧栏 ---------- */
    'code': '代码',
    'projects': '项目',
    'wiki': '维基',
    'security': '安全性',
    'insights': '洞察',
    'actions': '操作',
    'about': '关于',
    'license': '许可证',
    'view license': '查看许可证',
    'activity': '动态',
    'custom properties': '自定义属性',
    'report repository': '举报仓库',
    'releases': '发行版',
    'packages': '软件包',
    'used by': '使用者',
    'contributors': '贡献者',
    'languages': '语言',
    'stars': '星标',
    'forks': '复刻',
    'watchers': '关注者',
    'public': '公开',
    'private': '私有',
    'template': '模板',
    'archived': '已归档',
    'public archive': '公开归档',
    'fork': '复刻',
    'star': '星标',
    'starred': '已星标',
    'unstar': '取消星标',
    'watch': '关注',
    'unwatch': '取消关注',
    'sponsor': '赞助',
    'pin': '置顶',
    'unpin': '取消置顶',
    'pinned': '置顶',
    'edit pinned repository': '编辑置顶仓库',
    'customize your pins': '自定义置顶项',
    'no releases published': '尚未发布任何发行版',
    'create a new release': '创建新发行版',
    'new release': '新建发行版',
    'draft a new release': '起草新发行版',
    'publish release': '发布发行版',
    'generate release notes': '生成发行说明',
    'no packages published': '尚未发布任何软件包',
    'publish your first package': '发布你的第一个软件包',
    'report abuse': '举报滥用',

    /* ---------- 仓库按钮的悬停提示 ---------- */
    'star this repository': '星标本仓库',
    'unstar this repository': '取消星标本仓库',
    'watch this repository': '关注此仓库',
    'unwatch this repository': '取消关注此仓库',
    'fork your own copy of this repository': '复刻此仓库到你自己的账户',
    'toggle navigation': '切换导航',
    'open global navigation menu': '打开全局导航菜单',
    'open user navigation menu': '打开用户导航菜单',
    'browse the repository at this point in the history': '浏览此时间点的仓库',
    'open commit details': '打开提交详情',

    /* ---------- 文件浏览 / 提交 ---------- */
    'go to file': '转到文件',
    'add file': '添加文件',
    'create new file': '新建文件',
    'upload files': '上传文件',
    'find file': '查找文件',
    'latest commit': '最新提交',
    'commit history': '提交历史',
    'history': '历史',
    'commits': '提交',
    'commit': '提交',
    'raw': '原始文件',
    'blame': '追溯',
    'copy path': '复制路径',
    'copy permalink': '复制永久链接',
    'copy link': '复制链接',
    'edit this file': '编辑此文件',
    'delete this file': '删除此文件',
    'download zip': '下载 ZIP',
    'set up in desktop': '在桌面端设置',
    'open with github desktop': '使用 GitHub Desktop 打开',
    'open in github.dev': '在 github.dev 中打开',
    'browse files': '浏览文件',
    'parent': '父级',
    'parents': '父级',
    'author': '作者',
    'committer': '提交者',
    'verified': '已验证',
    'branches': '分支',
    'tags': '标签',
    'switch branches/tags': '切换分支/标签',
    'find or create a branch...': '查找或创建分支…',
    'view all branches': '查看所有分支',
    'view all tags': '查看所有标签',
    'active branches': '活跃分支',
    'stale branches': '陈旧分支',
    'all branches': '所有分支',
    'your branches': '你的分支',
    'yours': '你的',
    'default branch': '默认分支',
    'default': '默认',
    'compare': '比较',
    'clone': '克隆',

    /* ---------- 议题 / 拉取请求 ---------- */
    'new issue': '新建议题',
    'new pull request': '新建拉取请求',
    'new discussion': '新建讨论',
    'issue': '议题',
    'pull request': '拉取请求',
    'discussion': '讨论',
    'labels': '标签',
    'milestones': '里程碑',
    'assignees': '受理人',
    'reviewers': '审查者',
    'assignee': '受理人',
    'reviewer': '审查者',
    'label': '标签',
    'milestone': '里程碑',
    'participants': '参与者',
    'no one assigned': '未分配',
    'no description provided': '未提供说明',
    'no reviews': '暂无审查',
    'no labels': '暂无标签',
    'no milestone': '暂无里程碑',
    'no projects': '暂无项目',
    'review required': '需要审查',
    'approved': '已批准',
    'changes requested': '请求更改',
    'commented': '已评论',
    'dismissed': '已忽略',
    'pending': '待处理',
    'viewed': '已查看',
    'add your review': '添加你的审查',
    'submit review': '提交审查',
    'review changes': '审查更改',
    'approve': '批准',
    'request changes': '请求更改',
    'comment': '评论',
    'comments': '评论',
    'conversation': '对话',
    'files changed': '文件变更',
    'checks': '检查',
    'merged': '已合并',
    'closed': '已关闭',
    'draft': '草稿',
    'merge': '合并',
    'merge pull request': '合并拉取请求',
    'squash and merge': '压缩合并',
    'rebase and merge': '变基并合并',
    'confirm merge': '确认合并',
    'delete branch': '删除分支',
    'restore branch': '恢复分支',
    'revert': '还原',
    'close issue': '关闭议题',
    'close with comment': '评论并关闭',
    'reopen issue': '重新打开议题',
    'reopen pull request': '重新打开拉取请求',
    'reopen': '重新打开',
    'comment on this issue': '在此议题上评论',
    'add a comment': '添加评论',
    'leave a comment': '发表评论',
    'subscribe': '订阅',
    'unsubscribe': '取消订阅',
    'lock conversation': '锁定对话',
    'unlock conversation': '解锁对话',
    'delete issue': '删除议题',
    'transfer issue': '转移议题',
    'edit comment': '编辑评论',
    'delete comment': '删除评论',
    'pin comment': '置顶评论',
    'unpin comment': '取消置顶评论',
    'quote reply': '引用回复',
    'reply': '回复',
    'report content': '举报内容',
    'show resolved': '显示已解决',
    'hide resolved': '隐藏已解决',
    'resolve conversation': '解决对话',
    'unresolve conversation': '取消解决对话',
    'resolved': '已解决',
    'outdated': '已过时',
    'expand all': '全部展开',
    'collapse all': '全部折叠',
    'hide whitespace': '隐藏空白',
    'split': '拆分',
    'unified': '统一',
    'welcome to issues!': '欢迎使用议题！',
    'welcome to pull requests!': '欢迎使用拉取请求！',
    'welcome to discussions!': '欢迎使用讨论！',
    'issues are used to track todos, bugs, feature requests, and more.': '议题用于跟踪待办事项、缺陷、功能请求等。',
    'search all issues': '搜索所有议题',
    'search all pull requests': '搜索所有拉取请求',
    'no results matched your search.': '没有匹配的搜索结果。',
    'create your first issue': '创建你的第一个议题',
    'create pull request': '创建拉取请求',
    'compare & pull request': '比较并创建拉取请求',
    'update branch': '更新分支',
    'this branch has conflicts that must be resolved': '此分支存在必须解决的冲突',
    'merging can be performed automatically.': '可以自动完成合并。',

    /* ---------- 通知 ---------- */
    'all': '全部',
    'unread': '未读',
    'participating': '参与中',
    'done': '已完成',
    'saved': '已保存',
    'inbox': '收件箱',
    'mark as read': '标记为已读',
    'mark as done': '标记为已完成',
    'mark all as read': '全部标记为已读',
    'filter notifications': '筛选通知',
    'clear filters': '清除筛选',
    'you have no unread notifications': '你没有未读通知',

    /* ---------- 设置 / 个人资料 ---------- */
    'account': '账户',
    'appearance': '外观',
    'accessibility': '无障碍',
    'billing and plans': '账单和套餐',
    'emails': '电子邮件',
    'password and authentication': '密码和身份验证',
    'sessions': '会话',
    'ssh and gpg keys': 'SSH 和 GPG 密钥',
    'developer settings': '开发者设置',
    'personal access tokens': '个人访问令牌',
    'danger zone': '危险区域',
    'delete this repository': '删除此仓库',
    'change repository visibility': '更改仓库可见性',
    'change visibility': '更改可见性',
    'transfer ownership': '转移所有权',
    'archive this repository': '归档此仓库',
    'theme': '主题',
    'light': '浅色',
    'dark': '深色',
    'system': '跟随系统',
    'language': '语言',
    'profile': '个人资料',
    'public profile': '公开个人资料',
    'avatar': '头像',
    'bio': '个人简介',
    'website': '网站',
    'location': '位置',
    'company': '公司',
    'social accounts': '社交账户',
    'contributions': '贡献',
    'contribution activity': '贡献活动',
    'follow': '关注',
    'unfollow': '取消关注',
    'followers': '关注者',
    'following': '正在关注',
    'block or report': '屏蔽或举报',
    'achievements': '成就',
    'highlights': '亮点',
    'organizations': '组织',
    'people': '用户',
    'users': '用户',
    'teams': '团队',
    'enterprises': '企业',
    'collaborators': '协作者',
    'manage access': '管理访问权限',
    'webhooks': 'Webhook',
    'deploy keys': '部署密钥',
    'secrets and variables': '机密和变量',
    'environments': '环境',
    'deployments': '部署',

    /* ---------- Actions ---------- */
    'workflows': '工作流',
    'all workflows': '所有工作流',
    'runs': '运行',
    'jobs': '作业',
    'steps': '步骤',
    'summary': '摘要',
    'artifacts': '构件',
    'logs': '日志',
    'duration': '持续时间',
    'status': '状态',
    'success': '成功',
    'failed': '失败',
    'failure': '失败',
    'skipped': '已跳过',
    'cancelled': '已取消',
    'canceled': '已取消',
    'queued': '排队中',
    'in progress': '进行中',
    'started': '已开始',
    'completed': '已完成',
    'run workflow': '运行工作流',
    're-run all jobs': '重新运行所有作业',
    're-run failed jobs': '重新运行失败的作业',
    'cancel workflow': '取消工作流',

    /* ---------- 搜索 ---------- */
    'advanced search': '高级搜索',
    'search syntax tips': '搜索语法提示',
    'sort by': '排序方式',
    'newest': '最新',
    'oldest': '最早',
    'recently updated': '最近更新',
    'least recently updated': '最久未更新',
    'most stars': '星标最多',
    'most forks': '复刻最多',
    'best match': '最佳匹配',
    'most commented': '评论最多',
    'fewest comments': '评论最少',
    'most reactions': '反应最多',
    'last updated': '最近更新',

    /* ---------- 通用按钮 / 提示 ---------- */
    'loading': '加载中…',
    'processing': '处理中',
    'retry': '重试',
    'reload': '重新加载',
    'refresh': '刷新',
    'close': '关闭',
    'open': '打开',
    'cancel': '取消',
    'save': '保存',
    'save changes': '保存更改',
    'update': '更新',
    'create': '创建',
    'add': '添加',
    'remove': '移除',
    'edit': '编辑',
    'delete': '删除',
    'rename': '重命名',
    'copy': '复制',
    'copied!': '已复制！',
    'download': '下载',
    'upload': '上传',
    'import': '导入',
    'export': '导出',
    'confirm': '确认',
    'submit': '提交',
    'apply': '应用',
    'reset': '重置',
    'clear': '清除',
    'filter': '筛选',
    'filters': '筛选器',
    'sort': '排序',
    'ascending': '升序',
    'descending': '降序',
    'more': '更多',
    'options': '选项',
    'enable': '启用',
    'disable': '禁用',
    'enabled': '已启用',
    'disabled': '已禁用',
    'dismiss': '忽略',
    'got it': '知道了',
    'learn more': '了解更多',
    'read more': '阅读更多',
    'see more': '查看更多',
    'see all': '查看全部',
    'view all': '查看全部',
    'show more': '显示更多',
    'show less': '显示更少',
    'load more': '加载更多',
    'preview': '预览',
    'write': '编写',
    'title': '标题',
    'description': '描述',
    'name': '名称',
    'email': '电子邮件',
    'yes': '是',
    'no': '否',
    'ok': '确定',
    'okay': '好的',
    'back': '返回',
    'next': '下一页',
    'previous': '上一页',
    'or': '或',
    'select': '选择',
    'choose': '选择',
    'something went wrong.': '出错了。',
    'page not found': '页面未找到',

    /* ---------- 页脚 ---------- */
    'terms': '条款',
    'privacy': '隐私',
    'privacy policy': '隐私政策',
    'docs': '文档',
    'documentation': '文档',
    'support': '支持',
    'pricing': '价格',
    'blog': '博客',
    'contact github': '联系 GitHub',
    'manage cookies': '管理 Cookie',

    /* ---------- v1.2.0 补充 ---------- */
    'agents': '智能体',
    'security and quality': '安全与质量',
    'branch': '分支',
    'contributor': '贡献者',
    'watching': '关注',
    'codespaces': '代码空间',
    'code review': '代码审查',
    'code scanning': '代码扫描',
    'applications': '应用',
    'authentication': '身份验证',
    'billing': '账单',
    'copy raw file': '复制原始文件',
    'download raw file': '下载原始文件',
    'outline': '大纲',
    'edit file': '编辑文件',
    'view commit details': '查看提交详情',
    'ready for review': '可审查',
    'convert to draft': '转为草稿',
    'linked pull requests': '关联的拉取请求',
    'development': '开发',
    'get started': '开始使用',
    'quick setup': '快速设置',
    'yesterday': '昨天',
    'last week': '上周',
    'last month': '上个月',

    /* ---------- v1.3.0：个人主页 ---------- */
    'navigation menu': '导航菜单',
    'open navigation menu': '打开导航菜单',
    'close navigation menu': '关闭导航菜单',
    'search or jump to, type / to search': '搜索或跳转，输入 / 搜索',
    'user profile': '用户资料',
    'global': '全局',
    'homepage': '主页',
    'github homepage': 'GitHub 主页',
    'external link': '外部链接',
    'edit profile': '编辑个人资料',
    'block or report user': '屏蔽或举报用户',
    'block user': '屏蔽用户',
    'follows you': '关注了你',
    'popular repositories': '热门仓库',
    'readme': '自述文件',
    'contribution graph': '贡献图',
    'day of week': '星期',
    'learn how we count contributions': '了解贡献的统计方式',
    'contribution settings': '贡献设置',
    'activity overview': '动态概览',
    'contributed to': '贡献于',
    'show more activity': '显示更多动态',
    'less': '少',
    'no contributions.': '无贡献。',
    'no contributions': '无贡献',
    'low contributions.': '较少贡献。',
    'medium-low contributions.': '中低贡献。',
    'medium-high contributions.': '中高贡献。',
    'high contributions.': '高贡献。',
    'collapse': '折叠',
    'expand': '展开',
    'profile picture': '头像',
    'public email': '公开邮箱',
    'url': '网址',
    'available for hire': '可雇佣',
    'update profile': '更新个人资料',
    'delete account': '删除账户',
    'contributions & activity': '贡献与动态',

    /* ---------- v1.3.0：月份 / 星期 ---------- */
    'january': '1月',
    'february': '2月',
    'march': '3月',
    'april': '4月',
    'may': '5月',
    'june': '6月',
    'july': '7月',
    'august': '8月',
    'september': '9月',
    'october': '10月',
    'november': '11月',
    'december': '12月',
    'jan': '1月',
    'feb': '2月',
    'mar': '3月',
    'apr': '4月',
    'jun': '6月',
    'jul': '7月',
    'aug': '8月',
    'sep': '9月',
    'sept': '9月',
    'oct': '10月',
    'nov': '11月',
    'dec': '12月',
    'sunday': '周日',
    'monday': '周一',
    'tuesday': '周二',
    'wednesday': '周三',
    'thursday': '周四',
    'friday': '周五',
    'saturday': '周六',
    'sun': '周日',
    'mon': '周一',
    'tue': '周二',
    'tues': '周二',
    'wed': '周三',
    'thu': '周四',
    'thur': '周四',
    'thurs': '周四',
    'fri': '周五',
    'sat': '周六',

    /* ---------- v1.3.0：屏蔽 / 举报对话框 ---------- */
    'prevent this user from interacting with your repositories and sending you notifications.': '阻止此用户与你的仓库互动并向你发送通知。',
    'learn more about': '了解更多关于',
    'blocking users': '屏蔽用户',
    'you must be logged in to block users.': '你必须登录后才能屏蔽用户。',
    'close all issues, pull requests, and discussions opened by this user': '关闭此用户发起的所有议题、拉取请求和讨论',
    'content in all repositories owned by your account will be closed.': '你账户拥有的所有仓库中的相关内容都将被关闭。',
    'add an optional note': '添加可选备注',
    'contact github support about this user\'s behavior.': '就此用户的行为联系 GitHub 支持。',
    'reporting abuse': '举报滥用行为',

    /* ---------- v1.3.0：页脚 / 错误 / 会话提示 ---------- */
    'footer': '页脚',
    'footer navigation': '页脚导航',
    'community': '社区',
    'contact': '联系',
    'do not share my personal information': '请勿共享我的个人信息',
    'uh oh!': '哎呀！',
    'there was an error while loading.': '加载时出错了。',
    'please reload this page': '请重新加载此页面',
    'dismiss error': '关闭错误提示',
    'dismiss alert': '忽略此提示',
    'something went wrong, please refresh the page to try again.': '出错了，请刷新页面重试。',
    'if the problem persists, check the': '如果问题持续存在，请查看',
    'github status page': 'GitHub 状态页',
    'contact support': '联系支持',
    'you signed in with another tab or window.': '你在另一个标签页或窗口中登录了。',
    'to refresh your session.': '请刷新你的会话。',
    'you signed out in another tab or window.': '你在另一个标签页或窗口中退出了登录。',
    'you switched accounts on another tab or window.': '你在另一个标签页或窗口中切换了账户。',
    'you can\'t perform that action at this time.': '你目前无法执行此操作。',

    /* ---------- v1.3.0：仓库页 / 文件列表补充 ---------- */
    'folders and files': '文件夹与文件',
    'last commit message': '最近提交信息',
    'last commit date': '最近提交日期',
    'view all files': '查看所有文件',
    'repository files navigation': '仓库文件导航',
    'repository files': '仓库文件',
    'repository': '仓库',
    'code of conduct': '行为准则',
    'contributing': '贡献指南',
    'latest': '最新',
    'sponsor this project': '赞助此项目',
    'learn more about github sponsors': '了解 GitHub 赞助者',
    'view commit history for this file.': '查看此文件的提交历史。',
    'this path skips through empty directories': '此路径会跳过空目录',
    'you must be signed in to change notification settings': '你必须登录才能更改通知设置',
    'you must be signed in to star a repository': '你必须登录才能星标仓库',
  };

  /* ==================== 2. 动态句式（正则） ====================
   * 处理带数字 / 分支名的整句提示，例如：
   *   This branch is 3 commits ahead of main.
   *   1,234 Commits
   * 仅在「整个文本节点」匹配时生效。
   * --------------------------------------------------------- */

  /* ---------- v1.3.0：日期 / 活动句辅助 ---------- */

  const MONTH_NUM = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
    august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
    sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  };

  const WEEKDAY_ZH = {
    sunday: '周日', monday: '周一', tuesday: '周二', wednesday: '周三',
    thursday: '周四', friday: '周五', saturday: '周六',
    sun: '周日', mon: '周一', tue: '周二', tues: '周二',
    wed: '周三', thu: '周四', thur: '周四', thurs: '周四',
    fri: '周五', sat: '周六',
  };

  const REL_UNITS = { minute: '分钟', hour: '小时', day: '天', month: '个月', year: '年' };

  function zhMonth(name) {
    const n = MONTH_NUM[String(name).toLowerCase().replace(/\.$/, '')];
    return n ? n + '月' : null;
  }

  /* 绝对日期："October 5, 2026" / "Sunday, October 5, 2026" / "Oct 3" / "October 2026" */
  function zhDate(s) {
    if (!s) return null;
    const t = String(s).trim().replace(/\.$/, '');
    let m = /^([A-Za-z]+), ([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(t);
    if (m) {
      const mo = zhMonth(m[2]);
      if (!mo) return null;
      const wd = WEEKDAY_ZH[m[1].toLowerCase()];
      return m[4] + '年' + mo + parseInt(m[3], 10) + '日' + (wd ? '（' + wd + '）' : '');
    }
    m = /^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(t);
    if (m) {
      const mo = zhMonth(m[1]);
      return mo ? m[3] + '年' + mo + parseInt(m[2], 10) + '日' : null;
    }
    m = /^([A-Za-z]+\.?) (\d{1,2})$/.exec(t);
    if (m) {
      const mo = zhMonth(m[1]);
      return mo ? mo + parseInt(m[2], 10) + '日' : null;
    }
    m = /^([A-Za-z]+\.?) (\d{4})$/.exec(t);
    if (m) {
      const mo = zhMonth(m[1]);
      return mo ? m[2] + '年' + mo : null;
    }
    return null;
  }

  /* 绝对日期或相对时间（"2 days ago"），供 "Updated ..." 等句式使用 */
  function zhDateTime(s) {
    const abs = zhDate(s);
    if (abs) return abs;
    const t = String(s).trim().replace(/\.$/, '');
    let m = /^(?:an?|one) (minute|hour|day|month|year)s? ago$/i.exec(t);
    if (m) return '1 ' + REL_UNITS[m[1].toLowerCase()] + '前';
    m = /^(\d[\d,]*) (minutes|hours|days|months|years) ago$/i.exec(t);
    if (m) return m[1] + ' ' + REL_UNITS[m[2].toLowerCase().replace(/s$/, '')] + '前';
    return null;
  }

  const ACTIVITY_VERBS = {
    created: '创建', opened: '开启', started: '发起', reviewed: '审查',
    published: '发布', closed: '关闭', merged: '合并', reported: '报告',
  };

  const ACTIVITY_NOUNS = {
    commit: '个提交', commits: '个提交',
    repository: '个仓库', repositories: '个仓库',
    issue: '个议题', issues: '个议题',
    'pull request': '个拉取请求', 'pull requests': '个拉取请求',
    discussion: '个讨论', discussions: '个讨论',
    branch: '个分支', branches: '个分支',
    tag: '个标签', tags: '个标签',
    release: '个发行版', releases: '个发行版',
    'wiki page': '个 Wiki 页面', 'wiki pages': '个 Wiki 页面',
    gist: '个 Gist', gists: '个 Gist',
  };

  function activityParts(verb, noun) {
    const v = ACTIVITY_VERBS[String(verb).toLowerCase()];
    const u = ACTIVITY_NOUNS[String(noun).toLowerCase()];
    return v && u ? { v: v, u: u } : null;
  }

  const RULES = [
    /* 分支状态提示 */
    [/^This branch is up to date with (.+)\.$/, '此分支已与 $1 同步。'],
    [/^This branch is out-of-date with the base branch\.?$/, '此分支与基础分支不同步。'],
    [/^This branch is (\d[\d,]*) commits? ahead of and (\d[\d,]*) commits? behind (.+)\.$/, '此分支领先 $3 $1 个提交，落后 $2 个提交。'],
    [/^This branch is (\d[\d,]*) commits? ahead of (.+)\.$/, '此分支领先 $2 $1 个提交。'],
    [/^This branch is (\d[\d,]*) commits? behind (.+)\.$/, '此分支落后 $2 $1 个提交。'],
    [/^This branch is even with (.+)\.$/, '此分支与 $1 一致。'],
    [/^(\d[\d,]*) commits? ahead$/i, '领先 $1 个提交'],
    [/^(\d[\d,]*) commits? behind$/i, '落后 $1 个提交'],
    [/^forked from (.+)$/i, '复刻自 $1'],
    [/^Fork your own copy of (.+)$/i, '复刻 $1 到你自己的账户'],

    /* 计数类 */
    [/^Commits on (.+)$/i, function (m, d) { return '提交于 ' + (zhDateTime(d) || d); }],
    [/^Updated (.+)$/i, function (m, d) { return '更新于 ' + (zhDateTime(d) || d); }],
    [/^Last updated (.+)$/i, function (m, d) { return '最近更新于 ' + (zhDateTime(d) || d); }],
    [/^(\d[\d,]*) files? changed$/i, '$1 个文件已变更'],
    [/^(\d[\d,]*) additions?$/i, '$1 处新增'],
    [/^(\d[\d,]*) deletions?$/i, '$1 处删除'],
    [/^(\d[\d,]*[kKmM]?) Commits?$/i, '$1 个提交'],
    [/^(\d[\d,]*[kKmM]?) Branches?$/i, '$1 个分支'],
    [/^(\d[\d,]*[kKmM]?) Tags?$/i, '$1 个标签'],
    [/^(\d[\d,]*[kKmM]?) Stars?$/i, '$1 个星标'],
    [/^(\d[\d,]*[kKmM]?) Forks?$/i, '$1 次复刻'],
    [/^(\d[\d,]*[kKmM]?) watchers?$/i, '$1 个关注'],
    [/^(\d[\d,]*[kKmM]?) contributors?$/i, '$1 位贡献者'],
    [/^(\d[\d,]*[kKmM]?) releases?$/i, '$1 个发行版'],

    /* 加载占位 */
    [/^Loading\.{0,3}$/i, '加载中…'],

    /* ---------- v1.2.0 补充：相对时间与计数 ---------- */
    [/^just now$/i, '刚刚'],
    [/^an? minute ago$/i, '1 分钟前'],
    [/^an? hour ago$/i, '1 小时前'],
    [/^an? day ago$/i, '1 天前'],
    [/^an? month ago$/i, '1 个月前'],
    [/^an? year ago$/i, '1 年前'],
    [/^(\d[\d,]*) minutes? ago$/i, '$1 分钟前'],
    [/^(\d[\d,]*) hours? ago$/i, '$1 小时前'],
    [/^(\d[\d,]*) days? ago$/i, '$1 天前'],
    [/^(\d[\d,]*) months? ago$/i, '$1 个月前'],
    [/^(\d[\d,]*) years? ago$/i, '$1 年前'],
    [/^(\d[\d,]*[kKmM]*) followers?$/i, '$1 位关注者'],
    [/^(\d[\d,]*[kKmM]*) following$/i, '$1 个正在关注'],
    [/^(\d[\d,]*[kKmM]*) contributions? in the last year$/i, '$1 次贡献（过去一年）'],
    [/^(\d[\d,]*[kKmM]*) contributions?$/i, '$1 次贡献'],
    [/^(\d[\d,]*) files$/i, '$1 个文件'],
    [/^This repository has been archived by the owner on (.+)\.\s*It is now read-only\.?$/i, function (m, d) { return '此仓库已被所有者于 ' + (zhDateTime(d) || d) + ' 归档，现在是只读状态。'; }],

    /* ---------- v1.3.0：个人主页 / 活动列表 ---------- */
    [/^(.+) doesn't have any public repositories yet\.$/i, '$1 还没有公开仓库。'],
    [/^(.+) has no activity yet for this period\.$/i, '$1 在此时间段内还没有动态。'],
    [/^and (\d[\d,]*) (?:other|more) repositories?$/i, '以及其他 $1 个仓库'],
    [/^Contribution activity in (\d{4}), (\d+) of (\d+)$/, '$1年贡献动态（$2/$3）'],
    [/^(\d+)% of commits in ([A-Za-z]+) were made to (.+)$/, function (m, pct, mon, repo) {
      const zh = zhMonth(mon);
      return zh ? zh + '有 ' + pct + '% 的提交提交至 ' + repo : m;
    }],
    [/^(Created|Opened|Started|Reviewed|Published|Closed|Merged|Reported) (\d[\d,]*) ([A-Za-z][A-Za-z ]*?) (?:in|to) (\d[\d,]*) (repositories|repository|repos|repo)$/i, function (m, verb, n, noun, cnt) {
      const p = activityParts(verb, noun);
      return p ? '在 ' + cnt + ' 个仓库中' + p.v + '了 ' + n + ' ' + p.u : m;
    }],
    [/^(Created|Opened|Started|Reviewed|Published|Closed|Merged|Reported) (\d[\d,]*) ([A-Za-z][A-Za-z ]*?) in$/i, function (m, verb, n, noun) {
      const p = activityParts(verb, noun);
      return p ? p.v + '了 ' + n + ' ' + p.u + '：' : m;
    }],
    [/^(Created|Opened|Started|Reviewed|Published|Closed|Merged|Reported) (\d[\d,]*) ([A-Za-z][A-Za-z ]*)$/i, function (m, verb, n, noun) {
      const p = activityParts(verb, noun);
      return p ? p.v + '了 ' + n + ' ' + p.u : m;
    }],
    [/^Block or report (.+)$/, '屏蔽或举报 $1'],
    [/^View (.+)'s full-sized avatar$/i, '查看 $1 的完整头像'],
    [/^Achievement: (.+)$/, '成就：$1'],
    [/^No contributions on (.+)$/i, function (m, d) { return '无贡献：' + (zhDateTime(d) || d); }],
    [/^(\d[\d,]*) contributions? on (.+)$/i, function (m, n, d) { return (zhDateTime(d) || d) + '：' + n + ' 次贡献'; }],
    [/^This contribution was made on (.+)$/i, function (m, d) { return '此贡献发生于 ' + (zhDateTime(d) || d); }],
    [/^(\d[\d,]*) contributions?\.$/i, '$1 次贡献。'],
    [/^([A-Za-z]+) (\d{1,2}), (\d{4})$/, function (m) { return zhDate(m) || m; }],
    [/^([A-Za-z]+), ([A-Za-z]+) (\d{1,2}), (\d{4})$/, function (m) { return zhDate(m) || m; }],
    [/^([A-Za-z]+\.?) (\d{1,2})$/, function (m) { return zhDate(m) || m; }],
    [/^([A-Za-z]+\.?) (\d{4})$/, function (m) { return zhDate(m) || m; }],

    /* ---------- v1.3.0：仓库侧栏 / 文件列表补充 ---------- */
    [/^\+ (\d[\d,]*) releases?$/i, '+ $1 个发行版'],
    [/^\+ (\d[\d,]*) contributors?$/i, '+ $1 位贡献者'],
    [/^([\d,]+) users? starred this repository$/i, '$1 位用户星标了此仓库'],
    [/^Sponsor (.+)$/, '赞助 $1'],
    [/^commits by (.+)$/i, '$1 的提交'],
    [/^Commit ([0-9a-f]{7,40})$/i, '提交 $1'],
    [/^([\w][\w./-]*) branch$/i, '$1 分支'],
  ];

  /* ==================== 3. 不翻译区域 ====================
   * 命中这些选择器的元素（含后代）一律跳过：
   * 代码、行内代码、编辑框、Markdown 正文（README / 评论 / 议题描述）、
   * 文件名与目录名、议题与 PR 标题、提交信息、用户名等。
   * 想手动排除某个区域，给它加 data-ghzh-skip 属性即可。
   * --------------------------------------------------------- */

  const SKIP_SELECTOR = [
    /* 非文本 / 代码 */
    'script', 'style', 'noscript', 'template',
    'code', 'pre', 'kbd', 'samp', 'var', 'tt',
    /* 输入控件 */
    'textarea', 'input', 'select', 'option', '[contenteditable="true"]',
    /* 正文区域：README、议题/评论/讨论的 Markdown 渲染结果 */
    '.markdown-body', '.comment-body',
    /* 代码查看 / 编辑 */
    '.blob-code', '.highlight', '.js-file-line-container', '.react-code-lines',
    '.cm-editor', '.CodeMirror', '.monaco-editor',
    /* 用户内容：标题、提交信息、用户名 */
    '.js-issue-title', '.js-issue-title-input', 'a[href*="/commit/"]',
    '[data-testid="issue-listitem-title-link"]', '[data-testid="issue-pr-title-link"]',
    '.user-mention', '.commit-author',
    /* 搜索筛选框：避免把查询语法（如 is:open）和用户输入翻掉 */
    '[class*="FilterInputWrapper"]', '[class*="valid-filter-value"]',
    '[class*="StyledInput-module"]',
    /* 文件名 / 目录名 */
    '[data-testid="tree-view-item"]', '.PRIVATE_TreeView-item-content',
    '.react-directory-filename-column', '[class*="Breadcrumb-module"]',
    'a[href*="/blob/"]', 'a[href*="/tree/"]',
    '[aria-label="Breadcrumb"]', '[aria-label="Breadcrumbs"]',
    /* 新版代码视图容器 */
    '[data-testid="code-view"]', '[class*="CodeLine-module"]',
    /* 用户手动排除 */
    '[data-ghzh-skip]',
  ].join(',');

  /* ==================== 4. 翻译核心 ==================== */

  /* 归一化：统一弯引号、破折号、省略号与空白，提升查表命中率 */
  function normalize(text) {
    return String(text)
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2026/g, '...')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* 构建小写查询表 */
  const LOOKUP = new Map();
  for (const [en, zh] of Object.entries(DICT)) {
    LOOKUP.set(normalize(en).toLowerCase(), zh);
  }

  /* 翻译一段「完整文本」，命中返回中文，否则返回 null */
  function translateCore(core) {
    const norm = normalize(core);
    if (!norm || !/[A-Za-z]/.test(norm)) return null;

    const hit = LOOKUP.get(norm.toLowerCase());
    if (hit !== undefined) return hit;

    for (let i = 0; i < RULES.length; i++) {
      const re = RULES[i][0];
      if (!re.test(norm)) continue;
      const out = norm.replace(re, RULES[i][1]);
      if (typeof out === 'string' && out !== norm) return out;
    }
    return null;
  }

  /* 已翻译记录，供关闭时还原 */
  const touched = [];

  function remember(entry) {
    touched.push(entry);
    if (touched.length > 5000) touched.splice(0, 1000);
  }

  /* 翻译文本节点（保留首尾空白） */
  function translateTextNode(node) {
    const raw = node.nodeValue;
    if (!raw || raw.length > 500 || !/[A-Za-z]/.test(raw)) return;

    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
    if (!m) return;
    const core = m[2];
    const out = translateCore(core);
    if (out == null || out === core) return;

    remember({ kind: 'text', node, old: raw });
    node.nodeValue = m[1] + out + m[3];
  }

  /* 翻译元素属性（悬停提示 / 占位符 / 无障碍标签） */
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];

  function translateElementAttrs(el) {
    for (let i = 0; i < ATTRS.length; i++) {
      const name = ATTRS[i];
      const raw = el.getAttribute(name);
      if (!raw || raw.length > 500 || !/[A-Za-z]/.test(raw)) continue;

      const out = translateCore(raw);
      if (out == null || out === raw) continue;

      remember({ kind: 'attr', el, name, old: raw });
      el.setAttribute(name, out);
    }
  }

  /* 跳过区域的缓存，避免重复 closest 查询 */
  const skipCache = new WeakSet();

  function isSkipped(el) {
    if (!el) return true;
    if (skipCache.has(el)) return true;
    if (el.closest(SKIP_SELECTOR)) {
      skipCache.add(el);
      return true;
    }
    return false;
  }

  /* 文本节点的跳过判断：影子根 / 文档片段里的顶层文本没有元素父级，不应因此跳过 */
  function isSkippedNode(node) {
    const el = node.parentElement;
    if (el) return isSkipped(el);
    const p = node.parentNode;
    return !(p && (p.nodeType === Node.DOCUMENT_FRAGMENT_NODE || p.nodeType === Node.DOCUMENT_NODE));
  }

  /* 属性翻译的跳过判断：表单控件自身放行（输入框的 placeholder 需要翻译），
   * 但位于跳过区域内部的控件（如筛选框、正文）仍然跳过。 */
  function isAttrSkipped(el) {
    if (!el || !el.matches) return true;
    if (el.matches('input, textarea, select')) {
      const parent = el.parentElement;
      return !!(parent && parent.closest(SKIP_SELECTOR));
    }
    return !!el.closest(SKIP_SELECTOR);
  }

  /* Shadow DOM：GitHub 的时间组件（<relative-time> 等）把可见文本渲染在
   * 影子根里，普通 DOM 遍历够不到；这里按已知宿主选择器补翻并监听其变化。 */
  const SHADOW_HOSTS = 'relative-time, time-ago, time-until';
  const watchedShadow = new WeakSet();

  function watchShadowRoot(sr) {
    if (watchedShadow.has(sr)) return;
    watchedShadow.add(sr);
    try {
      observer.observe(sr, { childList: true, subtree: true, characterData: true });
    } catch (_) {
      /* 忽略 */
    }
  }

  function translateShadowHost(host) {
    if (!host || !host.shadowRoot || isSkipped(host)) return;
    watchShadowRoot(host.shadowRoot);
    translateRoot(host.shadowRoot);
  }

  /* 翻译一棵子树（增量入口，也可传 document / shadow root） */
  function translateRoot(root) {
    if (!enabled || !root) return;
    try {
      /* 单个文本节点 */
      if (root.nodeType === Node.TEXT_NODE) {
        if (!isSkippedNode(root)) translateTextNode(root);
        return;
      }

      const elRoot = root.nodeType === Node.DOCUMENT_NODE ? root.documentElement : root;
      if (!elRoot || (elRoot.nodeType !== Node.ELEMENT_NODE && elRoot.nodeType !== Node.DOCUMENT_FRAGMENT_NODE)) return;

      /* 属性（表单控件自身放行，便于翻译 placeholder） */
      if (!isAttrSkipped(elRoot)) translateElementAttrs(elRoot);
      const attrEls = elRoot.querySelectorAll('[title],[placeholder],[aria-label],[alt]');
      for (let i = 0; i < attrEls.length; i++) {
        const el = attrEls[i];
        if (!isAttrSkipped(el)) translateElementAttrs(el);
      }

      /* 文本 */
      const walker = document.createTreeWalker(elRoot, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          if (isSkippedNode(n)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let n;
      while ((n = walker.nextNode())) translateTextNode(n);

      /* Shadow DOM 宿主（含 elRoot 自身） */
      if (elRoot.nodeType === Node.ELEMENT_NODE && elRoot.shadowRoot) translateShadowHost(elRoot);
      const hosts = elRoot.querySelectorAll(SHADOW_HOSTS);
      for (let i = 0; i < hosts.length; i++) translateShadowHost(hosts[i]);
    } catch (err) {
      console.debug('[' + SCRIPT_NAME + ']', err);
    }
  }

  /* 浏览器标签页标题 */
  function translateTitle() {
    if (!enabled || !document.title) return;
    const parts = document.title.split(' · ');
    let changed = false;
    const out = parts.map((part) => {
      if (part.indexOf('/') !== -1 || part.indexOf(':') !== -1) return part;
      const zh = translateCore(part);
      if (zh != null) {
        changed = true;
        return zh;
      }
      return part;
    });
    if (changed) document.title = out.join(' · ');
  }

  /* 关闭时还原 */
  function revertAll() {
    while (touched.length) {
      const t = touched.pop();
      try {
        if (t.kind === 'text') {
          if (t.node.isConnected) t.node.nodeValue = t.old;
        } else if (t.el.isConnected) {
          t.el.setAttribute(t.name, t.old);
        }
      } catch (_) {
        /* 节点可能已被移除 */
      }
    }
  }

  /* ==================== 5. 动态内容监听 ==================== */

  const pending = new Set();
  let scheduled = false;

  function schedule(root) {
    if (!enabled || !root) return;
    if (root.nodeType === Node.TEXT_NODE && !/[A-Za-z]/.test(root.nodeValue || '')) return;

    pending.add(root);
    if (scheduled) return;
    scheduled = true;

    const flush = () => {
      scheduled = false;
      const roots = Array.from(pending);
      pending.clear();
      for (const r of roots) {
        if (r === document || r.isConnected) translateRoot(r);
      }
      translateTitle();
    };

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(flush);
    } else {
      setTimeout(flush, 30);
    }
  }

  const observer = new MutationObserver((mutations) => {
    if (!enabled) return;
    for (const m of mutations) {
      if (m.type === 'characterData') {
        schedule(m.target);
      } else if (m.type === 'childList') {
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
            schedule(node);
          }
        }
      }
    }
  });

  /* ==================== 6. 开关与菜单 ==================== */

  let toastEl = null;

  function toast(message) {
    try {
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.setAttribute('data-ghzh-skip', '');
        Object.assign(toastEl.style, {
          position: 'fixed',
          right: '16px',
          bottom: '16px',
          zIndex: '2147483647',
          background: 'rgba(31, 111, 235, .95)',
          color: '#fff',
          padding: '8px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          lineHeight: '1.4',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif',
          boxShadow: '0 4px 14px rgba(0, 0, 0, .25)',
          transition: 'opacity .2s',
          opacity: '0',
          pointerEvents: 'none',
        });
        document.body.appendChild(toastEl);
      }
      toastEl.textContent = message;
      toastEl.style.opacity = '1';
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => {
        if (toastEl) toastEl.style.opacity = '0';
      }, 1600);
    } catch (_) {
      /* 忽略 */
    }
  }

  function setEnabled(next, silent) {
    enabled = !!next;
    store.set('enabled', enabled);

    if (enabled) {
      translateRoot(document);
      translateTitle();
    } else {
      revertAll();
    }
    if (!silent) toast(SCRIPT_NAME + (enabled ? '：已开启' : '：已关闭'));
  }

  function registerMenus() {
    if (typeof GM_registerMenuCommand !== 'function') return;

    const canUnregister = typeof GM_unregisterMenuCommand === 'function';
    let menuId = null;

    const updateToggleMenu = () => {
      if (canUnregister && menuId != null) {
        try {
          GM_unregisterMenuCommand(menuId);
        } catch (_) {
          /* 忽略 */
        }
      }
      menuId = GM_registerMenuCommand(
        (enabled ? '✅' : '⛔') + ' ' + SCRIPT_NAME + '（点击' + (enabled ? '关闭' : '开启') + '）',
        () => {
          setEnabled(!enabled);
          if (canUnregister) updateToggleMenu();
        }
      );
    };

    updateToggleMenu();

    GM_registerMenuCommand('🔄 重新翻译当前页面', () => {
      if (!enabled) setEnabled(true, true);
      else {
        translateRoot(document);
        translateTitle();
      }
      toast(SCRIPT_NAME + '：已重新翻译');
    });
  }

  /* ==================== 7. 初始化 ==================== */

  function onNavigate() {
    if (!enabled) return;
    /* Turbo / PJAX 无刷新跳转后整页补一遍 */
    translateRoot(document);
    translateTitle();
  }

  function init() {
    /* 增量监听（React 动态渲染、无刷新跳转、局部刷新都靠它兜底） */
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    document.addEventListener('turbo:load', onNavigate, true);
    document.addEventListener('turbo:render', onNavigate, true);
    document.addEventListener('pjax:end', onNavigate, true);
    document.addEventListener('soft-nav:end', onNavigate, true);

    /* 加载后分阶段补扫：GitHub 分阶段渲染，个别节点首扫时还没出现、
     * 或被框架重新渲染回英文，这里做几次轻量补扫让最终状态稳定。 */
    [1200, 3500, 8000, 16000].forEach((ms) => setTimeout(() => schedule(document), ms));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) schedule(document);
    });
    window.addEventListener('focus', () => schedule(document));

    if (enabled) {
      translateRoot(document);
      translateTitle();
    }

    registerMenus();

    /* 调试入口：控制台可用 window.__ghzh.setEnabled(false) 等 */
    try {
      window.__ghzh = {
        version: '1.3.0',
        setEnabled,
        translateRoot,
        translateTitle,
        translateCore,
        dict: DICT,
        rules: RULES,
      };
    } catch (_) {
      /* 忽略 */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
