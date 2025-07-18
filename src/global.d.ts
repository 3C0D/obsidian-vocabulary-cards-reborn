declare module "obsidian " {
    interface StatRecord {
        r: number;
        w: number;
    }

    interface PageStats {
        [derivative: string]: StatRecord;
    }

    interface SectionInfo {
        lineStart: number;
        lineEnd: number;
        text: string;
    }

    interface Settings {
        stats: Record<string, PageStats>;
        showTime: number;
        explainTime: number;
        disableConfirmationButtons: boolean;
        showContextMenuButton: boolean;
    }
}