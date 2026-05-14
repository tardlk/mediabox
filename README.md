# MediaBox

CatVod / Fongmi / TVBox 的 QuickJS 爬虫脚本集合，附带 Windows 本地调试工具。

## 项目结构

```
mediabox/
├── js/                  # 爬虫脚本（116 个，直接放入 CatVod 使用）
├── skill/               # 开发参考文档
│   ├── catvod-quickjs-spider/
│   └── drpy-rule-spider/
├── catvodtool/          # 本地调试工具（Windows，JDK 21）
├── tvbox.json           # CatVod 配置示例
├── LICENSE
└── README.md
```

## 调试工具

无需 Android 设备，在电脑上直接测试爬虫。

**环境**：JDK 21+，其他一切（QuickJS 引擎、OkHttp、Gson）全部内置。

**用法**：

```bash
cd catvodtool

# 测试 js/ 目录下的爬虫（直接写文件名）
build.bat ikanbot.js
build.bat 豆瓣推荐.js

# 测试远程爬虫
build.bat "https://example.com/spider.js"

# 测试整个 JSON 配置
build.bat "https://example.com/tvbox.json"
```

输出 `PASS` 或 `FAIL`，PASS 表示 `home()` 返回了有效数据。

**原理**：Java 启动 `qjs.exe --std` 子进程，stdin/stdout 走 JSON 协议。JS 中的 HTTP 请求和加密计算全部代理到 Java 侧执行，行为与 Android WebView 中的 QuickJS 一致。详见 [`DEVELOPMENT.md`](catvodtool/DEVELOPMENT.md)。

## 爬虫类型

| 类型 | 特征 | 示例 |
|------|------|------|
| 独立 JS | `export default { init, home, ... }` | ikanbot.js, nsvod_spider.js |
| DrPy 规则 | `var rule = { ... }` | drpy.js, libvio.js |
| 流媒体直连 | Emby/Jellyfin/Plex API | emby.js, plex.js |

## CatVod 配置

在 CatVod 的 `tvbox.json` 中引用（以 ikanbot 为例）：

```json
{
  "key": "ikanbot",
  "name": "iKanBot",
  "type": 3,
  "api": "http://your-host/ikanbot.js",
  "searchable": 1,
  "quickSearch": 1,
  "filterable": 1
}
```

## 参考

- [`skill/catvod-quickjs-spider/`](skill/catvod-quickjs-spider/) — 完整 QuickJS 爬虫 API 参考
- [`skill/drpy-rule-spider/`](skill/drpy-rule-spider/) — DrPy 规则源编写指南
- [`catvodtool/DEVELOPMENT.md`](catvodtool/DEVELOPMENT.md) — 调试工具架构与设计决策

## License

MIT
