# dsh-deepseek-balance

> DeepSeek Harness 的 DeepSeek 余额与用量实时监控插件 —— 右下角悬浮小组件，
> 提醒你高峰价格时段的 API 使用。
>
> 中文 · **[English](README.md)**

## 功能

- **余额** —— 总余额 / 充值余额，官方 `GET /user/balance`，每 5 分钟刷新。
- **时间段消耗** —— 今天 / 近24小时 / 近7天 / 自定义起始日期，含按模型明细（`/usage/cost`）。
- **Token 消耗** —— 输入（命中缓存）/ 输入（未命中缓存）/ 输出，与平台用量页一致（`/usage/amount`）。
- **价格时段提醒** —— 🔴 **梁文峰**（高峰：北京时间周一至周五 09:00–12:00、14:00–18:00，价格 ×2）
  与 🟢 **梁文谷**（空闲：其余时间，含周末全天，约半价），实时倒计时；高峰时红色高亮提醒节制用量。

价格时段依据[官方文档](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)。

## 前置条件

- 运行 deepseek-harness 的 **web profile**（`dsh web`）。
- DeepSeek **API Key**（platform.deepseek.com → API keys）。
- 可选：平台 **userToken**（platform.deepseek.com → F12 → Application → Local Storage），
  用于精确统计消耗/Token；未配置时自动回退为余额快照估算。

## 安装

```sh
cd ~/.dsh/profiles/web
dsh plugin --profile web add file:../<路径>/dsh-deepseek-balance
```

追加到 `~/.dsh/profiles/web/cordis.patch.yml`：

```yaml
- insert:
    - id: dsh-deepseek-balance
      name: dsh-deepseek-balance
```

重启 profile（`dsh web`）。点击小组件 → 「配置」→ 粘贴 API Key（及可选 userToken）→ 「保存」。

> 发布到 npm 后，一条命令即可安装：`dsh plugin --profile web add dsh-deepseek-balance`。

## 使用

| 项目 | 位置 |
| --- | --- |
| API Key / userToken | 小组件 → 配置 |
| 时间窗口 | 小组件按钮（今天 / 24h / 7天 / 自定义） |
| 刷新 | 「刷新」按钮（或自动：5 分钟 / 30 秒） |
| 药丸摘要 | 右下角：当前价格时段 + 余额 + 时段消耗 |

## 持久化

常规 composition 插件，由 profile 启动时加载——**重启 `dsh` 后依然存在**。
配置与余额快照历史保存在 `~/.deepseek-balance.json`（权限 0600），请勿泄露该文件。

## 架构

```
宿主插件 lib/index.js     轮询（fetch）→ ~/.deepseek-balance.json
                           输出 JSON：/dsbal/state|refresh|config|window
客户端模块 lib/client.js   window.__ModuleLoader__ 产物
                           注册 shell.overlay 小组件；fetch() 上述路由
```

## 注意事项

- `/usage/cost` 与 `/usage/amount` 是**平台私有**控制台接口（不在公开文档中），可能变化；
  不可用时自动回退快照估算。数据为**账号整体**统计——平台接口不支持按 API Key 筛选。
- userToken 会自然过期；用量数据最多滞后 1 小时（内存缓存），点「刷新」立即更新。
- 建议 Node.js ≥ 20（使用全局 fetch 与 AbortSignal.timeout）。

## 贡献

欢迎 Issue / PR —— 例如高峰时段消耗阈值提醒、按模型筛选、更多语言。
请保持 `lib/client.js` 的 `window.__ModuleLoader__` 产物格式。

## License

[MIT](LICENSE)
