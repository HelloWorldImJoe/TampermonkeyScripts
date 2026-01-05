## TampermonkeyScripts 油猴脚本合集

本仓库收录了多个实用的 Tampermonkey（油猴）脚本，提升各类网站的使用体验。

### 当前脚本列表
- **V2EX Planet 关注按钮**：为 V2EX Planet 页面博客添加一键关注按钮，支持快速添加到 Planet 应用中进行阅读和管理。
	- 适用页面：[https://www.v2ex.com/planet](https://www.v2ex.com/planet)， [https://v2ex.com/planet](https://v2ex.com/planet)
	- [脚本安装地址](https://github.com/HelloWorldImJoe/TampermonkeyScripts/raw/master/planet-follow-button.user.js)

- **V2EX 打赏 + 私信 + 快速感谢**：为 V2EX 主题与 Planet 添加打赏（$V2EX / SOL）、1 $V2EX 私信、以及打赏者“一键感谢”填充/可选自动提交。
	- 适用页面：`https://www.v2ex.com/t/*`，`https://*.v2ex.com/t/*`，Planet 列表与评论页
	- [脚本安装地址](https://github.com/HelloWorldImJoe/TampermonkeyScripts/raw/master/v2ex-scene-script.user.js)
	- 本仓库文件：`v2ex-scene-script.user.js`

- **快速感谢打赏者（已并入上方脚本）**：原独立脚本 `topic-quick-thank.user.js` 的功能已整合进 `v2ex-scene-script.user.js`，仍可用于本地 `target/topic.html` 测试。
		- 使用方式：安装/更新 `v2ex-scene-script.user.js` 后，在话题打赏列表旁出现“感谢所有打赏者”“单独感谢”按钮；默认不自动提交，可切换按钮开启自动提交。
		- 风险提示：自动提交可能误发，建议先保持关闭并人工检查内容。


> 更多脚本将持续更新，欢迎关注和提出建议！

### 安装方法
1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 选择需要的脚本，点击对应安装链接

### 贡献
欢迎提交 PR 或 issue，贡献你的脚本或建议。

### 开源协议
MIT
