# 霍尔木兹海峡船舶流量监控

基于 IMF PortWatch 每日船舶过境数据的可视化监控页面，展示霍尔木兹海峡自 2021 年至今的每日通行量变化。

## 数据来源

- **IMF PortWatch** — 基于 MarineTraffic / Spire Global 的商业 AIS 数据
- 托管于联合国人道主义数据交换平台 (HDX)，免费公开
- 覆盖全球 28 个海上咽喉要道，本项目提取霍尔木兹海峡部分

## 快速开始

```bash
# 需要 Node.js >= 18
node server.mjs
```

打开浏览器访问 http://localhost:8765

## 功能

- **每日通行量曲线** — 1700+ 天历史数据
- **按船型分类** — 油轮、干散货、集装箱、其他货船四条曲线
- **近期柱状图** — 油轮与其他船舶堆叠对比
- **时间范围切换** — 1周 / 1月 / 1季度 / 半年 / 1年 / 全部
- **自动更新** — 每次刷新页面时后台从 IMF 拉取最新数据（1小时缓存）

## 文件结构

```
hormuz-monitor/
├── server.mjs              # Node.js HTTP 服务器（静态文件 + 数据代理）
├── hormuz-traffic.html     # 前端页面（Chart.js 可视化）
├── data/
│   └── hormuz-daily.csv    # 霍尔木兹每日通行量（自动更新）
└── README.md
```

## 工作原理

1. `server.mjs` 提供 HTTP 静态文件服务（端口 8765）
2. 前端页面加载 `data/hormuz-daily.csv` 绘制图表
3. 当请求 CSV 时，服务器后台从 IMF PortWatch 下载最新全量 CSV（~16MB），提取霍尔木兹数据覆盖本地缓存
4. 下载不阻塞页面响应——先用本地缓存秒开，下次刷新即为最新数据
5. 1小时内不重复下载，避免频繁请求

## 配置

在 `server.mjs` 中可修改：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 8765 | HTTP 服务端口 |
| `CACHE_TTL` | 3600000 (1h) | 数据缓存有效期（毫秒） |

## 依赖

- Node.js >= 18（无需 npm install，仅使用标准库）
- 前端通过 CDN 加载 Chart.js 和 date-fns 适配器
