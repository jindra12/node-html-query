import { HtmlDocument } from "./html";
import { Lexer, LexerType, cssLexerAtoms, htmlLexerAtoms } from "./lexers";
import { SelectorGroup } from "./selector";
import { ParserItem, Queue, QueueItem } from "./types";
import { parserItemToString } from "./utils";

export const parseLexer = (
    input: string,
    lexer: Partial<Record<LexerType, Lexer>>,
    compress: boolean,
    initialMode: string[] = [],
) => {
    const acc: QueueItem[] = [];
    const lexers = Object.values(lexer);
    const lexerKeys = Object.keys(lexer) as LexerType[];

    let parsedIndex = 0;
    const mode: string[] = initialMode;

    do {
        let matchedValue = "";
        const matchedLexer = lexers.findIndex((lexer) => {
            const matchesMode =
                (!lexer.mode && mode.length === 0) ||
                lexer.mode === mode[mode.length - 1];
            if (!matchesMode) {
                return false;
            }
            if (typeof lexer.value === "function") {
                const executed = lexer.value(input, parsedIndex);
                if (typeof executed === "number") {
                    const groupMatch = input.slice(parsedIndex, executed);
                    parsedIndex += groupMatch.length;
                    matchedValue = groupMatch;                    
                } else {
                    return false;
                }
            } else {
                const matchesRegex = new RegExp(
                    `^(${lexer.value.source})`,
                    "gu"
                ).exec(input.slice(parsedIndex));
                if (!matchesRegex?.[0]) {
                    return false;
                }
                const groupMatch = matchesRegex[0];
                parsedIndex += groupMatch.length;
                matchedValue = groupMatch;
            }
            if (lexer.popMode) {
                mode.pop();
            }
            if (lexer.pushMode) {
                mode.push(...lexer.pushMode);
            }
            return true;
        });
        if (matchedLexer === -1) {
            throw `${input.slice(
                parsedIndex
            ).slice(0, 25)}... does not match any known lexer items, matched previously: ${acc
                .map(({ type, value }) => `${type}:"${value}"`)
                .slice(-10)
                .join(",")}`;
        }
        if (!compress || lexerKeys[matchedLexer] !== "SEA_WS") {
            acc.push({
                type: lexerKeys[matchedLexer],
                value: matchedValue,
            });
        }
    } while (parsedIndex < input.length);
    acc.push({ type: "EOF", value: "" });
    return {
        queue: acc,
        mode: mode,
    };
};

export const parsedHtmlLexer = Object.entries(htmlLexerAtoms).reduce(
    (lexer: Partial<Record<LexerType, Lexer>>, [lexerKey, lexerValue]) => {
        const typedKey = lexerKey as LexerType;
        lexer[typedKey] =
            (lexerValue instanceof RegExp || typeof lexerValue === "function") ? { value: lexerValue } : lexerValue;
        return lexer;
    },
    {}
);

export const parsedQueryLexer = Object.entries(cssLexerAtoms).reduce(
    (lexer: Partial<Record<LexerType, Lexer>>, [lexerKey, lexerValue]) => {
        const typedKey = lexerKey as LexerType;
        lexer[typedKey] =
            lexerValue instanceof RegExp ? { value: lexerValue } : lexerValue;
        return lexer;
    },
    {}
);

const parseHtmlLexer = (input: string, compress: boolean) => {
    return parseLexer(input, parsedHtmlLexer, compress).queue;
};

const parseQueryLexer = (input: string) => {
    return parseLexer(input, parsedQueryLexer, false).queue;
};

export const createQueueFromItems = (lexerAtoms: QueueItem[]) => {
    const createQueue = (at: number): Queue => {
        return {
            items: lexerAtoms,
            at: at,
            next: () => createQueue(at + 1),
        };
    };
    return createQueue(0);
};

export const checkIfNothingRemains = (
    lexerAtoms: QueueItem[],
    endQueue: Queue,
    parent: ParserItem,
) => {
    const remainingLexerAtoms = lexerAtoms
        .slice(endQueue.at)
        .filter((atom) => atom.type !== "EOF");
    if (remainingLexerAtoms.length > 0) {
        throw `Error in parsing (finished: ${endQueue.at}/${lexerAtoms.length}) encountered at: ${remainingLexerAtoms
            .slice(0, 5)
            .map(({ type, value }) => `${type}: "${value}"`)
            .join(", ")}, remainder near error: ${parserItemToString(parent).slice(-50)}`;
    }
};

export const htmlParser = (input: string, compress: boolean) => {
    const lexerAtoms = parseHtmlLexer(input, compress);
    const document = new HtmlDocument();
    const endQueue = document.process(createQueueFromItems(lexerAtoms));
    checkIfNothingRemains(lexerAtoms, endQueue, document);
    return document;
};

export const queryParser = (input: string) => {
    const lexerAtoms = parseQueryLexer(input);
    const selectorGroup = new SelectorGroup();
    const endQueue = selectorGroup.process(createQueueFromItems(lexerAtoms));
    checkIfNothingRemains(lexerAtoms, endQueue, selectorGroup);
    return selectorGroup;
};

export const tryHtmlParser = (input: string, compress: boolean) => {
    try {
        return htmlParser(input, compress);
    } catch {
        return undefined;
    }
};

export const tryQueryParser = (input: string) => {
    try {
        return queryParser(input);
    } catch {
        return undefined;
    }
};
