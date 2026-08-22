# dsh-deepseek-balance

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的**持久化插件**：
监控 DeepSeek 账号余额与 API 用量，以**右下角悬浮小组件**常驻显示，
并在高峰时段（梁文峰）提醒你不要大量使用 API。

![widget](docs/widget.png)

## 功能

- **余额实时显示**：总余额 / 充值余额，来自官方 `GET /user/balance`（每 5 分钟轮询）。
- **指定时间段消耗**：今天 / 近24小时 / 近7天 / 自定义起始日期，含按模型明细（`/usage/cost`）。
- **Token 三类消耗**：输入（命中缓存）/ 输入（未命中缓存）/ 输出，与平台用量页一致（`/usage/amount`）。
- **梁文峰 / 梁文谷提醒**：🔴 梁文峰 = 高峰时段（北京时间 09:00–12:00、14:00–18:00，价格 ×2），
  🟢 梁文谷 = 空闲时段（其余时间，约半价）；显示当前时段、切换倒计时，高峰时红色高亮提醒。
- **与官方文档一致**：价格时段依据 <https://api-docs.deepseek.com/zh-cn/quick_start/pricing>。

## 前置条件

- 运行 deepseek-harness 的 **web profile**（`dsh web`）。
- DeepSeek **API Key**（platform.deepseek.com → API keys）。
- 可选：平台 **userToken**（platform.deepseek.com → F12 → Application → Local Storage），
  用于精确统计每日消耗/Token；未配置时自动回退为余额快照估算。

## 安装

```sh
cd ~/.dsh/profiles/web
dsh plugin --profile web add file:../<路径>/dsh-deepseek-balance
```

然后把下面这段追加到 `~/.dsh/profiles/web/cordis.patch.yml`：

```yaml
- insert:
    - id: dsh-deepseek-balance
      name: dsh-deepseek-balance
```

重启 profile（`dsh web`）。右下角出现小组件 → 点击展开 → 「配置」粘贴 API Key
（及可选 userToken）→ 「保存」。

> npm 分发：`npm publish` 后，用户直接
> `dsh plugin --profile web add dsh-deepseek-balance` 即可。

## 持久化

与"会话级动态插件"不同，这是常规的 composition 插件：由 profile 启动时加载，
**重启 `dsh` 后依然存在**。所有配置与余额快照历史保存在
`~/.deepseek-balance.json`。

## 配置项

| 字段 | 位置 | 说明 |
| --- | --- | --- |
| API Key | 组件 → 配置 | 必填；余额接口 |
| userToken | 组件 → 配置 | 可选；精确用量接口 |
| 时间窗口 | 组件按钮 | 今天 / 24h / 7天 / 自定义 |

## 工作原理

```
┌──────────────────────────── dsh web profile ────────────────────────────┐
│ 宿主插件 (lib/index.js)                                                 │
│   · 每 5 分钟轮询余额与用量（fetch）                                     │
│   · 持久化到 ~/.deepseek-balance.json                                   │
│   · 提供同源 HTTP：/dsbal/state | /dsbal/refresh | /dsbal/config |        │
│     /dsbal/window                                                        │
│                                                                          │
│ 客户端模块 (lib/client.js, window.__ModuleLoader__ 产物)                 │
│   · 在 shell.overlay 槽位注册右下角小组件                                │
│   · fetch() 上述路由；每 30 秒刷新                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

## 注意事项

- `/usage/cost` 与 `/usage/amount` 是平台私有的控制台接口（不在公开 API 文档中），
  可能随时变化；不可用时插件自动回退为余额快照估算。
- 请勿泄露你的 API Key / userToken：它们明文保存在
  `~/.deepseek-balance.json`（权限 0600）。

## 贡献

欢迎提交 Issue / PR（预警阈值、按模型筛选等想法均好）。
客户端产物需要与 dsh web 客户端模块系统的 `window.__ModuleLoader__` 格式保持一致。

## License

MIT
