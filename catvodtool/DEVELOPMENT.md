# CatVod Tool — 开发历程

## 项目起源

目标：在 Windows 上复刻 Android CatVod/Fongmi 的 JS 爬虫执行环境，实现"电脑上调通，手机上就能用"的开发体验。

Android 有三套爬虫引擎：JAR（DexClassLoader）、JS（QuickJS）、Python（Chaquopy）。只做 JS。

## 架构演变

### 第一代：QuickJS JNI（放弃）

最初想用 JNA 直接绑定 QuickJS C 库（和 Android 的 `wang.harlon.quickjs` 库同架构）。编译 QuickJS DLL 失败——MSYS2 GCC 和 Git Bash 有路径冲突，无法可靠编译。

### 第二代：qjs.exe 子进程 + JSON 协议（当前方案）

改用 quickjs-ng 预编译的 `qjs.exe`，通过 stdin/stdout 逐行 JSON 通信：

```
Java ←→ stdin/stdout JSON ←→ qjs.exe --std server.js
```

**关键发现：**
- `std.in.getline()` 在 live process 下正常工作，`std.in.read()` 会阻塞
- 独立爬虫用 `new Function('module','exports', code)` eval，需预处理 `export default` → `module.exports`
- `async/await` 在 blocking stdin 模式下有 Promise 微任务问题——最终方案是编译前替换 `async`/`await` 为同步代码（因为所有 `await` 目标都是同步 `req()`）

### 第三代：DrPy 模块模式

DrPy 引擎使用 ES `import`，`new Function` 不支持。引入 `qjs.exe --std --module` 路径：

- 独立爬虫 → script 模式（`server.js`）
- DrPy 爬虫 → module 模式（动态生成 wrapper，es module 原生加载）

**DrPy 依赖链：** 引擎文件里 `import` 的依赖全部从引擎 URL 的同级目录下载。

**兜底引擎：** 如果没有指定引擎，使用内置 `resources/drpy/` 下的 tvbox-main 版本。

### 第四代：HTML GUI（已废弃）

短暂尝试过浏览器调试界面（`Server.java` + `web/index.html`），后来意识到这工具是给 AI 用的，不需要 GUI。已删除。

### 第五代：去 Gradle 化（当前版本）

移除 Gradle，改为：
- OkHttp/Gson JAR 直接内置在 `lib/`
- `build.bat` 用 `javac` 编译，`java` 运行
- 零下载、零外部依赖（除 JDK 21）

## 关键设计决策

### 1. 为什么用子进程而不是 JNA
编译 QuickJS DLL 在 Windows 上过于复杂。子进程 + JSON 协议更简单，且使用真正的 QuickJS 引擎，行为与 Android 一致。

### 2. 为什么预处理 async/await
`std.in.getline()` 阻塞时 QuickJS 不处理微任务队列，`Promise.then()` 回调永不触发。预处理为同步代码避免了这个问题。

### 3. 为什么有两个加载路径（script vs module）
独立爬虫简单，script 模式足矣。DrPy 有复杂 import 链，必须用 module 模式让 qjs 原生处理。

### 4. 为什么引擎能动态下载
Android 行为是按 `api` 字段从网络下载引擎。硬编码本地引擎不符合这个逻辑。目前策略：有 `api` 就下载，没有就用内置兜底。

## 当前已知问题

### `$js is not defined`
CatVod 的 drpy2 版本有一个名为 `$js.toString()` 的模板 helper 函数，在规则文件中作为 `$js.toString(() => {...})` 使用。但在所有公开的 drpy 源码中都找不到 `$js` 的定义。它是 catvod 自己的 fork 加的功能。

**影响：** 约 20% 的 DrPy 爬虫（采集之王、爱奇艺、优酷、腾讯等）因缺少 `$js` 而失败。

**修复方向：** 从 catvod 的 minified `drpy2.min.js` 反推 `$js` 的实现。已知 `$js.toString(fn)` 返回函数体源码字符串。

### `pdfa/pdfh/pd is not defined`
某些 cheerio 版本缺少这三个函数。已通过 `_pdfh_shim.js` 提供 shim，但个别爬虫（鬼片之家）仍有问题。根因是 cheerio 版本不匹配。

### 中文字符
控制台输出 GBK 编码问题（数据正确，显示乱码）。Windows 终端限制，不影响功能。

## 如何扩展

### 添加新的全局函数
在 `server.js` 或 DrPy wrapper 的全局注入区添加。对应的 Java 实现在 `Crypto.java` 或 `QuickJSBridge.java` 的 `handleCryptoRequest()`。

### 修复 $js
1. 在 `JsSpider.generateWrapper()` 的全局注入区添加 `globalThis.$js`
2. 实现 `$js.toString(fn)` — 调用 `fn.toString()` 返回函数体
3. 可选：通过 `<module>.toString()` 或正则提取 `() => { ... }` 的内容

### 支持更多爬虫类型
- JAR 爬虫（`csp_`）— 需要 DexClassLoader 或 dex2jar，当前不支持
- Python 爬虫（`.py`）— 需要嵌入式 CPython，当前不支持

### 添加新的测试维度
在 `Test.java` 的测试循环中加入 `search()`、`detail()`、`play()` 调用。

## 文件说明

| 文件 | 作用 |
|------|------|
| `build.bat` | 编译 + 运行 |
| `bin/qjs.exe` | QuickJS 引擎（quickjs-ng v0.14.0） |
| `lib/*.jar` | OkHttp 4.12、Gson 2.10.1、Kotlin stdlib、Okio |
| `Test.java` | CLI 入口：下载 → 类型检测 → 逐个测试 |
| `JsSpider.java` | 爬虫加载器：standalone/DrPy 分支 |
| `QuickJSBridge.java` | qjs 子进程管理 + JSON 协议 + HTTP 代理 |
| `Module.java` | JS 源下载 + LRU 缓存 |
| `Spider.java` | 爬虫接口定义 |
| `Crypto.java` | MD5/AES/RSA 实现 |
| `Trans.java` | 简繁转换（2700 字对照表） |
| `server.js` | 独立爬虫的桥接脚本（script 模式） |
| `js/lib/` | cheerio, crypto-js, gbk, http.js 等 |
| `drpy/` | 兜底 Drpy 引擎 + 依赖 + pdfh shim |
