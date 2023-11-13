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
        passes: ["data-checked", "data-checked='value'", `checked="che'cked"`],
        fails: ["data=", "=data"],
    },
    HtmlChardata: {
        instance: new Html.HtmlChardata(),
        passes: ["", " ", `
        `, "Literally any text that contains anything except for html characters ě+ěřščřčžščž"],
        fails: ["<", ""],
    },
    HtmlContent: {
        instance: new Html.HtmlContent(testElement),
        passes: ["This be a text, <div>This be an element</div>, this is a text again <!-- this is a comment -->, <span />"],
        fails: [],
    },
    HtmlDocument: {
        instance: new Html.HtmlDocument(),
        passes: [`<!DOCTYPE html><html><head><title>Title of the document</title></head><body>The content of the document......</body></html>`, "<?xml version=\"1.0\">", "<div class='class' />"],
        fails: ["<div<"],
    },
    HtmlElement: {
        instance: new Html.HtmlElement(testElement),
        passes: ["<br />", "<div></div>", "<div><br /></div>", "<div class='lol'></div>", "<script>function() {return 1}</script>", "<style>.className { border: solid 1px black }</style>"],
        fails: ["><", "<div", "div>"],
    },
    HtmlElements: {
        instance: new Html.HtmlElements(testDocument),
        passes: ["<div />", "<!--comment--><div></div>"],
        fails: ["<--not a comment-->"],
    },
    HtmlMisc: {
        instance: new Html.HtmlMisc(),
        passes: ["<!--comment-->", `
        `],
        fails: ["Random text"],
    },
    Script: {
        instance: new Html.Script(),
        passes: ["<script>function() {return 1}</script>"],
        fails: ["script>function() {return 1}</script>", "<script>function() {return 1}</script", "<scrip>function() {return 1}</scrip>"],
    },
    ScriptletOrSeaWs: {
        instance: new Html.ScriptletOrSeaWs(),
        passes: [`
        `, " ", "<?xml ?>", "<% xml %>"],
        fails: ["", "< xml >"],
    },
    Style: {
        instance: new Html.Style(),
        passes: ["<style>.className { border: solid 1px black }</style>"],
        fails: ["<style>.className { border: solid 1px black }</style", "style>.className { border: solid 1px black }</style>", "<styl>.className { border: solid 1px black }</styl>"],
    },
};

describe("Can parse HTML items", () => {
    Object.entries(tests).forEach(([name, test]) => {
        test.passes.forEach((passes) => {
            it(`${name} parse ${passes.slice(0, 10)} contents and return exactly the same string`, () => {
                expect(testParseToString(passes, test.instance)).toBe(passes);
            });
        });
        test.fails?.forEach((fails) => {
            expect(() => testParseToString(fails, test.instance)).toThrow();
        });
    })
});