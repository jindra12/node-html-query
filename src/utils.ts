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

const sanitizeAttribute = (attribute: string | undefined) => {
    if (!attribute) {
        return attribute;
    }
    if (attribute[0] === `"`) {
        return attribute.replace(/"/gmu, "");
    }
    if (attribute[0] === `'`) {
        return attribute.replace(/'/gmu, "");
    }
    return attribute;
};

/**
    [attr]
        Represents elements with an attribute name of attr.
    [attr=value]
        Represents elements with an attribute name of attr whose value is exactly value.
    [attr~=value]
        Represents elements with an attribute name of attr whose value is a whitespace-separated list of words, one of which is exactly value.
    [attr|=value]
        Represents elements with an attribute name of attr whose value can be exactly value or can begin with value immediately followed by a hyphen, - (U+002D). It is often used for language subcode matches.
    [attr^=value]
        Represents elements with an attribute name of attr whose value is prefixed (preceded) by value.
    [attr$=value]
        Represents elements with an attribute name of attr whose value is suffixed (followed) by value.
    [attr*=value]
        Represents elements with an attribute name of attr whose value contains at least one occurrence of value within the string.
 */
export const matchAttribute = (attributes: Record<string, string>, attributeName: string, attributeValue: string, matchType: "[attr]" | "[attr=value]" | "[attr~=value]" | "[attr|=value]" | "[attr^=value]" | "[attr$=value]" | "[attr*=value]" | "not") => {
    const comparedAttribute = sanitizeAttribute(attributes[attributeName]);
    switch (matchType) {
        case "[attr^=value]":
            return comparedAttribute?.startsWith(attributeValue) || false;
        case "[attr$=value]":
            return comparedAttribute?.endsWith(attributeValue) || false;
        case "[attr*=value]":
            return comparedAttribute?.includes(attributeValue) || false;
        case "[attr]":
            return Object.keys(attributes).includes(attributeName);
        case "[attr|=value]":
            return comparedAttribute === attributeValue || `${attributeValue}-` === comparedAttribute;
        case "[attr~=value]":
            return comparedAttribute?.split(/\s/gmu).some((separated) => separated === attributeValue) || false;
        case "[attr=value]":
            return comparedAttribute === attributeValue;
        case "not":
            return !comparedAttribute || comparedAttribute !== attributeValue;
    }
};

/**
    week 	yyyy-W## 	<input type="week" min="2019-W23" step="">
    time 	hh:mm 	<input type="time" min="09:00" step="900">
    
    month 	yyyy-mm 	<input type="month" min="2019-12" step="12">
    date 	yyyy-mm-dd 	<input type="date" min="2019-12-25" step="1">
    datetime-local 	yyyy-mm-ddThh:mm 	<input type="datetime-local" min="2019-12-25T19:30">
    
    number 	<number> 	<input type="number" min="0" step="5" max="100">
    range 	<number> 	<input type="range" min="60" step="5" max="100">
 */
const rangeComparator = (maxAttribute: string, minAttribute: string, valueAttribute: string) => {
    const max = sanitizeAttribute(maxAttribute) || "";
    const min = sanitizeAttribute(minAttribute) || "";
    const value = sanitizeAttribute(valueAttribute) || "";

    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
        const numMin = parseFloat(min);
        const isMinValid = !numMin || (numValue <= numMin);
        const numMax = parseFloat(max);
        const isMaxValid = !numMax || (numValue >= numMax);
        return isMinValid && isMaxValid;
    }

    const dateValue = new Date(value);
    if (!isNaN(dateValue.getTime())) {

    }

    return false;
};

let id = 0;
export const uniqueId = (prefix: string) => {
    return `${prefix}${id++}`
};