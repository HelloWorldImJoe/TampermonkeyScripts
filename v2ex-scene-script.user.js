// ==UserScript==
// @name         V2EX 打赏 + 私信
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  为 V2EX 添加回复打赏（$V2EX / SOL）与 1 $V2EX 私信能力
// @author       JoeJoeJoe
// @match        https://www.v2ex.com/*
// @match        https://*.v2ex.com/*
// @icon         https://www.v2ex.com/static/icon-192.png
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      www.v2ex.com
// @connect      jillian-fnk7b6-fast-mainnet.helius-rpc.com
// ==/UserScript==

(function() {
    'use strict';

    // 添加样式
    GM_addStyle(`
        :root {
            --tip-button-color: #374151;
            --tip-button-hover-bg: rgba(59, 130, 246, 0.12);
            --tip-button-hover-border: #3b82f6;
        }

        .Night {
            --tip-button-color: #9aa0ae;
            --tip-button-hover-bg: rgba(59, 130, 246, 0.08);
        }

        .tip-button {
            cursor: pointer;
            color: var(--dm-accent, #3b82f6);
            margin-left: 6px;
            font-size: 12px;
            font-weight: 600;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 2px 6px;
            border: 1px solid rgba(59, 130, 246, 0.45);
            border-radius: 3px;
            background: rgba(59, 130, 246, 0.08);
            line-height: 1.2;
            position: relative;
            transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }

        .tip-button:first-child {
            margin-left: 0;
        }

        .tip-button .tip-icon {
            width: 12px;
            height: 12px;
            display: block;
        }

        .planet-tip-button {
            width: auto;
            height: auto;
            padding: 2px 8px;
            line-height: 1.2;
            font-size: 12px;
        }

        .tip-button:hover {
            color: var(--dm-accent, #3b82f6);
            background: rgba(59, 130, 246, 0.18);
            border-color: rgba(59, 130, 246, 0.65);
        }

        .tip-button.loading {
            opacity: 0.6;
            pointer-events: none;
        }

        .tip-button[data-tip]:hover::after,
        .tip-button[data-tip]:hover::before {
            opacity: 1;
            visibility: visible;
            transform: translate(-50%, -6px);
        }

        .tip-button[data-tip]::after {
            content: attr(data-tip);
            position: absolute;
            left: 50%;
            bottom: 100%;
            transform: translate(-50%, 0);
            background: #111827;
            color: #e5e7eb;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 12px;
            white-space: nowrap;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
            opacity: 0;
            visibility: hidden;
            transition: all 0.16s ease;
            z-index: 2;
        }

        .tip-button[data-tip]::before {
            content: '';
            position: absolute;
            left: 50%;
            bottom: 100%;
            transform: translate(-50%, 0);
            border: 6px solid transparent;
            border-top-color: #111827;
            opacity: 0;
            visibility: hidden;
            transition: all 0.16s ease;
            z-index: 2;
            margin-bottom: -1px;
        }

        #tip-modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            justify-content: center;
            align-items: center;
        }

        .tip-modal-content {
            background: #1a1f2e;
            border-radius: 12px;
            width: 500px;
            max-width: 90%;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .tip-modal-tabs {
            display: flex;
            background: #232936;
        }

        .tip-modal-tab {
            flex: 1;
            padding: 15px;
            text-align: center;
            cursor: pointer;
            color: #8a92a3;
            font-weight: 500;
            border-bottom: 2px solid transparent;
            transition: all 0.3s;
        }

        .tip-modal-tab.active {
            color: #fff;
            background: #1a1f2e;
            border-bottom-color: #3b82f6;
        }

        .tip-modal-tab:hover {
            color: #fff;
        }

        .tip-modal-inner {
            padding: 30px;
        }

        .tip-modal-title {
            font-size: 16px;
            color: #e5e7eb;
            margin-bottom: 18px;
            line-height: 1.5;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .tip-meta-row {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }

        .tip-token-chip {
            padding: 4px 10px;
            border-radius: 8px;
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: #fff;
            font-weight: 700;
            letter-spacing: 0.2px;
            box-shadow: 0 6px 18px rgba(59, 130, 246, 0.35);
        }

        .tip-meta-sub {
            color: #9ca3af;
            font-size: 13px;
        }

        .tip-amount-container {
            margin-bottom: 20px;
        }

        .tip-amount-label {
            color: #9ca3af;
            font-size: 14px;
            margin-bottom: 10px;
            display: block;
        }

        .tip-amounts {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .tip-amount-option {
            display: none;
        }

        .tip-amount-label-radio {
            padding: 10px 20px;
            border: 1px solid #374151;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s;
            color: #d1d5db;
            background: #232936;
            font-size: 14px;
        }

        .tip-amount-option:checked + .tip-amount-label-radio {
            background: #3b82f6;
            border-color: #3b82f6;
            color: #fff;
        }

        .tip-amount-label-radio:hover {
            border-color: #4b5563;
            background: #2d3748;
        }

        .tip-actions {
            display: flex;
            gap: 10px;
        }

        .tip-button-action {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s;
        }

        .tip-button-cancel {
            background: #374151;
            color: #d1d5db;
        }

        .tip-button-cancel:hover {
            background: #4b5563;
        }

        .tip-button-confirm {
            background: #3b82f6;
            color: #fff;
        }

        .tip-button-confirm:hover {
            background: #2563eb;
        }

        .tip-button-confirm:disabled {
            background: #4b5563;
            cursor: not-allowed;
            opacity: 0.5;
        }

        .tip-message {
            margin-top: 15px;
            padding: 12px;
            border-radius: 6px;
            font-size: 13px;
            display: none;
        }

        .tip-message.success {
            background: #065f46;
            color: #d1fae5;
            display: block;
        }

        .tip-message.error {
            background: #7f1d1d;
            color: #fecaca;
            display: block;
        }

        .tip-message.info {
            background: #1e3a8a;
            color: #bfdbfe;
            display: block;
        }

        .tip-user-info {
            color: #3b82f6;
            font-weight: 600;
        }

        .tip-postscript-container {
            margin-bottom: 20px;
        }

        .tip-postscript-label {
            color: #9ca3af;
            font-size: 14px;
            margin-bottom: 10px;
            display: block;
        }

        .tip-postscript-input {
            width: 100%;
            padding: 10px;
            background: #232936;
            border: 1px solid #374151;
            border-radius: 6px;
            color: #d1d5db;
            font-size: 14px;
            resize: vertical;
            min-height: 80px;
            font-family: inherit;
            transition: border-color 0.3s;
        }

        .tip-postscript-input:focus {
            outline: none;
            border-color: #3b82f6;
        }

        .tip-postscript-input::placeholder {
            color: #6b7280;
        }

        /* DM UI */
        :root {
            --dm-accent: #3b82f6;
            --dm-bg: #0f172a;
            --dm-text: #e5e7eb;
            --dm-muted: #9ca3af;
        }
        .dm-btn {
            cursor: pointer;
            color: var(--dm-accent);
            font-size: 12px;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(59,130,246,0.45);
            background: rgba(59,130,246,0.08);
            padding: 2px 6px;
            border-radius: 3px;
            margin-left: 6px;
            text-decoration: none;
            transition: all 0.2s ease;
        }
        .dm-btn:hover { background: rgba(59,130,246,0.18); }
        .dm-btn.loading { opacity: 0.6; pointer-events: none; }

        #dm-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.72);
            z-index: 10000;
            justify-content: center;
            align-items: center;
        }
        .dm-modal {
            width: 460px;
            max-width: 88vw;
            background: #111827;
            color: var(--dm-text);
            border-radius: 12px;
            box-shadow: 0 24px 70px rgba(0,0,0,0.55);
            overflow: hidden;
        }
        .dm-head {
            padding: 16px 18px;
            background: #0b1220;
            border-bottom: 1px solid #1f2937;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .dm-body { padding: 18px; }
        .dm-field label { color: var(--dm-muted); font-size: 13px; display: block; margin-bottom: 8px; }
        .dm-field textarea {
            width: 100%;
            min-height: 90px;
            box-sizing: border-box;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #1f2937;
            background: #0f172a;
            color: var(--dm-text);
            resize: vertical;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s ease;
        }
        .dm-field textarea:focus { border-color: var(--dm-accent); }
        .dm-foot {
            padding: 14px 18px 16px;
            display: flex;
            align-items: center;
            gap: 10px;
            border-top: 1px solid #1f2937;
        }
        .dm-actions { margin-left: auto; display: flex; gap: 10px; }
        .dm-btn-ghost, .dm-btn-primary {
            border: none;
            border-radius: 8px;
            padding: 10px 14px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .dm-btn-ghost { background: #1f2937; color: var(--dm-text); }
        .dm-btn-ghost:hover { background: #273248; }
        .dm-btn-primary { background: var(--dm-accent); color: #fff; }
        .dm-btn-primary[disabled] { opacity: 0.6; cursor: not-allowed; }
        .dm-status { color: var(--dm-muted); font-size: 12px; }

        /* Quick Thank */
        .quick-thank-btn { cursor: pointer; }
        .quick-thank-modal {
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            background: #222;
            color: #fff;
            padding: 12px;
            border-radius: 6px;
            z-index: 99999;
            min-width: 280px;
        }
        .quick-thank-modal input[type=checkbox] { margin-right: 6px; }
        .quick-thank-modal .actions { margin-top: 10px; text-align: right; }
    `);

    const SOLANA_RPC = 'https://jillian-fnk7b6-fast-mainnet.helius-rpc.com';
    const WEB3_CDN = 'https://unpkg.com/@solana/web3.js@1.95.0/lib/index.iife.js';
    const SPL_TOKEN_CDN = 'https://unpkg.com/@solana/spl-token@0.4.5/lib/index.iife.js';
    const V2EX_MINT = '9raUVuzeWUk53co63M4WXLWPWE4Xc6Lpn7RS9dnkpump';
    const MESSAGE_COST = 1;

    // 用户地址缓存
    const addressCache = new Map();
    const planetOwnerCache = new Map();
    const DEFAULT_REPLY_MESSAGE = '感谢您的精彩回答';
    const QUICK_THANK_AUTO_SUBMIT = false;
    const QUICK_THANK_TEMPLATE = (names) => `感谢 ${names.join(' ')} 的打赏！🎉\n`;
    const QUICK_THANK_STORAGE_KEY = 'quick-thank-thanked-users-v1';
    let dmModalEl = null;
    let quickThankInitialized = false;

    // 使用 GM_xmlhttpRequest 包装 fetch，绕过浏览器 CORS 限制
    function gmFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                url,
                method: options.method || 'GET',
                headers: options.headers,
                data: options.body,
                timeout: options.timeout || 15000,
                responseType: options.responseType || 'text',
                onload: (resp) => {
                    const headers = new Headers();
                    if (resp.responseHeaders) {
                        resp.responseHeaders.trim().split(/\r?\n/).forEach(line => {
                            const idx = line.indexOf(':');
                            if (idx > -1) {
                                const key = line.slice(0, idx).trim();
                                const value = line.slice(idx + 1).trim();
                                headers.append(key, value);
                            }
                        });
                    }

                    const body = options.responseType === 'arraybuffer' ? resp.response : resp.responseText;
                    resolve(new Response(body, {
                        status: resp.status,
                        statusText: resp.statusText,
                        headers
                    }));
                },
                onerror: () => reject(new Error('Failed to fetch')),
                ontimeout: () => reject(new Error('Request timed out'))
            });
        });
    }

    // 动态加载依赖脚本
    function loadScriptOnce(src, checkFn) {
        return new Promise((resolve, reject) => {
            if (checkFn()) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                if (checkFn()) {
                    resolve();
                } else {
                    reject(new Error(`脚本加载失败: ${src}`));
                }
            };
            script.onerror = () => reject(new Error(`脚本加载失败: ${src}`));
            document.head.appendChild(script);
        });
    }

    async function ensureSolanaLibraries() {
        await loadScriptOnce(WEB3_CDN, () => typeof solanaWeb3 !== 'undefined');
        await loadScriptOnce(SPL_TOKEN_CDN, () => typeof splToken !== 'undefined');
    }

    function isSolAddress(addr) {
        return typeof addr === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());
    }

    // 获取用户的Solana地址
    async function getUserAddress(username, options = {}) {
        const { fallbackAddress } = options;
        if (addressCache.has(username)) {
            return addressCache.get(username);
        }

        const fallback = isSolAddress(fallbackAddress) ? fallbackAddress.trim() : null;
        if (fallback) {
            addressCache.set(username, fallback);
            return fallback;
        }

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${window.location.origin}/member/${username}`,
                onload: function(response) {
                    if (response.status === 200) {
                        const match = response.responseText.match(/const address = "([^"]+)";/);
                        const address = match ? match[1] : null;
                        const finalAddr = isSolAddress(address) ? address : fallback;
                        addressCache.set(username, finalAddr);
                        resolve(finalAddr);
                    } else {
                        reject(new Error('获取用户信息失败'));
                    }
                },
                onerror: function() {
                    if (fallback) {
                        addressCache.set(username, fallback);
                        resolve(fallback);
                        return;
                    }
                    reject(new Error('网络请求失败'));
                }
            });
        });
    }

    function getTopicAuthorInfo() {
        const authorLink = document.querySelector('.header small.gray a[href^="/member/"]');
        const username = authorLink ? authorLink.textContent.trim() : null;
        const pageAddress = typeof window.address === 'string' ? window.address.trim() : null;
        const address = isSolAddress(pageAddress) ? pageAddress : null;
        return { username, address };
    }

    // 获取 Planet 站点的作者 V2EX 用户名
    async function getPlanetOwnerUsername(siteAddress) {
        if (planetOwnerCache.has(siteAddress)) {
            return planetOwnerCache.get(siteAddress);
        }

        try {
            const response = await gmFetch(`${window.location.origin}/planet/${siteAddress}`);
            if (!response.ok) {
                throw new Error('获取 Planet 作者失败');
            }

            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const memberLink = doc.querySelector('.header a[href^="/member/"]');
            const username = memberLink?.textContent?.trim() || memberLink?.getAttribute('href')?.split('/')?.pop() || null;
            planetOwnerCache.set(siteAddress, username);
            return username;
        } catch (err) {
            console.error('获取 Planet 作者失败:', err);
            planetOwnerCache.set(siteAddress, null);
            return null;
        }
    }

    // 创建打赏弹窗
    function createTipModal() {
        const modal = document.createElement('div');
        modal.id = 'tip-modal-overlay';
        modal.innerHTML = `
            <div class="tip-modal-content">
                <div class="tip-modal-tabs">
                    <div class="tip-modal-tab active" data-token="v2ex">使用$V2EX打赏</div>
                </div>
                <div class="tip-modal-inner">
                    <div class="tip-modal-title">
                        <div class="tip-meta-row">
                            <div class="tip-token-chip" id="tip-token-chip">$V2EX</div>
                            <div>打赏给 <span class="tip-user-info" id="tip-username"></span></div>
                        </div>
                        <div class="tip-meta-sub">数额会 100% 进入对方的钱包</div>
                    </div>
                    <div class="tip-amount-container">
                        <label class="tip-amount-label">选择金额</label>
                        <div class="tip-amounts" id="tip-amounts">
                            <input type="radio" name="amount" value="5" id="amount-5" class="tip-amount-option">
                            <label for="amount-5" class="tip-amount-label-radio">5</label>
                            <input type="radio" name="amount" value="10" id="amount-10" class="tip-amount-option">
                            <label for="amount-10" class="tip-amount-label-radio">10</label>
                            <input type="radio" name="amount" value="20" id="amount-20" class="tip-amount-option" checked>
                            <label for="amount-20" class="tip-amount-label-radio">20</label>
                            <input type="radio" name="amount" value="50" id="amount-50" class="tip-amount-option">
                            <label for="amount-50" class="tip-amount-label-radio">50</label>
                            <input type="radio" name="amount" value="100" id="amount-100" class="tip-amount-option">
                            <label for="amount-100" class="tip-amount-label-radio">100</label>
                            <input type="radio" name="amount" value="500" id="amount-500" class="tip-amount-option">
                            <label for="amount-500" class="tip-amount-label-radio">500</label>
                        </div>
                    </div>
                    <div class="tip-postscript-container">
                        <label class="tip-postscript-label">附言（可选）</label>
                        <textarea id="tip-postscript" class="tip-postscript-input" placeholder="可以在这里写一些想对 TA 说的话..." maxlength="500"></textarea>
                    </div>
                    <div class="tip-actions">
                        <button class="tip-button-action tip-button-cancel" id="tip-cancel">取消</button>
                        <button class="tip-button-action tip-button-confirm" id="tip-confirm">发送</button>
                    </div>
                    <div class="tip-message" id="tip-message"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // 点击遮罩层关闭
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeTipModal();
            }
        });

        // 取消按钮
        document.getElementById('tip-cancel').addEventListener('click', closeTipModal);

        // Tab切换
        document.querySelectorAll('.tip-modal-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.tip-modal-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                updateTipTokenLabel(this.dataset.token);
            });
        });

        return modal;
    }

    // 更新 token 标签和徽章
    function updateTipTokenLabel(token) {
        const tokenName = token === 'v2ex' ? '$V2EX' : 'Solana';
        const nameEl = document.getElementById('tip-token-name');
        const chipEl = document.getElementById('tip-token-chip');
        if (nameEl) {
            nameEl.textContent = tokenName;
        }
        if (chipEl) {
            chipEl.textContent = tokenName;
        }
    }

    // 显示打赏弹窗
    async function showTipModal(username, address, floorNumber, replyText, replyId, options = {}) {
        let modal = document.getElementById('tip-modal-overlay');
        if (!modal) {
            modal = createTipModal();
        }

        // 尝试静默连接，已授权用户避免重复弹窗
        await ensurePhantomConnected();

        document.getElementById('tip-username').textContent = username;
        
        // 重置消息
        const messageEl = document.getElementById('tip-message');
        messageEl.className = 'tip-message';
        messageEl.textContent = '';

        // 重置附言输入框与可见性（Planet 场景不提供附言）
        const isPlanetContext = isPlanetPage() || options.tipType === 'planet-post' || options.tipType === 'planet-comment';
        const postscriptContainer = document.querySelector('.tip-postscript-container');
        const postscriptEl = document.getElementById('tip-postscript');
        if (postscriptContainer) {
            postscriptContainer.style.display = isPlanetContext ? 'none' : '';
        }
        if (postscriptEl) {
            postscriptEl.value = '';
        }

        // 重置token选择
        document.querySelectorAll('.tip-modal-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.tip-modal-tab[data-token="v2ex"]').classList.add('active');
        updateTipTokenLabel('v2ex');

        // 重新绑定确认按钮事件
        const confirmBtn = document.getElementById('tip-confirm');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', async function() {
            await handleTipConfirm({ username, address, floorNumber, replyText, replyId, options });
        });

        modal.style.display = 'flex';
    }

    // 关闭打赏弹窗
    function closeTipModal() {
        const modal = document.getElementById('tip-modal-overlay');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // 显示消息
    function showMessage(message, type = 'info') {
        const messageEl = document.getElementById('tip-message');
        messageEl.className = `tip-message ${type}`;
        messageEl.textContent = message;
    }

    function getTopicTitle() {
        const titleEl = document.querySelector('.header h1') || document.querySelector('.topic_header h1');
        if (titleEl) return titleEl.textContent.trim();
        const docTitle = document.title || '';
        return docTitle.replace(/\s*-\s*V2EX.*/i, '').trim() || '该主题';
    }

    function sanitizeReplyText(text) {
        return (text || DEFAULT_REPLY_MESSAGE).trim().replace(/\s+/g, ' ');
    }

    function getTopicId() {
        const match = window.location.pathname.match(/\/t\/(\d+)/);
        return match ? match[1] : null;
    }

    function isPlanetPage() {
        return window.location.pathname.includes('/planet/');
    }

    function buildReplyContent({ replyText, replyId, options = {} }) {
        const { tipType, planetTitle, planetLink } = options;

        if (tipType === 'planet-post') {
            const safeTitle = sanitizeReplyText(planetTitle || getTopicTitle()) || 'Planet 主题';
            const linkPart = planetLink ? `, ${planetLink}` : '';
            return `打赏了你的Planet主题:[${safeTitle}]${linkPart}`;
        }

        const topicTitle = getTopicTitle();
        const safeReply = sanitizeReplyText(replyText);
        const topicId = getTopicId();
        const planetPage = isPlanetPage();
        
        let linkPart = '';
        if (replyId) {
            if (planetPage) {
                linkPart = ` ${window.location.href}`;
            } else if (topicId) {
                linkPart = ` ${window.location.origin}/t/${topicId}#${replyId}`;
            }
        }
        
        return `打赏了你在【${topicTitle}】的回复 › ${safeReply}${linkPart}`;
    }

    function buildPostscriptContent({ username, floorNumber, amount, token, postscript }) {
        const tokenLabel = token === 'v2ex' ? '$v2ex' : 'SOL';
        const amountLabel = amount ? `${amount} ${tokenLabel}` : `? ${tokenLabel}`;
        const floorLabel = floorNumber ? `#${floorNumber}` : '';
        const parts = [
            `@${username}`,
            floorLabel,
            `[${amountLabel}]`,
            postscript || DEFAULT_REPLY_MESSAGE
        ].filter(Boolean);
        return parts.join(' ');
    }

    // 处理打赏确认
    async function handleTipConfirm({ username, address, floorNumber, replyText, replyId, options = {} }) {
        const confirmBtn = document.getElementById('tip-confirm');
        const selectedAmount = document.querySelector('input[name="amount"]:checked');
        const selectedToken = document.querySelector('.tip-modal-tab.active').dataset.token;

        if (!selectedAmount) {
            showMessage('请选择打赏金额', 'error');
            return;
        }

        const amount = parseFloat(selectedAmount.value);

        // 禁用按钮
        confirmBtn.disabled = true;
        showMessage('正在处理交易...', 'info');

        try {
            // 检查Phantom钱包
            if (!window.solana || !window.solana.isPhantom) {
                throw new Error('请先安装 Phantom 钱包');
            }

            // 连接钱包（已连接则跳过授权弹窗）
            if (!window.solana.isConnected) {
                try {
                    await window.solana.connect();
                } catch (connErr) {
                    const reason = connErr?.message || connErr?.code || 'Phantom 连接被拒绝';
                    throw new Error(`Phantom 连接失败：${reason}`);
                }
            }
            const fromAddress = window.solana.publicKey?.toString();
            if (!fromAddress) {
                throw new Error('未获取到钱包地址');
            }

            // 根据选择的token确定mint地址
            let mintAddress;
            if (selectedToken === 'v2ex') {
                mintAddress = V2EX_MINT; // $V2EX token
            } else {
                mintAddress = 'So11111111111111111111111111111111111111112'; // SOL
            }

            // 构建交易
            const transaction = await buildTransaction(fromAddress, address, amount, mintAddress);
            
            // 发送交易
            const { signature } = await window.solana.signAndSendTransaction(transaction);
            
            showMessage('交易已发送，等待确认...', 'info');

            // 延时两秒，等待区块链网络处理
            await new Promise(resolve => setTimeout(()=>{
                waitForTransaction(signature);
                resolve();
            }, 2000));

            const replyContent = buildReplyContent({ replyText, replyId, options });

            await submitTipRecord({
                signature,
                amount,
                memo: replyContent,
                token: selectedToken
            });

            showMessage('打赏成功！', 'success');

            // 检查是否有附言需要发送
            const postscriptEl = document.getElementById('tip-postscript');
            const postscript = postscriptEl ? postscriptEl.value.trim() : '';
            
            if (postscript && replyId) {
                try {
                    showMessage('正在发送附言...', 'info');
                    const postscriptContent = buildPostscriptContent({
                        username,
                        floorNumber,
                        amount,
                        token: selectedToken,
                        postscript
                    });
                    await sendPostscript({
                        username,
                        floorNumber,
                        amount,
                        token: selectedToken,
                        postscript: postscriptContent,
                        replyId,
                        options
                    });
                    showMessage('打赏成功，附言已发送！', 'success');
                } catch (psError) {
                    console.error('发送附言失败:', psError);
                    showMessage('打赏成功，但附言发送失败', 'error');
                }
            }
            
            setTimeout(() => {
                // 新开标签查看交易
                const txUrl = `${window.location.origin}/solana/tips`;
                window.open(txUrl, '_blank');
                closeTipModal();
            }, 1500);

        } catch (error) {
            console.error('打赏失败:', error);
            showMessage(error.message || '打赏失败，请重试', 'error');
        } finally {
            confirmBtn.disabled = false;
        }
    }

    // 构建Solana交易
    async function buildTransaction(from, to, amount, mint) {
        const connection = new solanaWeb3.Connection(SOLANA_RPC, {
            commitment: 'confirmed',
            fetch: gmFetch
        });
        const fromPubkey = new solanaWeb3.PublicKey(from);
        const toPubkey = new solanaWeb3.PublicKey(to);
        
        const transaction = new solanaWeb3.Transaction();
        transaction.feePayer = fromPubkey;
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;

        if (mint === 'So11111111111111111111111111111111111111112') {
            const lamports = Math.round(amount * solanaWeb3.LAMPORTS_PER_SOL);
            transaction.add(
                solanaWeb3.SystemProgram.transfer({
                    fromPubkey,
                    toPubkey,
                    lamports
                })
            );
        } else {
            const mintPubkey = new solanaWeb3.PublicKey(mint);
            const mintInfo = await splToken.getMint(connection, mintPubkey);
            const decimals = mintInfo.decimals;
            const factor = Math.pow(10, decimals);
            const amountBn = BigInt(Math.round(amount * factor));

            const fromAta = await splToken.getAssociatedTokenAddress(mintPubkey, fromPubkey);
            const toAta = await splToken.getAssociatedTokenAddress(mintPubkey, toPubkey);

            const toAtaInfo = await connection.getAccountInfo(toAta);
            if (!toAtaInfo) {
                transaction.add(
                    splToken.createAssociatedTokenAccountInstruction(
                        fromPubkey,
                        toAta,
                        toPubkey,
                        mintPubkey
                    )
                );
            }

            transaction.add(
                splToken.createTransferInstruction(
                    fromAta,
                    toAta,
                    fromPubkey,
                    amountBn
                )
            );
        }
        
        return transaction;
    }

    // 等待交易确认
    async function waitForTransaction(signature) {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 30;
            
            const checkStatus = setInterval(async () => {
                attempts++;
                
                if (attempts > maxAttempts) {
                    clearInterval(checkStatus);
                    reject(new Error('交易确认超时'));
                    return;
                }
                
                try {
                    const response = await gmFetch(`${SOLANA_RPC}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: 1,
                            method: 'getSignatureStatuses',
                            params: [[signature]]
                        })
                    });
                    
                    const data = await response.json();
                    if (data.result?.value?.[0]?.confirmationStatus === 'confirmed' || 
                        data.result?.value?.[0]?.confirmationStatus === 'finalized') {
                        clearInterval(checkStatus);
                        resolve();
                    }
                } catch (err) {
                    console.error('检查交易状态失败:', err);
                }
            }, 2000);
        });
    }

    // 提交打赏记录到 V2EX
    async function submitTipRecord({ signature, amount, memo, token }) {
        const response = await fetch(`${window.location.origin}/solana/tip`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tx: signature,
                amount,
                memo,
                token
            }),
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('提交打赏记录失败');
        }

        return response;
    }

    function createDmModal() {
        const overlay = document.createElement('div');
        overlay.id = 'dm-overlay';
        overlay.innerHTML = `
            <div class="dm-modal">
                <div class="dm-head">发私信 · <span id="dm-target"></span> · 1 $V2EX</div>
                <div class="dm-body">
                    <div class="dm-field">
                        <label>消息内容（自动随附 1 $V2EX）</label>
                        <textarea id="dm-content" maxlength="500" placeholder="写下想对 TA 说的话..."></textarea>
                    </div>
                </div>
                <div class="dm-foot">
                    <div class="dm-status" id="dm-status">Phantom 将弹出确认支付 1 $V2EX</div>
                    <div class="dm-actions">
                        <button class="dm-btn-ghost" id="dm-cancel">取消</button>
                        <button class="dm-btn-primary" id="dm-send">发送私信</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeDmModal();
        });
        overlay.querySelector('#dm-cancel').addEventListener('click', closeDmModal);
        return overlay;
    }

    function openDmModal(username, address) {
        if (!dmModalEl) dmModalEl = createDmModal();
        dmModalEl.style.display = 'flex';
        const targetEl = dmModalEl.querySelector('#dm-target');
        targetEl.textContent = `@${username}`;
        const statusEl = dmModalEl.querySelector('#dm-status');
        statusEl.textContent = 'Phantom 将弹出确认支付 1 $V2EX';
        const sendBtn = dmModalEl.querySelector('#dm-send');
        const contentEl = dmModalEl.querySelector('#dm-content');
        sendBtn.disabled = false;
        sendBtn.textContent = '发送私信';
        contentEl.value = '';
        sendBtn.onclick = () => handleDmSend({ username, address, contentEl, sendBtn, statusEl });
    }

    function closeDmModal() {
        if (dmModalEl) dmModalEl.style.display = 'none';
    }

    async function handleDmSend({ username, address, contentEl, sendBtn, statusEl }) {
        const text = (contentEl.value || '').trim();
        if (!text || text.length < 3) {
            statusEl.textContent = '请至少输入 3 个字符';
            return;
        }

        try {
            sendBtn.disabled = true;
            statusEl.textContent = '准备钱包...';
            await ensureSolanaLibraries();
            if (!window.solana || !window.solana.isPhantom) {
                throw new Error('请安装并解锁 Phantom 钱包');
            }
            await ensurePhantomConnected();
            if (!window.solana.isConnected) {
                await window.solana.connect();
            }
            const from = window.solana.publicKey?.toString();
            if (!from) throw new Error('未获取到钱包地址');

            const tx = await buildTransaction(from, address, MESSAGE_COST, V2EX_MINT);
            statusEl.textContent = '等待钱包签名...';
            const { signature } = await window.solana.signAndSendTransaction(tx);
            statusEl.textContent = '链上确认中...';
            await waitForTransaction(signature);

            const memo = `${text}`.slice(0, 180);
            await submitMessageRecord({ signature, amount: MESSAGE_COST, memo, to: username });
            statusEl.textContent = '私信已发送并记录';
            setTimeout(() => {
                closeDmModal();
                window.open(`${window.location.origin}/solana/tips`, '_blank');
            }, 1200);
        } catch (err) {
            console.error('私信发送失败', err);
            statusEl.textContent = err.message || '私信发送失败';
            sendBtn.disabled = false;
        }
    }

    async function submitMessageRecord({ signature, amount, memo, to }) {
        const payload = { tx: signature, amount, memo, token: 'v2ex', to };
        const endpoints = ['/solana/message', '/solana/tip'];
        for (const ep of endpoints) {
            try {
                const res = await fetch(`${window.location.origin}${ep}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });
                if (res.ok) return ep;
            } catch (e) {
                console.warn(`提交到 ${ep} 失败`, e);
            }
        }
        throw new Error('链上转账成功，但私信记录提交失败');
    }

    function getProfileUsername() {
        const match = window.location.pathname.match(/\/member\/([^\/\?#]+)/);
        return match ? decodeURIComponent(match[1]) : null;
    }

    function addProfileDmButton() {
        if (!window.location.pathname.startsWith('/member/')) return;
        if (document.getElementById('dm-profile-btn')) return;
        const actions = document.querySelector('#Main .box .cell .fr');
        if (!actions) return;
        const username = getProfileUsername();
        if (!username) return;
        const fallbackAddress = isSolAddress(window.address) ? window.address.trim() : null;

        const btn = document.createElement('button');
        btn.id = 'dm-profile-btn';
        btn.className = 'super normal button';
        btn.style.marginRight = '5px';
        btn.textContent = '私信';
        btn.title = `私信 @${username}`;

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            btn.disabled = true;
            try {
                const addr = await getUserAddress(username, { fallbackAddress });
                if (!addr) throw new Error('对方未绑定 Solana 地址');
                await ensurePhantomConnected();
                openDmModal(username, addr);
            } catch (err) {
                alert(err.message || '无法发送私信');
            } finally {
                btn.disabled = false;
            }
        });

        const firstChild = actions.firstElementChild;
        actions.insertBefore(btn, firstChild || null);
    }

    function addTopicAuthorDmButton() {
        if (document.getElementById('dm-topic-op')) return;
        const tipBtn = document.getElementById('tip-button');
        if (!tipBtn) return;

        const { username, address } = getTopicAuthorInfo();
        if (!username) return;

        const dmBtn = document.createElement('a');
        dmBtn.id = 'dm-topic-op';
        dmBtn.href = '#';
        dmBtn.className = tipBtn.className || 'super normal button';
        dmBtn.style.marginLeft = '10px';
        dmBtn.textContent = '私信';
        dmBtn.title = `私信 @${username}`;

        dmBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            dmBtn.classList.add('loading');
            dmBtn.textContent = '...';
            try {
                const addr = await getUserAddress(username, { fallbackAddress: address });
                if (!addr) throw new Error('对方未绑定 Solana 地址');
                await ensurePhantomConnected();
                openDmModal(username, addr);
            } catch (err) {
                alert(err.message || '无法发送私信');
            } finally {
                dmBtn.classList.remove('loading');
                dmBtn.textContent = '私信';
            }
        });

        tipBtn.parentElement.insertBefore(dmBtn, tipBtn.nextSibling);
    }

    function getReplyBox() {
        return document.getElementById('reply_content') || document.querySelector('textarea[name="content"]');
    }

    function getReplySubmitButton() {
        return document.querySelector('input[type="submit"].super.normal.button') ||
            document.querySelector('input[type="submit"][value="回复"]') ||
            document.querySelector('button[type="submit"]');
    }

    function appendPostscriptViaApi(replyId, content) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${window.location.origin}/append/reply/${replyId}`,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: `content=${encodeURIComponent(content)}`,
                onload: function(response) {
                    if (response.status === 200) {
                        resolve(response);
                    } else {
                        reject(new Error('发送附言失败'));
                    }
                },
                onerror: function() {
                    reject(new Error('网络请求失败'));
                }
            });
        });
    }

    // 发送回复附言（优先使用回复框提交，找不到输入框时回退到 append 接口）
    async function sendPostscript({ username, floorNumber, amount, token, postscript, replyId, options = {} }) {
        const isPlanet = isPlanetPage() || options.tipType === 'planet-post';
        const replyBox = isPlanet ? null : getReplyBox();

        if (replyBox) {
            replyBox.value = postscript;
            const submitBtn = getReplySubmitButton();
            if (!submitBtn) {
                throw new Error('未找到回复提交按钮');
            }
            submitBtn.click();
            return 'submitted-via-form';
        }

        if (replyId) {
            await appendPostscriptViaApi(replyId, postscript);
            return 'submitted-via-append';
        }

        throw new Error('未找到可用的附言提交方式');
    }

    function quickThankFindPatronage() {
        const patronage = document.querySelector('#topic-tip-box .patronage');
        if (patronage) return patronage;
        return document.querySelector('.patronage');
    }

    function quickThankGetUsernamesFromPatronage(patronage) {
        if (!patronage) return [];
        const anchors = patronage.querySelectorAll('a[href^="/member/"]');
        const names = [];
        anchors.forEach((a) => {
            const href = a.getAttribute('href');
            const match = href.match(/^\/member\/(.+)$/);
            if (match) names.push(match[1]);
        });
        return Array.from(new Set(names));
    }

    function quickThankCreateButton(text) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'super normal button quick-thank-btn';
        btn.style.marginLeft = '8px';
        btn.textContent = text;
        return btn;
    }

    function quickThankFillReply(names) {
        const ta = getReplyBox() || document.getElementById('reply_content') || document.querySelector('textarea[name="content"]') || document.querySelector('textarea');
        if (!ta) {
            alert('未找到回复框，请滚动到页面或在有回复权限的情况下使用此脚本。');
            return;
        }
        const content = QUICK_THANK_TEMPLATE(names.map((n) => `@${n}`));
        ta.focus();
        ta.value = content;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function quickThankSubmitReply() {
        const submit = getReplySubmitButton();
        if (submit) {
            submit.click();
            return true;
        }
        const fallbackForm = document.querySelector('form[action^="/t/"]');
        if (fallbackForm) {
            fallbackForm.submit();
            return true;
        }
        return false;
    }

    function quickThankLoadThanked() {
        try {
            const raw = localStorage.getItem(QUICK_THANK_STORAGE_KEY) || '[]';
            return JSON.parse(raw);
        } catch (e) {
            return [];
        }
    }

    function quickThankSaveThanked(arr) {
        try {
            localStorage.setItem(QUICK_THANK_STORAGE_KEY, JSON.stringify(Array.from(new Set(arr))));
        } catch (e) {
            // ignore
        }
    }

    function quickThankMarkAsThanked(name) {
        const cur = quickThankLoadThanked();
        cur.push(name);
        quickThankSaveThanked(cur);
    }

    function quickThankHasBeenThanked(name) {
        const cur = quickThankLoadThanked();
        return cur.indexOf(name) !== -1;
    }

    function quickThankClearThankedRecords() {
        localStorage.removeItem(QUICK_THANK_STORAGE_KEY);
    }

    function quickThankOpenDialog(names, callback) {
        const toShow = (names || []).filter((n) => !quickThankHasBeenThanked(n));
        if (toShow.length === 0) {
            alert('没有未感谢的用户');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'quick-thank-modal';

        const title = document.createElement('div');
        title.textContent = '选择要单独感谢的用户：';
        modal.appendChild(title);

        const list = document.createElement('div');
        list.style.maxHeight = '240px';
        list.style.overflow = 'auto';
        list.style.marginTop = '8px';
        toShow.forEach((n) => {
            const row = document.createElement('div');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = n;
            cb.id = `qt_cb_${n}`;
            const lbl = document.createElement('label');
            lbl.htmlFor = cb.id;
            lbl.textContent = n;
            lbl.style.marginLeft = '6px';
            row.appendChild(cb);
            row.appendChild(lbl);
            list.appendChild(row);
        });
        modal.appendChild(list);

        const actions = document.createElement('div');
        actions.className = 'actions';
        const ok = document.createElement('button');
        ok.textContent = '确认';
        ok.className = 'super normal button';
        const cancel = document.createElement('button');
        cancel.textContent = '取消';
        cancel.className = 'super normal button';
        ok.style.marginRight = '8px';
        actions.appendChild(ok);
        actions.appendChild(cancel);
        modal.appendChild(actions);

        document.body.appendChild(modal);

        cancel.addEventListener('click', () => modal.remove());
        ok.addEventListener('click', () => {
            const checked = Array.from(modal.querySelectorAll('input[type=checkbox]:checked')).map((i) => i.value);
            modal.remove();
            callback(checked);
        });
    }

    function quickThankInsertControls() {
        const patronage = quickThankFindPatronage();
        if (!patronage) return;
        if (document.querySelector('.quick-thank-controls')) return;

        const container = document.createElement('div');
        container.className = 'quick-thank-controls';
        container.style.display = 'block';
        container.style.marginTop = '8px';
        container.style.marginLeft = '0';

        const allBtn = quickThankCreateButton('感谢所有打赏者');
        const autoToggle = quickThankCreateButton('开启自动提交');
        autoToggle.dataset.enabled = QUICK_THANK_AUTO_SUBMIT ? '1' : '0';
        autoToggle.textContent = QUICK_THANK_AUTO_SUBMIT ? '自动提交：已开' : '自动提交：已关';

        allBtn.addEventListener('click', () => {
            const names = quickThankGetUsernamesFromPatronage(patronage);
            if (names.length === 0) {
                alert('未检测到任何打赏者用户名');
                return;
            }
            quickThankFillReply(names);
            if (autoToggle.dataset.enabled === '1') {
                const ok = quickThankSubmitReply();
                if (!ok) alert('自动提交失败，请手动点击提交');
            }
        });

        autoToggle.addEventListener('click', () => {
            const enabled = autoToggle.dataset.enabled === '1';
            autoToggle.dataset.enabled = enabled ? '0' : '1';
            autoToggle.textContent = autoToggle.dataset.enabled === '1' ? '自动提交：已开' : '自动提交：已关';
        });

        container.appendChild(allBtn);
        container.appendChild(autoToggle);

        const names = quickThankGetUsernamesFromPatronage(patronage);
        const unthanked = names.filter((n) => !quickThankHasBeenThanked(n));
        const singleThanksBtn = quickThankCreateButton('单独感谢');
        singleThanksBtn.style.marginLeft = '12px';
        singleThanksBtn.addEventListener('click', () => {
            quickThankOpenDialog(unthanked, (selected) => {
                if (!selected || selected.length === 0) return;
                quickThankFillReply(selected);
                selected.forEach((s) => quickThankMarkAsThanked(s));
                if (autoToggle.dataset.enabled === '1') quickThankSubmitReply();
            });
        });
        container.appendChild(singleThanksBtn);

        const tipBox = patronage.closest('#topic-tip-box') || patronage.closest('.box');
        if (tipBox) {
            tipBox.appendChild(container);
        } else if (patronage.parentNode) {
            patronage.parentNode.insertBefore(container, patronage.nextSibling);
        }
    }

    function quickThankShouldRun() {
        if (window.location.protocol === 'file:') return true;
        const hostname = window.location.hostname || '';
        if (!hostname.endsWith('v2ex.com')) return false;
        return /\/t\//.test(window.location.pathname);
    }

    function quickThankCheckAndInsert() {
        if (!quickThankShouldRun()) return;
        quickThankInsertControls();
    }

    function initQuickThank() {
        if (!quickThankShouldRun()) return;
        quickThankCheckAndInsert();
        if (quickThankInitialized) return;
        quickThankInitialized = true;

        const mo = new MutationObserver(() => quickThankCheckAndInsert());
        mo.observe(document.body, { childList: true, subtree: true });

        if (typeof GM_registerMenuCommand === 'function') {
            GM_registerMenuCommand('V2EX 快速感谢：说明', () => {
                alert('在话题页面会在打赏者列表处显示“感谢所有打赏者”按钮。点击会将 @用户名 列表填入回复框。\n自动提交有风险，默认关闭。');
            });
            GM_registerMenuCommand('清除已记录的已感谢用户', () => {
                if (confirm('确定清除已感谢记录？')) {
                    quickThankClearThankedRecords();
                    alert('已清除');
                }
            });
        }
    }

    function createInlineDmButton({ username, targetId, fallbackAddress }) {
        if (targetId && document.getElementById(targetId)) return null;
        const btn = document.createElement('a');
        if (targetId) btn.id = targetId;
        btn.href = '#';
        btn.className = 'thank dm-btn';
        btn.textContent = '私';
        btn.title = `私信 @${username}`;
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            btn.classList.add('loading');
            try {
                const addr = await getUserAddress(username, { fallbackAddress });
                if (!addr) throw new Error('对方未绑定 Solana 地址');
                await ensurePhantomConnected();
                openDmModal(username, addr);
            } catch (err) {
                alert(err.message || '无法发送私信');
            } finally {
                btn.classList.remove('loading');
            }
        });
        return btn;
    }

    // 为经典主题页的回复添加打赏 + 私信按钮
    function addTopicTipButtons() {
        const replies = document.querySelectorAll('.cell[id^="r_"]');
        const topicAuthor = getTopicAuthorInfo();
        
        replies.forEach(reply => {
            const userLink = reply.querySelector('.dark');
            if (!userLink) return;
            const username = userLink.textContent.trim();
            const floorEl = reply.querySelector('.no');
            const floorNumber = floorEl ? floorEl.textContent.trim().replace('#', '') : null;
            
            const replyActions = reply.querySelector('.fr');
            if (!replyActions) return;

            const thankArea = replyActions.querySelector('.thank_area');
            const actionContainer = thankArea || replyActions;
            const timeAnchor = reply.querySelector('.ago') || reply.querySelector('.fade');
            const tipButtonId = `tip-${reply.id}`;
            const dmButtonId = `dm-${reply.id}`;

            let tipButton = reply.querySelector(`#${tipButtonId}`);

            if (!tipButton) {
                const defaultLabel = '赏';
                tipButton = document.createElement('a');
                tipButton.id = tipButtonId;
                tipButton.href = '#';
                tipButton.className = 'thank tip-button';
                tipButton.title = `打赏 @${username}`;
                tipButton.setAttribute('data-tip', '使用 $V2EX 打赏该回复');
                tipButton.innerHTML = defaultLabel;

                tipButton.addEventListener('click', async (e) => {
                    e.preventDefault();
                    tipButton.classList.add('loading');
                    tipButton.innerHTML = '...';

                    try {
                        const replyContentEl = reply.querySelector('.reply_content');
                        const replyText = replyContentEl ? replyContentEl.innerText || replyContentEl.textContent : '';
                        const replyId = reply.id; // 获取回复ID，格式如 'r_17147431'
                        const address = await getUserAddress(username);

                        if (!address) {
                            alert(`用户 ${username} 还未绑定 Solana 地址，无法接收打赏。\n\n请提醒 TA 在 V2EX 设置中绑定 Solana 地址。`);
                            return;
                        }

                        await showTipModal(username, address, floorNumber, replyText, replyId);
                    } catch (error) {
                        console.error('获取用户信息失败:', error);
                        alert('获取用户信息失败，请稍后重试');
                    } finally {
                        tipButton.classList.remove('loading');
                        tipButton.innerHTML = defaultLabel;
                    }
                });

            }

            const insertAfterIfNeeded = (target, node) => {
                if (!target || !node) return;
                if (target.nextElementSibling === node) return;
                target.insertAdjacentElement('afterend', node);
            };

            if (timeAnchor) {
                insertAfterIfNeeded(timeAnchor, tipButton);
            } else if (tipButton.parentElement !== actionContainer) {
                actionContainer.appendChild(tipButton);
            }

            let dmButton = reply.querySelector(`#${dmButtonId}`);
            if (!dmButton) {
                const fallbackAddress = topicAuthor.username && username === topicAuthor.username ? topicAuthor.address : null;
                dmButton = createInlineDmButton({ username, targetId: dmButtonId, fallbackAddress });
                if (!dmButton) return;
            }

            if (tipButton) {
                insertAfterIfNeeded(tipButton, dmButton);
            } else if (timeAnchor) {
                insertAfterIfNeeded(timeAnchor, dmButton);
            } else if (dmButton.parentElement !== actionContainer) {
                actionContainer.appendChild(dmButton);
            }
        });
    }

    // 为 Planet 页的评论添加打赏 + 私信按钮
    function addPlanetTipButtons() {
        const comments = document.querySelectorAll('.planet-comment');

        comments.forEach(comment => {
            const actions = comment.querySelector('.planet-comment-actions');
            const commentId = comment.id || '';
            const tipId = commentId ? `tip-${commentId}` : '';
            const dmId = commentId ? `dm-${commentId}` : '';
            if (!actions) return;

            const userLink = comment.querySelector('.planet-comment-header a[href^="/member/"]');
            if (!userLink) return;
            const username = userLink.textContent.trim();
            const floorNumber = null; // Planet 评论不需要显示楼号

            let tipButton = tipId ? actions.querySelector(`#${tipId}`) : null;
            const defaultLabel = '赏';

            if (!tipButton) {
                tipButton = document.createElement('a');
                if (tipId) tipButton.id = tipId;
                tipButton.href = '#';
                tipButton.className = 'planet-comment-action tip-button planet-tip-button';
                tipButton.title = `打赏 @${username}`;
                tipButton.setAttribute('data-tip', '使用 $V2EX 打赏该评论');
                tipButton.innerHTML = defaultLabel;

                tipButton.addEventListener('click', async (e) => {
                    e.preventDefault();
                    tipButton.classList.add('loading');
                    tipButton.innerHTML = '...';

                    try {
                        const commentContentEl = comment.querySelector('.planet-comment-content') || comment.querySelector('.markdown_body');
                        const replyText = commentContentEl ? commentContentEl.innerText || commentContentEl.textContent : '';
                        const replyId = comment.id; // 获取评论ID
                        const address = await getUserAddress(username);

                        if (!address) {
                            alert(`用户 ${username} 还未绑定 Solana 地址，无法接收打赏。\n\n请提醒 TA 在 V2EX 设置中绑定 Solana 地址。`);
                            return;
                        }

                        await showTipModal(username, address, floorNumber, replyText, replyId, {
                            tipType: 'planet-comment'
                        });
                    } catch (error) {
                        console.error('获取用户信息失败:', error);
                        alert('获取用户信息失败，请稍后重试');
                    } finally {
                        tipButton.classList.remove('loading');
                        tipButton.innerHTML = defaultLabel;
                    }
                });

                const replyAction = actions.querySelector('.planet-comment-action');
                if (replyAction) {
                    actions.insertBefore(tipButton, replyAction);
                } else {
                    actions.insertBefore(tipButton, actions.firstChild);
                }
            }

            if (!actions.querySelector(`#${dmId}`)) {
                const dmButton = createInlineDmButton({ username, targetId: dmId });
                if (dmButton) {
                    if (tipButton && tipButton.parentElement === actions) {
                        tipButton.insertAdjacentElement('afterend', dmButton);
                    } else {
                        actions.insertBefore(dmButton, actions.firstChild);
                    }
                }
            }
        });
    }

    function addTipButtons() {
        addTopicTipButtons();
        addPlanetTipButtons();
        addPlanetPostTipButtons();
    }

    function addDmButtons() {
        addTopicAuthorDmButton();
        addProfileDmButton();
    }

    // 为 Planet 主列表的主题卡片添加打赏 + 私信按钮
    function addPlanetPostTipButtons() {
        const posts = document.querySelectorAll('.planet-post');

        posts.forEach(post => {
            const footer = post.querySelector('.planet-post-footer');
            if (!footer || footer.querySelector('.planet-post-tip')) return;

            const statsPart = footer.querySelector('.planet-post-footer-part.stats');
            if (!statsPart) return;

            const siteAddress = post.getAttribute('data-site-address');
            const postUuid = post.getAttribute('data-post-uuid');
            const titleEl = post.querySelector('.planet-post-title');
            const planetTitle = titleEl ? titleEl.textContent.trim() : '';
            const planetLink = siteAddress && postUuid ? `${window.location.origin}/planet/${siteAddress}/${postUuid}` : window.location.href;

            const tipWrapper = document.createElement('div');
            tipWrapper.className = 'planet-post-footer-part planet-post-tip';

            const tipButton = document.createElement('a');
            tipButton.href = '#';
            tipButton.className = 'tip-button planet-tip-button';
            tipButton.textContent = '赏';
            tipButton.title = '打赏该 Planet 主题';
            tipButton.setAttribute('data-tip', '使用 $V2EX 打赏该主题');

            tipButton.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                tipButton.classList.add('loading');
                tipButton.textContent = '...';

                try {
                    if (!siteAddress) {
                        throw new Error('未获取到 Planet 地址');
                    }

                    const username = await getPlanetOwnerUsername(siteAddress);
                    if (!username) {
                        alert('未找到作者的 V2EX 用户名，暂时无法打赏');
                        return;
                    }

                    const address = await getUserAddress(username);
                    if (!address) {
                        alert(`用户 ${username} 还未绑定 Solana 地址，无法接收打赏。\n\n请提醒 TA 在 V2EX 设置中绑定 Solana 地址。`);
                        return;
                    }

                    await showTipModal(username, address, null, planetTitle, postUuid, {
                        tipType: 'planet-post',
                        planetTitle,
                        planetLink
                    });
                } catch (error) {
                    console.error('为 Planet 主题添加打赏失败:', error);
                    alert(error.message || '获取作者信息失败，请稍后重试');
                } finally {
                    tipButton.classList.remove('loading');
                    tipButton.textContent = '赏';
                }
            });

            const dmId = postUuid ? `dm-${postUuid}` : '';
            const dmButton = document.createElement('a');
            if (dmId) dmButton.id = dmId;
            dmButton.href = '#';
            dmButton.className = 'tip-button planet-tip-button dm-btn';
            dmButton.textContent = '私';
            dmButton.title = '私信作者';

            dmButton.addEventListener('click', async (e) => {
                e.preventDefault();
                dmButton.classList.add('loading');
                try {
                    if (!siteAddress) throw new Error('未获取到 Planet 地址');
                    const username = await getPlanetOwnerUsername(siteAddress);
                    if (!username) throw new Error('未找到作者用户名');
                    const addr = await getUserAddress(username);
                    if (!addr) throw new Error('对方未绑定 Solana 地址');
                    await ensurePhantomConnected();
                    openDmModal(username, addr);
                } catch (err) {
                    alert(err.message || '无法发送私信');
                } finally {
                    dmButton.classList.remove('loading');
                }
            });

            tipWrapper.appendChild(tipButton);
            tipWrapper.appendChild(dmButton);
            statsPart.insertAdjacentElement('afterend', tipWrapper);
        });
    }

    // 加载Solana Web3.js（简化版本，实际使用Phantom钱包API）
    function loadSolanaLib() {
        return new Promise((resolve) => {
            // 检查Phantom是否可用
            if (window.solana && window.solana.isPhantom) {
                resolve();
            } else {
                // 等待Phantom加载
                let attempts = 0;
                const checkPhantom = setInterval(() => {
                    attempts++;
                    if (window.solana && window.solana.isPhantom) {
                        clearInterval(checkPhantom);
                        resolve();
                    } else if (attempts > 20) {
                        clearInterval(checkPhantom);
                        console.warn('Phantom钱包未检测到');
                        resolve();
                    }
                }, 500);
            }
        });
    }

    // 尝试静默连接 Phantom，若已授权则避免重复弹窗
    async function ensurePhantomConnected() {
        if (!window.solana || !window.solana.isPhantom) return false;
        if (window.solana.isConnected) return true;
        try {
            await window.solana.connect({ onlyIfTrusted: true });
            return window.solana.isConnected;
        } catch (e) {
            // 未授权时会拒绝，保持静默
            return false;
        }
    }

    // 初始化
    async function init() {
        await ensureSolanaLibraries();
        await loadSolanaLib();
        addTipButtons();
        addDmButtons();
        initQuickThank();
        
        // 监听DOM变化（如果页面动态加载内容）
        const observer = new MutationObserver(() => {
            addTipButtons();
            addDmButtons();
            quickThankCheckAndInsert();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
