import { Notice, type MarkdownPostProcessorContext, Plugin } from "obsidian";
import { CardList } from "./CardList.ts";
import { CardStat } from "./CardStat.ts";
import { i10n, userLang } from "./i10n.ts";
import { renderCard, renderTableBody } from "./render.ts";
import { VocabularySettingTab } from "./settingTab.ts";
import { getSource, handleContextMenu } from "./utils.ts";
import { DEFAULT_SETTINGS } from "./variables.ts";
import type { Settings } from "obsidian ";


export default class VocabularyView extends Plugin {
    settings: Settings;
    viewedIds: string[] = [];
    mode: "random" | "next" = 'random';
    invert = false;
    autoMode = false;
    autoModeTimer: NodeJS.Timeout | null = null;

    async onload(): Promise<void> {
        await this.loadSettings();
        this.registerMarkdownCodeBlockProcessor("voca-table", await this.renderTable.bind(this));
        this.registerMarkdownCodeBlockProcessor("voca-card", await this.parseCodeBlock.bind(this));
        this.addSettingTab(new VocabularySettingTab(this.app, this));
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    async parseCodeBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
        await this.loadSettings();

        if (!ctx) {
            new Notice(i10n.noContext[userLang]);
            return;
        }

        const contentAfter = await getSource(el, ctx);
        const cardList = new CardList(this, contentAfter);
        const cardStat = new CardStat(this, this.app, el, ctx, cardList);
        await renderCard(this, cardStat, cardList, el, ctx, contentAfter);
        el.addEventListener("contextmenu", (e) => handleContextMenu(e, this, el, ctx, source, cardStat, cardList, contentAfter));

        // Add keyboard shortcut for context menu (Shift+F10) - useful for Linux users
        el.addEventListener('keydown', (event) => {
            if (event.shiftKey && event.key === 'F10') {
                event.preventDefault();
                // Create a synthetic mouse event at the center of the element
                const rect = el.getBoundingClientRect();
                const syntheticEvent = new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                });
                handleContextMenu(syntheticEvent, this, el, ctx, source, cardStat, cardList, contentAfter);
            }
        });

        // Make element focusable for keyboard navigation
        el.setAttribute('tabindex', '0');
    }

    async renderTable(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
        source = await getSource(el, ctx) || '';
        const cardList = new CardList(this, source);
        renderTableBody(this, cardList, el, ctx);
        el.addEventListener("contextmenu", (e) => handleContextMenu(e, this, el, ctx, source));

        // Add keyboard shortcut for context menu (Shift+F10) - useful for Linux users
        el.addEventListener('keydown', (event) => {
            if (event.shiftKey && event.key === 'F10') {
                event.preventDefault();
                // Create a synthetic mouse event at the center of the element
                const rect = el.getBoundingClientRect();
                const syntheticEvent = new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                });
                handleContextMenu(syntheticEvent, this, el, ctx, source);
            }
        });

        // Make element focusable for keyboard navigation
        el.setAttribute('tabindex', '0');
    }
}