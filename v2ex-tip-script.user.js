// ==UserScript==
// @name         V2EX 回复打赏功能
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  为V2EX主题回复添加打赏功能，支持使用$V2EX和Solana打赏
// @author       JoeJoeJoe
// @match        https://www.v2ex.com/t/*
// @match        https://*.v2ex.com/t/*
// @match        https://www.v2ex.com/planet/*
// @match        https://*.v2ex.com/planet/*
// @icon         https://www.v2ex.com/static/icon-192.png
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
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
            color: var(--tip-button-color);
            margin-left: 0px;
            font-size: 12px;
            font-weight: 600;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 12px;
            height: 12px;
            padding: 0;
            border: 1px solid transparent;
            border-radius: 2px;
            background: transparent;
            line-height: 1;
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
            color: var(--tip-button-color);
            background: var(--tip-button-hover-bg);
            border-color: var(--tip-button-hover-border);
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
    `);

    const SOLANA_RPC = 'https://jillian-fnk7b6-fast-mainnet.helius-rpc.com';
    const WEB3_CDN = 'https://unpkg.com/@solana/web3.js@1.95.0/lib/index.iife.js';
    const SPL_TOKEN_CDN = 'https://unpkg.com/@solana/spl-token@0.4.5/lib/index.iife.js';

    // 用户地址缓存
    const addressCache = new Map();
    const DEFAULT_REPLY_MESSAGE = '感谢您的精彩回答';

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

    // 获取用户的Solana地址
    async function getUserAddress(username) {
        // 检查缓存
        if (addressCache.has(username)) {
            return addressCache.get(username);
        }
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${window.location.origin}/member/${username}`,
                onload: function(response) {
                    if (response.status === 200) {
                        // 解析HTML查找address变量
                        const match = response.responseText.match(/const address = "([^"]+)";/);
                        if (match && match[1]) {
                            const address = match[1];
                            addressCache.set(username, address);
                            resolve(address);
                        } else {
                            addressCache.set(username, null);
                            resolve(null);
                        }
                    } else {
                        reject(new Error('获取用户信息失败'));
                    }
                },
                onerror: function() {
                    reject(new Error('网络请求失败'));
                }
            });
        });
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
    async function showTipModal(username, address, floorNumber, replyText, replyId) {
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

        // 重置token选择
        document.querySelectorAll('.tip-modal-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.tip-modal-tab[data-token="v2ex"]').classList.add('active');
        updateTipTokenLabel('v2ex');

        // 重新绑定确认按钮事件
        const confirmBtn = document.getElementById('tip-confirm');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', async function() {
            await handleTipConfirm({ username, address, floorNumber, replyText, replyId });
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

    function buildReplyContent(username, replyText, replyId) {
        const topicTitle = getTopicTitle();
        const safeReply = sanitizeReplyText(replyText);
        const topicId = getTopicId();
        
        let linkPart = '';
        if (topicId && replyId) {
            linkPart = ` /t/${topicId}#${replyId}`;
            // linkPart = ` ${window.location.origin}/t/${topicId}#${replyId}`;
        }
        
        return `打赏了你在【${topicTitle}】的回复 › ${safeReply}${linkPart}`;
    }

    // 处理打赏确认
    async function handleTipConfirm({ username, address, floorNumber, replyText, replyId }) {
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
                mintAddress = '9raUVuzeWUk53co63M4WXLWPWE4Xc6Lpn7RS9dnkpump'; // $V2EX token
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

            const replyContent = buildReplyContent(username, replyText, replyId);

            await submitTipRecord({
                signature,
                amount,
                memo: replyContent,
                token: selectedToken
            });

            showMessage('打赏成功！', 'success');
            
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

    // 为经典主题页的回复添加打赏按钮
    function addTopicTipButtons() {
        const replies = document.querySelectorAll('.cell[id^="r_"]');
        
        replies.forEach(reply => {
            if (reply.querySelector('.tip-button')) {
                return;
            }

            const userLink = reply.querySelector('.dark');
            if (!userLink) return;
            const username = userLink.textContent.trim();
            const floorEl = reply.querySelector('.no');
            const floorNumber = floorEl ? floorEl.textContent.trim().replace('#', '') : null;
            
            const replyActions = reply.querySelector('.fr');
            if (!replyActions) return;

            const thankArea = replyActions.querySelector('.thank_area');
            const actionContainer = thankArea || replyActions;
            const tipButton = document.createElement('a');
            const defaultLabel = '赏';

            tipButton.href = '#';
            tipButton.className = 'thank tip-button';
            tipButton.title = `打赏 @${username}`;
            tipButton.setAttribute('data-tip', '使用 $V2EX 或 Solana 打赏该回复');
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

            if (actionContainer === replyActions) {
                const firstElement = replyActions.firstElementChild;
                replyActions.insertBefore(tipButton, firstElement || null);
            } else {
                actionContainer.appendChild(tipButton);
            }
        });
    }

    // 为 Planet 页的评论添加打赏按钮
    function addPlanetTipButtons() {
        const comments = document.querySelectorAll('.planet-comment');

        comments.forEach(comment => {
            const actions = comment.querySelector('.planet-comment-actions');
            if (!actions || actions.querySelector('.tip-button')) return;

            const userLink = comment.querySelector('.planet-comment-header a[href^="/member/"]');
            if (!userLink) return;
            const username = userLink.textContent.trim();
            const floorNumber = null; // Planet 评论不需要显示楼号

            const tipButton = document.createElement('a');
            const defaultLabel = '赏';

            tipButton.href = '#';
            tipButton.className = 'planet-comment-action tip-button planet-tip-button';
            tipButton.title = `打赏 @${username}`;
            tipButton.setAttribute('data-tip', '使用 $V2EX 或 Solana 打赏该评论');
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

                    await showTipModal(username, address, floorNumber, replyText, replyId);
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
        });
    }

    function addTipButtons() {
        addTopicTipButtons();
        addPlanetTipButtons();
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
        
        // 监听DOM变化（如果页面动态加载内容）
        const observer = new MutationObserver(() => {
            addTipButtons();
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
