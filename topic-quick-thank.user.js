// ==UserScript==
// @name         V2EX 快速感谢打赏者
// @namespace    https://github.com/HelloWorldImJoe/TampermonkeyScripts
// @version      0.1.0
// @description  在 V2EX 话题页面快速感谢打赏过你的用户：一键填充回复框并可自动提交（可选）。支持本地 `target/topic.html` 测试页面。
// @author       
// @match        https://www.v2ex.com/t/*
// @match        https://v2ex.com/t/*
// @include      http://*/*target/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    // 配置
    const AUTO_SUBMIT = false; // 默认不自动提交，避免误操作
    const TEMPLATE = (names) => `感谢 ${names.join(' ')} 的打赏！🎉\n`;

    function $(sel, ctx=document) { return ctx.querySelector(sel); }
    function $all(sel, ctx=document) { return Array.from(ctx.querySelectorAll(sel)); }

    function createButton(text) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'super normal button quick-thank-btn';
        btn.style.marginLeft = '8px';
        btn.textContent = text;
        return btn;
    }

    function findPatronage() {
        // 话题页面中打赏 box 的 patronage 区域
        const patronage = document.querySelector('#topic-tip-box .patronage');
        if (patronage) return patronage;
        // 备用：按 inner class 查找
        return document.querySelector('.patronage');
    }

    function getUsernamesFromPatronage(patronage) {
        if (!patronage) return [];
        // 链接一般是 /member/用户名
        const anchors = patronage.querySelectorAll('a[href^="/member/"]');
        const names = [];
        anchors.forEach(a => {
            const href = a.getAttribute('href');
            const m = href.match(/^\/member\/(.+)$/);
            if (m) names.push(m[1]);
        });
        return Array.from(new Set(names));
    }

    function findReplyBox() {
        // V2EX 页面中的回复 textarea id 可能为 reply_content
        const ta = document.getElementById('reply_content') || document.querySelector('textarea[name="content"]') || document.querySelector('textarea');
        return ta;
    }

    function fillReply(names) {
        const ta = findReplyBox();
        if (!ta) {
            alert('未找到回复框，请滚动到页面或在有回复权限的情况下使用此脚本。');
            return;
        }
        const content = TEMPLATE(names.map(n => `@${n}`));
        ta.focus();
        ta.value = content;
        // 触发输入事件，部分页面会监听以保存草稿
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function submitReply() {
        // 尝试找到提交按钮
        const submit = document.querySelector('form[action^="/t/"] button[type="submit"], form[action^="/t/"] input[type="submit"]');
        if (submit) {
            submit.click();
            return true;
        }
        // Fallback: 尝试提交第一个表单
        const form = document.querySelector('form[action^="/t/"]');
        if (form) { form.submit(); return true; }
        return false;
    }

    function insertControls() {
        const patronage = findPatronage();
        if (!patronage) return;

        // 容器放置在 patronage 旁边
        const container = document.createElement('div');
    container.className = 'quick-thank-controls';
    // 放在打赏框下面，显示为块级并增加上边距
    container.style.display = 'block';
    container.style.marginTop = '8px';
    container.style.marginLeft = '0';

        const allBtn = createButton('感谢所有打赏者');
        const autoToggle = createButton('开启自动提交');
        autoToggle.dataset.enabled = AUTO_SUBMIT ? '1' : '0';
        autoToggle.textContent = AUTO_SUBMIT ? '自动提交：已开' : '自动提交：已关';

        allBtn.addEventListener('click', () => {
            const names = getUsernamesFromPatronage(patronage);
            if (names.length === 0) { alert('未检测到任何打赏者用户名'); return; }
            fillReply(names);
            if (autoToggle.dataset.enabled === '1') {
                const ok = submitReply();
                if (!ok) alert('自动提交失败，请手动点击提交');
            }
        });

        autoToggle.addEventListener('click', () => {
            const en = autoToggle.dataset.enabled === '1';
            autoToggle.dataset.enabled = en ? '0' : '1';
            autoToggle.textContent = autoToggle.dataset.enabled === '1' ? '自动提交：已开' : '自动提交：已关';
        });

        container.appendChild(allBtn);
        container.appendChild(autoToggle);

        // 单独感谢：一个按钮，点击弹出选择对话框列出未感谢的用户
        const names = getUsernamesFromPatronage(patronage);
        const unthanked = names.filter(n => !hasBeenThanked(n));
        const singleThanksBtn = createButton('单独感谢');
        singleThanksBtn.style.marginLeft = '12px';
        singleThanksBtn.addEventListener('click', () => {
            openThanksDialog(unthanked, (selected) => {
                if (!selected || selected.length === 0) return;
                fillReply(selected);
                // 标记为已感谢
                selected.forEach(s => markAsThanked(s));
                // 如果自动提交开着，则提交
                if (autoToggle.dataset.enabled === '1') submitReply();
                // 移除已感谢的按钮/项（下次打开对话框会被过滤）
            });
        });
        container.appendChild(singleThanksBtn);

        // 优先将控件追加到 #topic-tip-box 底部（确保在打赏框下面），
        // 否则回退到插入到 patronage 的 nextSibling
        const tipBox = patronage.closest('#topic-tip-box') || patronage.closest('.box');
        if (tipBox) {
            tipBox.appendChild(container);
        } else {
            patronage.parentNode.insertBefore(container, patronage.nextSibling);
        }
    }

    function init() {
        console.debug('[quick-thank] init start', location.href);
        GM_addStyle(`
            .quick-thank-btn { cursor: pointer; }
            .quick-thank-modal { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); background: #222; color: #fff; padding: 12px; border-radius: 6px; z-index: 99999; min-width: 280px; }
            .quick-thank-modal input[type=checkbox] { margin-right: 6px; }
            .quick-thank-modal .actions { margin-top: 10px; text-align: right; }
        `);

        // DOM 可能异步加载，使用 MutationObserver
        const checkAndInsert = () => {
            const patronage = findPatronage();
            console.debug('[quick-thank] checkAndInsert: patronage?', !!patronage, 'reply?', !!findReplyBox());
            if (patronage && !document.querySelector('.quick-thank-controls')) {
                try { insertControls(); console.debug('[quick-thank] inserted controls'); } catch (e) { console.error('[quick-thank] insert failed', e); }
            }
        };

        checkAndInsert();

        const mo = new MutationObserver(() => checkAndInsert());
        mo.observe(document.body, { childList: true, subtree: true });

        // 注册菜单，用于显示/打开脚本安装说明
        if (GM_registerMenuCommand) {
            GM_registerMenuCommand('V2EX 快速感谢：说明', () => {
                alert('在话题页面会在打赏者列表处显示“感谢所有打赏者”按钮。点击会将 @用户名 列表填入回复框。\n自动提交有风险，默认关闭。');
            });
            GM_registerMenuCommand('清除已记录的已感谢用户', () => {
                if (confirm('确定清除已感谢记录？')) { clearThankedRecords(); alert('已清除'); }
            });
        }
    }

    // 已感谢记录管理（localStorage）
    const STORAGE_KEY = 'quick-thank-thanked-users-v1';
    function loadThanked() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY) || '[]';
            return JSON.parse(raw);
        } catch (e) { return []; }
    }
    function saveThanked(arr) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(new Set(arr)))); } catch (e) {}
    }
    function markAsThanked(name) {
        const cur = loadThanked();
        cur.push(name);
        saveThanked(cur);
    }
    function hasBeenThanked(name) {
        const cur = loadThanked();
        return cur.indexOf(name) !== -1;
    }
    function clearThankedRecords() { localStorage.removeItem(STORAGE_KEY); }

    // 弹窗：选择待感谢用户（简单实现）
    function openThanksDialog(names, callback) {
        // 过滤已感谢
        const toShow = (names || []).filter(n => !hasBeenThanked(n));
        if (toShow.length === 0) { alert('没有未感谢的用户'); return; }

        const modal = document.createElement('div');
        modal.className = 'quick-thank-modal';

        const title = document.createElement('div');
        title.textContent = '选择要单独感谢的用户：';
        modal.appendChild(title);

        const list = document.createElement('div');
        list.style.maxHeight = '240px';
        list.style.overflow = 'auto';
        list.style.marginTop = '8px';
        toShow.forEach(n => {
            const row = document.createElement('div');
            const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = n; cb.id = 'qt_cb_' + n;
            const lbl = document.createElement('label'); lbl.htmlFor = cb.id; lbl.textContent = n; lbl.style.marginLeft = '6px';
            row.appendChild(cb); row.appendChild(lbl);
            list.appendChild(row);
        });
        modal.appendChild(list);

        const actions = document.createElement('div'); actions.className = 'actions';
        const ok = document.createElement('button'); ok.textContent = '确认'; ok.className = 'super normal button';
        const cancel = document.createElement('button'); cancel.textContent = '取消'; cancel.className = 'super normal button';
        ok.style.marginRight = '8px';
        actions.appendChild(ok); actions.appendChild(cancel);
        modal.appendChild(actions);

        document.body.appendChild(modal);

        cancel.addEventListener('click', () => { modal.remove(); });
        ok.addEventListener('click', () => {
            const checked = Array.from(modal.querySelectorAll('input[type=checkbox]:checked')).map(i => i.value);
            modal.remove();
            callback(checked);
        });
    }

    // 仅在话题页面或本地测试页面运行
    function shouldRunOnHost(hostname) {
        if (!hostname) return false;
        if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
        if (hostname.endsWith('v2ex.com')) return true;
        return false;
    }

    if (shouldRunOnHost(location.hostname) || location.protocol === 'file:') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
        else init();
    }

})();
