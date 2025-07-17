import type { MarkdownPostProcessorContext } from "obsidian";
import type { CardList } from "./CardList.ts";
import type { CardStat } from "./CardStat.ts";
import type VocabularyView from "./main.ts";
import { renderSingleCard } from "./utils.ts";


export async function toggleAutoMode(plugin: VocabularyView, cardList: CardList, cardStat: CardStat, el: HTMLElement, ctx: MarkdownPostProcessorContext, source: string): Promise<void> {
    plugin.autoMode = !plugin.autoMode;
    const playButton = el.querySelector('.reload-container_play-button') as HTMLButtonElement;
    playButton.textContent = plugin.autoMode ? '⏹' : '▶';
    const disableConfirmationButtons = plugin.settings.disableConfirmationButtons;

    if (plugin.autoMode) {
        if (disableConfirmationButtons) disableButtons(el);
        await runAutoMode(plugin, cardList, cardStat, el, ctx, source);
    } else {
        if (disableConfirmationButtons) enableButtons(el);
        if (plugin.autoModeTimer) {
            clearTimeout(plugin.autoModeTimer);
            plugin.autoModeTimer = null;
        }
    }
}

export function disableButtons(el: HTMLElement): void {
    const buttons = el.querySelectorAll('.voca-card_button-danger, .voca-card_button-success') as NodeListOf<HTMLButtonElement>;
    buttons.forEach(button => {
        button.disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
    });
}

function enableButtons(el: HTMLElement): void {
    const buttons = el.querySelectorAll('.voca-card_button-danger, .voca-card_button-success') as NodeListOf<HTMLButtonElement>;
    buttons.forEach(button => {
        button.disabled = false;
        button.style.opacity = '';
        button.style.cursor = '';
    });
}

export async function runAutoMode(plugin: VocabularyView, cardList: CardList, cardStat: CardStat, el: HTMLElement, ctx: MarkdownPostProcessorContext, source: string): Promise<void> {
    async function runCycle(): Promise<void> {
        if (!plugin.autoMode) return;

        const voca_card = el.querySelector('.voca-card') as HTMLElement;
        await renderSingleCard(plugin, cardList, cardStat, voca_card, ctx, source);
        const disableConfirmationButtons = plugin.settings.disableConfirmationButtons;
        if (disableConfirmationButtons) disableButtons(el);

        plugin.autoModeTimer = setTimeout(async () => {
            if (!plugin.autoMode) return;
            const blurredEl = el.querySelector('.voca-card_explanation-blurred') as HTMLElement;
            if (blurredEl) {
                blurredEl.click();
                plugin.autoModeTimer = setTimeout(() => runCycle(), plugin.settings.explainTime * 1000);
            } else {
                runCycle();
            }
        }, plugin.settings.showTime * 1000);
    }

    runCycle();
}