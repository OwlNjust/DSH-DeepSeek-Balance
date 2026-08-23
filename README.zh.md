# dsh-deepseek-balance

> DeepSeek Harness 的 DeepSeek 余额与用量实时监控插件 —— 右下角悬浮小组件，
> 附高峰/空闲时段（梁文峰 / 梁文谷）价格提醒。
>
> 中文 · **[English](README.md)**

---

**安装只需一步：** 把 `https://github.com/OwlNjust/DSH-DeepSeek-Balance`
发给您的 agent，它就知道如何自动安装本插件。手动安装步骤如下。

## 安装（面向 agent，无需 npm）

本包从**本地克隆**安装——零运行时依赖，**不发布 npm**。agent（或人工）按以下步骤执行即可：

```sh
# 1. 克隆/复制仓库到任意可访问路径
git clone https://github.com/OwlNjust/DSH-DeepSeek-Balance.git /tmp/dsh-deepseek-balance

# 2. 安装到 web profile（file: = 快照；link: = 源码符号链接）
cd ~/.dsh/profiles/web
dsh plugin --profile web add file:/tmp/dsh-deepseek-balance
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

- **不要**执行 `npm publish`；安装基于本地克隆。
- 配置与余额历史保存在 `~/.deepseek-balance.json`（0600），**切勿回显其内容**。
- 卸载：删除 `cordis.patch.yml` 中的行、删除
  `~/.dsh/profiles/web/node_modules/dsh-deepseek-balance`，重启 `dsh web`。

## 前置条件

- deepseek-harness 的 **web profile**（`dsh web`）；Node.js ≥ 20。
- DeepSeek **API Key**（platform.deepseek.com → API keys）。
- 可选：平台 **userToken**（platform.deepseek.com → F12 → Application → Local Storage），
  用于精确统计消耗/Token；未配置时自动回退为余额快照估算。

## 功能

- **余额** —— 总余额 / 充值余额，官方 `GET /user/balance`，每 5 分钟刷新。
- **时间段消耗** —— 今天 / 近24小时 / 近7天 / 自定义起始日期，含按模型明细（`/usage/cost`）。
- **Token 消耗** —— 输入（命中缓存）/ 输入（未命中缓存）/ 输出，与平台用量页一致（`/usage/amount`）。
- **价格时段提醒** —— 🔴 **梁文峰**（高峰：北京时间周一至周五 09:00–12:00 与 14:00–18:00，价格 ×2）
  与 🟢 **梁文谷**（空闲：其余时间，含周末全天，约半价），实时倒计时，高峰红色高亮。
  时段依据[官方定价文档](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)。

## 使用

| 项目 | 位置 |
| --- | --- |
| API Key / userToken | 小组件 → 配置 |
| 时间窗口 | 小组件按钮（今天 / 24h / 7天 / 自定义） |
| 刷新 | 「刷新」按钮（或自动：5 分钟 / 30 秒） |
| 药丸摘要 | 右下角：当前价格时段 + 余额 + 时段消耗 |

## 架构

```
宿主插件 lib/index.js     轮询（fetch）→ ~/.deepseek-balance.json
                           输出 JSON：/dsbal/state|refresh|config|window
客户端模块 lib/client.js   window.__ModuleLoader__ 产物
                           注册 shell.overlay 小组件；fetch() 上述路由
```

## 注意事项

- `/usage/cost` 与 `/usage/amount` 是**平台私有**控制台接口（不在公开文档中），可能变化；
  不可用时自动回退估算。数据为**账号整体**统计——平台接口不支持按 API Key 筛选。
- userToken 会自然过期；用量数据最多滞后 1 小时（内存缓存），点「刷新」立即更新。
- 密钥明文保存于 `~/.deepseek-balance.json`（0600），请勿泄露。

## 贡献

欢迎 Issue / PR（高峰阈值提醒、按模型筛选、多语言等）。
请保持 `lib/client.js` 的 `window.__ModuleLoader__` 产物格式。

## License

[MIT](LICENSE)
