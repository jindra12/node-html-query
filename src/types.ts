import { LexerType } from "./lexers";

export interface ParserItem {
    consumed: () => boolean;
    process: (queue: Queue) => Queue;
    search: (searcher: Searcher) => void;
}

export class LexerItem<T extends LexerType> {
    item: T;
    value = "";
    constructor(item: T, value?: string) {
        this.item = item;
        if (value) {
            this.value = value;
        }
    }
}

export interface QueueItem {
    type: LexerType;
    value: string;
}

export interface Queue {
    items: QueueItem[];
    at: number;
    next: () => Queue;
}

export interface Searcher {
    feedParserItem: (item: ParserItem | undefined) => void;
    feedParserItems: (item: ParserItem[]) => void;
    feedLexerItem: <T extends LexerType>(item: LexerItem<T> | undefined) => void;
}