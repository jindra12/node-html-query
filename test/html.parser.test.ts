import {
    parseLexer,
    parsedHtmlLexer,
    createQueueFromItems,
    checkIfNothingRemains,
} from "../src/parser";
import * as Html from "../src/html";
import { ParserItem } from "../src/types";
import { parserItemToString } from "../src/utils";

const htmlTestParser = (
    input: string,
    instance: ParserItem,
    initialMode?: string[]
) => {
    const queueItems = parseLexer(input, parsedHtmlLexer, initialMode).queue;
    const queue = createQueueFromItems(queueItems);
    const processed = instance.process(queue);
    if (!instance.consumed()) {
        throw `Instance could not consume test: ${JSON.stringify(
            instance,
            (key, value) => (key === "parent" ? "parent" : value)
        )}`;
    }
    if (processed.at !== queue.items.length - 1) {
        throw `(${processed.at}/${queue.items.length}) ${queue.items
            .slice(processed.at)
            .map((q) => q.value)
            .join("")}`;
    }
    checkIfNothingRemains(queueItems, processed, instance);
    return instance;
};

const testParseToString = (
    input: string,
    instance: ParserItem,
    initialMode?: string[]
) => parserItemToString(htmlTestParser(input, instance, initialMode));

const testDocument = new Html.HtmlDocument();
const testElement = new Html.HtmlElement(testDocument);

const tests: {
    [Type in keyof typeof Html]: {
        instance: () => InstanceType<(typeof Html)[Type]>;
        passes: string[];
        fails?: string[];
        mode?: string[];
    };
} = {
    HtmlAttribute: {
        instance: () => new Html.HtmlAttribute(),
        passes: ["data-checked", "data-checked='value'", `checked="che'cked"`],
        fails: ["data=", "=data"],
        mode: ["TAG"],
    },
    HtmlChardata: {
        instance: () => new Html.HtmlChardata(),
        passes: [
            " ",
            `
        `,
            "Literally any text that contains anything except for html characters ě+ěřščřčžščž",
        ],
        fails: ["<", ""],
    },
    HtmlContent: {
        instance: () => new Html.HtmlContent(testElement),
        passes: [
            "This be a text, <div>This be an element</div>, this is a text again <!-- this is a comment -->, <span />",
        ],
        fails: [],
    },
    HtmlDocument: {
        instance: () => new Html.HtmlDocument(),
        passes: [
            `<!DOCTYPE html><html><head><title>Title of the document</title></head><body>The content of the document......</body></html>`,
            '<?xml version="1.0">',
            "<div class='class' />",
            "<script />",
            "<style />",
            "<script>function(){}</script>",
            "<style>.clas { position: fixed; }</style>",
            "<div><p>Hello?</p><br /></div>",
            "<div><br /><p></p><h1>Hello</h1></div>",
            "<div><p></p><h1>Hello</h1></div>",
            "<div><p></p></div>",
            "<div><h1>Hello</h1><h2>Hello</h2></div>",
            "<h3>World</h3>",
            "<h2>Hello </h2>",
            "<div><h2>Hello </h2><h3>World</h3></div>",
            `
<!DOCTYPE html>
<html>
    <head>
        <title>Title</title>
    </head>
    <body>
        <div id='1' />
        <div id='2' />
        <p>
            <div class='one' />
        </p>
        <ul>
            <li>item</li>
            <li><ol id='shallow'><li><div id='deep'>item</div></li></ol></li>
        </ul>
        <article>Lorem ipsum <span> <img /> </span> <!-- this is a comment --></article>
        <h1 style='position: fixed'>Hello</h1>
        <h2 style='height: 50%'>Hello</h2>
        <h3><div id='three' /></h3>
        <input type='text' style='width: 100px' />
    </body>
</html> 
`
        ],
        fails: ["<div<"],
    },
    HtmlElement: {
        instance: () => new Html.HtmlElement(testElement),
        passes: [
            "<br />",
            "<div></div>",
            "<div><br /></div>",
            "<div class='lol'></div>",
            "<script>function() {return 1}</script>",
            "<style>.className { border: solid 1px black }</style>",
            "<script />",
            "<style />",
        ],
        fails: ["><", "<div", "div>"],
    },
    HtmlElements: {
        instance: () => new Html.HtmlElements(testDocument),
        passes: ["<div />", "<!--comment--><div></div>"],
        fails: ["<--not a comment-->"],
    },
    HtmlMisc: {
        instance: () => new Html.HtmlMisc(),
        passes: [
            "<!--comment-->",
            `
        `,
        ],
        fails: ["Random text"],
    },
    Script: {
        instance: () => new Html.Script(),
        passes: ["<script>function() {return 1}</script>", "<script />"],
        fails: [
            "script>function() {return 1}</script>",
            "<script>function() {return 1}</script",
            "<scrip>function() {return 1}</scrip>",
        ],
    },
    ScriptletOrSeaWs: {
        instance: () => new Html.ScriptletOrSeaWs(),
        passes: [
            `
        `,
            " ",
            "<% xml %>",
        ],
        fails: ["", "< xml >"],
    },
    Style: {
        instance: () => new Html.Style(),
        passes: ["<style>.className { border: solid 1px black }</style>", "<style />"],
        fails: [
            "<style>.className { border: solid 1px black }</style",
            "style>.className { border: solid 1px black }</style>",
            "<styl>.className { border: solid 1px black }</styl>",
        ],
    },
    HtmlComment: {
        instance: () => new Html.HtmlComment(),
        passes: [
            "<!--This is a comment. Comments are not displayed in the browser-->",
            `<!--[if lt IE 9]>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/respond.js/1.4.2/respond.js" integrity="sha512-BWbLJlfp8hzXlxT6K5KLdxPVAj+4Zn2e4FVq5P7NSFH/mkAJ18UiZRQUD4anR3jyp0/WYkeZ0Zmq5EWWrDxneQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
            <![endif]-->`,
            `<![if !IE]>
            <link href="non-ie.css" rel="stylesheet">
            <![endif]>`,
        ],
        fails: ["<div />", "<>", "<!>"],
    },
};

describe("Can parse HTML items", () => {
    Object.entries(tests).forEach(([name, test]) => {
        test.passes.forEach((passes) => {
            it(`${name} parse ${passes.slice(
                0,
                10
            )} contents and return exactly the same string`, () => {
                expect(testParseToString(passes, test.instance(), test.mode)).toBe(
                    passes
                );
            });
        });
        test.fails?.forEach((fails) => {
            it(`${name} parse ${fails.slice(
                0,
                10
            )} contents and throws an exception`, () => {
                expect(() =>
                    testParseToString(fails, test.instance(), test.mode)
                ).toThrow();
            });
        });
    });
});
