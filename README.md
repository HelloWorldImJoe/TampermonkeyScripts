## TampermonkeyScripts 油猴脚本合集

本仓库收录了多个实用的 Tampermonkey（油猴）脚本，提升各类网站的使用体验。

### 当前脚本列表
- **V2EX Planet 关注按钮**：为 V2EX Planet 页面博客添加一键关注按钮，支持快速添加到 Planet 应用中进行阅读和管理。
	- 适用页面：[https://www.v2ex.com/planet](https://www.v2ex.com/planet)， [https://v2ex.com/planet](https://v2ex.com/planet)
	- [脚本安装地址](https://github.com/HelloWorldImJoe/TampermonkeyScripts/raw/master/planet-follow-button.user.js)

- **V2EX 快速感谢打赏者**：在 V2EX 话题页面快速感谢打赏过你的用户，一键填充回复框并可选择自动提交。
	- 适用页面：`https://www.v2ex.com/t/*`，本地测试页面：`target/topic.html`（file 协议）
	- [脚本安装地址](https://github.com/HelloWorldImJoe/TampermonkeyScripts/raw/master/topic-quick-thank.user.js)
	- 本仓库文件：`topic-quick-thank.user.js`
	- 使用说明：
	  1. 安装 Tampermonkey 扩展并从仓库或本地安装 `topic-quick-thank.user.js`。
	  2. 打开一个 V2EX 话题页面（且你有回复权限），在打赏者列表旁会出现“感谢所有打赏者”按钮。
	  3. 点击该按钮会将 `@用户` 列表填入回复框。脚本默认不会自动提交，避免误操作。可切换“自动提交”按钮以开启/关闭自动提交功能。
	  4. 自动提交会触发页面的提交按钮或直接提交表单，请谨慎开启。

	- 风险与建议：
	  - 自动提交有可能造成误发或重复发送，首次使用请保持默认关闭并手动确认内容后提交。
	  - 脚本基于页面结构进行选择器查找，如页面改版可能需要更新脚本。


> 更多脚本将持续更新，欢迎关注和提出建议！

### 安装方法
1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 选择需要的脚本，点击对应安装链接

### 贡献
欢迎提交 PR 或 issue，贡献你的脚本或建议。

### 开源协议
MIT
