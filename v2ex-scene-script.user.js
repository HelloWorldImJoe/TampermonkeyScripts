// ==UserScript==
// @name         V2EX 打赏 + 私信
// @namespace    http://tampermonkey.net/
// @version      1.3.1
// @description  为 V2EX 添加回复打赏（$V2EX / SOL）与 1 $V2EX 私信能力
// @author       JoeJoeJoe
// @match        https://www.v2ex.com/*
// @match        https://*.v2ex.com/*
// @icon         https://www.v2ex.com/static/icon-192.png
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @connect      www.v2ex.com
// @connect      jillian-fnk7b6-fast-mainnet.helius-rpc.com
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function() {
    'use strict';

    const PAGE_WINDOW = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;

    // Solana RPC 端点
    const SOLANA_RPC = 'https://jillian-fnk7b6-fast-mainnet.helius-rpc.com';
    // Solana Web3.js CDN 链接
    const WEB3_CDN = 'https://unpkg.com/@solana/web3.js@1.95.0/lib/index.iife.js';
    // Solana SPL Token CDN 链接
    const SPL_TOKEN_CDN = 'https://unpkg.com/@solana/spl-token@0.4.5/lib/index.iife.js';
    // Solana Wallet Adapter Base CDN 链接
    const WALLET_ADAPTER_BASE_CDN = 'https://cdn.jsdelivr.net/npm/@solana/wallet-adapter-base@0.9.24/+esm';
    // BS58 模块 CDN 链接
    const BS58_MODULE_CDN = 'https://cdn.jsdelivr.net/npm/bs58@5.0.0/+esm';
    // Solana 链 ID
    const SOLANA_CHAIN_ID = 'solana:mainnet-beta';
    // 标准连接功能
    const STANDARD_CONNECT_FEATURE = 'standard:connect';
    // 标准事件功能
    const STANDARD_EVENTS_FEATURE = 'standard:events';
    // Solana 签名并发送交易功能
    const SOLANA_SIGN_AND_SEND_FEATURE = 'solana:signAndSendTransaction';
    // Solana 签名交易功能
    const SOLANA_SIGN_TRANSACTION_FEATURE = 'solana:signTransaction';
    // V2EX 代币铸币地址
    const V2EX_MINT = '9raUVuzeWUk53co63M4WXLWPWE4Xc6Lpn7RS9dnkpump';
    // 消息成本
    const MESSAGE_COST = 1;

    // 用户地址缓存
    const addressCache = new Map();
    // Planet 所有者缓存
    const planetOwnerCache = new Map();
    // 默认回复消息
    const DEFAULT_REPLY_MESSAGE = '感谢您的精彩回答';
    // 快速感谢自动提交标志
    const QUICK_THANK_AUTO_SUBMIT = false;
    // 快速感谢模板函数
    const QUICK_THANK_TEMPLATE = (names) => `感谢 ${names.join(' ')} 的打赏！🎉\n`;
    // 快速感谢存储键
    const QUICK_THANK_STORAGE_KEY = 'quick-thank-thanked-users-v1';
    // DM 模态元素
    let dmModalEl = null;
    // 快速感谢是否已初始化
    let quickThankInitialized = false;

    // 聊天记录存储键
    const TIP_CHAT_STORAGE_KEY = 'v2ex-tip-chat-records-v1';
    // 聊天元数据存储键
    const TIP_CHAT_META_KEY = 'v2ex-tip-chat-meta-v1';
    // 当前登录用户缓存键
    const TIP_CHAT_SELF_KEY = 'v2ex-tip-chat-self';
    // 聊天记录最大限制
    const TIP_CHAT_RECORD_LIMIT = 600;
    // 聊天消息长度限制（需少于 150 个字符）
    const TIP_CHAT_MAX_MESSAGE_LENGTH = 149;
    // 脚本远程地址
    const SCRIPT_UPDATE_URL = 'https://raw.githubusercontent.com/HelloWorldImJoe/TampermonkeyScripts/master/v2ex-scene-script.user.js';
    // 脚本检查缓存键
    const SCRIPT_UPDATE_CHECK_KEY = 'v2ex-tip-chat-update-check';
    // 更新检查间隔（6 小时）
    const SCRIPT_UPDATE_INTERVAL = 6 * 60 * 60 * 1000;
    // 每页记录数量预估（用于计算最大分页请求）
    const TIP_CHAT_PAGE_ESTIMATE = 20;
    // 引导阶段最多抓取的页面数量
    const TIP_CHAT_MAX_BOOTSTRAP_PAGES = Math.ceil(TIP_CHAT_RECORD_LIMIT / TIP_CHAT_PAGE_ESTIMATE) + 2;
    // 增量页面数量
    const TIP_CHAT_INCREMENTAL_PAGES = 2;
    // 刷新间隔（毫秒）
    const TIP_CHAT_REFRESH_INTERVAL = 120000;
    // 长按触发时间（毫秒）
    const TIP_CHAT_LONG_PRESS_DELAY = 520;
    // 长按移动容差（像素）
    const TIP_CHAT_LONG_PRESS_MOVE_THRESHOLD = 6;
    // 初始加载数量
    const TIP_CHAT_INITIAL_LOAD = 50;
    // 加载步长
    const TIP_CHAT_LOAD_STEP = 20;
    // 手动刷新修复页数上限
    const TIP_CHAT_REPAIR_PAGES = 6;
    // 聊天是否已初始化标志
    let tipChatInitialized = false;
    // 升级检测是否已安排
    let scriptUpdateCheckScheduled = false;
    // 聊天状态对象
    const tipChatState = {
        // 聊天记录数组
        records: [],
        // 对话映射
        conversationMap: new Map(),
        // 摘要数组
        summaries: [],
        // 活跃对等方
        activePeer: null,
        // 可见计数映射
        visibleCountMap: new Map(),
        // 元素对象
        elements: {},
        // 当前登录用户
        currentUser: null,
        // 刷新状态
        refreshing: null,
        // 刷新定时器
        refreshTimer: null,
        // 用户是否向上滚动
        userScrolledUp: false,
        // 面板是否固定
        pinned: false,
        // 是否正在发送新消息
        composerSending: false,
        // 已提示的升级版本
        upgradePromptedVersion: null,
        // 消息操作菜单
        messageActionsMenu: null,
        // 引用的消息
        quotedMessage: null
    };
    // 成员头像缓存
    const memberAvatarCache = new Map();
    // 成员头像请求缓存
    const memberAvatarRequestCache = new Map();

    const isMemberPage = window.location.pathname.startsWith('/member/');

    const baseStyles = `
        :root {
            --tip-button-color: #374151;
            --tip-button-hover-bg: rgba(59, 130, 246, 0.12);
            --tip-button-hover-border: #3b82f6;
            --tip-chat-panel-bg: #0f172a;
            --tip-chat-sidebar-bg: #111a2f;
            --tip-chat-border: rgba(148, 163, 184, 0.18);
            --tip-chat-text: #e2e8f0;
            --tip-chat-muted: #94a3b8;
            --tip-chat-accent: #6366f1;
            --tip-chat-bubble-self: #283859;
            --tip-chat-bubble-peer: rgba(100, 116, 139, 0.35);
            --dm-accent: #3b82f6;
            --dm-bg: #0f172a;
            --dm-text: #e5e7eb;
            --dm-muted: #9ca3af;
        }

        .Night {
            --tip-button-color: #9aa0ae;
            --tip-button-hover-bg: rgba(59, 130, 246, 0.08);
            --tip-chat-panel-bg: #050a18;
            --tip-chat-sidebar-bg: #070d18;
            --tip-chat-border: rgba(148, 163, 184, 0.28);
        }
    `;

    const tipStyles = `
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

        /* Hover-only controls for reply rows */
        .cell[id^="r_"] tr .tip-button,
        .cell[id^="r_"] tr .dm-btn {
            opacity: 0;
            pointer-events: none;
            transform: translateY(2px);
            transition: opacity 0.16s ease, transform 0.16s ease;
        }

        .cell[id^="r_"] tr:hover .tip-button,
        .cell[id^="r_"] tr:hover .dm-btn {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
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

        .tip-update-banner {
            position: fixed;
            right: 24px;
            bottom: 24px;
            border-radius: 10px;
            background: rgba(15, 23, 42, 0.94);
            color: #e2e8f0;
            padding: 14px 18px;
            box-shadow: 0 18px 45px rgba(15, 23, 42, 0.45);
            border: 1px solid rgba(148, 163, 184, 0.25);
            font-size: 13px;
            display: flex;
            gap: 12px;
            align-items: center;
            z-index: 2147483647;
        }

        .tip-update-banner a {
            color: #60a5fa;
            text-decoration: underline;
            font-weight: 600;
        }

        .tip-update-close {
            background: transparent;
            border: none;
            color: #94a3b8;
            font-size: 15px;
            cursor: pointer;
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
    `;

    const dmAndChatStyles = `
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

        .tip-chat-launcher {
            position: fixed;
            right: 26px;
            bottom: 26px;
            width: 52px;
            height: 52px;
            border-radius: 16px;
            border: none;
            background: var(--tip-chat-accent, #6366f1);
            color: #fff;
            cursor: pointer;
            box-shadow: 0 18px 45px rgba(2, 6, 23, 0.55);
            z-index: 9998;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .tip-chat-launcher:hover {
            transform: translateY(-2px);
            box-shadow: 0 22px 55px rgba(15, 23, 42, 0.65);
        }
        .tip-chat-launcher-indicator {
            position: absolute;
            top: 9px;
            right: 10px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #f87171;
            box-shadow: 0 0 0 4px rgba(248, 113, 113, 0.32);
        }
        .tip-chat-panel {
            position: fixed;
            right: 26px;
            bottom: 90px;
            z-index: 9999;
            opacity: 0;
            pointer-events: none;
            transform: translateY(12px);
            transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .tip-chat-panel.open {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
        }
        .tip-chat-shell {
            width: min(920px, 96vw);
            height: min(740px, 85vh);
            display: flex;
            border-radius: 18px;
            overflow: hidden;
            background: var(--tip-chat-panel-bg);
            border: 1px solid var(--tip-chat-border);
            color: var(--tip-chat-text);
            box-shadow: 0 30px 70px rgba(2, 6, 23, 0.7);
        }
        .tip-chat-sidebar {
            width: 320px;
            background: var(--tip-chat-sidebar-bg);
            border-right: 1px solid var(--tip-chat-border);
            display: flex;
            flex-direction: column;
        }
        .tip-chat-sidebar-header {
            padding: 18px 20px 12px;
            border-bottom: 1px solid var(--tip-chat-border);
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
        }
        .tip-chat-title {
            font-size: 16px;
            font-weight: 700;
        }
        .tip-chat-subtitle {
            font-size: 12px;
            color: var(--tip-chat-muted);
        }
        .tip-chat-sidebar-actions {
            display: flex;
            gap: 6px;
        }
        .tip-chat-icon-btn {
            width: 28px;
            height: 28px;
            border-radius: 8px;
            border: 1px solid var(--tip-chat-border);
            background: transparent;
            color: var(--tip-chat-text);
            cursor: pointer;
            font-size: 13px;
            transition: background 0.2s ease;
        }
        .tip-chat-icon-btn:hover {
            background: rgba(148, 163, 184, 0.12);
        }
        .tip-chat-icon-btn.loading {
            opacity: 0.6;
            pointer-events: none;
        }
        .tip-chat-conversation-list {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
        }
        .tip-chat-conversation-empty {
            padding: 20px;
            text-align: center;
            color: var(--tip-chat-muted);
            font-size: 13px;
        }
        .tip-chat-conversation-item {
            width: 100%;
            border: none;
            background: transparent;
            color: inherit;
            padding: 10px;
            border-radius: 10px;
            display: flex;
            gap: 10px;
            cursor: pointer;
            text-align: left;
            transition: background 0.2s ease;
        }
        .tip-chat-conversation-item:hover {
            background: rgba(148, 163, 184, 0.12);
        }
        .tip-chat-conversation-item.active {
            background: rgba(99, 102, 241, 0.18);
        }
        .tip-chat-avatar {
            width: 38px;
            height: 38px;
            border-radius: 12px;
            background: rgba(148, 163, 184, 0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 14px;
            color: var(--tip-chat-text);
            overflow: hidden;
        }
        .tip-chat-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .tip-chat-conversation-meta {
            flex: 1;
            min-width: 0;
        }
        .tip-chat-conversation-meta header {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            margin-bottom: 4px;
        }
        .tip-chat-conversation-meta header span:last-child {
            color: var(--tip-chat-muted);
            font-size: 12px;
        }
        .tip-chat-conversation-preview {
            color: var(--tip-chat-muted);
            font-size: 12px;
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .tip-chat-thread {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: var(--tip-chat-panel-bg);
        }
        .tip-chat-thread-header {
            padding: 18px 22px 14px;
            border-bottom: 1px solid var(--tip-chat-border);
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .tip-chat-thread-info {
            flex: 1;
            min-width: 0;
        }
        .tip-chat-thread-title {
            font-size: 15px;
            font-weight: 600;
        }
        .tip-chat-thread-meta {
            font-size: 12px;
            color: var(--tip-chat-muted);
            margin-top: 2px;
        }
        .tip-chat-thread-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .tip-chat-thread-tip-btn {
            height: 30px;
            padding: 0 12px;
            border-radius: 8px;
            border: 1px solid rgba(99, 102, 241, 0.45);
            background: rgba(99, 102, 241, 0.14);
            color: var(--tip-chat-text);
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;
        }
        .tip-chat-thread-tip-btn:hover:not(:disabled) {
            background: rgba(99, 102, 241, 0.22);
            border-color: rgba(99, 102, 241, 0.7);
            color: #fff;
        }
        .tip-chat-thread-tip-btn:disabled,
        .tip-chat-thread-tip-btn.loading {
            opacity: 0.5;
            cursor: not-allowed;
            pointer-events: none;
        }
        .tip-chat-pin-btn {
            min-width: 54px;
            height: 30px;
            border-radius: 999px;
            border: 1px solid rgba(148, 163, 184, 0.35);
            background: rgba(15, 23, 42, 0.35);
            color: var(--tip-chat-muted);
            cursor: pointer;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            line-height: 1;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-family: 'JetBrains Mono', 'SFMono-Regular', 'Menlo', monospace;
            padding: 0 14px 0 16px;
            transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }
        .tip-chat-pin-btn:hover {
            color: var(--tip-chat-text);
            border-color: rgba(99, 102, 241, 0.65);
            background: rgba(99, 102, 241, 0.18);
        }
        .tip-chat-pin-btn.pinned {
            color: var(--tip-chat-text);
            border-color: rgba(99, 102, 241, 0.8);
            background: rgba(99, 102, 241, 0.22);
            box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.35);
        }
        .tip-chat-thread-list {
            flex: 1;
            overflow-y: auto;
            padding: 16px 22px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
        }
        .tip-chat-composer {
            border-top: 1px solid var(--tip-chat-border);
            padding: 14px 22px 18px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            background: var(--tip-chat-panel-bg);
        }
        .tip-chat-composer-row {
            display: flex;
            gap: 10px;
            align-items: flex-start;
        }
        .tip-chat-composer textarea {
            width: 100%;
            min-height: 20px;
            height: 20px;
            border-radius: 14px;
            border: 1px solid var(--tip-chat-border);
            background: rgba(15, 23, 42, 0.4);
            color: var(--tip-chat-text);
            padding: 8px 10px;
            font-size: 13px;
            line-height: 1.4;
            resize: vertical;
            flex: 1;
        }
        .tip-chat-composer textarea:focus {
            outline: none;
            border-color: rgba(99, 102, 241, 0.7);
            box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.25);
        }
        .tip-chat-composer textarea:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .tip-chat-send-btn {
            border: none;
            background: #6366f1;
            color: #fff;
            padding: 10px 16px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.2s ease;
            align-self: stretch;
            white-space: nowrap;
        }
        .tip-chat-send-btn:hover:not([disabled]) {
            opacity: 0.9;
        }
        .tip-chat-send-btn[disabled] {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .tip-chat-empty {
            margin: auto;
            text-align: center;
            color: var(--tip-chat-muted);
            font-size: 13px;
        }
        .tip-chat-thread-hint {
            text-align: center;
            font-size: 12px;
            color: var(--tip-chat-muted);
        }
        .tip-chat-message {
            max-width: 88%;
            display: flex;
            gap: 10px;
            align-items: flex-end;
        }
        .tip-chat-message.incoming {
            align-self: flex-start;
            flex-direction: row;
        }
        .tip-chat-message.outgoing {
            align-self: flex-end;
            flex-direction: row-reverse;
            justify-content: flex-end;
            text-align: left;
            margin-left: auto;
        }
        .tip-chat-message-avatar {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background: rgba(148, 163, 184, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            flex-shrink: 0;
            font-weight: 600;
            font-size: 13px;
            color: var(--tip-chat-text);
        }
        .tip-chat-message-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .tip-chat-message-content {
            display: flex;
            flex-direction: column;
            gap: 4px;
            max-width: 100%;
        }
        .tip-chat-message.outgoing .tip-chat-message-content {
            align-items: flex-end;
        }
        .tip-chat-message-meta {
            font-size: 11px;
            color: var(--tip-chat-muted);
            display: flex;
            gap: 6px;
            justify-content: flex-start;
        }
        .tip-chat-message.outgoing .tip-chat-message-meta {
            justify-content: flex-end;
        }
        .tip-chat-message-bubble {
            padding: 10px 12px;
            border-radius: 14px;
            background: var(--tip-chat-bubble-peer);
            color: var(--tip-chat-text);
            line-height: 1.45;
            font-size: 13px;
            word-break: break-word;
            align-self: flex-start;
            max-width: 100%;
        }
        .tip-chat-message-bubble .tip-chat-message-img {
            max-width: min(360px, 82vw);
            width: 100%;
            height: auto;
            border-radius: 12px;
            display: block;
            margin-top: 6px;
        }
        .tip-chat-message-bubble .tip-chat-image-link {
            text-decoration: none;
        }
        .tip-chat-message-bubble a {
            color: #7cb7ff;
            text-decoration: none;
            font-weight: 600;
        }
        .tip-chat-message-bubble a:hover {
            text-decoration: underline;
            color: #a5d4ff;
        }
        .tip-chat-message.outgoing .tip-chat-message-bubble {
            background: var(--tip-chat-bubble-self);
            align-self: flex-end;
        }
        .tip-chat-message.tip-chat-highlight {
            box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.4);
            border-radius: 14px;
            transition: box-shadow 0.2s ease;
        }
        .tip-chat-thread-list::-webkit-scrollbar,
        .tip-chat-conversation-list::-webkit-scrollbar {
            width: 6px;
        }
        .tip-chat-thread-list::-webkit-scrollbar-thumb,
        .tip-chat-conversation-list::-webkit-scrollbar-thumb {
            background: rgba(148, 163, 184, 0.35);
            border-radius: 3px;
        }
        .tip-chat-cta-btn {
            margin-top: 12px;
            padding: 8px 14px;
            border-radius: 10px;
            border: 1px solid var(--tip-chat-border);
            background: rgba(99, 102, 241, 0.12);
            color: var(--tip-chat-text);
            cursor: pointer;
            font-size: 13px;
        }
        .tip-chat-cta-btn:hover:not([disabled]) {
            background: rgba(99, 102, 241, 0.2);
        }
        .tip-chat-cta-btn[disabled] {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .tip-chat-message-actions {
            position: fixed;
            background: rgba(17, 24, 39, 0.98);
            border: 1px solid var(--tip-chat-border);
            border-radius: 10px;
            box-shadow: 0 12px 35px rgba(0, 0, 0, 0.5);
            z-index: 10001;
            overflow: hidden;
            min-width: 140px;
        }
        .tip-chat-message-action-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            border: none;
            background: transparent;
            color: var(--tip-chat-text);
            font-size: 13px;
            cursor: pointer;
            width: 100%;
            text-align: left;
            transition: background 0.2s ease;
        }
        .tip-chat-message-action-item:hover {
            background: rgba(99, 102, 241, 0.15);
        }
        .tip-chat-message-action-item:not(:last-child) {
            border-bottom: 1px solid var(--tip-chat-border);
        }
        .tip-chat-message-action-icon {
            font-size: 14px;
        }
        .tip-chat-message-bubble {
            cursor: pointer;
            user-select: none;
            position: relative;
        }
        .tip-chat-message-quote {
            background: rgba(99, 102, 241, 0.15);
            border-left: 3px solid var(--tip-chat-accent);
            padding: 8px 10px;
            margin-bottom: 8px;
            border-radius: 6px;
            font-size: 12px;
            color: var(--tip-chat-muted);
            line-height: 1.4;
            max-height: 80px;
            overflow: hidden;
            position: relative;
        }
        .tip-chat-message-quote::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 20px;
            background: linear-gradient(transparent, rgba(99, 102, 241, 0.15));
        }
        .tip-chat-message-divider {
            margin: 8px 0;
            border: none;
            border-top: 1px dashed var(--tip-chat-border);
        }
    `;

    GM_addStyle(`
        ${baseStyles}
        ${isMemberPage ? '' : tipStyles}
        ${dmAndChatStyles}
    `);

    // 使用 GM_xmlhttpRequest 包装 fetch，绕过浏览器 CORS 限制
    function gmFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            const shouldSendCredentials = typeof options.withCredentials === 'boolean'
                ? options.withCredentials
                : (typeof window !== 'undefined' && window.location && url.startsWith(window.location.origin));
            GM_xmlhttpRequest({
                url,
                method: options.method || 'GET',
                headers: options.headers,
                data: options.body,
                timeout: options.timeout || 15000,
                responseType: options.responseType || 'text',
                withCredentials: shouldSendCredentials,
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

    let walletAdapterBaseModulePromise = null;
    let bs58ModulePromise = null;

    function ensureWalletAdapterBaseModule() {
        if (!walletAdapterBaseModulePromise) {
            walletAdapterBaseModulePromise = import(WALLET_ADAPTER_BASE_CDN);
        }
        return walletAdapterBaseModulePromise;
    }

    function getBs58Encoder() {
        if (!bs58ModulePromise) {
            bs58ModulePromise = import(BS58_MODULE_CDN);
        }
        return bs58ModulePromise.then((mod) => mod?.default || mod);
    }

    function getAccountChain(account) {
        if (account?.chains && account.chains.length > 0) {
            return account.chains[0];
        }
        return SOLANA_CHAIN_ID;
    }

    function buildStandardSignOptions(options = {}) {
        const payload = {};
        if (options.preflightCommitment) payload.preflightCommitment = options.preflightCommitment;
        if (typeof options.minContextSlot === 'number') payload.minContextSlot = options.minContextSlot;
        return Object.keys(payload).length ? payload : undefined;
    }

    function buildStandardSendOptions(options = {}) {
        const payload = {};
        if (options.preflightCommitment) payload.preflightCommitment = options.preflightCommitment;
        if (typeof options.minContextSlot === 'number') payload.minContextSlot = options.minContextSlot;
        if (options.commitment) payload.commitment = options.commitment;
        if (typeof options.skipPreflight === 'boolean') payload.skipPreflight = options.skipPreflight;
        if (typeof options.maxRetries === 'number') payload.maxRetries = options.maxRetries;
        return Object.keys(payload).length ? payload : undefined;
    }

    const walletSession = {
        module: null,
        provider: null,
        type: null,
        account: null,
        eventUnsubscribe: null,
        sleep(ms = 100) {
            return new Promise((resolve) => setTimeout(resolve, ms));
        },
        async ensureModule() {
            if (!this.module) {
                this.module = await ensureWalletAdapterBaseModule();
            }
            return this.module;
        },
        async detectProvider() {
            if (this.provider) return this.provider;
            const module = await this.ensureModule();
            const { isWalletAdapterCompatibleStandardWallet, WalletNotReadyError } = module;
            const candidates = [];

            if (PAGE_WINDOW.navigator?.wallets?.get) {
                try {
                    const wallets = await PAGE_WINDOW.navigator.wallets.get();
                    if (Array.isArray(wallets)) {
                        candidates.push(...wallets.filter(Boolean));
                    }
                } catch (err) {
                    console.warn('获取 Wallet Standard 钱包失败:', err);
                }
            }

            const injectedCandidates = this.getInjectedCandidates();
            candidates.push(...injectedCandidates);

            const standardWallet = candidates.find((wallet) => {
                try {
                    return isWalletAdapterCompatibleStandardWallet(wallet);
                } catch (err) {
                    return false;
                }
            });

            if (standardWallet) {
                this.provider = standardWallet;
                this.type = 'standard';
                return standardWallet;
            }

            const legacy = this.selectLegacyProvider([...injectedCandidates]);
            if (legacy) {
                const normalizedLegacy = await this.normalizeLegacyProvider(legacy);
                if (normalizedLegacy) {
                    this.provider = normalizedLegacy;
                    this.type = 'legacy';
                    return normalizedLegacy;
                }
            }

            throw new WalletNotReadyError('未检测到支持 Wallet Standard 的 Solana 钱包');
        },
        getInjectedCandidates() {
            const results = [];
            const solana = PAGE_WINDOW.solana;
            if (solana?.providers?.length) {
                results.push(...solana.providers.filter(Boolean));
            }
            if (solana) {
                results.push(solana);
            }
            if (PAGE_WINDOW.phantom?.solana) {
                results.push(PAGE_WINDOW.phantom.solana);
            }
            const knownKeys = ['backpack', 'solflare', 'exodus', 'clover', 'slope', 'okxwallet', 'bitgetwallet'];
            knownKeys.forEach((key) => {
                const candidate = PAGE_WINDOW[key];
                if (!candidate) return;
                if (candidate.solana) {
                    results.push(candidate.solana);
                    if (candidate.solana.provider) {
                        results.push(candidate.solana.provider);
                    }
                }
                if (candidate.providers?.solana) {
                    results.push(candidate.providers.solana);
                }
                if (candidate.wallet) {
                    results.push(candidate.wallet);
                }
                if (candidate.provider) {
                    results.push(candidate.provider);
                }
                results.push(candidate);
            });
            const okx = PAGE_WINDOW.okxwallet;
            if (okx) {
                if (okx.solana) {
                    results.push(okx.solana);
                    if (okx.solana.provider) {
                        results.push(okx.solana.provider);
                    }
                }
                if (okx.providers?.solana) {
                    results.push(okx.providers.solana);
                }
                if (typeof okx.getProvider === 'function') {
                    try {
                        const provider = okx.getProvider('solana');
                        if (provider && typeof provider.then !== 'function') {
                            results.push(provider);
                        }
                    } catch (err) {
                        console.debug('OKX getProvider 调用失败:', err);
                    }
                }
            }
            return results.filter(Boolean);
        },
        isOkxLikeWallet(wallet) {
            return Boolean(wallet && (
                wallet.isOkxWallet ||
                wallet.isOKXWallet ||
                wallet.isOKX ||
                wallet.okxwallet ||
                wallet === PAGE_WINDOW.okxwallet ||
                wallet === PAGE_WINDOW.okxwallet?.solana ||
                wallet === PAGE_WINDOW.okxwallet?.solana?.provider
            ));
        },
        isBitgetLikeWallet(wallet) {
            return Boolean(wallet && (
                wallet.isBitget ||
                wallet.isBitKeep ||
                wallet === PAGE_WINDOW.bitgetwallet ||
                wallet === PAGE_WINDOW.bitgetwallet?.solana
            ));
        },
        unwrapLegacyCandidate(wallet, options = {}) {
            if (!wallet) return null;
            const { requireConnector = false } = options;
            const candidates = [
                wallet.solana?.provider,
                wallet.providers?.solana,
                wallet.solanaProvider,
                wallet.solana,
                wallet.provider,
                wallet
            ];
            for (const candidate of candidates) {
                if (!candidate) continue;
                if (!requireConnector) {
                    return candidate;
                }
                if (typeof candidate.connect === 'function' || typeof candidate.request === 'function') {
                    return candidate;
                }
            }
            return requireConnector ? null : wallet;
        },
        selectLegacyProvider(candidates = []) {
            return candidates.find((wallet) => {
                if (!wallet) return false;
                const target = this.unwrapLegacyCandidate(wallet, { requireConnector: true }) || this.unwrapLegacyCandidate(wallet);
                if (!target) return false;
                const hasConnector = typeof target.connect === 'function' || typeof target.request === 'function';
                const hasSigner = typeof target.signAndSendTransaction === 'function' || typeof target.signTransaction === 'function' || typeof target.request === 'function';
                if (hasConnector && hasSigner) {
                    return true;
                }
                if (this.isOkxLikeWallet(wallet) || this.isBitgetLikeWallet(wallet)) {
                    return true;
                }
                return false;
            }) || null;
        },
        async normalizeLegacyProvider(wallet) {
            if (!wallet) return null;
            const isOkx = this.isOkxLikeWallet(wallet);
            const isBitget = this.isBitgetLikeWallet(wallet);
            const attemptLimit = isOkx ? 6 : (isBitget ? 3 : 1);
            const tryResolve = async () => {
                if (isOkx) {
                    if (PAGE_WINDOW.okxwallet?.solana && (typeof PAGE_WINDOW.okxwallet.solana.connect === 'function' || typeof PAGE_WINDOW.okxwallet.solana.request === 'function')) {
                        return PAGE_WINDOW.okxwallet.solana;
                    }
                    if (PAGE_WINDOW.okxwallet?.providers?.solana) {
                        const solProvider = PAGE_WINDOW.okxwallet.providers.solana;
                        if (typeof solProvider.connect === 'function' || typeof solProvider.request === 'function') {
                            return solProvider;
                        }
                    }
                    if (typeof PAGE_WINDOW.okxwallet?.getProvider === 'function') {
                        try {
                            const maybeProvider = PAGE_WINDOW.okxwallet.getProvider('solana');
                            const resolved = typeof maybeProvider?.then === 'function' ? await maybeProvider : maybeProvider;
                            if (resolved && (typeof resolved.connect === 'function' || typeof resolved.request === 'function')) {
                                return resolved;
                            }
                        } catch (err) {
                            console.debug('获取 OKX Solana provider 失败:', err);
                        }
                    }
                }
                if (isBitget) {
                    const bitgetSol = PAGE_WINDOW.bitgetwallet?.solana;
                    if (bitgetSol && (typeof bitgetSol.connect === 'function' || typeof bitgetSol.request === 'function')) {
                        return bitgetSol;
                    }
                }
                const direct = this.unwrapLegacyCandidate(wallet, { requireConnector: true });
                if (direct) {
                    return direct;
                }
                return null;
            };
            for (let attempt = 0; attempt < attemptLimit; attempt++) {
                const resolved = await tryResolve();
                if (resolved) {
                    return resolved;
                }
                if (attempt < attemptLimit - 1) {
                    await this.sleep(150);
                }
            }
            return this.unwrapLegacyCandidate(wallet) || wallet;
        },
        async connect(options = {}) {
            const provider = await this.detectProvider();
            if (this.type === 'standard') {
                await this.connectStandard(provider, options);
            } else {
                await this.connectLegacy(provider, options);
            }
        },
        async connectStandard(provider, options = {}) {
            const connectFeature = provider.features?.[STANDARD_CONNECT_FEATURE];
            if (!connectFeature || typeof connectFeature.connect !== 'function') {
                throw new Error('钱包不支持 Wallet Standard 连接能力');
            }
            const params = options.silent ? { silent: true } : undefined;
            const result = await connectFeature.connect(params);
            const accounts = result?.accounts || provider.accounts || [];
            if (!accounts.length) {
                throw new Error('钱包未返回任何账户');
            }
            this.account = accounts[0];
            this.bindStandardEvents(provider);
        },
        bindStandardEvents(provider) {
            if (this.eventUnsubscribe || !provider.features?.[STANDARD_EVENTS_FEATURE]) return;
            try {
                const { on } = provider.features[STANDARD_EVENTS_FEATURE];
                if (typeof on === 'function') {
                    this.eventUnsubscribe = on('change', ({ accounts }) => {
                        if (Array.isArray(accounts) && accounts.length) {
                            this.account = accounts[0];
                        }
                    });
                }
            } catch (err) {
                console.warn('注册钱包事件失败:', err);
            }
        },
        async connectLegacy(provider, options = {}) {
            const isConnected = provider.isConnected || provider.connected;
            if (isConnected) return;
            if (typeof provider.connect !== 'function') {
                throw new Error('当前钱包不支持连接接口');
            }
            if (options.silent) {
                try {
                    await provider.connect({ onlyIfTrusted: true });
                } catch (err) {
                    console.debug('静默连接 Legacy 钱包失败:', err);
                }
                return;
            }
            await provider.connect();
        },
        isConnected() {
            if (this.type === 'standard') {
                return Boolean(this.account || this.provider?.accounts?.length);
            }
            return Boolean(this.provider?.isConnected || this.provider?.connected);
        },
        getAddress() {
            if (this.type === 'standard') {
                const account = this.account || this.provider?.accounts?.[0];
                if (!account) return null;
                if (account.publicKey) {
                    try {
                        return new solanaWeb3.PublicKey(account.publicKey).toBase58();
                    } catch (err) {
                        console.warn('解析钱包公钥失败:', err);
                    }
                }
                if (account.address && isSolAddress(account.address)) {
                    return account.address;
                }
                return null;
            }
            return this.provider?.publicKey?.toString() || null;
        },
        async signAndSend(transaction, options = {}) {
            const provider = await this.detectProvider();
            if (this.type === 'standard') {
                if (!this.isConnected()) {
                    await this.connect();
                }
                return this.signAndSendStandard(provider, transaction, options);
            }
            if (typeof provider.signAndSendTransaction !== 'function') {
                throw new Error('当前钱包不支持 signAndSendTransaction');
            }
            const result = await provider.signAndSendTransaction(transaction);
            if (typeof result === 'string') {
                return result;
            }
            if (result?.signature) {
                return result.signature;
            }
            throw new Error('钱包未返回交易签名');
        },
        async signAndSendStandard(provider, transaction, options = {}) {
            const account = this.account || provider.accounts?.[0];
            if (!account) {
                throw new Error('钱包未授权任何账户');
            }
            const chain = getAccountChain(account);
            const serialized = transaction.serialize();
            const feature = provider.features?.[SOLANA_SIGN_AND_SEND_FEATURE];
            if (feature?.signAndSendTransaction) {
                const [output] = await feature.signAndSendTransaction({
                    account,
                    chain,
                    transaction: serialized,
                    options: buildStandardSendOptions(options)
                });
                if (!output?.signature) {
                    throw new Error('钱包未返回交易签名');
                }
                const bs58 = await getBs58Encoder();
                return bs58.encode(output.signature);
            }
            const signFeature = provider.features?.[SOLANA_SIGN_TRANSACTION_FEATURE];
            if (!signFeature?.signTransaction) {
                throw new Error('钱包不支持签名交易');
            }
            const [signed] = await signFeature.signTransaction({
                account,
                chain,
                transaction: serialized,
                options: buildStandardSignOptions(options)
            });
            if (!signed?.signedTransaction) {
                throw new Error('钱包未返回签名结果');
            }
            const connection = new solanaWeb3.Connection(SOLANA_RPC, {
                commitment: options.commitment || 'confirmed',
                fetch: gmFetch
            });
            return connection.sendRawTransaction(signed.signedTransaction, {
                skipPreflight: options.skipPreflight,
                maxRetries: options.maxRetries,
                preflightCommitment: options.preflightCommitment,
                minContextSlot: options.minContextSlot
            });
        }
    };

    async function ensureWalletConnection(options = {}) {
        try {
            await walletSession.connect(options);
            return true;
        } catch (err) {
            if (options?.silent) {
                console.debug('静默连接钱包失败:', err);
                return false;
            }
            throw err;
        }
    }

    function getConnectedWalletAddress() {
        return walletSession.getAddress();
    }

    function isWalletAlreadyConnected() {
        return walletSession.isConnected();
    }

    async function walletSignAndSendTransaction(transaction, options = {}) {
        return walletSession.signAndSend(transaction, options);
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
        await ensureWalletConnection({ silent: true });

        document.getElementById('tip-username').textContent = username;
        
        // 重置消息
        const messageEl = document.getElementById('tip-message');
        messageEl.className = 'tip-message';
        messageEl.textContent = '';

        // 重置附言输入框与可见性（Planet 场景不提供附言）
        const isPlanetContext = isPlanetPage() || options.tipType === 'planet-post' || options.tipType === 'planet-comment' || options.tipType === 'tip-chat';
        const postscriptContainer = document.querySelector('.tip-postscript-container');
        const postscriptEl = document.getElementById('tip-postscript');
        const defaultPostscript = options.defaultPostscript || '';
        if (postscriptContainer) {
            postscriptContainer.style.display = isPlanetContext ? 'none' : '';
        }
        if (postscriptEl) {
            postscriptEl.value = defaultPostscript;
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

        if (tipType === 'tip-chat') {
            const chatMemo = (options && options.defaultPostscript) || (options && options.tipChatMemo) || '';
            return chatMemo || '打赏了你的私聊';
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

    function buildTipChatPostscript(messageText) {
        const normalized = (messageText || '').replace(/\s+/g, ' ').trim();
        const content = normalized || '（空消息）';
        const truncated = content.length > 120 ? `${content.slice(0, 117)}...` : content;
        return `打赏了你的私聊 > ${truncated}`;
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
            const connected = await ensureWalletConnection();
            if (!connected) {
                throw new Error('请先连接支持 Wallet Standard 的 Solana 钱包');
            }
            const fromAddress = getConnectedWalletAddress();
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
            const signature = await walletSignAndSendTransaction(transaction);
            
            showMessage('交易已发送，等待确认...', 'info');

            // 延时两秒，等待区块链网络处理
            await new Promise(resolve => setTimeout(()=>{
                waitForTransaction(signature);
                resolve();
            }, 2000));

            const defaultPostscript = options.defaultPostscript || '';
            const replyContent = buildReplyContent({ replyText, replyId, options });
            const postscriptEl = document.getElementById('tip-postscript');
            const userPostscript = postscriptEl ? postscriptEl.value.trim() : '';
            const postscript = userPostscript || defaultPostscript;
            const memoContent = replyContent || postscript || '';

            await submitTipRecord({
                signature,
                amount,
                memo: memoContent,
                token: selectedToken
            });

            showMessage('打赏成功！', 'success');

            // 检查是否有附言需要发送
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
            const failMsg = (error.message || '打赏失败，请重试') + '。建议完全退出 Chrome 并重新打开后再试。';
            showMessage(failMsg, 'error');
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
                        }),
                        withCredentials: false
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
                    <div class="dm-status" id="dm-status">钱包将弹出确认支付 1 $V2EX</div>
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
        statusEl.textContent = '钱包将弹出确认支付 1 $V2EX';
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

    async function sendDmMessage({ username, address, text, onStatus }) {
        const content = (text || '').trim();
        if (!content || content.length < 3) {
            throw new Error('请至少输入 3 个字符');
        }
        const normalizedAddress = typeof address === 'string' ? address.trim() : '';
        if (!isSolAddress(normalizedAddress)) {
            throw new Error('对方未绑定地址，无法发送');
        }
        const reportStatus = (msg) => {
            if (typeof onStatus === 'function' && msg) {
                onStatus(msg);
            }
        };
        reportStatus('准备钱包...');
        await ensureSolanaLibraries();
        if (!isWalletAlreadyConnected()) {
            reportStatus('连接钱包...');
        }
        const connected = await ensureWalletConnection();
        if (!connected) {
            throw new Error('请安装并解锁支持 Wallet Standard 的 Solana 钱包');
        }
        const from = getConnectedWalletAddress();
        if (!from) {
            throw new Error('未获取到钱包地址');
        }
        reportStatus('构建交易...');
        const tx = await buildTransaction(from, normalizedAddress, MESSAGE_COST, V2EX_MINT);
        reportStatus('等待钱包签名...');
        const signature = await walletSignAndSendTransaction(tx);
        reportStatus('链上确认中...');
        await waitForTransaction(signature);
        const memo = content.slice(0, 180);
        await submitMessageRecord({ signature, amount: MESSAGE_COST, memo, to: username });
        return { signature, memo };
    }

    async function handleDmSend({ username, address, contentEl, sendBtn, statusEl }) {
        const text = (contentEl.value || '').trim();
        if (!text || text.length < 3) {
            statusEl.textContent = '请至少输入 3 个字符';
            return;
        }

        try {
            sendBtn.disabled = true;
            sendBtn.textContent = '发送中...';
            await sendDmMessage({
                username,
                address,
                text,
                onStatus: (msg) => {
                    statusEl.textContent = msg;
                }
            });
            statusEl.textContent = '私信已发送并记录';
            setTimeout(() => {
                closeDmModal();
                window.open(`${window.location.origin}/solana/tips`, '_blank');
            }, 1200);
        } catch (err) {
            console.error('私信发送失败', err);
            statusEl.textContent = err.message || '私信发送失败';
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = '发送私信';
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

    function getCurrentUsername() {
        const topLink = document.querySelector('#Top .tools a[href^="/member/"]');
        if (topLink) {
            const text = topLink.textContent?.trim();
            if (text) return text;
        }
        const altLink = document.querySelector('a.top[href^="/member/"]');
        return altLink ? altLink.textContent?.trim() || null : null;
    }

    function getUsernameFromDocument(doc) {
        if (!doc) return null;
        const navLink = doc.querySelector('#Top .tools a[href^="/member/"]');
        if (navLink?.textContent) {
            return navLink.textContent.trim();
        }
        const altLink = doc.querySelector('a.top[href^="/member/"]');
        return altLink?.textContent?.trim() || null;
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
                await ensureWalletConnection({ silent: true });
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
                await ensureWalletConnection({ silent: true });
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

    function safeJsonParse(value, fallback) {
        if (!value) return fallback;
        try {
            return JSON.parse(value);
        } catch (err) {
            return fallback;
        }
    }

    function loadTipChatRecords() {
        return safeJsonParse(localStorage.getItem(TIP_CHAT_STORAGE_KEY), []);
    }

    function saveTipChatRecords(records) {
        try {
            localStorage.setItem(TIP_CHAT_STORAGE_KEY, JSON.stringify(records));
        } catch (err) {
            console.warn('保存打赏记录失败', err);
        }
    }

    function loadTipChatMeta() {
        return safeJsonParse(localStorage.getItem(TIP_CHAT_META_KEY), {
            latestId: null,
            lastSeenId: null,
            updatedAt: 0
        });
    }

    function saveTipChatMeta(meta) {
        const payload = {
            latestId: meta?.latestId || null,
            lastSeenId: meta?.lastSeenId || null,
            updatedAt: meta?.updatedAt || Date.now()
        };
        try {
            localStorage.setItem(TIP_CHAT_META_KEY, JSON.stringify(payload));
        } catch (err) {
            console.warn('保存打赏元信息失败', err);
        }
    }

    function loadTipChatSelf() {
        try {
            const stored = localStorage.getItem(TIP_CHAT_SELF_KEY);
            return stored ? stored.trim() : null;
        } catch (err) {
            console.warn('读取当前用户失败', err);
            return null;
        }
    }

    function saveTipChatSelf(username) {
        if (!username) return;
        const normalized = username.trim();
        if (!normalized) return;
        tipChatState.currentUser = normalized;
        try {
            localStorage.setItem(TIP_CHAT_SELF_KEY, normalized);
        } catch (err) {
            console.warn('保存当前用户失败', err);
        }
    }

    function resolveTipChatCurrentUser() {
        if (tipChatState.currentUser) {
            return tipChatState.currentUser;
        }
        const domUser = getCurrentUsername();
        if (domUser) {
            saveTipChatSelf(domUser);
            return domUser;
        }
        const stored = loadTipChatSelf();
        if (stored) {
            tipChatState.currentUser = stored;
            return stored;
        }
        return null;
    }

    function loadScriptUpdateMeta() {
        return safeJsonParse(localStorage.getItem(SCRIPT_UPDATE_CHECK_KEY), {
            checkedAt: 0,
            latestVersion: null
        }) || { checkedAt: 0, latestVersion: null };
    }

    function saveScriptUpdateMeta(meta) {
        try {
            localStorage.setItem(SCRIPT_UPDATE_CHECK_KEY, JSON.stringify(meta));
        } catch (err) {
            console.warn('保存更新检查信息失败', err);
        }
    }

    function getCurrentScriptVersion() {
        if (typeof GM_info === 'object' && GM_info?.script?.version) {
            return GM_info.script.version;
        }
        const metaTag = document.querySelector('meta[name="version"]');
        return metaTag?.getAttribute('content') || '0.0.0';
    }

    function compareVersions(a = '0.0.0', b = '0.0.0') {
        const parse = (input) => input.split('.').map(part => parseInt(part, 10) || 0);
        const partsA = parse(a);
        const partsB = parse(b);
        const max = Math.max(partsA.length, partsB.length);
        for (let i = 0; i < max; i++) {
            const diff = (partsA[i] || 0) - (partsB[i] || 0);
            if (diff !== 0) return diff > 0 ? 1 : -1;
        }
        return 0;
    }

    async function fetchLatestScriptVersion() {
        const response = await gmFetch(SCRIPT_UPDATE_URL, { method: 'GET', timeout: 15000 });
        if (!response.ok) {
            throw new Error('获取最新脚本失败');
        }
        const text = await response.text();
        const match = text.match(/@version\s+([0-9.]+)/);
        return match ? match[1].trim() : null;
    }

    function showUpgradeBanner(latestVersion) {
        if (!document.body) return;
        if (!latestVersion) return;
        if (tipChatState.upgradePromptedVersion === latestVersion) return;
        tipChatState.upgradePromptedVersion = latestVersion;
        if (document.getElementById('tip-update-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'tip-update-banner';
        banner.className = 'tip-update-banner';
        banner.innerHTML = `
            <span>发现新版本 <strong>v${latestVersion}</strong>，请前往升级。</span>
            <a href="${SCRIPT_UPDATE_URL}" target="_blank" rel="noopener noreferrer">立即安装</a>
            <button class="tip-update-close" type="button">×</button>
        `;
        const closeBtn = banner.querySelector('.tip-update-close');
        closeBtn?.addEventListener('click', () => {
            banner.remove();
        });
        document.body.appendChild(banner);
    }

    function scheduleScriptUpdateCheck() {
        if (scriptUpdateCheckScheduled) return;
        scriptUpdateCheckScheduled = true;
        setTimeout(() => {
            runScriptUpdateCheck().catch(() => {});
        }, 3500);
    }

    async function runScriptUpdateCheck({ force = false } = {}) {
        const currentVersion = getCurrentScriptVersion();
        const record = loadScriptUpdateMeta();
        const now = Date.now();
        if (!force && record?.checkedAt && (now - record.checkedAt) < SCRIPT_UPDATE_INTERVAL) {
            if (record.latestVersion && compareVersions(record.latestVersion, currentVersion) > 0) {
                showUpgradeBanner(record.latestVersion);
            }
            return;
        }
        try {
            const latestVersion = await fetchLatestScriptVersion();
            saveScriptUpdateMeta({ checkedAt: now, latestVersion });
            if (latestVersion && compareVersions(latestVersion, currentVersion) > 0) {
                showUpgradeBanner(latestVersion);
            }
        } catch (err) {
            console.warn('检查脚本更新失败', err);
        }
    }

    function trimTipRecords(records) {
        if (!Array.isArray(records)) return [];
        if (records.length <= TIP_CHAT_RECORD_LIMIT) return records;
        return records.slice(records.length - TIP_CHAT_RECORD_LIMIT);
    }

    function mergeTipRecords(base, incoming) {
        const map = new Map();
        (base || []).forEach(record => {
            if (record?.id) {
                map.set(record.id, record);
            }
        });
        (incoming || []).forEach(record => {
            if (!record?.id) return;
            map.set(record.id, { ...(map.get(record.id) || {}), ...record });
        });
        const merged = Array.from(map.values());
        merged.sort((a, b) => {
            const diff = (a.timestamp || 0) - (b.timestamp || 0);
            if (diff !== 0) return diff;
            return (a.id || '').localeCompare(b.id || '');
        });
        return merged;
    }

    // 从 localStorage 重新同步内存中的打赏记录，避免跨标签页或重载后的状态漂移
    function syncTipChatStateFromStorage() {
        const stored = loadTipChatRecords();
        if (!Array.isArray(stored)) return false;
        const currentRecords = Array.isArray(tipChatState.records) ? tipChatState.records : [];
        const currentLatestId = currentRecords.length ? currentRecords[currentRecords.length - 1]?.id : null;
        const storedLatestId = stored.length ? stored[stored.length - 1]?.id : null;
        const currentCount = currentRecords.length;
        const storedCount = stored.length;

        // 仅在存储中存在更新（更多条目或不同的最新 ID）时才回填，避免覆盖本地未保存的新增记录
        const shouldSync = (storedCount > currentCount) || (storedLatestId && storedLatestId !== currentLatestId);
        if (!shouldSync) return false;

        tipChatState.records = trimTipRecords(stored);
        rebuildTipConversationMap();
        tipChatState.summaries = getConversationSummaries();
        return true;
    }

    function clearTipChatCache() {
        try {
            localStorage.removeItem(TIP_CHAT_STORAGE_KEY);
            localStorage.removeItem(TIP_CHAT_META_KEY);
        } catch (err) {
            console.warn('清除本地缓存失败', err);
        }
        tipChatState.records = [];
        tipChatState.conversationMap = new Map();
        tipChatState.summaries = [];
        tipChatState.visibleCountMap = new Map();
        tipChatState.activePeer = null;
        tipChatState.pinned = false;
        tipChatState.refreshing = null;
        saveTipChatMeta({ latestId: null, lastSeenId: null, updatedAt: Date.now() });
        updateTipChatPinUI();
        updateLauncherBadge(false);
        renderTipConversationList();
        renderTipThread();
        refreshTipChatData({ forceFull: true, repair: true }).catch(() => {});
        alert('已清除本地缓存并开始重新同步');
    }

    function parseAmountInfo(text = '') {
        if (!text) return { amount: null, token: 'v2ex' };
        const cleaned = text.replace(/,/g, '');
        const match = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:\$?V2EX|SOL)/i);
        if (match) {
            return {
                amount: parseFloat(match[1]),
                token: match[0].toLowerCase().includes('sol') ? 'sol' : 'v2ex'
            };
        }
        return {
            amount: null,
            token: cleaned.toLowerCase().includes('sol') ? 'sol' : 'v2ex'
        };
    }

    function normalizeUsernameFromHref(href) {
        if (!href) return null;
        const match = href.match(/\/member\/([^\/?#]+)/);
        return match ? decodeURIComponent(match[1]) : null;
    }

    function extractSignatureId(link) {
        if (!link) return null;
        const text = link.textContent?.trim();
        if (text && text.length > 20) return text;
        const href = link.getAttribute('href') || link.href || '';
        const match = href.match(/tx\/([^/?]+)/i);
        if (match) return match[1];
        return href || text || null;
    }

    function extractAvatarFromLink(link) {
        if (!link) return null;
        const img = link.querySelector('img');
        if (img?.src) return img.src;
        const parentImg = link.parentElement?.querySelector('img.avatar');
        return parentImg?.src || null;
    }

    function findInlineAvatarForUsername(username) {
        if (!username || typeof document === 'undefined') return null;
        const links = document.querySelectorAll('a[href^="/member/"]');
        for (const link of links) {
            if (normalizeUsernameFromHref(link.getAttribute('href')) === username) {
                const src = extractAvatarFromLink(link);
                if (src) return src;
            }
        }
        return null;
    }

    function extractAvatarFromCell(cell, index = 0) {
        const avatars = Array.from(cell.querySelectorAll('img.avatar'));
        if (!avatars.length) return null;
        return avatars[index]?.src || avatars[0]?.src || null;
    }

    function formatRelativeTime(ts) {
        const diff = Date.now() - (ts || Date.now());
        const abs = Math.abs(diff);
        const units = [
            { label: '天', value: 86400000 },
            { label: '小时', value: 3600000 },
            { label: '分钟', value: 60000 }
        ];
        for (const unit of units) {
            if (abs >= unit.value) {
                const count = Math.floor(abs / unit.value);
                return `${count}${unit.label}前`;
            }
        }
        return '刚刚';
    }

    function formatAbsoluteTime(ts) {
        const date = new Date(ts || Date.now());
        if (Number.isNaN(date.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function parseRelativeTimeLabel(label) {
        if (!label) return Date.now();
        const text = label.trim();
        if (!text) return Date.now();
        const normalized = text.replace(/\s+/g, ' ');
        const parsedDate = Date.parse(normalized.replace(/年|月/g, '/').replace(/日/g, '').replace(/-/g, '/'));
        if (!Number.isNaN(parsedDate)) {
            return parsedDate;
        }
        if (/刚刚/.test(normalized)) {
            return Date.now();
        }
        let diff = 0;
        const dayMatch = normalized.match(/(\d+)\s*天/);
        if (dayMatch) {
            diff += parseInt(dayMatch[1], 10) * 86400000;
        }
        const hourMatch = normalized.match(/(\d+)\s*小时/);
        if (hourMatch) {
            diff += parseInt(hourMatch[1], 10) * 3600000;
        }
        const minuteMatch = normalized.match(/(\d+)\s*分/);
        if (minuteMatch) {
            diff += parseInt(minuteMatch[1], 10) * 60000;
        }
        const secondMatch = normalized.match(/(\d+)\s*秒/);
        if (secondMatch) {
            diff += parseInt(secondMatch[1], 10) * 1000;
        }
        if (diff === 0 && /前/.test(normalized)) {
            diff = 60000;
        }
        return Date.now() - diff;
    }

    function formatRecordPreview(record) {
        const memoText = getRecordMemoText(record);
        if (memoText) {
            return memoText.length > 80 ? `${memoText.slice(0, 77)}…` : memoText;
        }
        if (record?.amount) {
            const tokenLabel = record.token === 'sol' ? 'SOL' : '$V2EX';
            return `打赏 ${record.amount} ${tokenLabel}`;
        }
        return `${record?.from || '?'} → ${record?.to || '?'}`;
    }

    function formatMessageBody(record) {
        const memoText = getRecordMemoText(record);
        if (memoText) return memoText;
        const tokenLabel = record?.token === 'sol' ? 'SOL' : '$V2EX';
        if (record?.amount) {
            return `打赏 ${record.amount} ${tokenLabel}`;
        }
        const fallback = `${record?.from || ''} -> ${record?.to || ''}`.trim();
        return fallback || '无附言';
    }

    function escapeHtmlText(value = '') {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return value.replace(/[&<>"']/g, (ch) => map[ch]).replace(/\n/g, '<br>');
    }

    const ALLOWED_RICH_TAGS = new Set(['A', 'SPAN', 'DIV', 'P', 'BR', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'B', 'I', 'CODE', 'PRE', 'SMALL']);

    function escapeHtmlAttribute(value = '') {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return value.replace(/[&<>"']/g, (ch) => map[ch]);
    }

    function isSafeHref(href = '') {
        const trimmed = href.trim();
        if (!trimmed) return false;
        if (/^javascript:/i.test(trimmed)) return false;
        return /^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('/');
    }

    function sanitizeRichTextElement(element) {
        if (!element) return '';
        const walk = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                return escapeHtmlText(node.textContent || '');
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return '';
            const tag = (node.nodeName || '').toUpperCase();
            if (tag === 'BR') return '<br>';
            const children = Array.from(node.childNodes).map(walk).join('');
            if (!ALLOWED_RICH_TAGS.has(tag)) {
                return children;
            }
            let attrs = '';
            if (tag === 'A') {
                const href = node.getAttribute('href') || '';
                if (isSafeHref(href)) {
                    attrs += ` href="${escapeHtmlAttribute(href)}" target="_blank" rel="noopener noreferrer"`;
                }
            }
            return `<${tag.toLowerCase()}${attrs}>${children}</${tag.toLowerCase()}>`;
        };
        return Array.from(element.childNodes).map(walk).join('').trim();
    }

    function extractRichText(element) {
        if (!element) return { memoText: '', memoHtml: '' };
        const memoText = (element.textContent || '').trim();
        const memoHtml = sanitizeRichTextElement(element);
        return { memoText, memoHtml };
    }

    function getRecordMemoText(record) {
        if (!record) return '';
        if (typeof record.memo === 'string' && record.memo.trim()) return record.memo.trim();
        if (typeof record.memoHtml === 'string' && record.memoHtml.trim()) {
            const scratch = document.createElement('div');
            scratch.innerHTML = record.memoHtml;
            return (scratch.textContent || '').trim();
        }
        return '';
    }

    function normalizeQuoteId(rawId) {
        const val = String(rawId || '').trim();
        return val ? val.slice(0, 6) : '';
    }

    function parseQuotedMessage(rawText = '') {
        if (!rawText) return { quoteId: null, quoteText: '', mainText: '' };
        const parts = rawText.split('------');
        if (parts.length < 2) {
            return { quoteId: null, quoteText: '', mainText: rawText.trim() };
        }
        const rawQuote = parts[0].trim();
        const match = rawQuote.match(/^\[quote:([^\]]+)\]\s*(.*)$/s);
        const rawQuoteId = match ? (match[1] || '').trim() : null;
        const quoteId = normalizeQuoteId(rawQuoteId);
        const quoteText = match ? (match[2] || '').trim() : rawQuote;
        const mainText = parts.slice(1).join('------').trim();
        return { quoteId, quoteText, mainText };
    }

    function findTipChatRecordByQuoteId(quoteId) {
        if (!quoteId || !Array.isArray(tipChatState.records)) return null;
        const normalizedTarget = normalizeQuoteId(quoteId) || quoteId;
        for (let i = tipChatState.records.length - 1; i >= 0; i--) {
            const record = tipChatState.records[i];
            if (!record?.id) continue;
            const normalizedRecordId = normalizeQuoteId(record.id) || record.id;
            if (normalizedRecordId === normalizedTarget || record.id === quoteId) {
                return record;
            }
        }
        return null;
    }

    function resolveQuotePreviewText(quoteId, inlineQuoteText = '') {
        if (inlineQuoteText) return inlineQuoteText;
        const record = findTipChatRecordByQuoteId(quoteId);
        if (!record) return '';
        return getRecordMemoText(record) || formatMessageBody(record) || '';
    }

    function escapeCssSelector(val) {
        if (!val) return '';
        if (window.CSS && typeof window.CSS.escape === 'function') {
            return window.CSS.escape(val);
        }
        return String(val).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }

    function getRecordMessageHtml(record) {
        if (!record) return '';
        const memoText = getRecordMemoText(record);
        const memoHtml = typeof record.memoHtml === 'string' ? record.memoHtml.trim() : '';

        if (memoText) {
            const { quoteId, quoteText, mainText } = parseQuotedMessage(memoText);
            const resolvedQuoteText = resolveQuotePreviewText(quoteId, quoteText);
            const fallbackQuoteText = quoteId && !resolvedQuoteText ? '引用内容不可见' : '';
            const quoteContent = resolvedQuoteText || fallbackQuoteText;
            if (quoteId || quoteContent) {
                const quoteHtml = quoteContent ? linkifyText(quoteContent) : '';
                const mainHtml = mainText ? linkifyText(mainText) : '';
                const dataAttr = quoteId ? ` data-quote-target="${escapeHtmlAttribute(quoteId)}"` : '';
                return `<div class="tip-chat-message-quote"${dataAttr}>${quoteHtml}</div>${mainHtml}`;
            }
            if (memoHtml) {
                if (/<a\s/i.test(memoHtml)) return memoHtml;
                if (memoText) return linkifyText(memoText);
                return memoHtml;
            }
            return linkifyText(memoText);
        }
        return escapeHtmlText(formatMessageBody(record) || '');
    }

    function isImgurImageUrl(url) {
        if (!url) return false;
        try {
            const u = new URL(url, window.location.origin);
            const isSupportedHost = u.hostname === 'i.imgur.com' || u.hostname === 'i.v2ex.co';
            if (!isSupportedHost) return false;
            return /\.(png|jpe?g|gif|webp)$/i.test(u.pathname);
        } catch (_err) {
            return false;
        }
    }

    function linkifyText(text = '') {
        if (!text) return '';
        const urlRegex = /(https?:\/\/[^\s]+|\/?t\/\d+(?:#[\w-]+)?)/gi;
        let html = '';
        let lastIndex = 0;
        text.replace(urlRegex, (match, _p1, offset) => {
            html += escapeHtmlText(text.slice(lastIndex, offset));
            let href = match;
            if (!match.startsWith('http')) {
                const path = match.startsWith('/') ? match : `/${match}`;
                href = `${window.location.origin}${path}`;
            }
            const safeHref = escapeHtmlAttribute(href);
            if (isImgurImageUrl(href)) {
                html += `<a class="tip-chat-image-link" href="${safeHref}" target="_blank" rel="noopener noreferrer"><img class="tip-chat-message-img" src="${safeHref}" alt="image" loading="lazy"></a>`;
            } else {
                html += `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(match)}</a>`;
            }
            lastIndex = offset + match.length;
            return match;
        });
        if (lastIndex < text.length) {
            html += escapeHtmlText(text.slice(lastIndex));
        }
        return html || escapeHtmlText(text);
    }

    function rebuildTipConversationMap() {
        const me = resolveTipChatCurrentUser();
        if (!me) return;
        const nextMap = new Map();
        (tipChatState.records || []).forEach((record) => {
            if (!record) return;
            if (record.from !== me && record.to !== me) return;
            const peer = record.from === me ? record.to : record.from;
            if (!peer) return;
            if (!nextMap.has(peer)) {
                nextMap.set(peer, []);
            }
            nextMap.get(peer).push(record);
        });
        nextMap.forEach((list, key) => {
            list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            nextMap.set(key, list);
        });
        tipChatState.conversationMap = nextMap;
    }

    function resolveAvatarForUser(username, records) {
        if (!username) return null;
        if (memberAvatarCache.has(username) && memberAvatarCache.get(username)) {
            return memberAvatarCache.get(username);
        }
        const inlineAvatar = findInlineAvatarForUsername(username);
        if (inlineAvatar) {
            memberAvatarCache.set(username, inlineAvatar);
            return inlineAvatar;
        }
        if (!Array.isArray(records)) return memberAvatarCache.get(username) || null;
        for (let i = records.length - 1; i >= 0; i--) {
            const record = records[i];
            if (record?.from === username && record.fromAvatar) {
                memberAvatarCache.set(username, record.fromAvatar);
                return record.fromAvatar;
            }
            if (record?.to === username && record.toAvatar) {
                memberAvatarCache.set(username, record.toAvatar);
                return record.toAvatar;
            }
        }
        return memberAvatarCache.get(username) || null;
    }

    function fetchMemberAvatar(username) {
        if (!username) return Promise.resolve(null);
        if (memberAvatarCache.has(username) && memberAvatarCache.get(username)) {
            return Promise.resolve(memberAvatarCache.get(username));
        }
        if (memberAvatarRequestCache.has(username)) {
            return memberAvatarRequestCache.get(username);
        }
        const request = (async () => {
            try {
                const response = await gmFetch(`${window.location.origin}/member/${encodeURIComponent(username)}`);
                if (!response.ok) return null;
                const html = await response.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const img = doc.querySelector('#Main .box .cell img.avatar, #Main img.avatar');
                const url = img?.src || null;
                if (url) {
                    memberAvatarCache.set(username, url);
                    applyAvatarToRecords(username, url);
                }
                return url;
            } catch (err) {
                console.warn('获取头像失败:', err);
                return null;
            }
        })().finally(() => {
            memberAvatarRequestCache.delete(username);
        });
        memberAvatarRequestCache.set(username, request);
        return request;
    }

    function applyAvatarToRecords(username, avatarUrl) {
        if (!username || !avatarUrl) return;
        let updated = false;
        (tipChatState.records || []).forEach((record) => {
            if (record?.from === username && !record.fromAvatar) {
                record.fromAvatar = avatarUrl;
                updated = true;
            }
            if (record?.to === username && !record.toAvatar) {
                record.toAvatar = avatarUrl;
                updated = true;
            }
        });
        if (updated) {
            saveTipChatRecords(tipChatState.records);
            tipChatState.summaries = tipChatState.summaries.map((summary) => summary.peer === username ? { ...summary, avatar: avatarUrl } : summary);
            renderTipConversationList();
            if (tipChatState.activePeer === username) {
                renderTipThread();
            }
        }
    }

    function ensureAvatarForPeer(username) {
        if (!username) return;
        if (memberAvatarCache.has(username) && memberAvatarCache.get(username)) return;
        fetchMemberAvatar(username).catch(() => {});
    }

    function getConversationSummaries() {
        const summaries = [];
        tipChatState.conversationMap.forEach((records, peer) => {
            if (!records.length) return;
            const last = records[records.length - 1];
            summaries.push({
                peer,
                lastMessage: formatRecordPreview(last),
                lastTimestamp: last.timestamp || 0,
                avatar: resolveAvatarForUser(peer, records)
            });
        });
        summaries.sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
        return summaries;
    }

    function createTipChatUIIfNeeded() {
        if (tipChatState.elements.launcher || !document.body) return;

        const launcher = document.createElement('button');
        launcher.type = 'button';
        launcher.id = 'tip-chat-launcher';
        launcher.className = 'tip-chat-launcher';
        launcher.innerHTML = '<span class="tip-chat-launcher-icon">💬</span>';
        const indicator = document.createElement('span');
        indicator.className = 'tip-chat-launcher-indicator';
        indicator.hidden = true;
        launcher.appendChild(indicator);
        document.body.appendChild(launcher);

        const panel = document.createElement('div');
        panel.id = 'tip-chat-panel';
        panel.className = 'tip-chat-panel';
        panel.innerHTML = `
            <div class="tip-chat-shell">
                <aside class="tip-chat-sidebar">
                    <div class="tip-chat-sidebar-header">
                        <div>
                            <div class="tip-chat-title">V2EX会话</div>
                            <div class="tip-chat-subtitle">基于$V2EX打赏记录</div>
                        </div>
                        <div class="tip-chat-sidebar-actions">
                            <button class="tip-chat-pin-btn" title="固定面板">PIN</button>
                            <button class="tip-chat-icon-btn tip-chat-refresh" title="刷新">R</button>
                            <button class="tip-chat-icon-btn tip-chat-clear" title="清除本地缓存">D</button>
                            <button class="tip-chat-icon-btn tip-chat-close" title="关闭">X</button>
                        </div>
                    </div>
                    <div class="tip-chat-conversation-list" id="tip-chat-conversation-list"></div>
                </aside>
                <section class="tip-chat-thread">
                    <div class="tip-chat-thread-header">
                        <div class="tip-chat-thread-info">
                            <div class="tip-chat-thread-title" id="tip-chat-thread-title">选择会话</div>
                            <div class="tip-chat-thread-meta" id="tip-chat-thread-meta">最近 30 条消息</div>
                        </div>
                        <div class="tip-chat-thread-actions">
                            <button class="tip-chat-thread-tip-btn" id="tip-chat-tip-btn" type="button" title="打赏当前会话">赏</button>
                        </div>
                    </div>
                    <div class="tip-chat-thread-list" id="tip-chat-thread-list">
                        <div class="tip-chat-empty">正在加载...</div>
                    </div>
                    <div class="tip-chat-composer">
                        <div class="tip-chat-composer-row">
                            <textarea id="tip-chat-composer-input" maxlength="${TIP_CHAT_MAX_MESSAGE_LENGTH}"></textarea>
                            <button class="tip-chat-send-btn" id="tip-chat-send-btn" type="button">发送</button>
                        </div>
                    </div>
                </section>
            </div>
        `;
        document.body.appendChild(panel);

        tipChatState.elements = {
            launcher,
            launcherIndicator: indicator,
            panel,
            conversationList: panel.querySelector('#tip-chat-conversation-list'),
            threadList: panel.querySelector('#tip-chat-thread-list'),
            threadTitle: panel.querySelector('#tip-chat-thread-title'),
            threadMeta: panel.querySelector('#tip-chat-thread-meta'),
            threadTipBtn: panel.querySelector('#tip-chat-tip-btn'),
            composerInput: panel.querySelector('#tip-chat-composer-input'),
            composerSendBtn: panel.querySelector('#tip-chat-send-btn'),
            pinBtn: panel.querySelector('.tip-chat-pin-btn'),
            refreshBtn: panel.querySelector('.tip-chat-refresh'),
            clearBtn: panel.querySelector('.tip-chat-clear'),
            closeBtn: panel.querySelector('.tip-chat-close')
        };

        launcher.addEventListener('click', () => toggleTipChatPanel());
        tipChatState.elements.closeBtn.addEventListener('click', () => toggleTipChatPanel(false));
        tipChatState.elements.refreshBtn.addEventListener('click', () => {
            refreshTipChatData({ forceFull: needsTipChatBootstrap(), repair: true });
        });
        if (tipChatState.elements.clearBtn) {
            tipChatState.elements.clearBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                if (confirm('清除本地缓存并重新同步？')) {
                    clearTipChatCache();
                }
            });
        }
        if (tipChatState.elements.pinBtn) {
            tipChatState.elements.pinBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                toggleTipChatPinned();
            });
        }
        if (tipChatState.elements.composerSendBtn) {
            tipChatState.elements.composerSendBtn.addEventListener('click', handleTipChatComposerSend);
        }
        if (tipChatState.elements.composerInput) {
            tipChatState.elements.composerInput.addEventListener('keydown', (event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    handleTipChatComposerSend();
                }
            });
        }
        if (tipChatState.elements.threadTipBtn) {
            tipChatState.elements.threadTipBtn.hidden = true;
            tipChatState.elements.threadTipBtn.addEventListener('click', handleTipChatThreadTip);
        }
        tipChatState.elements.threadList.addEventListener('scroll', handleTipChatScroll);
        updateTipChatPinUI();
        const handleGlobalClick = (event) => {
            if (!isTipChatPanelOpen()) return;
            const panelEl = tipChatState.elements.panel;
            const launcherEl = tipChatState.elements.launcher;
            const actionsMenuEl = tipChatState.messageActionsMenu;
            const path = typeof event.composedPath === 'function' ? event.composedPath() : null;
            const isInsidePanel = panelEl ? path ? path.includes(panelEl) : panelEl.contains(event.target) : false;
            const isLauncher = launcherEl ? path ? path.includes(launcherEl) : launcherEl.contains(event.target) : false;
            const isInsideActionsMenu = actionsMenuEl ? path ? path.includes(actionsMenuEl) : actionsMenuEl.contains(event.target) : false;
            if (!isInsidePanel && !isLauncher && !isInsideActionsMenu) {
                if (tipChatState.pinned) return;
                toggleTipChatPanel(false);
            }
        };
        tipChatState.elements.handleGlobalClick = handleGlobalClick;
        document.addEventListener('click', handleGlobalClick);
        updateTipComposerState({ preserveStatus: false });
    }

    function updateLauncherBadge(hasNew) {
        const indicator = tipChatState.elements.launcherIndicator;
        if (!indicator) return;
        indicator.hidden = !hasNew;
    }

    function isTipChatPanelOpen() {
        return Boolean(tipChatState.elements.panel?.classList.contains('open'));
    }

    function toggleTipChatPanel(force) {
        const panel = tipChatState.elements.panel;
        if (!panel) return;
        const shouldOpen = typeof force === 'boolean' ? force : !panel.classList.contains('open');
        panel.classList.toggle('open', shouldOpen);
        if (shouldOpen) {
            const hadUnreadIndicator = Boolean(tipChatState.elements.launcherIndicator && !tipChatState.elements.launcherIndicator.hidden);
            syncTipChatStateFromStorage();
            if (shouldReloadAfterUnreadOpen(hadUnreadIndicator)) {
                setTimeout(() => window.location.reload(), 250);
                return;
            }
            markTipChatSeen();
            tipChatState.userScrolledUp = false;
            renderTipConversationList();
            renderTipThread();
            maybeRefreshTipChatOnOpen();
        }
    }

    function shouldReloadAfterUnreadOpen(hadUnreadIndicator) {
        if (!hadUnreadIndicator) return false;
        const summaries = Array.isArray(tipChatState.summaries) ? tipChatState.summaries : [];
        return summaries.length === 0;
    }

    function toggleTipChatPinned(force) {
        const next = typeof force === 'boolean' ? force : !tipChatState.pinned;
        tipChatState.pinned = next;
        updateTipChatPinUI();
    }

    function updateTipChatPinUI() {
        const pinned = Boolean(tipChatState.pinned);
        const pinBtn = tipChatState.elements.pinBtn;
        const panel = tipChatState.elements.panel;
        if (pinBtn) {
            pinBtn.classList.toggle('pinned', pinned);
            pinBtn.textContent = pinned ? 'UNPIN' : 'PIN';
            pinBtn.title = pinned ? '已固定，点击取消' : '固定面板';
        }
        if (panel) {
            panel.classList.toggle('pinned', pinned);
        }
    }

    function maybeRefreshTipChatOnOpen() {
        const hasConversations = tipChatState.conversationMap?.size > 0;
        const meta = loadTipChatMeta();
        const hasUnreadMeta = Boolean(meta.latestId && meta.lastSeenId !== meta.latestId);
        if (!hasConversations) {
            refreshTipChatData({ forceFull: true });
            return;
        }
        if (hasUnreadMeta) {
            refreshTipChatData({ forceFull: false });
        }
    }

    function markTipChatSeen() {
        const meta = loadTipChatMeta();
        if (!meta.latestId) return;
        meta.lastSeenId = meta.latestId;
        meta.updatedAt = Date.now();
        saveTipChatMeta(meta);
        updateLauncherBadge(false);
    }

    function needsTipChatBootstrap() {
        if (!tipChatState.records || !tipChatState.records.length) return true;
        const meta = loadTipChatMeta();
        return !meta.latestId;
    }
 
    function createTipChatBootstrapCallout({ className = 'tip-chat-conversation-empty', message } = {}) {
        const wrapper = document.createElement('div');
        wrapper.className = className;
        const text = document.createElement('div');
        text.textContent = message || '首次使用需要同步全部打赏记录，点击下方按钮即可开始。';
        wrapper.appendChild(text);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tip-chat-cta-btn';
        if (tipChatState.refreshing) {
            btn.disabled = true;
            btn.textContent = '同步中...';
        } else {
            btn.textContent = '立即同步';
        }
        btn.addEventListener('click', () => triggerTipChatBootstrap(btn));
        wrapper.appendChild(btn);
        return wrapper;
    }
 
    function triggerTipChatBootstrap(button) {
        if (tipChatState.refreshing) return tipChatState.refreshing;
        const shouldReloadAfter = needsTipChatBootstrap();
        if (button) {
            button.disabled = true;
            button.textContent = '同步中...';
        }
        const promise = refreshTipChatData({ forceFull: true }).then(() => {
            tipChatState.summaries = getConversationSummaries();
            renderTipConversationList();
            renderTipThread();
            if (shouldReloadAfter && !needsTipChatBootstrap()) {
                setTimeout(() => window.location.reload(), 500);
            }
        }).finally(() => {
            if (button) {
                button.disabled = false;
                button.textContent = '重新同步';
            }
        });
        return promise;
    }
 
    function renderTipConversationList() {
        const container = tipChatState.elements.conversationList;
        if (!container) return;
        container.innerHTML = '';
        if (!tipChatState.summaries.length) {
            if (needsTipChatBootstrap()) {
                container.appendChild(createTipChatBootstrapCallout());
                if (tipChatState.elements.threadList) {
                    const callout = createTipChatBootstrapCallout({
                        className: 'tip-chat-empty',
                        message: '尚未同步打赏记录，点击下方按钮开始全量获取。'
                    });
                    tipChatState.elements.threadList.innerHTML = '';
                    tipChatState.elements.threadList.appendChild(callout);
                }
            } else {
                const empty = document.createElement('div');
                empty.className = 'tip-chat-conversation-empty';
                empty.textContent = '暂无与您相关的打赏消息';
                container.appendChild(empty);
                if (tipChatState.elements.threadList) {
                    tipChatState.elements.threadList.innerHTML = '<div class="tip-chat-empty">暂无消息</div>';
                }
            }
            return;
        }
        ensureActiveTipPeer();
        tipChatState.summaries.forEach((summary) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'tip-chat-conversation-item';
            if (summary.peer === tipChatState.activePeer) {
                item.classList.add('active');
            }
            const avatarWrap = document.createElement('div');
            avatarWrap.className = 'tip-chat-avatar';
            if (summary.avatar) {
                const img = document.createElement('img');
                img.src = summary.avatar;
                img.alt = summary.peer;
                avatarWrap.appendChild(img);
            } else {
                avatarWrap.textContent = (summary.peer || '?').slice(0, 1).toUpperCase();
            }
            const metaWrap = document.createElement('div');
            metaWrap.className = 'tip-chat-conversation-meta';
            const header = document.createElement('header');
            const nameSpan = document.createElement('span');
            nameSpan.textContent = `@${summary.peer}`;
            const timeSpan = document.createElement('span');
            timeSpan.textContent = summary.lastTimestamp ? formatAbsoluteTime(summary.lastTimestamp) : '';
            header.appendChild(nameSpan);
            header.appendChild(timeSpan);
            const preview = document.createElement('div');
            preview.className = 'tip-chat-conversation-preview';
            preview.textContent = summary.lastMessage || '';
            metaWrap.appendChild(header);
            metaWrap.appendChild(preview);
            item.appendChild(avatarWrap);
            item.appendChild(metaWrap);
            item.addEventListener('click', () => setActiveTipConversation(summary.peer));
            container.appendChild(item);
        });
    }

    function ensureActiveTipPeer() {
        if (!tipChatState.summaries.length) return;
        const current = tipChatState.activePeer;
        if (current && tipChatState.conversationMap.has(current)) return;
        const fallback = tipChatState.summaries.find(summary => tipChatState.conversationMap.has(summary.peer))
            || tipChatState.summaries[0];
        tipChatState.activePeer = fallback?.peer || null;
    }

    function getVisibleCount(peer, total) {
        if (!peer) return 0;
        const stored = tipChatState.visibleCountMap.get(peer);
        const fallback = Math.min(TIP_CHAT_INITIAL_LOAD, total);
        return Math.min(total, stored || fallback || 0);
    }

    function setVisibleCount(peer, count) {
        if (!peer) return;
        tipChatState.visibleCountMap.set(peer, count);
    }

    function renderTipThread(options = {}) {
        const container = tipChatState.elements.threadList;
        const titleEl = tipChatState.elements.threadTitle;
        const metaEl = tipChatState.elements.threadMeta;
        const tipBtn = tipChatState.elements.threadTipBtn;
        updateTipComposerState();
        if (!container) return;
        const peer = tipChatState.activePeer;
        const hasPeerThread = Boolean(peer && tipChatState.conversationMap.has(peer));
        if (tipBtn) {
            tipBtn.classList.remove('loading');
            tipBtn.textContent = '赏';
            tipBtn.disabled = !hasPeerThread;
            tipBtn.hidden = !hasPeerThread;
            tipBtn.title = hasPeerThread ? `打赏 @${peer}` : '选择会话后可打赏';
        }
        if (!hasPeerThread) {
            const prevPeer = peer;
            ensureActiveTipPeer();
            if (tipChatState.activePeer && tipChatState.activePeer !== prevPeer && tipChatState.conversationMap.has(tipChatState.activePeer)) {
                renderTipThread(options);
                return;
            }
            container.innerHTML = '';
            if (!tipChatState.summaries.length && needsTipChatBootstrap()) {
                container.appendChild(createTipChatBootstrapCallout({
                    className: 'tip-chat-empty',
                    message: '首次使用需要同步全部打赏记录，点击按钮立即同步。'
                }));
                if (metaEl) metaEl.textContent = '尚无记录';
                if (titleEl) titleEl.textContent = '打赏会话';
            } else if (!tipChatState.summaries.length) {
                container.innerHTML = '<div class="tip-chat-empty">暂无消息</div>';
                if (metaEl) metaEl.textContent = '尚无记录';
                if (titleEl) titleEl.textContent = '打赏会话';
            } else {
                container.innerHTML = '<div class="tip-chat-empty">选择会话以查看消息</div>';
                if (titleEl) titleEl.textContent = '选择会话';
                if (metaEl) metaEl.textContent = '最近 30 条消息';
            }
            updateTipComposerState({ preserveStatus: false });
            return;
        }
        if (titleEl) titleEl.textContent = `@${peer}`;
        const records = tipChatState.conversationMap.get(peer) || [];
        const total = records.length;
        const visibleCount = getVisibleCount(peer, total);
        if (metaEl) metaEl.textContent = `共 ${total} 条 · 正在显示最近 ${visibleCount} 条`;
        const startIndex = Math.max(0, total - visibleCount);
        const fragment = document.createDocumentFragment();
        if (startIndex > 0) {
            const hint = document.createElement('div');
            hint.className = 'tip-chat-thread-hint';
            hint.textContent = '上拉加载更多历史';
            fragment.appendChild(hint);
        }
        const me = resolveTipChatCurrentUser();
        for (let i = startIndex; i < total; i++) {
            const record = records[i];
            const row = document.createElement('div');
            const outgoing = record.from === me;
            row.className = `tip-chat-message ${outgoing ? 'outgoing' : 'incoming'}`;
            if (record.id) {
                const quoteId = normalizeQuoteId(record.id) || record.id;
                row.id = `tip-chat-msg-${quoteId}`;
                row.dataset.recordId = record.id;
                row.dataset.quoteId = quoteId;
            }

            const avatarOwner = outgoing ? me : (record.from || peer);
            const avatarUrl = record.fromAvatar || resolveAvatarForUser(avatarOwner, tipChatState.records);
            const avatarWrap = document.createElement('div');
            avatarWrap.className = 'tip-chat-message-avatar';
            if (avatarUrl) {
                const img = document.createElement('img');
                img.src = avatarUrl;
                img.alt = avatarOwner || '';
                avatarWrap.appendChild(img);
            } else {
                avatarWrap.textContent = (avatarOwner || '?').slice(0, 1).toUpperCase();
            }

            const contentWrap = document.createElement('div');
            contentWrap.className = 'tip-chat-message-content';
            const meta = document.createElement('div');
            meta.className = 'tip-chat-message-meta';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = outgoing ? '我' : `@${record.from || peer || '?'}`;
            const timeSpan = document.createElement('span');
            timeSpan.textContent = formatAbsoluteTime(record.timestamp);
            meta.appendChild(nameSpan);
            meta.appendChild(timeSpan);

            const bubble = document.createElement('div');
            bubble.className = 'tip-chat-message-bubble';
            bubble.innerHTML = getRecordMessageHtml(record);

            // 长按显示操作菜单，保留普通点击用于打开链接
            bindMessageBubbleActions(bubble, record, peer);

            // 引用块点击跳转
            bubble.querySelectorAll('.tip-chat-message-quote').forEach((quoteEl) => {
                const targetId = quoteEl.getAttribute('data-quote-target');
                if (!targetId) return;
                quoteEl.style.cursor = 'pointer';
                quoteEl.addEventListener('click', (evt) => {
                    evt.stopPropagation();
                    jumpToQuotedMessage(targetId);
                });
            });

            contentWrap.appendChild(meta);
            contentWrap.appendChild(bubble);
            row.appendChild(avatarWrap);
            row.appendChild(contentWrap);
            fragment.appendChild(row);
        }
        const previousHeight = options.previousHeight || container.scrollHeight;
        container.innerHTML = '';
        container.appendChild(fragment);
        if (options.preserveScroll) {
            const diff = container.scrollHeight - previousHeight;
            container.scrollTop = diff > 0 ? diff : 0;
        } else if (!tipChatState.userScrolledUp) {
            container.scrollTop = container.scrollHeight;
        }
    }

    function getLatestTipChatMessageText(peer) {
        const list = tipChatState.conversationMap.get(peer) || [];
        for (let i = list.length - 1; i >= 0; i--) {
            const text = getRecordMemoText(list[i]) || formatMessageBody(list[i]) || '';
            if (text) return text;
        }
        return '';
    }

    async function handleTipChatThreadTip() {
        const btn = tipChatState.elements.threadTipBtn;
        const peer = tipChatState.activePeer;
        if (!btn || !peer || !tipChatState.conversationMap.has(peer)) return;
        const previousLabel = btn.textContent;
        btn.classList.add('loading');
        btn.disabled = true;
        btn.textContent = '...';
        try {
            const address = await getUserAddress(peer);
            if (!address) {
                alert(`用户 ${peer} 还未绑定 Solana 地址，无法接收打赏。\n\n请提醒 TA 在 V2EX 设置中绑定 Solana 地址。`);
                return;
            }
            const latestMessage = getLatestTipChatMessageText(peer);
            const postscript = buildTipChatPostscript(latestMessage);
            await showTipModal(peer, address, null, '来自聊天面板的打赏', null, {
                tipType: 'tip-chat',
                defaultPostscript: postscript,
                tipChatMemo: latestMessage
            });
        } catch (err) {
            console.error('打开打赏弹窗失败', err);
            alert(err.message || '获取用户信息失败，请稍后重试');
        } finally {
            btn.classList.remove('loading');
            btn.disabled = false;
            btn.textContent = previousLabel || '赏';
        }
    }

    function jumpToQuotedMessage(targetId) {
        if (!targetId) return;
        const container = tipChatState.elements.threadList;
        if (!container) return;
        const shortId = normalizeQuoteId(targetId);
        let targetEl = container.querySelector(`#tip-chat-msg-${escapeCssSelector(targetId)}`);
        if (!targetEl && shortId && shortId !== targetId) {
            targetEl = container.querySelector(`#tip-chat-msg-${escapeCssSelector(shortId)}`);
        }
        if (!targetEl) return;
        const desiredOffset = targetEl.offsetTop - 72;
        container.scrollTop = desiredOffset < 0 ? 0 : desiredOffset;
        targetEl.classList.add('tip-chat-highlight');
        setTimeout(() => {
            targetEl.classList.remove('tip-chat-highlight');
        }, 1500);
    }

    // 创建消息操作菜单
    function createMessageActionsMenu() {
        if (tipChatState.messageActionsMenu) {
            return tipChatState.messageActionsMenu;
        }
        
        const menu = document.createElement('div');
        menu.className = 'tip-chat-message-actions';
        menu.style.display = 'none';
        
        const tipAction = document.createElement('button');
        tipAction.className = 'tip-chat-message-action-item';
        tipAction.innerHTML = '<span>赞赏</span>';
        
        const quoteAction = document.createElement('button');
        quoteAction.className = 'tip-chat-message-action-item';
        quoteAction.innerHTML = '<span>引用</span>';
        
        menu.appendChild(tipAction);
        menu.appendChild(quoteAction);
        document.body.appendChild(menu);
        
        // 点击外部关闭菜单
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && !e.target.closest('.tip-chat-message-bubble')) {
                menu.style.display = 'none';
            }
        });
        
        tipChatState.messageActionsMenu = menu;
        return menu;
    }

    // 显示消息操作菜单
    function showMessageActionsMenu(e, record, peerUsername) {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
        }
        
        const menu = createMessageActionsMenu();
        const anchorEl = (e && (e.target || e.currentTarget)) || null;
        const rect = anchorEl && anchorEl.getBoundingClientRect ? anchorEl.getBoundingClientRect() : null;
        const fallbackLeft = (e && typeof e.clientX === 'number') ? e.clientX : 0;
        const fallbackTop = (e && typeof e.clientY === 'number') ? e.clientY : 0;
        
        // 定位菜单
        menu.style.left = `${rect ? rect.left : fallbackLeft}px`;
        menu.style.top = `${rect ? rect.bottom + 5 : fallbackTop + 5}px`;
        menu.style.display = 'block';
        
        // 检查是否超出屏幕
        setTimeout(() => {
            const menuRect = menu.getBoundingClientRect();
            const anchorRect = rect || {
                left: fallbackLeft,
                right: fallbackLeft,
                top: fallbackTop,
                bottom: fallbackTop
            };
            if (menuRect.right > window.innerWidth) {
                menu.style.left = `${anchorRect.right - menuRect.width}px`;
            }
            if (menuRect.bottom > window.innerHeight) {
                menu.style.top = `${anchorRect.top - menuRect.height - 5}px`;
            }
        }, 0);
        
        // 绑定事件
        const tipBtn = menu.querySelector('.tip-chat-message-action-item:nth-child(1)');
        const quoteBtn = menu.querySelector('.tip-chat-message-action-item:nth-child(2)');
        
        // 移除旧的事件监听器
        const newTipBtn = tipBtn.cloneNode(true);
        const newQuoteBtn = quoteBtn.cloneNode(true);
        tipBtn.parentNode.replaceChild(newTipBtn, tipBtn);
        quoteBtn.parentNode.replaceChild(newQuoteBtn, quoteBtn);
        
        // 赞赏功能
        newTipBtn.onclick = async () => {
            const isOutgoing = record.from === tipChatState.currentUser;
            const targetUser = isOutgoing ? record.to : record.from;
            
            try {
                const address = await getUserAddress(targetUser);
                if (!address) {
                    alert(`用户 ${targetUser} 还未绑定 Solana 地址，无法接收打赏。\n\n请提醒 TA 在 V2EX 设置中绑定 Solana 地址。`);
                    return;
                }
                
                const messageText = getRecordMemoText(record) || formatMessageBody(record) || '';
                const postscript = buildTipChatPostscript(messageText);
                await showTipModal(targetUser, address, null, null, null, {
                    tipType: 'tip-chat',
                    defaultPostscript: postscript,
                    tipChatMemo: messageText
                });
            } catch (err) {
                console.error('打赏失败:', err);
                alert(`打赏失败: ${(err.message || '未知错误')}\n建议完全退出 Chrome 并重新打开后再试。`);
            }
        };
        
        // 引用功能
        newQuoteBtn.onclick = () => {
            const composer = tipChatState.elements.composerInput;
            if (!composer) return;
            
            const messageText = getRecordMemoText(record) || formatMessageBody(record) || '';
            const quoteId = normalizeQuoteId(record.id) || '';
            
            const prefix = quoteId ? `[quote:${quoteId}]` : '';
            if (!prefix) {
                updateTipComposerState({ message: '未找到引用消息 ID，无法引用', preserveStatus: true });
                return;
            }
            const currentText = composer.value.trim();
            const suffix = currentText ? `\n${currentText}\n` : '\n';
            const composed = `${prefix}\n------${suffix}`;
            if (composed.length > TIP_CHAT_MAX_MESSAGE_LENGTH) {
                updateTipComposerState({ message: `引用后内容超出 ${TIP_CHAT_MAX_MESSAGE_LENGTH} 字符限制`, preserveStatus: true });
                return;
            }
            tipChatState.quotedMessage = {
                text: messageText,
                from: record.from,
                timestamp: record.created,
                id: quoteId
            };
            composer.value = composed;

            // 提升输入框高度以容纳引用
            const desiredHeight = 96;
            const currentHeight = parseInt(window.getComputedStyle(composer).height, 10) || 0;
            if (currentHeight < desiredHeight) {
                composer.style.minHeight = `${desiredHeight}px`;
                composer.style.height = `${desiredHeight}px`;
            }

            composer.focus();
            // 将光标移到最后一行，便于继续输入
            const caretPos = composer.value.length;
            composer.setSelectionRange(caretPos, caretPos);
        };
    }

    function bindMessageBubbleActions(bubble, record, peerUsername) {
        if (!bubble) return;
        let pressTimer = null;
        let pressTriggered = false;
        let startX = 0;
        let startY = 0;

        const clearPressTimer = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        const cancelPress = (evt) => {
            const wasTriggered = pressTriggered;
            clearPressTimer();
            pressTriggered = false;
            if (wasTriggered && evt) {
                evt.preventDefault();
                evt.stopPropagation();
            }
        };

        bubble.addEventListener('pointerdown', (evt) => {
            if (evt.pointerType === 'mouse' && evt.button !== 0) return;
            startX = evt.clientX;
            startY = evt.clientY;
            pressTriggered = false;
            clearPressTimer();
            pressTimer = setTimeout(() => {
                pressTimer = null;
                pressTriggered = true;
                const syntheticEvent = {
                    target: evt.target || bubble,
                    currentTarget: bubble,
                    clientX: evt.clientX,
                    clientY: evt.clientY,
                    preventDefault: () => {},
                    stopPropagation: () => {}
                };
                showMessageActionsMenu(syntheticEvent, record, peerUsername);
            }, TIP_CHAT_LONG_PRESS_DELAY);
        });

        bubble.addEventListener('pointermove', (evt) => {
            if (!pressTimer) return;
            if (Math.abs(evt.clientX - startX) > TIP_CHAT_LONG_PRESS_MOVE_THRESHOLD || Math.abs(evt.clientY - startY) > TIP_CHAT_LONG_PRESS_MOVE_THRESHOLD) {
                clearPressTimer();
                pressTriggered = false;
            }
        });

        bubble.addEventListener('pointerup', cancelPress, true);
        bubble.addEventListener('pointercancel', cancelPress);
        bubble.addEventListener('pointerleave', () => {
            if (pressTimer) {
                clearPressTimer();
                pressTriggered = false;
            }
        });
        bubble.addEventListener('dragstart', clearPressTimer);
    }

    function updateTipComposerState({ message, preserveStatus = true } = {}) {
        const input = tipChatState.elements.composerInput;
        const sendBtn = tipChatState.elements.composerSendBtn;
        const hasPeer = Boolean(tipChatState.activePeer);
        if (input) {
            input.disabled = !hasPeer || tipChatState.composerSending;
            input.placeholder = hasPeer ? `对 @${tipChatState.activePeer} 说点什么...` : '';
        }
        if (sendBtn) {
            if (tipChatState.composerSending) {
                sendBtn.disabled = true;
                sendBtn.textContent = '发送中...';
            } else {
                sendBtn.disabled = !hasPeer;
                sendBtn.textContent = '发送';
            }
        }
    }

    async function handleTipChatComposerSend() {
        const input = tipChatState.elements.composerInput;
        if (!input) return;
        const peer = tipChatState.activePeer;
        if (!peer) {
            updateTipComposerState({ message: '请选择会话以发送私信', preserveStatus: false });
            return;
        }
        let text = (input.value || '').trim();
        if (!text || text.length < 3) {
            updateTipComposerState({ message: '请至少输入 3 个字符', preserveStatus: true });
            return;
        }
        if (text.length > TIP_CHAT_MAX_MESSAGE_LENGTH) {
            updateTipComposerState({ message: '消息需少于 150 个字符', preserveStatus: true });
            return;
        }
        const parsedQuote = parseQuotedMessage(text);
        if (parsedQuote.quoteId) {
            const sanitizedMain = parsedQuote.mainText ? `\n${parsedQuote.mainText}` : '';
            text = `[quote:${parsedQuote.quoteId}]\n------${sanitizedMain}`.trim();
        }
        if (text.length > TIP_CHAT_MAX_MESSAGE_LENGTH) {
            updateTipComposerState({ message: '消息需少于 150 个字符', preserveStatus: true });
            return;
        }
        const me = resolveTipChatCurrentUser();
        if (!me) {
            updateTipComposerState({ message: '未获取到当前用户，请刷新页面后重试', preserveStatus: false });
            return;
        }
        tipChatState.composerSending = true;
        updateTipComposerState({ message: '准备钱包...', preserveStatus: true });
        try {
            const address = await getUserAddress(peer);
            if (!address) {
                throw new Error('对方未绑定地址，无法发送');
            }
            const { signature, memo } = await sendDmMessage({
                username: peer,
                address,
                text,
                onStatus: (msg) => updateTipComposerState({ message: msg, preserveStatus: true })
            });
            input.value = '';
            const meAvatar = resolveAvatarForUser(me, tipChatState.records) || findInlineAvatarForUsername(me) || null;
            if (meAvatar) {
                memberAvatarCache.set(me, meAvatar);
            }
            appendLocalTipChatRecord({
                id: signature || `local-${Date.now()}`,
                signature,
                from: me,
                to: peer,
                memo,
                token: 'v2ex',
                amount: MESSAGE_COST,
                timestamp: Date.now(),
                fromAvatar: meAvatar
            });
            updateTipComposerState({ message: '私信已发送并记录', preserveStatus: true });
        } catch (err) {
            console.error('私信发送失败', err);
            updateTipComposerState({ message: err.message || '发送失败', preserveStatus: true });
        } finally {
            tipChatState.composerSending = false;
            updateTipComposerState();
        }
    }

    function appendLocalTipChatRecord(record) {
        if (!record) return;
        const normalized = { ...record };
        if (!normalized.id) {
            normalized.id = `local-${Date.now()}`;
        }
        if (!normalized.timestamp) {
            normalized.timestamp = Date.now();
        }
        if (normalized.memo && !normalized.memoHtml) {
            normalized.memoHtml = escapeHtmlText(normalized.memo);
        }
        const nextRecords = Array.isArray(tipChatState.records) ? [...tipChatState.records, normalized] : [normalized];
        const trimmed = trimTipRecords(nextRecords);
        tipChatState.records = trimmed;
        saveTipChatRecords(trimmed);
        rebuildTipConversationMap();
        tipChatState.summaries = getConversationSummaries();
        const meta = loadTipChatMeta();
        const nextMeta = {
            latestId: normalized.id || meta.latestId || null,
            lastSeenId: normalized.id || meta.lastSeenId || null,
            updatedAt: Date.now()
        };
        saveTipChatMeta(nextMeta);
        updateLauncherBadge(false);
        renderTipConversationList();
        renderTipThread();
    }

    function setActiveTipConversation(peer) {
        if (!peer) return;
        tipChatState.activePeer = peer;
        if (!tipChatState.visibleCountMap.has(peer)) {
            const total = tipChatState.conversationMap.get(peer)?.length || 0;
            tipChatState.visibleCountMap.set(peer, Math.min(TIP_CHAT_INITIAL_LOAD, total));
        }
        ensureAvatarForPeer(peer);
        tipChatState.userScrolledUp = false;
        renderTipConversationList();
        renderTipThread();
    }

    function handleTipChatScroll() {
        const container = tipChatState.elements.threadList;
        if (!container || !tipChatState.activePeer) return;
        if (container.scrollTop <= 12) {
            const records = tipChatState.conversationMap.get(tipChatState.activePeer) || [];
            const currentCount = getVisibleCount(tipChatState.activePeer, records.length);
            if (records.length > currentCount) {
                const previousHeight = container.scrollHeight;
                const nextCount = Math.min(records.length, currentCount + TIP_CHAT_LOAD_STEP);
                setVisibleCount(tipChatState.activePeer, nextCount);
                renderTipThread({ preserveScroll: true, previousHeight });
            }
        }
        tipChatState.userScrolledUp = container.scrollTop + container.clientHeight < container.scrollHeight - 40;
    }

    function updateRefreshUI(isLoading) {
        const btn = tipChatState.elements.refreshBtn;
        if (!btn) return;
        btn.classList.toggle('loading', Boolean(isLoading));
        btn.disabled = Boolean(isLoading);
        btn.textContent = isLoading ? '…' : '⟳';
    }

    function scheduleTipChatRefresh() {
        if (tipChatState.refreshTimer) {
            clearInterval(tipChatState.refreshTimer);
        }
        tipChatState.refreshTimer = setInterval(() => {
            refreshTipChatData({ forceFull: false });
        }, TIP_CHAT_REFRESH_INTERVAL);
    }

    async function refreshTipChatData({ forceFull = false, repair = false } = {}) {
        // 在拉取远端数据前先尝试从本地存储同步，避免因跨标签页写入导致的缺失
        syncTipChatStateFromStorage();
        if (!forceFull && needsTipChatBootstrap()) {
            return;
        }
        if (tipChatState.refreshing) return tipChatState.refreshing;
        const meta = loadTipChatMeta();
        let stopId = forceFull ? null : meta.latestId;
        let maxPages = stopId ? TIP_CHAT_INCREMENTAL_PAGES : TIP_CHAT_MAX_BOOTSTRAP_PAGES;
        if (repair && !forceFull) {
            stopId = null;
            maxPages = Math.min(TIP_CHAT_REPAIR_PAGES, TIP_CHAT_MAX_BOOTSTRAP_PAGES);
        }
        updateRefreshUI(true);
        const refreshPromise = (async () => {
            const freshRecords = await fetchTipRecords({ stopId, maxPages });
            if (!freshRecords.length) {
                return;
            }
            const merged = mergeTipRecords(tipChatState.records, freshRecords);
            const trimmed = trimTipRecords(merged);
            tipChatState.records = trimmed;
            saveTipChatRecords(trimmed);
            rebuildTipConversationMap();
            tipChatState.summaries = getConversationSummaries();
            const newest = trimmed[trimmed.length - 1];
            const nextMeta = {
                latestId: newest?.id || meta.latestId || null,
                lastSeenId: isTipChatPanelOpen() ? newest?.id || null : meta.lastSeenId || null,
                updatedAt: Date.now()
            };
            saveTipChatMeta(nextMeta);
            updateLauncherBadge(Boolean(nextMeta.latestId && nextMeta.lastSeenId !== nextMeta.latestId));
            renderTipConversationList();
            renderTipThread();
        })().catch((err) => {
            console.warn('刷新打赏记录失败', err);
        }).finally(() => {
            tipChatState.refreshing = null;
            updateRefreshUI(false);
        });
        tipChatState.refreshing = refreshPromise;
        return refreshPromise;
    }

    function extractMaxPageNumber(doc) {
        if (!doc) return null;
        const input = doc.querySelector('.page_input');
        if (input) {
            const maxAttr = parseInt(input.getAttribute('max'), 10);
            if (!Number.isNaN(maxAttr)) {
                return maxAttr;
            }
        }
        let maxPage = null;
        doc.querySelectorAll('a.page_normal, a.page_current').forEach((link) => {
            const text = link.textContent?.trim();
            const num = parseInt(text, 10);
            if (!Number.isNaN(num)) {
                maxPage = maxPage === null ? num : Math.max(maxPage, num);
            }
        });
        return maxPage;
    }

    async function fetchTipRecords({ stopId, maxPages }) {
        const collected = [];
        let reachedStop = false;
        let dynamicMaxPages = maxPages;
        for (let page = 1; page <= dynamicMaxPages; page++) {
            const { records, hasMore, totalPages } = await fetchTipPage(page);
            if (typeof totalPages === 'number' && totalPages > 0) {
                dynamicMaxPages = Math.min(dynamicMaxPages, totalPages);
            }
            if (!records.length) break;
            for (const record of records) {
                if (stopId && record.id === stopId) {
                    reachedStop = true;
                    break;
                }
                collected.push(record);
                if (!stopId && collected.length >= TIP_CHAT_RECORD_LIMIT) {
                    break;
                }
            }
            if (reachedStop || !hasMore || (!stopId && collected.length >= TIP_CHAT_RECORD_LIMIT)) break;
        }
        return collected;
    }

    async function fetchTipPage(page = 1) {
        const params = new URLSearchParams();
        if (page > 1) {
            params.set('p', page);
        }
        params.set('view', 'all');
        const query = params.toString();
        const baseUrl = `${window.location.origin}/solana/tips`;
        const response = await gmFetch(query ? `${baseUrl}?${query}` : baseUrl);
        if (!response.ok) {
            throw new Error('获取打赏记录失败');
        }
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const records = parseTipRecordsFromDoc(doc);
        const totalPages = extractMaxPageNumber(doc);
        const hasMore = typeof totalPages === 'number' ? page < totalPages : records.length > 0;
        return { records, hasMore, totalPages };
    }

    function parseTipRecordsFromDoc(doc) {
        const results = [];
        if (!doc) return results;
        let me = resolveTipChatCurrentUser();
        if (!me) {
            me = getUsernameFromDocument(doc);
            if (me) {
                saveTipChatSelf(me);
            }
        }
        const rows = doc.querySelectorAll('#Main .cell.flex-one-row');
        rows.forEach((row) => {
            const signatureLink = row.querySelector('a[href*="solscan.io/tx"]');
            if (!signatureLink) return;
            const id = extractSignatureId(signatureLink) || signatureLink.getAttribute('href') || signatureLink.href;
            if (!id) return;
            const textContainer = row.querySelector('div[style*="flex: 1"]') || row.querySelector('.flex-one-row > div:nth-child(2)') || row.children[1];
            if (!textContainer) return;
            const summaryText = (textContainer.textContent || '').trim();
            const memberLinks = Array.from(textContainer.querySelectorAll('a[href^="/member/"]'))
                .filter(link => !link.closest('.payload, .tip-memo, .memo, .item_content, .markdown_body, .message, .topic_content'));
            let counterpart = null;
            let counterpartLink = null;
            for (const link of memberLinks) {
                const username = normalizeUsernameFromHref(link?.getAttribute('href'));
                if (username && username !== me) {
                    counterpart = username;
                    counterpartLink = link;
                    break;
                }
            }
            if (!counterpart && memberLinks.length) {
                counterpartLink = memberLinks[0];
                counterpart = normalizeUsernameFromHref(counterpartLink?.getAttribute('href'));
            }
            if (!counterpart) return;
            const amountSpan = textContainer.querySelector('span[style*="var(--code-font)"]');
            let amount = amountSpan ? parseFloat(amountSpan.textContent.replace(/,/g, '')) : null;
            if (!Number.isFinite(amount)) {
                amount = null;
            }
            const tokenText = (amountSpan?.nextElementSibling?.textContent || '').trim();
            const token = /sol/i.test(tokenText) ? 'sol' : 'v2ex';
            const timeSpan = textContainer.querySelector('.small.fade');
            const timeLabel = timeSpan?.getAttribute('title')?.trim() || timeSpan?.textContent?.trim() || '';
            const timestamp = parseRelativeTimeLabel(timeLabel);
            const memoEl = row.querySelector('.payload, .tip-memo, .memo, .item_content, .markdown_body, .message, .topic_content');
            const { memoText: memo, memoHtml } = memoEl ? extractRichText(memoEl) : { memoText: '', memoHtml: '' };
            const avatarImg = counterpartLink?.querySelector('img.avatar') || row.querySelector('img.avatar');
            const avatarSrc = avatarImg?.src || null;
            let from = null;
            let to = null;
            let fromAvatar = null;
            let toAvatar = null;
            if (/收到来自/.test(summaryText)) {
                from = counterpart;
                to = me;
                fromAvatar = avatarSrc;
            } else if (/向\s+/.test(summaryText) && /发送了/.test(summaryText)) {
                from = me;
                to = counterpart;
                fromAvatar = avatarSrc;
            } else if (/收到/.test(summaryText) && !/发送/.test(summaryText)) {
                from = counterpart;
                to = me;
                fromAvatar = avatarSrc;
            } else {
                from = counterpart;
                to = me;
            }
            if (from && fromAvatar) {
                memberAvatarCache.set(from, fromAvatar);
            }
            if (to && toAvatar) {
                memberAvatarCache.set(to, toAvatar);
            }
            results.push({
                id,
                signature: signatureLink.getAttribute('href') || signatureLink.href,
                from,
                to,
                memo,
                memoHtml,
                amount,
                token,
                timestamp,
                timeLabel,
                fromAvatar,
                toAvatar
            });
        });
        return results;
    }

    function initTipChat() {
        if (tipChatInitialized) return;
        const currentUser = resolveTipChatCurrentUser();
        if (!currentUser) return;
        createTipChatUIIfNeeded();
        tipChatState.records = loadTipChatRecords();
        rebuildTipConversationMap();
        tipChatState.summaries = getConversationSummaries();
        tipChatInitialized = true;
        const meta = loadTipChatMeta();
        updateLauncherBadge(Boolean(meta.latestId && meta.lastSeenId !== meta.latestId));
        renderTipConversationList();
        renderTipThread();
        scheduleTipChatRefresh();
        if (meta.latestId) {
            refreshTipChatData({ forceFull: false }).catch(() => {});
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
                await ensureWalletConnection({ silent: true });
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
                    await ensureWalletConnection({ silent: true });
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

    // 初始化钱包检测，等待注入完成
    async function loadSolanaLib() {
        try {
            const module = await ensureWalletAdapterBaseModule();
            module.scopePollingDetectionStrategy(() => Boolean(
                PAGE_WINDOW.navigator?.wallets ||
                PAGE_WINDOW.solana ||
                PAGE_WINDOW.phantom?.solana ||
                PAGE_WINDOW.okxwallet ||
                PAGE_WINDOW.bitgetwallet
            ));
        } catch (err) {
            console.warn('钱包检测初始化失败:', err);
        }
    }

    // 初始化
    async function init() {
        await ensureSolanaLibraries();
        await loadSolanaLib();
        addTipButtons();
        addDmButtons();
        initQuickThank();
        initTipChat();
        scheduleScriptUpdateCheck();
        
        // 监听DOM变化（如果页面动态加载内容）
        const observer = new MutationObserver(() => {
            addTipButtons();
            addDmButtons();
            quickThankCheckAndInsert();
            initTipChat();
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
