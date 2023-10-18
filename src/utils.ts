import { LexerType } from "./lexers";
import { LexerItem, ParserItem, Searcher } from "./types";

const searchProducer = (
    reducer: (item: ParserItem | LexerItem<LexerType>) => void
): Searcher => {
    const searcher: Searcher = {
        feedLexerItem: (lexer) => {
            if (lexer.value) {
                reducer(lexer);
            }
        },
        feedParserItem: (parser) => {
            if (!parser.consumed()) {
                return;
            }
            reducer(parser);
            parser.search(searcher);
        },
        feedParserItems: (parsers) => {
            parsers.forEach((parser) => searcher.feedParserItem(parser));
        },
    };
    return searcher;
};

export const printer = (document: ParserItem) => {
    let aggregate = "";
    const searcher = searchProducer((item) => {
        if (item instanceof LexerItem) {
            aggregate += item.value;
        }
    });
    document.search(searcher);
    return aggregate;
};

let id = 0;
export const uniqueId = (prefix: string) => {
    return `${prefix}${id++}`
};