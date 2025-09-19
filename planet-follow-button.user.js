// ==UserScript==
// @name         V2EX Planet 关注按钮
// @namespace    https://github.com/tampermonkey/tampermonkey
// @version      1.0.0
// @description  为V2EX Planet页面的博客添加关注按钮，支持一键添加到Planet应用中进行阅读和管理
// @author       joejoejoe
// @homepage     https://github.com/HelloWorldImJoe/TampermonkeyScripts
// @supportURL   https://github.com/HelloWorldImJoe/TampermonkeyScripts/issues
// @match        https://www.v2ex.com/planet
// @match        https://v2ex.com/planet
// @icon         https://www.v2ex.com/static/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @license      MIT
// @created      2025-09-19
// @updated      2025-09-19
// ==/UserScript==

(function() {
    'use strict';

    // 添加自定义样式
    GM_addStyle(`
        .follow-button {
            position: absolute;
            top: 8px;
            right: 8px;
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 12px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            transition: all 0.2s ease;
            z-index: 10;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            min-width: 48px;
            text-align: center;
        }

        .follow-button:hover {
            background-color: #45a049;
            transform: translateY(-1px);
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        }

        .follow-button.following {
            background-color: #f44336;
            cursor: pointer;
            opacity: 1;
        }

        .follow-button.following:hover {
            background-color: #da190b;
            transform: translateY(-1px);
        }

        .planet-post {
            position: relative;
        }

        /* 夜间模式适配 */
        .Night .follow-button {
            background-color: #555;
            color: #fff;
            box-shadow: 0 1px 3px rgba(255,255,255,0.1);
        }

        .Night .follow-button:hover {
            background-color: #666;
            box-shadow: 0 2px 6px rgba(255,255,255,0.15);
        }

        .Night .follow-button.following {
            background-color: #d32f2f;
            cursor: pointer;
            opacity: 1;
        }

        .Night .follow-button.following:hover {
            background-color: #b71c1c;
            transform: translateY(-1px);
        }
    `);

    // 获取已关注的站点列表
    function getFollowedSites() {
        const followed = GM_getValue('followedSites', '[]');
        return JSON.parse(followed);
    }

    // 保存已关注的站点列表
    function saveFollowedSites(sites) {
        GM_setValue('followedSites', JSON.stringify(sites));
    }

    // 切换关注状态
    function toggleFollow(siteAddress, siteName, button) {
        const followedSites = getFollowedSites();
        const siteIndex = followedSites.findIndex(site => site.address === siteAddress);

        if (siteIndex > -1) {
            // 取消关注
            followedSites.splice(siteIndex, 1);
            button.textContent = '关注';
            button.classList.remove('following');
            console.log(`已取消关注: ${siteName}`);
            saveFollowedSites(followedSites);
        } else {
            // 添加关注
            followedSites.push({
                address: siteAddress,
                name: siteName,
                followedAt: new Date().toISOString()
            });
            button.textContent = '已关注';
            button.classList.add('following');
            console.log(`已关注: ${siteName}`);
            saveFollowedSites(followedSites);

            // 只有在添加关注时才打开 planet:// 链接
            const planetUrl = `planet://${siteAddress}`;
            try {
                window.open(planetUrl, '_blank');
            } catch (e) {
                // 如果浏览器不支持自定义协议，在控制台显示链接
                console.log(`请复制此链接到支持的应用中打开: ${planetUrl}`);
                alert(`已关注 ${siteName}！\n\n如需在Planet应用中打开，请复制此链接：\n${planetUrl}`);
            }
        }
    }

    // 创建关注按钮
    function createFollowButton(siteAddress, siteName) {
        const followedSites = getFollowedSites();
        const isFollowing = followedSites.some(site => site.address === siteAddress);

        const button = document.createElement('button');
        button.className = 'follow-button';
        button.textContent = isFollowing ? '已关注' : '关注';
        
        if (isFollowing) {
            button.classList.add('following');
        }

        button.addEventListener('click', function(e) {
            e.stopPropagation(); // 防止触发博客点击事件
            e.preventDefault();
            
            toggleFollow(siteAddress, siteName, button);
        });

        return button;
    }

    // 为所有博客文章添加关注按钮
    function addFollowButtons() {
        const blogPosts = document.querySelectorAll('.planet-post');
        
        blogPosts.forEach(post => {
            // 检查是否已经添加了关注按钮
            if (post.querySelector('.follow-button')) {
                return;
            }

            const siteAddress = post.getAttribute('data-site-address');
            const siteNameElement = post.querySelector('.planet-site-title');
            
            if (siteAddress && siteNameElement) {
                const siteName = siteNameElement.textContent.trim();
                const followButton = createFollowButton(siteAddress, siteName);
                post.appendChild(followButton);
            }
        });
    }

    // 页面加载完成后执行
    function init() {
        // 等待页面元素加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', addFollowButtons);
        } else {
            addFollowButtons();
        }

        // 监听页面变化（处理动态加载的内容）
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // 检查新增的节点是否包含博客文章
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1 && node.classList && node.classList.contains('planet-post')) {
                            // 为新加载的博客文章添加关注按钮
                            setTimeout(addFollowButtons, 100);
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 启动脚本
    init();
})();