import { parseLexer, parsedHtmlLexer, createQueueFromItems, checkIfNothingRemains } from "../src/parser";
import * as Html from "../src/html";
import { ParserItem } from "../src/types";
import { parserItemToString } from "../src/utils";

const htmlTestParser = (input: string, instance: ParserItem) => {
    const queueItems = parseLexer(input, parsedHtmlLexer).queue;
    const queue = createQueueFromItems(queueItems);
    const processed = instance.process(queue);
    checkIfNothingRemains(queueItems, processed);
    if (!instance.consumed()) {
        throw `Instance could not consume test`;
    }
    return instance;
};

const testParseToString = (input: string, instance: ParserItem) => parserItemToString(htmlTestParser(input, instance));

const testDocument = new Html.HtmlDocument();
const testElement = new Html.HtmlElement(testDocument);

const tests: { [Type in keyof typeof Html]: {
    instance: InstanceType<(typeof Html)[Type]>,
    passes: string[],
    fails?: string[],
}} = {
    HtmlAttribute: {
        instance: new Html.HtmlAttribute(),
        passes: [],
        fails: [],
    },
    HtmlChardata: {
        instance: new Html.HtmlChardata(),
        passes: [],
        fails: [],
    },
    HtmlContent: {
        instance: new Html.HtmlContent(testElement),
        passes: [],
        fails: [],
    },
    HtmlDocument: {
        instance: new Html.HtmlDocument(),
        passes: [],
        fails: [],
    },
    HtmlElement: {
        instance: new Html.HtmlElement(testElement),
        passes: [],
        fails: [],
    },
    HtmlElements: {
        instance: new Html.HtmlElements(testDocument),
        passes: [],
        fails: [],
    },
    HtmlMisc: {
        instance: new Html.HtmlMisc(),
        passes: [],
        fails: [],
    },
    Script: {
        instance: new Html.Script(),
        passes: [],
        fails: [],
    },
    ScriptletOrSeaWs: {
        instance: new Html.ScriptletOrSeaWs(),
        passes: [],
        fails: [],
    },
    Style: {
        instance: new Html.Style(),
        passes: [],
        fails: [],
    },
};

describe("Can parse HTML items", () => {
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