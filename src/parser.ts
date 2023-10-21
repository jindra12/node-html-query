import { HtmlDocument } from "./html";
import { Lexer, LexerType, cssLexerAtoms, htmlLexerAtoms } from "./lexers";
import { SelectorGroup } from "./selector";
import { Queue, QueueItem } from "./types";

const parseLexer = (input: string, lexer: Partial<Record<LexerType, Lexer>>): QueueItem[] => {
    const acc: QueueItem[] = [];
    const lexers = Object.values(lexer);
    const lexerKeys = Object.keys(lexer) as LexerType[];

    let parsedIndex = 0;
    const mode: string[] = [];
    
    while (parsedIndex < input.length) {
        let matchedValue = "";
        const matchedLexer = lexers.findIndex((lexer) => {
            const matchesMode = mode.length === 0 || lexer.mode === mode[mode.length - 1];
            if (!matchesMode) {
                return false;
            }
            const matchesRegex = new RegExp(`^.{${parsedIndex}}(${lexer.value})`, "gmu").exec(input);
            if (typeof matchesRegex?.[1] !== "string") {
                return false;
            }
            const groupMatch = matchesRegex[1];
            parsedIndex += groupMatch.length;
            matchedValue = groupMatch;
            if (lexer.popMode) {
                mode.pop();
            }
            if (lexer.pushMode) {
                mode.push(lexer.pushMode);
            }
            return true;
        });
        if (matchedLexer === -1) {
            throw `${input.slice(parsedIndex)} does not match any known lexer items`;
        }
        acc.push({
            type: lexerKeys[matchedLexer],
            value: matchedValue,
        });
    }
    acc.push({ type: "EOF", value: "" });
    return acc;
};

const parsedHtmlLexer = Object.entries(htmlLexerAtoms).reduce((lexer: Partial<Record<LexerType, Lexer>>, [lexerKey, lexerValue]) => {
    const typedKey = lexerKey as LexerType;
    lexer[typedKey] = lexerValue instanceof RegExp ? { value: lexerValue } : lexerValue;
    return lexer;
}, {});

const parsedQueryLexer = Object.entries(cssLexerAtoms).reduce((lexer: Partial<Record<LexerType, Lexer>>, [lexerKey, lexerValue]) => {
    const typedKey = lexerKey as LexerType;
    lexer[typedKey] = lexerValue instanceof RegExp ? { value: lexerValue } : lexerValue;
    return lexer;
}, {});

export const parseHtmlLexer = (input: string) => {
    return parseLexer(input, parsedHtmlLexer);
};

export const parseQueryLexer = (input: string) => {
    return parseLexer(input, parsedQueryLexer);
};

export const htmlParser = (input: string) => {
    const lexerAtoms = parseHtmlLexer(input);
    const createQueue = (at: number): Queue => {
        return {
            items: lexerAtoms,
            at: at,
            next: () => createQueue(at + 1),
        };
    };
    const queue = createQueue(0);
    const document = new HtmlDocument();
    const endQueue = document.process(queue);
    const remainingLexerAtoms = lexerAtoms.slice(endQueue.at).filter((atom) => atom.type !== "EOF");
    if (remainingLexerAtoms.length > 0) {
        throw `Error in parsing encountered at: ${remainingLexerAtoms.slice(0, 5).map(({ type }) => type).join(", ")}, near: ${remainingLexerAtoms[0].value.slice(0, 100)}...`
    }
    return document;
};

export const queryParser = (input: string) => {
    const lexerAtoms = parseQueryLexer(input);
    const createQueue = (at: number): Queue => {
        return {
            items: lexerAtoms,
            at: at,
            next: () => createQueue(at + 1),
        };
    };
    const queue = createQueue(0);
    const selectorGroup = new SelectorGroup();
    const endQueue = selectorGroup.process(queue);
    const remainingLexerAtoms = lexerAtoms.slice(endQueue.at).filter((atom) => atom.type !== "EOF");
    if (remainingLexerAtoms.length > 0) {
        throw `Error in parsing encountered at: ${remainingLexerAtoms.slice(0, 5).map(({ type }) => type).join(", ")}, near: ${remainingLexerAtoms[0].value.slice(0, 100)}...`
    }
    return selectorGroup;
};