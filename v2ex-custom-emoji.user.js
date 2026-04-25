// ==UserScript==
// @name         V2EX Custom Emoji
// @namespace    https://github.com/tampermonkey/tampermonkey
// @version      0.2.1
// @description  为 V2EX 回复输入框增加可配置的数据源自定义表情面板
// @author       JoeJoeJoe
// @homepage     https://github.com/HelloWorldImJoe/TampermonkeyScripts
// @supportURL   https://github.com/HelloWorldImJoe/TampermonkeyScripts/issues
// @match        https://www.v2ex.com/t/*
// @match        https://v2ex.com/t/*
// @match        https://*.v2ex.com/t/*
// @icon         https://www.v2ex.com/static/favicon.ico
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      *
// @license      MIT
// @created      2026-04-25
// @updated      2026-04-25
// ==/UserScript==

(function() {
	'use strict';

	const STORAGE_SOURCE_KEY = 'v2ex-custom-emoji-source-url';
	const STORAGE_SOURCES_KEY = 'v2ex-custom-emoji-sources';
	const STORAGE_ACTIVE_SOURCE_KEY = 'v2ex-custom-emoji-active-source';
	const STORAGE_CACHE_KEY = 'v2ex-custom-emoji-cache';
	const DEFAULT_SOURCE_URL = '{{Resource URL}}';
	const DEFAULT_SOURCE_ALIAS = '默认源';
	const DEFAULT_PAGE_SIZE = 20;
	const REQUEST_TIMEOUT = 15000;
	const SOURCE_ICON_TEXT_LIMIT = 2;
	const PANEL_VIEWPORT_MARGIN = 16;
	const PANEL_TRIGGER_GAP = 10;
	const PANEL_MIN_VISIBLE_HEIGHT = 220;

	const initialSources = loadSources();
	const initialActiveSourceId = resolveInitialActiveSourceId(initialSources);
	const initialActiveSource = initialSources.find((source) => source.id === initialActiveSourceId) || null;

	const state = {
		sources: initialSources,
		activeSourceId: initialActiveSourceId,
		sourceUrl: initialActiveSource ? initialActiveSource.url : '',
		emojiItems: [],
		pageSize: DEFAULT_PAGE_SIZE,
		currentPage: 1,
		totalPages: 1,
		version: '',
		loading: false,
		error: '',
		refreshPromise: null,
		loadedSourceUrl: '',
		editingSourceId: '',
		instances: new Set()
	};

	addStyle(`
		.v2ex-emoji-anchor {
			position: relative;
			display: inline-flex;
			align-items: center;
			margin-left: 10px;
		}

		.v2ex-emoji-trigger {
			appearance: none;
			border: 1px solid #d1d5db;
			background: linear-gradient(180deg, #ffffff 0%, #f3f4f6 100%);
			color: #374151;
			border-radius: 999px;
			padding: 5px 12px;
			font-size: 12px;
			line-height: 1;
			cursor: pointer;
			transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
		}

		.v2ex-emoji-trigger:hover {
			border-color: #60a5fa;
			box-shadow: 0 4px 12px rgba(37, 99, 235, 0.14);
			transform: translateY(-1px);
		}

		.v2ex-emoji-trigger.is-open {
			border-color: #2563eb;
			box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
		}

		.v2ex-emoji-panel {
			position: absolute;
			right: 0;
			top: calc(100% + 10px);
			bottom: auto;
			width: min(620px, calc(100vw - 24px));
			display: none;
			flex-direction: column;
			background: #151b2d;
			border: 1px solid rgba(86, 99, 132, 0.78);
			border-radius: 18px;
			box-shadow: 0 24px 56px rgba(3, 8, 20, 0.45);
			z-index: 9999;
			overflow: hidden;
			max-height: calc(100vh - 32px);
		}

		.v2ex-emoji-panel.is-open {
			display: flex;
		}

		.v2ex-emoji-panel.is-open-up {
			top: auto;
			bottom: calc(100% + 10px);
		}

		.v2ex-emoji-panel.is-open-down {
			top: calc(100% + 10px);
			bottom: auto;
		}

		.v2ex-emoji-panel-body {
			padding: 16px;
			flex: 1 1 auto;
			min-height: 0;
			display: flex;
			flex-direction: column;
			overflow-y: auto;
		}

		.v2ex-emoji-status {
			font-size: 12px;
			color: #a5b4d3;
		}

		.v2ex-emoji-footer-status {
			margin-left: auto;
			text-align: right;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			min-width: 0;
		}

		.v2ex-emoji-status.is-error {
			color: #dc2626;
		}

		.v2ex-emoji-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
			gap: 14px 12px;
			align-content: start;
			grid-auto-rows: max-content;
		}

		.v2ex-emoji-card {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: flex-start;
			gap: 6px;
			padding: 0;
			border: 0;
			background: transparent;
			cursor: pointer;
			transition: transform 0.2s ease, opacity 0.2s ease;
		}

		.v2ex-emoji-card:hover {
			transform: translateY(-2px);
		}

		.v2ex-emoji-card:hover .v2ex-emoji-thumb,
		.v2ex-emoji-card:focus-visible .v2ex-emoji-thumb {
			border-color: rgba(129, 161, 255, 0.95);
			box-shadow: 0 10px 24px rgba(35, 54, 116, 0.38);
		}

		.v2ex-emoji-thumb {
			position: relative;
			width: 100%;
			aspect-ratio: 1 / 1;
			border-radius: 8px;
			overflow: hidden;
			background: rgba(255, 255, 255, 0.04);
			border: 1px solid rgba(80, 96, 132, 0.45);
			transition: border-color 0.2s ease, box-shadow 0.2s ease;
		}

		.v2ex-emoji-thumb img {
			width: 100%;
			height: 100%;
			object-fit: cover;
			image-rendering: auto;
			display: block;
		}

		.v2ex-emoji-card-label {
			width: 100%;
			text-align: center;
			font-size: 11px;
			line-height: 1.25;
			color: #c8d1e5;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.v2ex-emoji-empty {
			grid-column: 1 / -1;
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 120px;
			border: 1px dashed rgba(95, 112, 146, 0.68);
			border-radius: 14px;
			color: #8da0c2;
			background: rgba(20, 28, 48, 0.72);
			text-align: center;
			padding: 0 16px;
			font-size: 13px;
		}

		.v2ex-emoji-panel-footer {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 12px;
			padding: 4px 16px 6px;
		}

		.v2ex-emoji-pager {
			display: inline-flex;
			align-items: center;
			gap: 8px;
		}

		.v2ex-emoji-page-indicator {
			min-width: 64px;
			text-align: center;
			font-size: 12px;
			color: #b3bfd7;
		}

		.v2ex-emoji-secondary,
		.v2ex-emoji-primary {
			appearance: none;
			border-radius: 10px;
			padding: 6px 10px;
			font-size: 12px;
			cursor: pointer;
			border: 1px solid rgba(82, 98, 133, 0.82);
			background: rgba(24, 33, 57, 0.96);
			color: #d8e0f0;
		}

		.v2ex-emoji-secondary:disabled,
		.v2ex-emoji-primary:disabled {
			cursor: not-allowed;
			opacity: 0.45;
		}

		.v2ex-emoji-primary {
			background: linear-gradient(180deg, #2563eb, #1d4ed8);
			color: #ffffff;
			border-color: #1d4ed8;
		}

		.v2ex-emoji-settings {
			display: none;
			margin: 0 16px 12px;
			padding: 14px;
			border-radius: 14px;
			border: 1px solid rgba(78, 96, 133, 0.75);
			background: rgba(18, 25, 43, 0.9);
		}

		.v2ex-emoji-settings.is-open {
			display: block;
		}

		.v2ex-emoji-settings-label {
			display: block;
			margin-bottom: 8px;
			font-size: 12px;
			font-weight: 700;
			color: #e2e8f0;
		}

		.v2ex-emoji-settings-field + .v2ex-emoji-settings-field {
			margin-top: 12px;
		}

		.v2ex-emoji-settings-input {
			width: 100%;
			box-sizing: border-box;
			padding: 9px 10px;
			border-radius: 10px;
			border: 1px solid rgba(82, 98, 133, 0.88);
			font-size: 12px;
			color: #e2e8f0;
			background: rgba(12, 18, 34, 0.98);
		}

		.v2ex-emoji-settings-hint {
			margin-top: 8px;
			font-size: 12px;
			color: #91a1c0;
			word-break: break-all;
		}

		.v2ex-emoji-source-list {
			display: flex;
			flex-direction: column;
			gap: 8px;
			margin-top: 12px;
			max-height: 170px;
			overflow-y: auto;
		}

		.v2ex-emoji-source-item {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 10px;
			padding: 10px 12px;
			border-radius: 12px;
			background: rgba(24, 33, 57, 0.94);
			border: 1px solid rgba(72, 88, 123, 0.78);
		}

		.v2ex-emoji-source-item.is-active {
			border-color: rgba(103, 143, 255, 0.92);
			box-shadow: inset 0 0 0 1px rgba(103, 143, 255, 0.28);
		}

		.v2ex-emoji-source-meta {
			min-width: 0;
			flex: 1 1 auto;
		}

		.v2ex-emoji-source-alias {
			font-size: 12px;
			font-weight: 700;
			color: #e2e8f0;
		}

		.v2ex-emoji-source-url {
			margin-top: 4px;
			font-size: 11px;
			color: #93a5c7;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.v2ex-emoji-source-actions {
			display: inline-flex;
			gap: 6px;
			flex: 0 0 auto;
		}

		.v2ex-emoji-source-actions button {
			padding: 4px 8px;
			font-size: 11px;
			border-radius: 8px;
		}

		.v2ex-emoji-source-switcher {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px 16px 14px;
			border-top: 1px solid rgba(70, 84, 116, 0.72);
			background: rgba(17, 23, 39, 0.98);
			overflow-x: auto;
		}

		.v2ex-emoji-source-tab {
			appearance: none;
			border: 0;
			padding: 0;
			background: transparent;
			cursor: pointer;
			flex: 0 0 auto;
		}

		.v2ex-emoji-source-tab.is-empty {
			opacity: 0.75;
		}

		.v2ex-emoji-source-switcher-settings {
			margin-left: auto;
			flex: 0 0 auto;
		}

		.v2ex-emoji-source-icon {
			width: 30px;
			height: 30px;
			border-radius: 10px;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			font-size: 12px;
			font-weight: 700;
			color: #dce5f6;
			border: 1px solid rgba(76, 92, 128, 0.84);
			background: rgba(31, 40, 66, 0.98);
			transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
		}

		.v2ex-emoji-source-tab:hover .v2ex-emoji-source-icon,
		.v2ex-emoji-source-tab.is-active .v2ex-emoji-source-icon {
			transform: translateY(-1px);
			border-color: rgba(255, 197, 64, 0.95);
			box-shadow: 0 0 0 2px rgba(255, 197, 64, 0.18);
		}

		.v2ex-emoji-settings-actions {
			display: flex;
			justify-content: flex-end;
			gap: 8px;
			margin-top: 12px;
		}

		.v2ex-emoji-secondary:hover,
		.v2ex-emoji-primary:hover {
			filter: brightness(1.05);
		}

		.Night .v2ex-emoji-trigger {
			background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
			border-color: rgba(148, 163, 184, 0.35);
			color: #e5e7eb;
		}

		.Night .v2ex-emoji-panel {
			background: #0f172a;
			border-color: rgba(71, 85, 105, 0.75);
			box-shadow: 0 24px 48px rgba(2, 6, 23, 0.5);
		}

		.Night .v2ex-emoji-panel-title,
		.Night .v2ex-emoji-card-label,
		.Night .v2ex-emoji-settings-label,
		.Night .v2ex-emoji-settings-input,
		.Night .v2ex-emoji-primary,
		.Night .v2ex-emoji-secondary {
			color: #e2e8f0;
		}

		.Night .v2ex-emoji-status,
		.Night .v2ex-emoji-empty,
		.Night .v2ex-emoji-page-indicator,
		.Night .v2ex-emoji-settings-hint {
			color: #94a3b8;
		}

		.Night .v2ex-emoji-card {
			background: rgba(30, 41, 59, 0.9);
			border-color: rgba(71, 85, 105, 0.75);
		}

		.Night .v2ex-emoji-empty,
		.Night .v2ex-emoji-settings {
			background: rgba(15, 23, 42, 0.88);
			border-color: rgba(71, 85, 105, 0.75);
		}

		.Night .v2ex-emoji-settings-input,
		.Night .v2ex-emoji-secondary {
			background: rgba(15, 23, 42, 0.85);
			border-color: rgba(71, 85, 105, 0.85);
		}

		@media (max-width: 720px) {
			.v2ex-emoji-panel {
				right: auto;
				left: 50%;
				transform: translateX(-50%);
				width: min(94vw, 620px);
			}

			.v2ex-emoji-grid {
				grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
			}
		}

		@media (max-width: 560px) {
			.v2ex-emoji-panel-footer {
				flex-direction: column;
				align-items: stretch;
			}

			.v2ex-emoji-pager {
				justify-content: center;
			}

			.v2ex-emoji-grid {
				grid-template-columns: repeat(4, minmax(0, 1fr));
				gap: 10px 8px;
			}

			.v2ex-emoji-source-item {
				flex-direction: column;
				align-items: stretch;
			}

			.v2ex-emoji-source-actions {
				justify-content: flex-end;
			}
		}
	`);

	hydrateFromCache();
	init();

	function init() {
		attachToReplyBoxes();

		const observer = new MutationObserver(() => {
			attachToReplyBoxes();
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true
		});

		document.addEventListener('click', handleDocumentClick, true);
		document.addEventListener('keydown', handleDocumentKeydown, true);
		window.addEventListener('resize', () => {
			renderAll();
		});
	}

	function attachToReplyBoxes() {
		const textareas = document.querySelectorAll('#reply-box textarea, textarea#reply_content');
		textareas.forEach((textarea) => {
			if (!(textarea instanceof HTMLTextAreaElement) || textarea.dataset.v2exEmojiEnhanced === '1') {
				return;
			}

			const form = textarea.form || textarea.closest('form');
			if (!form) {
				return;
			}

			const actionRow = findActionRow(textarea, form);
			if (!actionRow) {
				return;
			}

			const instance = createEmojiUI(textarea);
			const submitButton = actionRow.querySelector('input[type="submit"], button[type="submit"]');
			if (submitButton && submitButton.parentNode === actionRow) {
				submitButton.insertAdjacentElement('afterend', instance.anchor);
			} else {
				actionRow.appendChild(instance.anchor);
			}

			textarea.dataset.v2exEmojiEnhanced = '1';
			state.instances.add(instance);
			instance.render();
		});
	}

	function findActionRow(textarea, form) {
		let current = textarea.nextElementSibling;
		while (current) {
			if (current.matches && current.matches('div')) {
				const hasSubmit = current.querySelector('input[type="submit"], button[type="submit"]');
				if (hasSubmit) {
					return current;
				}
			}
			current = current.nextElementSibling;
		}

		return form.querySelector('input[type="submit"], button[type="submit"]')?.closest('div') || null;
	}

	function createEmojiUI(textarea) {
		const anchor = document.createElement('div');
		anchor.className = 'v2ex-emoji-anchor';

		const trigger = document.createElement('button');
		trigger.type = 'button';
		trigger.className = 'v2ex-emoji-trigger';
		trigger.textContent = 'Emoji';

		trigger.addEventListener('mousedown', (event) => {
			event.preventDefault();
			textarea.focus();
		});

		const panel = document.createElement('div');
		panel.className = 'v2ex-emoji-panel';

		const body = document.createElement('div');
		body.className = 'v2ex-emoji-panel-body';

		const grid = document.createElement('div');
		grid.className = 'v2ex-emoji-grid';

		body.appendChild(grid);

		const footer = document.createElement('div');
		footer.className = 'v2ex-emoji-panel-footer';

		const pager = document.createElement('div');
		pager.className = 'v2ex-emoji-pager';

		const prevButton = document.createElement('button');
		prevButton.type = 'button';
		prevButton.className = 'v2ex-emoji-secondary';
		prevButton.textContent = '上一页';

		const pageIndicator = document.createElement('span');
		pageIndicator.className = 'v2ex-emoji-page-indicator';

		const nextButton = document.createElement('button');
		nextButton.type = 'button';
		nextButton.className = 'v2ex-emoji-secondary';
		nextButton.textContent = '下一页';

		const footerStatus = document.createElement('div');
		footerStatus.className = 'v2ex-emoji-status v2ex-emoji-footer-status';

		pager.appendChild(prevButton);
		pager.appendChild(pageIndicator);
		pager.appendChild(nextButton);

		footer.appendChild(pager);
		footer.appendChild(footerStatus);

		const settings = document.createElement('div');
		settings.className = 'v2ex-emoji-settings';

		const settingsLabel = document.createElement('label');
		settingsLabel.className = 'v2ex-emoji-settings-label';
		settingsLabel.textContent = '资源别名';

		const aliasField = document.createElement('div');
		aliasField.className = 'v2ex-emoji-settings-field';

		const aliasInput = document.createElement('input');
		aliasInput.className = 'v2ex-emoji-settings-input';
		aliasInput.type = 'text';
		aliasInput.placeholder = '例如：猫猫包';
		aliasInput.maxLength = 20;
		aliasInput.spellcheck = false;
		aliasField.appendChild(settingsLabel);
		aliasField.appendChild(aliasInput);

		const urlField = document.createElement('div');
		urlField.className = 'v2ex-emoji-settings-field';

		const urlLabel = document.createElement('label');
		urlLabel.className = 'v2ex-emoji-settings-label';
		urlLabel.textContent = '表情源地址';

		const settingsInput = document.createElement('input');
		settingsInput.className = 'v2ex-emoji-settings-input';
		settingsInput.type = 'url';
		settingsInput.placeholder = '输入 {{Resource URL}}';
		settingsInput.spellcheck = false;
		urlField.appendChild(urlLabel);
		urlField.appendChild(settingsInput);

		const settingsHint = document.createElement('div');
		settingsHint.className = 'v2ex-emoji-settings-hint';

		const sourceList = document.createElement('div');
		sourceList.className = 'v2ex-emoji-source-list';

		const settingsActions = document.createElement('div');
		settingsActions.className = 'v2ex-emoji-settings-actions';

		const cancelButton = document.createElement('button');
		cancelButton.type = 'button';
		cancelButton.className = 'v2ex-emoji-secondary';
		cancelButton.textContent = '取消';

		const saveButton = document.createElement('button');
		saveButton.type = 'button';
		saveButton.className = 'v2ex-emoji-primary';
		saveButton.textContent = '新增源';

		settingsActions.appendChild(cancelButton);
		settingsActions.appendChild(saveButton);
		settings.appendChild(aliasField);
		settings.appendChild(urlField);
		settings.appendChild(settingsHint);
		settings.appendChild(sourceList);
		settings.appendChild(settingsActions);

		const sourceSwitcher = document.createElement('div');
		sourceSwitcher.className = 'v2ex-emoji-source-switcher';

		const settingsButton = document.createElement('button');
		settingsButton.type = 'button';
		settingsButton.className = 'v2ex-emoji-secondary v2ex-emoji-source-switcher-settings';
		settingsButton.textContent = '设置';

		panel.appendChild(body);
		panel.appendChild(footer);
		panel.appendChild(settings);
		panel.appendChild(sourceSwitcher);

		anchor.appendChild(trigger);
		anchor.appendChild(panel);

		const instance = {
			anchor,
			trigger,
			panel,
			status: footerStatus,
			body,
			footer,
			grid,
			pageIndicator,
			prevButton,
			nextButton,
			settings,
			settingsButton,
			aliasInput,
			settingsInput,
			settingsHint,
			sourceList,
			sourceSwitcher,
			textarea,
			isOpen: false,
			isSettingsOpen: false,
			render
		};

		trigger.addEventListener('click', async(event) => {
			event.preventDefault();
			event.stopPropagation();
			textarea.focus();
			closeOtherPanels(instance);
			instance.isOpen = !instance.isOpen;
			if (instance.isOpen) {
				instance.isSettingsOpen = false;
				resetEditingState(instance, false);
				if (!state.emojiItems.length || state.loadedSourceUrl !== state.sourceUrl) {
					void loadEmojiData();
				}
			}
			renderAll();
		});

		prevButton.addEventListener('click', () => {
			if (state.currentPage > 1) {
				state.currentPage -= 1;
				renderAll();
			}
		});

		nextButton.addEventListener('click', () => {
			if (state.currentPage < state.totalPages) {
				state.currentPage += 1;
				renderAll();
			}
		});

		settingsButton.addEventListener('click', () => {
			instance.isSettingsOpen = !instance.isSettingsOpen;
			if (instance.isSettingsOpen) {
				resetEditingState(instance, false);
			}
			renderAll();
			if (instance.isSettingsOpen) {
				(instance.aliasInput.value ? instance.aliasInput : instance.settingsInput).focus();
			}
		});

		cancelButton.addEventListener('click', () => {
			instance.isSettingsOpen = false;
			resetEditingState(instance, true);
			renderAll();
		});

		saveButton.addEventListener('click', async() => {
			const alias = normalizeAlias(instance.aliasInput.value);
			const nextSourceUrl = normalizeSourceUrl(instance.settingsInput.value);
			if (!isConfigurableSource(nextSourceUrl)) {
				state.error = '请输入可访问的 {{Resource URL}}，例如 https://example.com/assets';
				renderAll();
				return;
			}

			state.error = '';
			upsertSource({
				id: state.editingSourceId,
				alias,
				url: nextSourceUrl
			});
			instance.isSettingsOpen = false;
			resetEditingState(instance, true);
			await activateSource(state.activeSourceId, true);
		});

		settingsInput.addEventListener('keydown', async(event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				saveButton.click();
			}
		});

		aliasInput.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				saveButton.click();
			}
		});

		return instance;

		function render() {
			instance.panel.classList.toggle('is-open', instance.isOpen);
			instance.panel.classList.toggle('is-open-up', false);
			instance.panel.classList.toggle('is-open-down', false);
			instance.trigger.classList.toggle('is-open', instance.isOpen);
			instance.settings.classList.toggle('is-open', instance.isOpen && instance.isSettingsOpen);

			instance.settingsButton.textContent = instance.isSettingsOpen ? '收起' : '设置';
			instance.pageIndicator.textContent = `${state.currentPage} / ${state.totalPages}`;
			instance.prevButton.disabled = state.currentPage <= 1 || state.loading;
			instance.nextButton.disabled = state.currentPage >= state.totalPages || state.loading;
			saveButton.textContent = state.editingSourceId ? '保存修改' : '新增源';

			instance.status.classList.toggle('is-error', Boolean(state.error));
			instance.status.textContent = state.error || formatStatusText();

			renderGrid(instance);
			renderSourceList(instance);
			renderSourceSwitcher(instance);
			updatePanelLayout(instance);
		}
	}

	function renderGrid(instance) {
		instance.grid.replaceChildren();

		if (state.loading) {
			instance.grid.appendChild(createEmptyState('正在加载表情...'));
			return;
		}

		if (!isConfigurableSource(state.sourceUrl)) {
			instance.grid.appendChild(createEmptyState('请先点击右下角“设置”，配置表情源地址。'));
			return;
		}

		if (!state.emojiItems.length) {
			instance.grid.appendChild(createEmptyState(state.error ? '表情加载失败，请检查数据源设置。' : '当前数据源没有可用表情。'));
			return;
		}

		const items = getCurrentPageItems();
		items.forEach((item) => {
			const card = document.createElement('button');
			card.type = 'button';
			card.className = 'v2ex-emoji-card';
			card.title = `${item.name}\n${item.insertText}`;

			const thumb = document.createElement('div');
			thumb.className = 'v2ex-emoji-thumb';

			const image = document.createElement('img');
			image.src = item.previewUrl;
			image.alt = item.name;
			image.loading = 'lazy';

			const label = document.createElement('div');
			label.className = 'v2ex-emoji-card-label';
			label.textContent = item.name;

			thumb.appendChild(image);
			card.appendChild(thumb);
			card.appendChild(label);
			card.addEventListener('click', () => {
				insertEmojiText(instance.textarea, item.insertText);
				instance.isOpen = false;
				instance.isSettingsOpen = false;
				renderAll();
			});

			instance.grid.appendChild(card);
		});
	}

	function renderSourceList(instance) {
		instance.sourceList.replaceChildren();

		if (!state.sources.length) {
			instance.sourceList.appendChild(createEmptyState('还没有配置表情源，先填写别名和地址后点击“新增源”。'));
			return;
		}

		state.sources.forEach((source) => {
			const item = document.createElement('div');
			item.className = 'v2ex-emoji-source-item';
			if (source.id === state.activeSourceId) {
				item.classList.add('is-active');
			}

			const meta = document.createElement('div');
			meta.className = 'v2ex-emoji-source-meta';

			const alias = document.createElement('div');
			alias.className = 'v2ex-emoji-source-alias';
			alias.textContent = source.alias;

			const url = document.createElement('div');
			url.className = 'v2ex-emoji-source-url';
			url.textContent = source.url;

			meta.appendChild(alias);
			meta.appendChild(url);

			const actions = document.createElement('div');
			actions.className = 'v2ex-emoji-source-actions';

			const switchButton = document.createElement('button');
			switchButton.type = 'button';
			switchButton.className = 'v2ex-emoji-secondary';
			switchButton.textContent = source.id === state.activeSourceId ? '当前' : '切换';
			switchButton.disabled = source.id === state.activeSourceId;
			switchButton.addEventListener('click', async() => {
				await activateSource(source.id, true);
			});

			const editButton = document.createElement('button');
			editButton.type = 'button';
			editButton.className = 'v2ex-emoji-secondary';
			editButton.textContent = '编辑';
			editButton.addEventListener('click', () => {
				state.editingSourceId = source.id;
				instance.aliasInput.value = source.alias;
				instance.settingsInput.value = source.url;
				instance.isSettingsOpen = true;
				renderAll();
			});

			const deleteButton = document.createElement('button');
			deleteButton.type = 'button';
			deleteButton.className = 'v2ex-emoji-secondary';
			deleteButton.textContent = '删除';
			deleteButton.addEventListener('click', async() => {
				removeSource(source.id);
				if (state.activeSourceId) {
					await activateSource(state.activeSourceId, true);
				} else {
					renderAll();
				}
			});

			actions.appendChild(switchButton);
			actions.appendChild(editButton);
			actions.appendChild(deleteButton);

			item.appendChild(meta);
			item.appendChild(actions);
			instance.sourceList.appendChild(item);
		});
	}

	function renderSourceSwitcher(instance) {
		instance.sourceSwitcher.replaceChildren();

		if (!state.sources.length) {
			const empty = document.createElement('button');
			empty.type = 'button';
			empty.className = 'v2ex-emoji-source-tab is-empty';
			empty.title = '新增表情源';
			empty.addEventListener('click', () => {
				instance.isSettingsOpen = true;
				resetEditingState(instance, false);
				renderAll();
			});

			const emptyIcon = document.createElement('span');
			emptyIcon.className = 'v2ex-emoji-source-icon';
			emptyIcon.textContent = '+';
			empty.appendChild(emptyIcon);
			instance.sourceSwitcher.appendChild(empty);
			instance.sourceSwitcher.appendChild(instance.settingsButton);
			return;
		}

		state.sources.forEach((source) => {
			const tab = document.createElement('button');
			tab.type = 'button';
			tab.className = 'v2ex-emoji-source-tab';
			tab.title = `${source.alias}\n${source.url}`;
			if (source.id === state.activeSourceId) {
				tab.classList.add('is-active');
			}
			tab.addEventListener('click', async() => {
				if (source.id === state.activeSourceId) {
					return;
				}
				await activateSource(source.id, true);
			});

			const icon = document.createElement('span');
			icon.className = 'v2ex-emoji-source-icon';
			icon.textContent = getSourceIconText(source.alias);
			tab.appendChild(icon);
			instance.sourceSwitcher.appendChild(tab);
		});

		const addButton = document.createElement('button');
		addButton.type = 'button';
		addButton.className = 'v2ex-emoji-source-tab';
		addButton.title = '新增表情源';
		addButton.addEventListener('click', () => {
			instance.isSettingsOpen = true;
			resetEditingState(instance, false);
			renderAll();
		});

		const addIcon = document.createElement('span');
		addIcon.className = 'v2ex-emoji-source-icon';
		addIcon.textContent = '+';
		addButton.appendChild(addIcon);
		instance.sourceSwitcher.appendChild(addButton);
		instance.sourceSwitcher.appendChild(instance.settingsButton);
	}

	function createEmptyState(message) {
		const empty = document.createElement('div');
		empty.className = 'v2ex-emoji-empty';
		empty.textContent = message;
		return empty;
	}

	async function loadEmojiData(forceRefresh) {
		if (!isConfigurableSource(state.sourceUrl)) {
			state.emojiItems = [];
			state.totalPages = 1;
			state.pageSize = DEFAULT_PAGE_SIZE;
			state.loadedSourceUrl = '';
			state.error = '';
			persistCache();
			renderAll();
			return;
		}

		if (state.refreshPromise && !forceRefresh) {
			return state.refreshPromise;
		}

		state.loading = true;
		state.error = '';
		renderAll();

		const dataUrl = buildEmojiJsonUrl(state.sourceUrl);
		state.refreshPromise = requestJson(dataUrl)
			.then((payload) => {
				const parsed = parseEmojiPayload(payload, state.sourceUrl);
				state.emojiItems = parsed.emojiItems;
				state.pageSize = parsed.pageSize;
				state.totalPages = parsed.totalPages;
				state.version = parsed.version;
				state.currentPage = Math.min(state.currentPage, state.totalPages);
				state.currentPage = Math.max(1, state.currentPage);
				state.loadedSourceUrl = state.sourceUrl;
				persistCache();
			})
			.catch((error) => {
				state.error = error instanceof Error ? error.message : '表情数据加载失败';
				state.emojiItems = [];
				state.totalPages = 1;
				state.pageSize = DEFAULT_PAGE_SIZE;
			})
			.finally(() => {
				state.loading = false;
				state.refreshPromise = null;
				renderAll();
			});

		return state.refreshPromise;
	}

	function parseEmojiPayload(payload, sourceUrl) {
		if (!payload || typeof payload !== 'object') {
			throw new Error('emoji.json 返回格式无效');
		}

		if (!Array.isArray(payload.emojis)) {
			throw new Error('emoji.json 缺少 emojis 数组');
		}

		const emojiItems = [];
		payload.emojis.forEach((group, groupIndex) => {
			if (!group || typeof group !== 'object' || Array.isArray(group)) {
				return;
			}

			Object.entries(group).forEach(([name, fileName], emojiIndex) => {
				if (typeof fileName !== 'string' || !fileName.trim()) {
					return;
				}

				const normalizedName = typeof name === 'string' && name.trim() ? name.trim() : `emoji-${groupIndex + 1}-${emojiIndex + 1}`;
				const resolvedUrl = resolveResourceUrl(sourceUrl, fileName.trim());
				emojiItems.push({
					name: normalizedName,
					fileName: fileName.trim(),
					previewUrl: resolvedUrl,
					insertText: resolvedUrl
				});
			});
		});

		const pageSize = clampPageSize(payload.page_size);
		const totalPages = Math.max(1, Math.ceil(emojiItems.length / pageSize));

		return {
			version: typeof payload.version === 'string' ? payload.version : '',
			emojiItems,
			pageSize,
			totalPages
		};
	}

	function getCurrentPageItems() {
		const startIndex = (state.currentPage - 1) * state.pageSize;
		return state.emojiItems.slice(startIndex, startIndex + state.pageSize);
	}

	function formatStatusText() {
		if (state.loading) {
			return '正在加载表情数据...';
		}

		if (!state.sources.length || !isConfigurableSource(state.sourceUrl)) {
			return '尚未配置表情源';
		}

		const activeSource = getActiveSource();
		const aliasText = activeSource ? `${activeSource.alias} · ` : '';
		return `${aliasText}共 ${state.emojiItems.length} 个表情，每页 ${state.pageSize} 个`;
	}

	function formatSubtitle() {
		if (!state.sources.length || !isConfigurableSource(state.sourceUrl)) {
			return '未配置数据源';
		}

		const versionText = state.version ? `v${state.version}` : '已连接';
		const activeSource = getActiveSource();
		const aliasText = activeSource ? `${activeSource.alias} · ` : '';
		return `${aliasText}${versionText} · ${state.sourceUrl}`;
	}

	function upsertSource(nextSource) {
		const normalizedUrl = normalizeSourceUrl(nextSource.url);
		const normalizedAlias = normalizeAlias(nextSource.alias);
		const existingIndex = nextSource.id ? state.sources.findIndex((source) => source.id === nextSource.id) : -1;
		const sourceRecord = {
			id: existingIndex >= 0 ? state.sources[existingIndex].id : createSourceId(),
			alias: normalizedAlias,
			url: normalizedUrl
		};

		if (existingIndex >= 0) {
			state.sources.splice(existingIndex, 1, sourceRecord);
		} else {
			state.sources.push(sourceRecord);
		}

		state.activeSourceId = sourceRecord.id;
		state.sourceUrl = sourceRecord.url;
		persistSources();
	}

	function removeSource(sourceId) {
		state.sources = state.sources.filter((source) => source.id !== sourceId);
		if (state.editingSourceId === sourceId) {
			state.editingSourceId = '';
		}

		if (state.activeSourceId === sourceId) {
			const fallbackSource = state.sources[0] || null;
			state.activeSourceId = fallbackSource ? fallbackSource.id : '';
			state.sourceUrl = fallbackSource ? fallbackSource.url : '';
			state.loadedSourceUrl = state.activeSourceId ? state.loadedSourceUrl : '';
			if (!fallbackSource) {
				state.emojiItems = [];
				state.totalPages = 1;
				state.pageSize = DEFAULT_PAGE_SIZE;
			}
		}

		persistSources();
	}

	function getActiveSource() {
		return state.sources.find((source) => source.id === state.activeSourceId) || null;
	}

	async function activateSource(sourceId, forceRefresh) {
		const source = state.sources.find((item) => item.id === sourceId) || null;
		state.activeSourceId = source ? source.id : '';
		state.sourceUrl = source ? source.url : '';
		state.currentPage = 1;
		state.error = '';
		persistSources();

		if (!source) {
			state.loadedSourceUrl = '';
			state.emojiItems = [];
			state.totalPages = 1;
			state.pageSize = DEFAULT_PAGE_SIZE;
			persistCache();
			renderAll();
			return;
		}

		if (forceRefresh || state.loadedSourceUrl !== source.url || !state.emojiItems.length) {
			await loadEmojiData(Boolean(forceRefresh));
			return;
		}

		renderAll();
	}

	function resetEditingState(instance, useActiveSource) {
		const activeSource = useActiveSource ? getActiveSource() : null;
		state.editingSourceId = '';
		instance.aliasInput.value = activeSource ? activeSource.alias : '';
		instance.settingsInput.value = activeSource ? activeSource.url : '';
	}

	function insertEmojiText(textarea, text) {
		textarea.focus();

		if (typeof textarea.setRangeText === 'function') {
			const start = textarea.selectionStart || 0;
			const end = textarea.selectionEnd || start;
			textarea.setRangeText(text, start, end, 'end');
		} else {
			const start = textarea.selectionStart || 0;
			const end = textarea.selectionEnd || start;
			textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
			textarea.selectionStart = textarea.selectionEnd = start + text.length;
		}

		textarea.dispatchEvent(new Event('input', { bubbles: true }));
		textarea.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function closeOtherPanels(currentInstance) {
		state.instances.forEach((instance) => {
			if (instance !== currentInstance) {
				instance.isOpen = false;
				instance.isSettingsOpen = false;
			}
		});
	}

	function handleDocumentClick(event) {
		state.instances.forEach((instance) => {
			if (!instance.isOpen) {
				return;
			}

			if (!instance.anchor.contains(event.target)) {
				instance.isOpen = false;
				instance.isSettingsOpen = false;
			}
		});

		renderAll();
	}

	function handleDocumentKeydown(event) {
		if (event.key !== 'Escape') {
			return;
		}

		let changed = false;
		state.instances.forEach((instance) => {
			if (instance.isOpen) {
				instance.isOpen = false;
				instance.isSettingsOpen = false;
				changed = true;
			}
		});

		if (changed) {
			renderAll();
		}
	}

	function renderAll() {
		state.instances.forEach((instance) => {
			if (!document.body.contains(instance.anchor)) {
				state.instances.delete(instance);
				return;
			}
			instance.render();
		});
	}

	function updatePanelLayout(instance) {
		if (!instance.isOpen) {
			instance.panel.style.maxHeight = '';
			instance.body.style.maxHeight = '';
			return;
		}

		const anchorRect = instance.anchor.getBoundingClientRect();
		const availableBelow = Math.max(0, window.innerHeight - anchorRect.bottom - PANEL_VIEWPORT_MARGIN - PANEL_TRIGGER_GAP);
		const availableAbove = Math.max(0, anchorRect.top - PANEL_VIEWPORT_MARGIN - PANEL_TRIGGER_GAP);
		const naturalHeight = instance.panel.scrollHeight;
		const shouldOpenDown = naturalHeight <= availableBelow || availableBelow >= availableAbove;
		const availableHeight = shouldOpenDown ? availableBelow : availableAbove;
		const viewportCap = Math.max(120, window.innerHeight - PANEL_VIEWPORT_MARGIN * 2);
		const clampedHeight = Math.min(viewportCap, Math.max(Math.min(PANEL_MIN_VISIBLE_HEIGHT, viewportCap), availableHeight));

		instance.panel.classList.toggle('is-open-down', shouldOpenDown);
		instance.panel.classList.toggle('is-open-up', !shouldOpenDown);
		instance.panel.style.maxHeight = `${clampedHeight}px`;

		const staticHeight =
			instance.footer.offsetHeight +
			instance.sourceSwitcher.offsetHeight +
			(instance.isSettingsOpen ? instance.settings.offsetHeight : 0);
		const bodyMaxHeight = Math.max(96, clampedHeight - staticHeight);
		instance.body.style.maxHeight = `${bodyMaxHeight}px`;
	}

	function buildEmojiJsonUrl(sourceUrl) {
		return `${sourceUrl.replace(/\/$/, '')}/emoji.json`;
	}

	function resolveResourceUrl(sourceUrl, fileName) {
		const normalizedBase = `${sourceUrl.replace(/\/$/, '')}/`;
		return new URL(fileName, normalizedBase).toString();
	}

	function normalizeSourceUrl(value) {
		const raw = typeof value === 'string' ? value.trim() : '';
		if (!raw) {
			return '';
		}

		if (raw.endsWith('/emoji.json')) {
			return raw.slice(0, -'/emoji.json'.length).replace(/\/$/, '');
		}

		return raw.replace(/\/$/, '');
	}

	function normalizeAlias(value) {
		const raw = typeof value === 'string' ? value.trim() : '';
		return raw || DEFAULT_SOURCE_ALIAS;
	}

	function isConfigurableSource(value) {
		if (!value || value.includes('{') || value.includes('}')) {
			return false;
		}

		try {
			const parsed = new URL(value);
			return parsed.protocol === 'http:' || parsed.protocol === 'https:';
		} catch (error) {
			return false;
		}
	}

	function clampPageSize(value) {
		const pageSize = Number.parseInt(String(value), 10);
		if (!Number.isFinite(pageSize) || pageSize <= 0) {
			return DEFAULT_PAGE_SIZE;
		}
		return Math.min(pageSize, 100);
	}

	function hydrateFromCache() {
		const cached = readValue(STORAGE_CACHE_KEY, null);
		if (!cached || typeof cached !== 'string') {
			return;
		}

		try {
			const parsed = JSON.parse(cached);
			if (!parsed || typeof parsed !== 'object') {
				return;
			}

			if (normalizeSourceUrl(parsed.sourceUrl) !== state.sourceUrl) {
				return;
			}

			if (!Array.isArray(parsed.emojiItems)) {
				return;
			}

			state.emojiItems = parsed.emojiItems.filter((item) => item && typeof item.previewUrl === 'string' && typeof item.insertText === 'string');
			state.pageSize = clampPageSize(parsed.pageSize);
			state.totalPages = Math.max(1, Math.ceil(state.emojiItems.length / state.pageSize));
			state.version = typeof parsed.version === 'string' ? parsed.version : '';
			state.loadedSourceUrl = state.sourceUrl;
		} catch (error) {
			console.warn('[V2EX Custom Emoji] Failed to read cache', error);
		}
	}

	function persistCache() {
		writeValue(STORAGE_CACHE_KEY, JSON.stringify({
			sourceUrl: state.sourceUrl,
			pageSize: state.pageSize,
			version: state.version,
			emojiItems: state.emojiItems
		}));
	}

	function persistSources() {
		writeValue(STORAGE_SOURCES_KEY, JSON.stringify(state.sources));
		writeValue(STORAGE_ACTIVE_SOURCE_KEY, state.activeSourceId || '');
		writeValue(STORAGE_SOURCE_KEY, state.sourceUrl || DEFAULT_SOURCE_URL);
	}

	function loadSources() {
		const rawSources = readValue(STORAGE_SOURCES_KEY, null);
		const parsedSources = parseSourceList(rawSources);
		if (parsedSources.length) {
			return parsedSources;
		}

		const legacySource = normalizeSourceUrl(readValue(STORAGE_SOURCE_KEY, DEFAULT_SOURCE_URL));
		if (!isConfigurableSource(legacySource)) {
			return [];
		}

		return [{
			id: createSourceId(),
			alias: DEFAULT_SOURCE_ALIAS,
			url: legacySource
		}];
	}

	function resolveInitialActiveSourceId(sources) {
		if (!sources.length) {
			return '';
		}

		const storedActiveId = readValue(STORAGE_ACTIVE_SOURCE_KEY, '');
		if (typeof storedActiveId === 'string' && sources.some((source) => source.id === storedActiveId)) {
			return storedActiveId;
		}

		const legacySource = normalizeSourceUrl(readValue(STORAGE_SOURCE_KEY, DEFAULT_SOURCE_URL));
		const matchedSource = sources.find((source) => source.url === legacySource);
		return matchedSource ? matchedSource.id : sources[0].id;
	}

	function parseSourceList(rawSources) {
		let parsed = rawSources;
		if (typeof rawSources === 'string') {
			try {
				parsed = JSON.parse(rawSources);
			} catch (error) {
				return [];
			}
		}

		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed
			.map((source, index) => normalizeSourceRecord(source, index))
			.filter(Boolean);
	}

	function normalizeSourceRecord(source, index) {
		if (!source || typeof source !== 'object') {
			return null;
		}

		const url = normalizeSourceUrl(source.url);
		if (!isConfigurableSource(url)) {
			return null;
		}

		return {
			id: typeof source.id === 'string' && source.id ? source.id : `emoji-source-${index + 1}`,
			alias: normalizeAlias(source.alias),
			url
		};
	}

	function createSourceId() {
		return `emoji-source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	}

	function getSourceIconText(alias) {
		const compact = normalizeAlias(alias).replace(/\s+/g, '');
		return compact.slice(0, SOURCE_ICON_TEXT_LIMIT) || DEFAULT_SOURCE_ALIAS.slice(0, SOURCE_ICON_TEXT_LIMIT);
	}

	function requestJson(url) {
		return new Promise((resolve, reject) => {
			if (typeof GM_xmlhttpRequest === 'function') {
				GM_xmlhttpRequest({
					method: 'GET',
					url,
					timeout: REQUEST_TIMEOUT,
					headers: {
						Accept: 'application/json'
					},
					onload: (response) => {
						if (response.status < 200 || response.status >= 300) {
							reject(new Error(`请求失败：${response.status}`));
							return;
						}

						try {
							resolve(JSON.parse(response.responseText));
						} catch (error) {
							reject(new Error('emoji.json 不是合法 JSON'));
						}
					},
					ontimeout: () => reject(new Error('请求超时，请稍后重试')),
					onerror: () => reject(new Error('网络错误，请检查数据源地址'))
				});
				return;
			}

			fetch(url)
				.then((response) => {
					if (!response.ok) {
						throw new Error(`请求失败：${response.status}`);
					}
					return response.json();
				})
				.then(resolve)
				.catch((error) => {
					reject(error instanceof Error ? error : new Error('网络错误，请检查数据源地址'));
				});
		});
	}

	function readValue(key, fallbackValue) {
		try {
			if (typeof GM_getValue === 'function') {
				return GM_getValue(key, fallbackValue);
			}
		} catch (error) {
			console.warn('[V2EX Custom Emoji] Failed to read GM value', error);
		}

		try {
			const stored = window.localStorage.getItem(key);
			return stored === null ? fallbackValue : stored;
		} catch (error) {
			return fallbackValue;
		}
	}

	function writeValue(key, value) {
		try {
			if (typeof GM_setValue === 'function') {
				GM_setValue(key, value);
				return;
			}
		} catch (error) {
			console.warn('[V2EX Custom Emoji] Failed to write GM value', error);
		}

		try {
			window.localStorage.setItem(key, String(value));
		} catch (error) {
			console.warn('[V2EX Custom Emoji] Failed to write localStorage value', error);
		}
	}

	function addStyle(cssText) {
		if (typeof GM_addStyle === 'function') {
			GM_addStyle(cssText);
			return;
		}

		const style = document.createElement('style');
		style.textContent = cssText;
		document.head.appendChild(style);
	}
})();
