import { type MarkdownPostProcessorContext, Notice, Menu, DropdownComponent } from "obsidian";
import type { Card } from "./Card.ts";
import type { CardList } from "./CardList.ts";
import type { CardStat } from "./CardStat.ts";
import { i10n, userLang } from "./i10n.ts";
import type VocabularyView from "./main.ts";
import { renderCard, renderCardStats, renderCardContent, renderCardButtons } from "./render.ts";


/**
 * returns the content of the markdown page untill next code block if exists
 */
export async function getSource(el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<string> {
    const sectionInfo = ctx.getSectionInfo(el);
    if (!sectionInfo) return "";
    // page content
    const lines = sectionInfo.text.split('\n').filter(line => !/^#{1,6}\s+/.test(line));
    return getContentAfterCodeBlock(lines, sectionInfo.lineEnd);
}

function getContentAfterCodeBlock(lines: string[], codeBlockEndLine: number): string {
    let contentAfter = lines.slice(codeBlockEndLine + 1);

    const nextCodeBlockIndex = contentAfter.findIndex(line =>
        line.trim().startsWith("```voca-card") ||
        line.trim().startsWith("```voca-table")
    );

    // If another relevant code block is found, keep only the content until that block
    if (nextCodeBlockIndex !== -1) {
        contentAfter = contentAfter.slice(0, nextCodeBlockIndex);
    }

    return contentAfter.join('\n').trim();
}

export async function replaceLanguage(plugin: VocabularyView, ctx: MarkdownPostProcessorContext, el: HTMLElement): Promise<string | undefined> {
    const sectionInfo = ctx.getSectionInfo(el);
    if (!sectionInfo) return "";
    const file = plugin.app.vault.getFileByPath(ctx.sourcePath);
    if (!file) return "";

    // get header
    const lines = sectionInfo.text.split('\n');
    const codeBlockHeader = lines[sectionInfo.lineStart] ?? '';

    await plugin.app.vault.process(file, (content) => {
        const newLines = [...lines];
        newLines[sectionInfo.lineStart] = codeBlockHeader.includes("voca-card") ? newLines[sectionInfo.lineStart].replace("voca-card", "voca-table") : newLines[sectionInfo.lineStart].replace("voca-table", "voca-card");
        const newText = newLines.join('\n');
        return content.replace(sectionInfo.text, newText);
    });
}

export function getNextCard(plugin: VocabularyView, remainingCards: Card[], cardStat: CardStat, cardList: CardList): Card | undefined {
    return plugin.mode === "random"
        ? getRandomCardWithWeight(remainingCards, cardStat)
        : cardList.nextCard();
}

export function getRandomCardWithWeight(cards: Card[], cardStat: CardStat): Card {
    const randomFactor = 0.2;
    const maxWeight = 9;
    const baseWeight = 1;
    const sortThreshold = 100; // Threshold above which we sort the list

    const weightedCards = cards.map(card => {
        const [right, wrong] = cardStat.getStats(card);
        const weight = Math.min((Math.log(wrong + 1) + baseWeight) / (right + 1) * (1 + Math.random() * randomFactor), maxWeight);
        return { card, weight };
    });

    // Sort the list if the number of cards exceeds the threshold
    if (cards.length > sortThreshold) {
        weightedCards.sort((a, b) => b.weight - a.weight);
    }

    const totalWeight = weightedCards.reduce((sum, wc) => sum + wc.weight, 0);
    const randomValue = Math.random() * totalWeight;

    let cumulativeWeight = 0;
    for (const wc of weightedCards) {
        cumulativeWeight += wc.weight;
        if (randomValue < cumulativeWeight) {
            return wc.card;
        }
    }

    return weightedCards[0].card;
}

export function createEmpty(el: HTMLElement, secondChild?: HTMLElement): void {
    const emptyElement = el.createEl('div', { cls: 'voca-empty', text: i10n.empty[userLang] });
    if (secondChild) {
        el.insertBefore(emptyElement, secondChild);
    }
}

// string from date in ms
export function createIdfromDate(): string {
    return Date.now().toString();
}

export async function cleanStats(): Promise<void> {
    const markdownFiles = this.app.vault.getMarkdownFiles();
    const codeBlockRegex = /^```(voca-card|voca-table)\s*(.*?)\s*$/gm;
    const usedIds = new Set();

    for (const file of markdownFiles) {
        try {
            const fileContent = await this.app.vault.cachedRead(file);
            const matches = fileContent.matchAll(codeBlockRegex);
            for (const match of matches) {
                const id = match[2].trim();
                if (id) {
                    usedIds.add(id);
                }
            }
        } catch (error) {
            console.error("Error reading file:", error);
            new Notice("Unable to read file.");
        }
    }

    const unusedKeys = Object.keys(this.settings.stats).filter(key => !usedIds.has(key));

    if (!unusedKeys.length) {
        new Notice(i10n.nothingToClean[userLang]);
        return;
    }

    for (const key of unusedKeys) {
        delete this.settings.stats[key];
    }

    new Notice(i10n.statsCleaned[userLang]);

    await this.saveSettings();
}

export function handleContextMenu(event: MouseEvent, plugin: VocabularyView, el: HTMLElement, ctx: MarkdownPostProcessorContext, source: string, cardStat?: CardStat, cardList?: CardList, contentAfter?: string): void {
    // Prevent default context menu to avoid conflicts
    event.preventDefault();
    event.stopPropagation();

    const isVocaCard = el.classList.contains("block-language-voca-card");
    const menu = new Menu();

    menu.addItem((item) => item
        // clean up old stats
        .setTitle(i10n.clean[userLang])
        .setIcon("trash")
        .onClick(async () => await cleanStats.bind(plugin)())
    );

    menu.addItem((item) => item
        // change language
        .setTitle(isVocaCard ? i10n.tableSwitch[userLang] : i10n.cardSwitch[userLang])
        .setIcon("arrow-right")
        .onClick(async () => {
            await replaceLanguage(plugin, ctx, el);
            el.detach();
            if (!isVocaCard) {
                await plugin.parseCodeBlock(source, el, ctx);
            } else {
                await plugin.renderTable(source, el, ctx);
                el.addEventListener("contextmenu", (event) => handleContextMenu(event, plugin, el, ctx, source));
            }
        })
    );

    if (cardStat && cardList && contentAfter) {
        menu.addItem((item) => item
            // change mode (random/next)
            .setTitle(plugin.mode === "random" ? i10n.next[userLang] : i10n.random[userLang])
            .setIcon("arrow-right")
            .onClick(async () => {
                plugin.mode = plugin.mode === "random" ? "next" : "random";
                await plugin.saveSettings();
                (el.querySelector(".mode-div") as HTMLSpanElement).textContent = plugin.mode === "random" ? i10n.random[userLang] : i10n.next[userLang];
            })
        );

        menu.addItem((item) => item
            // invert showing
            .setTitle(plugin.invert ? i10n.normal[userLang] : i10n.invert[userLang])
            .setIcon("arrow-right")
            .onClick(async () => {
                plugin.invert = !plugin.invert;
                await plugin.saveSettings();
                (el.querySelector(".invert-div") as HTMLSpanElement).textContent = plugin.invert ? i10n.invert[userLang] : i10n.normal[userLang];
                await renderCard(plugin, cardStat, cardList, el, ctx, contentAfter);
            })
        );
    }

    try {
        // Try to show menu at mouse event position first
        menu.showAtMouseEvent(event);
    } catch {
        try {
            // Fallback: show menu at a fixed position relative to the element
            const rect = el.getBoundingClientRect();
            menu.showAtPosition({ x: rect.left + 10, y: rect.top + 10 });
        } catch {
            try {
                // Linux/Flatpak fallback: try showing at document center
                menu.showAtPosition({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2
                });
            } catch (finalError) {
                console.error("All context menu methods failed:", finalError);
                // Last resort: show a notice with available actions
                new Notice("Context menu unavailable on this system. Enable 'Use dropdown menu' in settings as an alternative.");
            }
        }
    }
}

export function showDropdownActions(plugin: VocabularyView, el: HTMLElement, ctx: MarkdownPostProcessorContext, source: string, cardStat?: CardStat, cardList?: CardList, contentAfter?: string): void {
    const isVocaCard = el.classList.contains("block-language-voca-card");

    // Create a temporary dropdown container
    const dropdownContainer = el.createEl('div', {
        cls: 'temp-dropdown-container',
        attr: { style: 'position: absolute; top: 0; left: 0; z-index: 1000;' }
    });

    const dropdown = new DropdownComponent(dropdownContainer);

    // Add options
    dropdown.addOption('clean', `🗑️ ${i10n.clean[userLang]}`);
    dropdown.addOption('switch', `↔️ ${isVocaCard ? i10n.tableSwitch[userLang] : i10n.cardSwitch[userLang]}`);

    if (cardStat && cardList && contentAfter) {
        dropdown.addOption('mode', `🔀 ${plugin.mode === "random" ? i10n.next[userLang] : i10n.random[userLang]}`);
        dropdown.addOption('invert', `🔄 ${plugin.invert ? i10n.normal[userLang] : i10n.invert[userLang]}`);
    }

    dropdown.onChange(async (value) => {
        switch (value) {
            case 'clean':
                await cleanStats.bind(plugin)();
                break;
            case 'switch':
                await replaceLanguage(plugin, ctx, el);
                el.detach();
                if (!isVocaCard) {
                    await plugin.parseCodeBlock(source, el, ctx);
                } else {
                    await plugin.renderTable(source, el, ctx);
                }
                break;
            case 'mode':
                if (cardStat && cardList) {
                    plugin.mode = plugin.mode === "random" ? "next" : "random";
                    await plugin.saveSettings();
                    (el.querySelector(".mode-div") as HTMLSpanElement).textContent = plugin.mode === "random" ? i10n.random[userLang] : i10n.next[userLang];
                }
                break;
            case 'invert':
                if (cardStat && cardList && contentAfter) {
                    plugin.invert = !plugin.invert;
                    await plugin.saveSettings();
                    (el.querySelector(".invert-div") as HTMLSpanElement).textContent = plugin.invert ? i10n.invert[userLang] : i10n.normal[userLang];
                    await renderCard(plugin, cardStat, cardList, el, ctx, contentAfter);
                }
                break;
        }
        dropdownContainer.remove();
    });

    // Position the dropdown near the click
    const rect = el.getBoundingClientRect();
    dropdownContainer.style.left = `${rect.left}px`;
    dropdownContainer.style.top = `${rect.bottom}px`;

    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (dropdownContainer.parentNode) {
            dropdownContainer.remove();
        }
    }, 10000);
}

export function remainingCards(plugin: VocabularyView, cardList: CardList, cardStat: CardStat): Card | undefined {
    const remainingCards = cardList.cards.filter(c => c !== cardList.currentCard);
    return remainingCards.length ? getNextCard(plugin, remainingCards, cardStat, cardList) : undefined;
}

export async function renderSingleCard(plugin: VocabularyView, cardList: CardList, cardStat: CardStat, el: HTMLElement, ctx: MarkdownPostProcessorContext, source: string): Promise<void> {
    if (cardList.cards.length) {
        await cardStat.resolveId();
    }
    const card = remainingCards(plugin, cardList, cardStat);
    if (!card) return;
    cardList.currentCard = card;

    await cardStat.cleanupSavedStats();

    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
    renderCardStats(el, cardStat, card, cardList);
    renderCardContent(plugin, el, card);
    renderCardButtons(plugin, el, card, cardStat, cardList, el, ctx, source);
}