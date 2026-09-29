# dsh-deepseek-balance

[![test](https://github.com/OwlNjust/DSH-DeepSeek-Balance/actions/workflows/test.yml/badge.svg)](https://github.com/OwlNjust/DSH-DeepSeek-Balance/actions/workflows/test.yml)

> DeepSeek Harness 的 DeepSeek 余额与用量实时监控插件 —— 右下角悬浮小组件，
> 附高峰/空闲时段（梁文峰 / 梁文谷）价格提醒。
>
> 中文 · **[English](README.md)**

---

**安装只需一步：** 把 `https://github.com/OwlNjust/DSH-DeepSeek-Balance`
发给您的 agent，它就知道如何自动安装本插件。手动安装步骤如下。

## 安装（面向 agent，无需 npm）

本包**零运行时依赖、不发布 npm**，提供两条安装路线——**同一 profile 只能选一条**：
两条都用会让插件 id 被插入两次（见「agent 注意事项」）。

### 路线 A（推荐）：作为「组合包」安装（deepseek-harness ≥ 0.2.0）

本包声明了 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`，所以 harness 的插件管理器
可以直接把它当作组合包（profile 层）安装并自动激活——**无需手改任何文件**：

- **桌面端**：菜单栏 →「管理插件 / Manage plugins」→ 填入
  `https://github.com/OwlNjust/DSH-DeepSeek-Balance`
- **命令行**：

  ```sh
  dsh plugin --profile <profile> add https://github.com/OwlNjust/DSH-DeepSeek-Balance
  ```

管理器会把包加入 profile 的 `dsh.profile.bundles`，包内的 `cordis.patch.yml`（含激活插件的
`insert` 行）随之作为组合层生效。重载/重启 profile 后右下角即出现小组件。

### 路线 B：本地克隆 + 用户补丁层（离线 / 改源码调试用）

```sh
# 1. 克隆/复制仓库到任意可访问路径
git clone https://github.com/OwlNjust/DSH-DeepSeek-Balance.git /tmp/dsh-deepseek-balance

# 2. 安装到 web profile（file: = 快照；link: = 源码符号链接，改代码即生效）
cd ~/.dsh/profiles/web
dsh plugin --profile web add link:/tmp/dsh-deepseek-balance
```

3. 把下面这段**追加**到 `~/.dsh/profiles/web/cordis.patch.yml`（profile 的用户补丁层）：

```yaml
- insert:
    - id: dsh-deepseek-balance
      name: dsh-deepseek-balance
```

4. 重启 profile：

```sh
dsh web
```

5. 可选验证：确认 web 服务器响应

```sh
curl -s http://127.0.0.1:3080/dsbal/state
```

强制刷新页面（Ctrl+Shift+R）后右下角出现小组件。让用户点击小组件 → 「配置」→
粘贴 DeepSeek **API key**（可选再填平台 **userToken**）→「保存」。

### agent 注意事项

- **不要**执行 `npm publish`；安装基于 git 仓库或本地克隆。
- **两条路线别混用**：路线 A 已由组合层插入插件行，若再手工追加同一 `insert` 行，插件 id 会被
  插入两次（cordis 按 id 折叠成一份，所以**不会报错**，只是组合树里多出一行、日后极易误判）。
  切换路线时先确认 `dsh.profile.bundles` 与 profile 的 `cordis.patch.yml` 只有一边生效；
  一条命令自检，结果必须是 `1`：

  ```sh
  dsh --profile web --dump-config | grep -c 'id: dsh-deepseek-balance'
  ```

  若输出 `2`：删掉 `cordis.patch.yml` 里手写的那段（保留 `dsh.profile.bundles` 里的包，
  组合层交给插件管理器维护），重启 `dsh web` 生效。反向切换（改回手写行）则先从
  `dsh.profile.bundles` 移除本包。
- 配置与余额历史保存在 `~/.deepseek-balance.json`（0600），**切勿回显其内容**。
- 卸载：删除 `cordis.patch.yml` 中的行、删除
  `~/.dsh/profiles/web/node_modules/dsh-deepseek-balance`，重启 `dsh web`。

## 前置条件

- deepseek-harness 的 **web profile**（`dsh web`）；Node.js ≥ 20
  （本插件在 **v0.1.2-rc.1** 上适配验证，并已复检至 **v0.2.0-rc.2**，四个版本零改动可用）。
- DeepSeek **API Key**（platform.deepseek.com → API keys）。
- 可选：平台 **userToken**（platform.deepseek.com → F12 → Application → Local Storage），
  用于精确统计消耗/Token；未配置时自动回退为余额快照估算。

## 功能

- **余额** —— 总余额 / 充值余额，官方 `GET /user/balance`，每 5 分钟刷新。
- **时间段消耗** —— 今天 / 近24小时 / 近7天 / 自定义起始日期，含按模型明细（`/usage/cost`）。
- **Token 消耗** —— 输入（命中缓存）/ 输入（未命中缓存）/ 输出，与平台用量页一致（`/usage/amount`）。
- **价格时段提醒** —— 🔴 **梁文峰**（高峰：北京时间周一至周五 09:00–12:00 与 14:00–18:00，
  **不含中国法定节假日**，价格 ×2）与 🟢 **梁文谷**（空闲：其余时段，**含周末与法定节假日全天**，半价），
  实时倒计时，高峰红色高亮，法定节假日显示 🎉 标识。
  时段依据[官方定价文档](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)。
- **中英双语** —— 界面文案集中于 `lib/client.js` 的文案表；语言跟随宿主设置 → 浏览器语言，
  面板内可一键切换；插件卡片标题/描述见 `locale/zh.json`、`locale/en.json`，图标 `icon.svg`。
- **可拖动定位** —— **右键**按住药丸拖动即可移到任意位置，位置自动记忆；左键只负责点击展开面板。
  药丸上右键不弹浏览器菜单（药丸即拖拽手柄）；展开面板时自动避让屏幕边缘，
  窗口缩放后药丸也会自动夹回可视区域。面板底部提供「重置位置（右下角）」按钮，
  一键恢复默认位置。

## 使用

| 项目 | 位置 |
| --- | --- |
| API Key / userToken | 小组件 → 配置 |
| 时间窗口 | 小组件按钮（今天 / 24h / 7天 / 自定义） |
| 刷新 | 「刷新」按钮（或自动：按配置的 `pollIntervalMs`，默认 5 分钟；标签页隐藏时暂停） |
| 语言 | 跟随宿主设置的语言 → 否则浏览器语言；面板标题栏的 `EN/中` 按钮可手动切换（记忆在本机） |
| 药丸摘要 | 右下角：当前价格时段 + 余额 + 时段消耗 |

## 架构

```
宿主 lib/index.js      仅装配：config 校验 → 建 store/service → 注册四条已认证路由 → 定时轮询
  ├─ lib/service.js    操作实现（getState / refresh / setConfig / setWindow / poll）
  ├─ lib/config.js     可调项 DEFAULTS + 校验（profile 的 config: 覆盖，整体替换语义）
  ├─ lib/store.js      状态文件：原子写（临时文件 + rename）、串行化、schemaVersion 信封、损坏隔离
  ├─ lib/deepseek.js   余额/用量 HTTP 客户端（浏览器头 + 15s 超时）与载荷解析
  ├─ lib/phase.js      时段/法定节假日算法（梁文峰/梁文谷）
  ├─ lib/window.js     窗口区间、快照估算、按天聚合计费与 Token
  ├─ lib/validate.js   /dsbal/* 请求校验（含 fromMs 范围、凭据长度与 key 形态）
  └─ lib/i18n.js       读取宿主语言偏好
客户端 lib/client.js   window.__ModuleLoader__ 产物：shell.overlay 悬浮小组件 + 文案表（zh/en）
```

**认证**：四条 `/dsbal/*` 路由都先过宿主自己的门禁 `ctx.connection.admit(req)`
（与 `/api` 通道同一套 Host/Origin 信任栅栏 + 浏览器 cookie 认证）。
未携带会话 cookie 的请求返回 **401**，跨源请求返回 **403**，方法不符返回 **405**，
非法请求体返回 **400 且不改动任何状态**。写入凭据的接口只对已登录的本机浏览器开放。

## 配置

在 profile 的补丁层按 entry id 覆盖（`config:` 是**整体替换**，未写的字段回落默认值）：

```yaml
- id: dsh-deepseek-balance
  config:
    pollIntervalMs: 900000     # 轮询周期，30s ~ 24h，默认 5 分钟
    historyDays: 180           # 余额快照保留天数 / 自定义窗口上限，1 ~ 400，默认 90
    usageTtlMs: 1800000        # 用量接口成功缓存，1min ~ 24h，默认 1 小时
    usageErrorTtlMs: 600000    # 用量接口失败缓存，1min ~ 24h，默认 10 分钟
    maxSnapshots: 5000         # 快照条数上限，100 ~ 100000
    requestTimeoutMs: 15000    # 单次请求超时，1s ~ 120s
```

后端地址（`balanceUrl` / `usageCostUrl` / `usageAmountUrl`）也可覆盖，必须是 https。
任何非法值都会**让插件激活失败并打印字段名**，而不是静默用默认值。

## 模型访问（agent tool）

本插件目前**不注册** agent tool。原因是硬约束而非取舍：注册 tool 需要 harness 的
`defineTool()`（位于 `@deepseek-ai/dsh-tools`），而本插件零依赖、profile 里也解析不到该包；
手写 `tools.register()` 的裸定义会依赖 harness 内部契约，在没有真实 agent 会话的情况下无法验证。
因此操作已先收敛到 `lib/service.js`（UI 与将来的 tool 共用一个实现），
而**写入凭据的 `setConfig()` 永远不会被 model 触达**——这是设计约束，不是待办。

## 注意事项

- `/usage/cost` 与 `/usage/amount` 是**平台私有**控制台接口（不在公开文档中），可能变化；
  不可用时自动回退估算。数据为**账号整体**统计——平台接口不支持按 API Key 筛选。
- userToken 会自然过期；用量数据最多滞后 1 小时（内存缓存），点「刷新」立即更新。
- 密钥明文保存于 `~/.deepseek-balance.json`（0600），请勿泄露。
- 状态文件带 `schemaVersion` 信封并**原子写入**（临时文件 + rename），写入串行化；
  若文件损坏或版本高于插件，插件会把它**改名隔离**为 `…​.corrupt-<时间戳>`、
  从空状态启动，并在面板上显示原因——不会静默丢数据。
- 法定节假日按**国务院办公厅年度通知**内置（当前收录 **2026 年**）。跨年后需更新插件才能
  识别次年节假日；未收录的年份会标注「节假日数据待更新」并暂按普通周一至周五判定。

## 贡献

欢迎 Issue / PR（高峰阈值提醒、按模型筛选、多语言等）。
请保持 `lib/client.js` 的 `window.__ModuleLoader__` 产物格式。

改动任何模块后请跑 `npm test`（**113 项**，全部是零依赖的 Node 内置断言）：

| 套件 | 项数 | 覆盖 |
| --- | --- | --- |
| `test/phase.test.mjs` | 28 | 时段算法：工作日/周末/法定节假日/跨节日合并段/未收录年份回退 |
| `test/window.test.mjs` | 14 | 北京日界、快照估算（充值不计消耗）、跨月/跨年区间、按模型与 Token 汇总 |
| `test/config.test.mjs` | 6 | 默认值、整体替换语义、未知字段、范围与 https 校验 |
| `test/store.test.mjs` | 9 | 原子写、串行写者、权限 0600、损坏/未来版本隔离、写失败可诊断 |
| `test/i18n.test.mjs` | 5 | BCP 47 归一化、settings.describe() 读取与安全退化 |
| `test/service.test.mjs` | 13 | poll/refresh/setConfig/setWindow/getState（注入假 HTTP，无网络） |
| `test/routes.test.mjs` | 18 | 请求校验与边界（非法 id/非 JSON/类型错/fromMs 范围/长度/key 形态） |
| `test/package.test.mjs` | 20 | 包名与导出、组合层只有一行 insert、客户端产物与文案表、认证门禁不可回归 |

CI（`.github/workflows/test.yml`）在 Node 20/24 矩阵上跑 `npm run check` + `npm test`。
改动**客户端产物格式**（`window.__ModuleLoader__.load` + `exports.inject`）、
**认证门禁**、**状态文件格式**或**时段算法**时，必须同步更新对应套件；
时段算法与客户端文案表都有结构性断言兜底（表外中文字面量、zh/en 键一一对应）。

## License

[MIT](LICENSE)
