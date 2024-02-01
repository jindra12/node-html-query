import { LexerType } from "./lexers";
import { LexerItem, ParserItem, Searcher } from "./types";

const searchProducer = (
    reducer: (item: ParserItem | LexerItem<LexerType>) => void
): Searcher => {
    const searcher: Searcher = {
        feedLexerItem: (lexer) => {
            if (lexer?.value) {
                reducer(lexer);
            }
        },
        feedParserItem: (parser) => {
            if (!parser?.consumed()) {
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

export const getItems = <T extends ParserItem>(document: ParserItem, validator: (item: ParserItem | LexerItem<any>) => item is T) => {
    const items: T[] = [];
    const searcher = searchProducer((item) => {
        if (validator(item)) {
            items.push(item);
        }
    });
    document.search(searcher);
    return items;
}

export const parserItemToString = (document?: ParserItem) => {
    let aggregate = "";
    const searcher = searchProducer((item) => {
        if (item instanceof LexerItem) {
            aggregate += item.value;
        }
        return true;
    });
    document?.search(searcher);
    return aggregate;
};

export const desanitizeAttribute = (attributeValue: string) => {
    const hasDoubleQuote = attributeValue.includes('"');
    const hasSingleQuote = attributeValue.includes("'");
    const hasBothTypesOfQuote = hasSingleQuote && hasDoubleQuote;
    const hasNoQuotes = !hasSingleQuote && !hasDoubleQuote;

    if (hasBothTypesOfQuote) {
        return `'${attributeValue.replace(/"/gmu, "&quot;")}'`;
    } else if (hasDoubleQuote) {
        return `'${attributeValue}'`;
    } else if (!hasNoQuotes) {
        return attributeValue;
    } else {
        return `"${attributeValue}"`;
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
export const matchAttribute = <T extends string | boolean>(attributes: Partial<Record<string, string>>, attributeName: string, attributeValue: T, matchType: T extends boolean ? ("[attr]" | "not") : ("[attr]" | "[attr=value]" | "[attr~=value]" | "[attr|=value]" | "[attr^=value]" | "[attr$=value]" | "[attr*=value]" | "not")) => {
    if (typeof attributeValue === "boolean") {
        if (matchType === "[attr]") {
            return Object.keys(attributes).includes(attributeName) === attributeValue;
        } else {
            return Object.keys(attributes).includes(attributeName) !== attributeValue;
        }
    } else {
        const comparedAttribute = attributes[attributeName];
        const sanitizedAttributeValue = sanitizeAttribute(attributeValue)!;
        switch (matchType) {
            case "[attr^=value]":
                return comparedAttribute?.startsWith(sanitizedAttributeValue) || false;
            case "[attr$=value]":
                return comparedAttribute?.endsWith(sanitizedAttributeValue) || false;
            case "[attr*=value]":
                return comparedAttribute?.includes(sanitizedAttributeValue) || false;
            case "[attr]":
                return Object.keys(attributes).includes(sanitizedAttributeValue);
            case "[attr|=value]":
                return comparedAttribute === sanitizedAttributeValue || `${sanitizedAttributeValue}-` === comparedAttribute;
            case "[attr~=value]":
                return comparedAttribute?.split(/\s/gmu).some((separated) => separated === sanitizedAttributeValue) || false;
            case "[attr=value]":
                return comparedAttribute === sanitizedAttributeValue;
            case "not":
                return !comparedAttribute || comparedAttribute !== sanitizedAttributeValue;
        }
    }
    return false;
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
export const rangeComparator = (attributes: Partial<Record<string, string>>) => {
    const max = attributes["max"] || "";
    const min = attributes["min"] || "";
    const step = attributes["step"] || "";
    const value = attributes["value"] || "";
    const type = attributes["type"] || "text";

    const numValue = /^((-?0(\.\d*)?)|(-?[1-9]\d*(\.\d*)?))$/gmui.test(value) ? parseFloat(value) : NaN;
    if (!isNaN(numValue)) {
        const numMin = parseFloat(min);
        const isMinValid = !numMin || (numValue >= numMin);
        const numMax = parseFloat(max);
        const isMaxValid = !numMax || (numValue <= numMax);
        const numStep = parseFloat(step);
        const isStepValid = !numStep || numValue % numStep === 0;
        return isMinValid && isMaxValid && isStepValid;
    }

    const dateValue = new Date(value);
    if (type === "month" || type == "date" || type === "datetime-local" || !isNaN(dateValue.getTime())) {
        const resolveStep = () => {
            const stepNum = parseInt(step);
            if (stepNum) {
                const monthRegex = /^\d+-(\d{2})$/gmui;
                const dateRegex = /^\d+-\d{2}-(\d{2})$/gmui;
                const dateTimeRegex = /^\d+-\d{2}-\d{2}T\d{2}:(\d{2})$/gmui;
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
        const isMinValid = isNaN(dateMin.getTime()) || ((dateValue.getTime() || 0) >= dateMin.getTime());
        const dateMax = new Date(max);
        const isMaxValid = isNaN(dateMax.getTime()) || ((dateValue.getTime() || 0) <= dateMax.getTime());
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
        const isMinValid = weekMin === undefined || (weekValue >= weekMin);
        const weekMax = getWeekValue(max);
        const isMaxValid = weekMax === undefined || (weekValue <= weekMax);
        const weekStep = parseInt(step);
        const isStepValid = !weekStep || ((weekValue % 100) % weekStep === 0);
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
        const isMinValid = timeMin === undefined || (timeValue >= timeMin);
        const timeMax = getTimeValue(max);
        const isMaxValid = timeMax === undefined || (timeValue <= timeMax);
        const minuteStep = parseInt(step);
        const isStepValid = !minuteStep || timeValue % minuteStep === 0;
        return isMinValid && isMaxValid && isStepValid;
    }

    return false;
};

/**
 * pattern, min, max, required, step, minlength, maxlength
 */
export const inputValidation = (attributes: Partial<Record<string, string>>, getAttributes: () => Partial<Record<string, string>>[]) => {
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
    if (patternValidation && !patternValidation.test(value)) {
        return false;
    }
    if ((attributes["min"] || attributes["max"] || attributes["step"]) && !rangeComparator(attributes)) {
        return false;
    }
    if (Object.keys(attributes).includes("required")) {
        if (type === "radio" && !value) {
            const allAttributes = getAttributes();
            const hasAnotherChecked = allAttributes.some((attributes) => {
                const otherValue = attributes["value"] || "";
                const otherType = attributes["type"] || "text";
                const otherName = attributes["name"] || "";
                return Boolean(otherValue) && otherType === "radio" && otherName === name;
            });
            if (!hasAnotherChecked) {
                return false;
            }
        }
        if (!Boolean(value) && !(type === "checkbox" && Object.keys(attributes).includes("checked"))) {
            return false;
        }
    }
    if (attributes["minlength"]) {
        const minlength = parseInt(attributes["minlength"] || "");
        if (!isNaN(minlength) && value.length < minlength) {
            return false;
        }
    }
    if (attributes["maxlength"]) {
        const maxlength = parseInt(attributes["maxlength"] || "");
        if (!isNaN(maxlength) && value.length > maxlength) {
            return false;
        }
    }
    return true;
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