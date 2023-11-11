import { parseLexer, createQueueFromItems, checkIfNothingRemains, parsedQueryLexer } from "../src/parser";
import * as Query from "../src/selector";
import { ParserItem } from "../src/types";
import { parserItemToString } from "../src/utils";

const htmlTestParser = (input: string, instance: ParserItem) => {
    const queueItems = parseLexer(input, parsedQueryLexer).queue;
    const queue = createQueueFromItems(queueItems);
    const processed = instance.process(queue);
    checkIfNothingRemains(queueItems, processed);
    if (!instance.consumed()) {
        throw `Instance could not consume test`;
    }
    return instance;
};

const testParseToString = (input: string, instance: ParserItem) => parserItemToString(htmlTestParser(input, instance));

const testPseudo = new Query.FunctionalPseudo();

const tests: { [Type in keyof typeof Query]: {
    instance: InstanceType<(typeof Query)[Type]>,
    passes: string[],
    fails?: string[],
}} = {
    Attrib: {
        instance: new Query.Attrib(),
        passes: [],
        fails: [],
    },
    ClassName: {
        instance: new Query.ClassName(),
        passes: [],
        fails: [],
    },
    Combinator: {
        instance: new Query.Combinator(),
        passes: [],
        fails: [],
    },
    ElementName: {
        instance: new Query.ElementName(),
        passes: [],
        fails: [],
    },
    Expression: {
        instance: new Query.Expression(testPseudo),
        passes: [],
        fails: [],
    },
    FunctionalPseudo: {
        instance: new Query.FunctionalPseudo(),
        passes: [],
        fails: [],
    },
    Negation: {
        instance: new Query.Negation(),
        passes: [],
        fails: [],
    },
    NegationArg: {
        instance: new Query.NegationArg(),
        passes: [],
        fails: [],
    },
    Pseudo: {
        instance: new Query.Pseudo(),
        passes: [],
        fails: [],
    },
    Selector: {
        instance: new Query.Selector(),
        passes: [],
        fails: [],
    },
    SelectorGroup: {
        instance: new Query.SelectorGroup(),
        passes: [],
        fails: [],
    },
    SimpleSelectorSequence: {
        instance: new Query.SimpleSelectorSequence(),
        passes: [],
        fails: [],
    },
    TypeNamespacePrefix: {
        instance: new Query.TypeNamespacePrefix(),
        passes: [],
        fails: [],
    },
    TypeSelector: {
        instance: new Query.TypeSelector(),
        passes: [],
        fails: [],
    },
    Universal: {
        instance: new Query.Universal(),
        passes: [],
        fails: [],
    },
    Ws: {
        instance: new Query.Ws(),
        passes: [],
        fails: [],
    }
};

describe("Can parse Query items", () => {
    Object.entries(tests).forEach(([name, test]) => {
        test.passes.forEach((passes) => {
            it(`${name} parse ${passes.slice(0, 100)} contents and return exactly the same string`, () => {
                expect(testParseToString(passes, test.instance)).toBe(passes);
            });
        });
        test.fails?.forEach((fails) => {
            expect(() => testParseToString(fails, test.instance)).toThrow();
        });
    })
});