import { LexerType } from "./lexers";

export interface ParserItem {
    consumed: () => boolean;
    process: (queue: Queue) => Queue;
    search: (searcher: Searcher) => void;
}

export class LexerItem<T extends LexerType> {
    item: T;
    value = "";
    constructor(item: T) {
        this.item = item;
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
    feedParserItem: (item: ParserItem) => void;
    feedParserItems: (item: ParserItem[]) => void;
    feedLexerItem: <T extends LexerType>(item: LexerItem<T>) => void;
}