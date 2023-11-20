import { LexerType } from "./lexers";
import { LexerItem, ParserItem, Searcher } from "./types";

export const consumeCache = (consumeFn: () => boolean) => {
    let resolved: boolean | undefined;
    return () => resolved ||= consumeFn();
};

const searchProducer = (
    reducer: (item: ParserItem | LexerItem<LexerType>) => boolean
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

export const parserItemToString = (document: ParserItem) => {
    let aggregate = "";
    const searcher = searchProducer((item) => {
        if (item instanceof LexerItem) {
            aggregate += item.value;
        }
        return true;
    });
    document.search(searcher);
    return aggregate;
};

export const desanitizeAttribute = (attributeValue: string) => {
    const hasDoubleQuote = attributeValue.includes('"');
    const hasSingleQuote = attributeValue.includes("'");
    const hasBothTypesOfQuote = hasSingleQuote && hasDoubleQuote;

    if (hasBothTypesOfQuote) {
        return `'${attributeValue.replace(/"/gmu, "&quot;")}'`;
    } else if (hasDoubleQuote) {
        return `'${attributeValue}'`;
    } else {
        return `"${attributeValue}"`
    }

};

export const sanitizeAttribute = (attribute: string | undefined) => {
    if (!attribute) {
        return attribute;
    }
    if (attribute[0] === `"`) {
        return attribute.replace(/^"/gmu, "").replace(/"$/gmu, "").replace(/&quot;/, '"');
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
    const comparedAttribute = attributes[attributeName];
    attributeValue = sanitizeAttribute(attributeValue)!;
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
export const rangeComparator = (attributes: Record<string, string>) => {
    const max = attributes["max"] || "";
    const min = attributes["min"] || "";
    const step = attributes["step"] || "";
    const value = attributes["value"] || "";
    const type = attributes["type"] || "text";

    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
        const numMin = parseFloat(min);
        const isMinValid = !numMin || (numValue <= numMin);
        const numMax = parseFloat(max);
        const isMaxValid = !numMax || (numValue >= numMax);
        const numStep = parseFloat(step);
        const isStepValid = !numStep || numValue % numStep === 0;
        return isMinValid && isMaxValid && isStepValid;
    }

    const dateValue = new Date(value);
    if (type === "month" || type == "date" || type === "datetime-local" || !isNaN(dateValue.getTime())) {
        const resolveStep = () => {
            const stepNum = parseInt(step);
            if (stepNum) {
                const monthRegex = /^\d+-(\d{2})$/;
                const dateRegex = /^\d+-\d{2}-(\d{2})$/;
                const dateTimeRegex = /^\d+-\d{2}-\d{2}-\d{2}T\d{2}:(\d{2})$/;
                const monthExec = monthRegex.exec(value);
                if (monthExec) {
                    const month = parseInt(monthExec[1]);
                    return month % stepNum === 0;
                }
                const dateExec = dateRegex.exec(value);
                if (dateExec) {
                    const day = parseInt(dateExec[1]);
                    return day % stepNum === 0;
                }
                const dateTimeExec = dateTimeRegex.exec(value);
                if (dateTimeExec) {
                    const minute = parseInt(dateTimeExec[1]);
                    return minute % stepNum === 0;
                }
            }
            return true;
        };
        const dateMin = new Date(min);
        const isMinValid = isNaN(dateMin.getTime()) || ((dateValue.getTime() || 0) <= dateMin.getTime());
        const dateMax = new Date(max);
        const isMaxValid = isNaN(dateMax.getTime()) || ((dateValue.getTime() || 0) >= dateMax.getTime());
        return isMinValid && isMaxValid && resolveStep();
    }

    const getWeekValue = (val: string) => {
        const weekRegex = /^(\d+)-W(\d{2})$/gmu;
        const match = weekRegex.exec(val);
        if (match?.length !== 3) {
            return undefined;
        }
        const [year, weeks] = match.slice(1).map((part) => parseInt(part));
        return year * 100 + weeks;
    };
    const weekValue = getWeekValue(value);
    if (weekValue !== undefined) {
        const weekMin = getWeekValue(min);
        const isMinValid = weekMin === undefined || (weekValue <= weekMin);
        const weekMax = getWeekValue(max);
        const isMaxValid = weekMax === undefined || (weekMax >= weekValue);
        const weekStep = parseInt(step);
        const isStepValid = !weekStep || (weekValue % weekStep === 0);
        return isMinValid && isMaxValid && isStepValid;
    }

    const getTimeValue = (val: string) => {
        const timeRegex = /^(\d{2}):(\d{2})$/;
        const match = timeRegex.exec(val);
        if (match?.length !== 3) {
            return undefined;
        }
        const [hours, minutes] = match.slice(1).map((part) => parseInt(part));
        return hours * 60 + minutes;
    };

    const timeValue = getTimeValue(value);
    if (timeValue !== undefined) {
        const timeMin = getTimeValue(min);
        const isMinValid = timeMin === undefined || (timeValue <= timeMin);
        const timeMax = getTimeValue(max);
        const isMaxValid = timeMax === undefined || (timeMax >= timeValue);
        const minuteStep = parseInt(step);
        const isStepValid = !minuteStep || timeValue % minuteStep === 0;
        return isMinValid && isMaxValid && isStepValid;
    }

    return false;
};

/**
 * pattern, min, max, required, step, minlength, maxlength
 */
export const inputValidation = (attributes: Record<string, string>, getAttributes: () => Record<string, string>[]) => {
    const value = attributes["value"] || "";
    const type = attributes["type"] || "text";
    const name = attributes["name"] || "";
    const patternValidation = (() => {
        const pattern = attributes["pattern"];
        try {
            return pattern ? new RegExp(pattern) : undefined;
        } catch {
            return undefined;
        }
    })();
    let valid = true;
    if (patternValidation) {
        valid = patternValidation.test(value);
    }
    if (attributes["min"] || attributes["max"] || attributes["step"]) {
        valid = valid && rangeComparator(attributes);
    }
    if (attributes["required"]) {
        if (type === "radio" && !value && valid) {
            const allAttributes = getAttributes();
            const hasAnotherChecked = allAttributes.some((attributes) => {
                const otherValue = attributes["value"] || "";
                const otherType = attributes["type"] || "text";
                const otherName = attributes["name"] || "";
                return Boolean(otherValue) && otherType === "radio" && otherName === name;
            });
            valid = hasAnotherChecked;
        }
        valid = valid && (Boolean(value) || (type === "checkbox" || Object.keys(attributes).includes("checked")));
    }
    if (attributes["minlength"]) {
        const minlength = parseInt(attributes["minlength"] || "");
        valid = valid && (isNaN(minlength) || value.length >= minlength);
    }
    if (attributes["maxlength"]) {
        const maxlength = parseInt(attributes["maxlength"] || "");
        valid = valid && (isNaN(maxlength) || value.length <= maxlength);
    }
    return valid;
};

export const flatten = <T>(multi: T[][]): T[] => {
    return multi.reduce((flatten: T[], item) => {
        item.forEach((value) => {
            flatten.push(value);
        })
        return flatten;
    }, []);
};

let id = 0;
export const uniqueId = (prefix: string) => {
    return `${prefix}${id++}`
};