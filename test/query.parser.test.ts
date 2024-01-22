import { parseLexer, createQueueFromItems, checkIfNothingRemains, parsedQueryLexer } from "../src/parser";
import * as Query from "../src/selector";
import { ParserItem } from "../src/types";
import { parserItemToString } from "../src/utils";

const queryTestParser = (input: string, instance: ParserItem) => {
    const queueItems = parseLexer(input, parsedQueryLexer).queue;
    const queue = createQueueFromItems(queueItems);
    const processed = instance.process(queue);
    checkIfNothingRemains(queueItems, processed);
    if (!instance.consumed()) {
        throw `Instance could not consume test`;
    }
    return instance;
};

const testParseToString = (input: string, instance: ParserItem) => parserItemToString(queryTestParser(input, instance));

const testPseudo = new Query.FunctionalPseudo();

const tests: { [Type in keyof typeof Query]: {
    instance: () => InstanceType<(typeof Query)[Type]>,
    passes: string[],
    fails?: string[],
}} = {
    Attrib: {
        instance: () => new Query.Attrib(),
        passes: ["[data-id]", "[data-id=text]", "[data-id=1]", "[data-id='text']", `[data-id="text"]`, "[data-id$='text']", "[data-id^='text']", "[data-id|='text']", "[data-id~='text']"],
        fails: ["Literally any random text []"],
    },
    ClassName: {
        instance: () => new Query.ClassName(),
        passes: [".class"],
        fails: ["not-a-class", ".class not a class"],
    },
    Combinator: {
        instance: () => new Query.Combinator(),
        passes: [" ", "+", "~", ">"],
        fails: ["-", "<", "+~"],
    },
    ElementName: {
        instance: () => new Query.ElementName(),
        passes: ["element-name", "element", "h1"],
        fails: ["1dz", "...", ","],
    },
    Expression: {
        instance: () => new Query.Expression(testPseudo),
        passes: ["even", "odd", "1", "2n", "2n + 1", "-1n - 1", "-2n + 1", "2n of .className", "2 of #hash"],
        fails: ["2 + 1", "--1", "-5n + n", ""],
    },
    FunctionalPseudo: {
        instance: () => new Query.FunctionalPseudo(),
        passes: ["nth-child( 2)", "nth-child(2n + 1)", "nth-of-type(n + 1)", "has(+ p)", "is(div, p, h1)"],
        fails: ["before", "after", "nth-child"],
    },
    Negation: {
        instance: () => new Query.Negation(),
        passes: [":not(.className)"],
        fails: [":not(", ":not(.className", ".className"],
    },
    NegationArg: {
        instance: () => new Query.NegationArg(),
        passes: ["*|div", "prefix|div", ".class", "#id", "[id=1]", "[id]", "[id$=2]", ":first-child", "p"],
        fails: ["12", "2n + 1"],
    },
    Pseudo: {
        instance: () => new Query.Pseudo(),
        passes: [":first-child", "::first-child"],
        fails: ["not-a-child"],
    },
    Selector: {
        instance: () => new Query.Selector(),
        passes: ["p", "div > p", "div > #id", ".class > .class", "div + div", "p ~ p", "div > div > div", "p + p > p", "#id #id #id", "p + p + p", "p ~ p ~ p"],
        fails: ["+ p", "p +"],
    },
    SelectorGroup: {
        instance: () => new Query.SelectorGroup(),
        passes: ["div, div", "p, p", "p > p, div + div", "p, p, p", "#id, .class, p", ".class"],
        fails: ["div,", ",div"],
    },
    SimpleSelectorSequence: {
        instance: () => new Query.SimpleSelectorSequence(),
        passes: ["*|div", "prefix|div", ".class", "#id", "[id=1]", "[id]", "[id$=2]", "p", "*"],
        fails: ["12", "2n + 1", "div, div"],
    },
    TypeNamespacePrefix: {
        instance: () => new Query.TypeNamespacePrefix(),
        passes: ["*|", "div|"],
        fails: ["div", "*"],
    },
    TypeSelector: {
        instance: () => new Query.TypeSelector(),
        passes: ["namespace|div", "article"],
        fails: ["|"],
    },
    Universal: {
        instance: () => new Query.Universal(),
        passes: ["*", "namespace|*"],
        fails: ["."],
    },
    Ws: {
        instance: () => new Query.Ws(),
        passes: [" ", "   "],
        fails: ["a", " a"],
    }
};

describe("Can parse Query items", () => {
    Object.entries(tests).forEach(([name, test]) => {
        test.passes.forEach((passes) => {
            it(`${name} parse ${passes.slice(0, 100)} contents and return exactly the same string`, () => {
                expect(testParseToString(passes, test.instance())).toBe(passes);
            });
        });
        test.fails?.forEach((fails) => {
            it(`${name} parse ${fails.slice(0, 100)} contents and throws an exception`, () => {
                expect(() => testParseToString(fails, test.instance())).toThrow();
            });
        });
    })
});