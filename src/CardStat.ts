import type { App, MarkdownPostProcessorContext } from "obsidian";
import type { SectionInfo, PageStats } from "obsidian ";
import type { Card } from "./Card.ts";
import type { CardList } from "./CardList.ts";
import type VocabularyView from "./main.ts";
import { createIdfromDate } from "./utils.ts";


export class CardStat {
    private id = "";

    constructor(
        private plugin: VocabularyView,
        private app: App,
        private el: HTMLElement,
        private ctx: MarkdownPostProcessorContext,
        private cardList: CardList
    ) { }

    async resolveId(): Promise<string | undefined> {
        // get section info lineStart, lineEnd, text (page content)
        const sectionInfo = this.ctx.getSectionInfo(this.el);
        if (!sectionInfo) return "";

        // get header
        const lines = sectionInfo.text.split('\n');
        const codeBlockHeader = lines[sectionInfo.lineStart] ?? '';
        // get attribute id
        const match = /^`{3,}\S+\s+(.*)$/.exec(codeBlockHeader);

        if (!match) {
            this.id = await this.createAndSaveNewId(this.app, lines, sectionInfo);
        } else {
            this.id = match[1].trim();
        }
    }

    private async createAndSaveNewId(app: App, lines: string[], sectionInfo: SectionInfo): Promise<string> {
        const id = createIdfromDate();
        const file = app.vault.getFileByPath(this.ctx.sourcePath);
        if (!file) return "";

        await app.vault.process(file, (content) => {
            const newLines = lines.slice();//copy
            newLines[sectionInfo.lineStart] = newLines[sectionInfo.lineStart].trim() + ` id:${id}`;
            const newText = newLines.join('\n');
            return content.replace(sectionInfo.text, newText);
        });

        return id;
    }

    getStats(card: Card): [number, number] {
        const pageStats = this.plugin.settings.stats[this.id];
        if (!pageStats) return [card.rightCount, card.wrongCount];//[0,0] by default
        const answer = pageStats[card.derivative];
        return answer ? [answer.r, answer.w] : [card.rightCount, card.wrongCount];
    }

    async cleanupSavedStats(): Promise<void> {
        const stats = this.plugin.settings.stats;
        if (!stats[this.id]) return;

        const currentDerivatives = new Set(this.cardList.cards.map(card => card.derivative));
        const statsToKeep: PageStats = {};

        for (const [derivative, stat] of Object.entries(stats[this.id])) {
            if (currentDerivatives.has(derivative)) {
                statsToKeep[derivative] = stat;
            }
        }

        stats[this.id] = statsToKeep;
        await this.plugin.saveSettings();
    }

    async rightAnswer(card: Card): Promise<void> {
        await this.updateAnswer(card, true);
    }

    async wrongAnswer(card: Card): Promise<void> {
        await this.updateAnswer(card, false);
    }

    private async updateAnswer(card: Card, isRight: boolean): Promise<void> {
        if (!this.plugin.settings.stats[this.id]) {
            this.plugin.settings.stats[this.id] = {};
        }

        if (isRight) {
            card.incrementRight();
            card.setWrong(0);
        } else {
            card.incrementWrong();
            card.setRight(0);
        }

        this.plugin.settings.stats[this.id][card.derivative] = {
            r: card.rightCount,
            w: card.wrongCount
        };

        await this.plugin.saveSettings();
    }
}