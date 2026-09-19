# DNT_OF

高中生，自学 C# 与 Python。给 [SCP: Secret Laboratory](https://github.com/DNTOF) 服务器写插件、数据接口和工具。

站点：[dntof.com](https://dntof.com)（GitHub Pages，仓库根目录即站点根目录，CNAME `dntof.com`）。

## 项目

以 GitHub 仓库为准，不在这里编造数字或评价。

| 项目 | 说明 | 状态 |
| --- | --- | --- |
| [SLDataAPI](https://github.com/DNTOF/SLDataAPI) | SCP:SL 服务端 LabAPI 插件。HTTP / WebSocket 暴露在线玩家、回合、核弹、阵营等实时数据 | 活跃 · v2.5.4 · GPLv3 |
| [astrbot_plugin_sl_query](https://github.com/DNTOF/astrbot_plugin_sl_query) | 上面那套数据的 AstrBot 群聊查询前端 | 活跃 |
| [SLAgent](https://github.com/DNTOF/SLAgent) | EXILED 插件：游戏里用自然语言管服务器 | 维护 |
| [astrbot_plugin_adsb_monitor](https://github.com/DNTOF/astrbot_plugin_adsb_monitor) | Dump1090 → ADS-B 推送。已归档 | 停更 |
| [DNT-118](https://github.com/DNT-118) | 面向 SCP:SL 服务器生态的开发组织 | 运作中 |
| [Foundation Console](https://dntof.com/platform/) | SLDataAPI 的自托管控制台 | 源码计划 2027-01-01 公开 |

其余仓库见 [github.com/DNTOF](https://github.com/DNTOF)。

## 站点结构

```text
/                 个人索引（dnt-index：静态 HTML/CSS，少量 JS）
/platform/        SLDataAPI × Foundation Console 说明
/dnt-118/         组织页
/redeem.html      兑换中心
/archive/         可选实验终端（原根路径上的 Three.js ARCHIVE OS）
CNAME             dntof.com
css/dnt-index.css 全站唯一主题
```

根路径不再跑 WebGL 开机动画。要看旧终端，从页脚「实验终端」进 `/archive/`，顶栏 Skip 回索引。

## dnt-index

一套主题，没有切换器。根页是编辑式个人索引：自定义字标、纸纹网格、SLDataAPI 数据链路示意图。没有左轨编号条，也没有假 HUD 顶栏。

- `--bg #EDEEE9` · `--ink #14161C` · `--muted #5C6570`
- `--line rgba(20,22,28,.14)` · `--panel #F7F7F4`
- `--signal #0F766E` · `--danger #B42318`
- 字体：IBM Plex Sans + Noto Sans SC（等宽只出现在示意图标注和子页）

`platform/`、`dnt-118/`、`redeem.html` 共用这份 CSS 的 token 和文档原语。

## 本地预览

仓库根目录就是站点根。不要用 `app/` 里的 Vite 去预览首页——那只会打开实验终端源码。

```bash
python3 -m http.server 8080
# http://127.0.0.1:8080/
# http://127.0.0.1:8080/platform/
# http://127.0.0.1:8080/dnt-118/
# http://127.0.0.1:8080/redeem.html
# http://127.0.0.1:8080/archive/
```

实验终端源码在 `app/`。`npm run build` 的产物不要覆盖仓库根的 `index.html`；线上入口是 `archive/index.html`，构建资源仍走 `/app-build/`。

## 支持

- 爱发电：https://afdian.com/a/DNT_OF
- 哔哩哔哩：https://space.bilibili.com/3493125592975851
