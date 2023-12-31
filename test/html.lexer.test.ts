import { htmlLexerAtoms } from "../src/lexers";
import { parseLexer, parsedHtmlLexer } from "../src/parser";
import { Queue, QueueItem } from "../src/types";

type LexerType = keyof typeof htmlLexerAtoms;

const testMap: Record<LexerType, { inverse?: true, modes?: string[], nextModes?: string[], value: string }[]> = {
    ATTVALUE_VALUE: [{
        value: `"hello"`,
        modes: ["ATTVALUE"],
        nextModes: [],
    }, {
        value: `"9"`,
        modes: ["ATTVALUE"],
        nextModes: [],
    }, {
        value: `'9'`,
        modes: ["ATTVALUE"],
        nextModes: [],
    }, {
        value: `'&//!'`,
        modes: ["ATTVALUE"],
        nextModes: [],
    }, {
        value: `"&/!"`,
        modes: ["ATTVALUE"],
        nextModes: [],
    }, {
        value: `&//!`,
        inverse: true,
    }, {
        value: `&/!`,
        inverse: true,
    }, {
        value: "Hello",
        inverse: true,
    }, {
        value: `"'"`,
        modes: ["ATTVALUE"],
        nextModes: [],
    }, {
        value: `'"'`,
        modes: ["ATTVALUE"],
        nextModes: [],
    }, {
        value: `"""`,
        inverse: true,
    }, {
        value: `'''`,
        inverse: true,
    }],
    CDATA: [{
        value: `<![CDATA[
            characters with markup
        ]]>`,
    }, {
        value: `<[CDATA[
            characters with markup
        ]]>`,
        inverse: true,
    }],
    DTD: [{
        value: "<!DOCTYPE note SYSTEM \"note.dtd\">"
    }, {
        value: "<DOCTYPE note SYSTEM \"note.dtd\">",
        inverse: true,
    }],
    HTML_COMMENT: [{
        value: "<!-- Hello world?! <*> / !-->"
    }, {
        value: "<!-- -->"
    }, {
        value: "<!-- Hello world?! <*> / !--",
        inverse: true,
    }, {
        value: "!-- Hello world?! <*> / !-->",
        inverse: true,
    }],
    HTML_CONDITIONAL_COMMENT: [{
        value: `<!--[if lt IE 9]>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/respond.js/1.4.2/respond.js" integrity="sha512-BWbLJlfp8hzXlxT6K5KLdxPVAj+4Zn2e4FVq5P7NSFH/mkAJ18UiZRQUD4anR3jyp0/WYkeZ0Zmq5EWWrDxneQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
        <![endif]-->`
    }],
    HTML_TEXT: [{
        value: "Hello world>?!",
    }, {
        value: `"Hello world"`,
    }, {
        value: "<Hello world!",
        inverse: true,
    }],
    SCRIPT_BODY: [{
        value: "function() { return '</script>'; }</script>",
        modes: ["SCRIPT"],
        nextModes: []
    }],
    SCRIPT_OPEN: [{
        value: "script",
        nextModes: ["SCRIPT"],
    }, {
        value: "scripts",
        inverse: true,
    }],
    SCRIPT_SHORT_BODY: [{
        value: "/",
        nextModes: [],
        modes: ["SCRIPT"],
    }],
    SCRIPTLET: [{
        value: "<%%>"
    }, {
        value: "<% <div></div> %>",
    }, {
        value: "<??>",
    }, {
        value: "<? <div></div> ?>",
    }, {
        value: "",
        inverse: true,
    }],
    SEA_WS: [{
        value: `
        
        `
    }, {
        value: "    ",
    }, {
        value: " ",
    }, {
        value: "",
        inverse: true,
    }],
    STYLE_BODY: [{
        value: ".style-kind: { content: ' '; position: absolute; }</style",
        modes: ["STYLE"],
        nextModes: [],
    }],
    STYLE_OPEN: [{
        value: "style",
        nextModes: ["STYLE"],
    }],
    STYLE_SHORT_BODY: [{
        value: "/",
        modes: ["STYLE"],
    }],
    TAG_CLOSE: [{
        value: ">",
    }],
    TAG_EQUALS: [{
        value: "=",
    }],
    TAG_NAME: [{
        value: "data-val-required",
        modes: ["TAG"],
        nextModes: ["TAG"],
    }, {
        value: "class",
        modes: ["TAG"],
        nextModes: ["TAG"],
    }, {
        value: "id",
        modes: ["TAG"],
        nextModes: ["TAG"],
    }, {
        value: "div",
        modes: ["TAG"],
        nextModes: ["TAG"],
    }],
    TAG_OPEN: [{
        value: "<",
        nextModes: ["<"]
    }],
    TAG_SLASH: [{
        value: "/",
        modes: ["TAG"],
        nextModes: ["TAG"],
    }],
    TAG_SLASH_CLOSE: [{
        value: "/>",
        modes: ["TAG"],
        nextModes: [],
    }],
    TAG_WHITESPACE: [{
        value: `
        
        `
    }, {
        value: "    ",
    }, {
        value: " ",
    }, {
        value: "",
        inverse: true,
    }],
    XML: [{
        value: "<?xml id='1' >"
    }]
};

const parseQueue = (input: string) => parseLexer(input, parsedHtmlLexer).queue.map((item) => item.value);

describe("Match HTML lexer items correctly", () => {
    Object.entries(testMap).forEach(([key, tests]) => {
        const lexerType = key as LexerType;
        tests.forEach((test) => {
            it(`${test.inverse ? "Doesn't match" : "Matches"} ${lexerType} with value ${test.value}, in mode ${test.modes?.join(", ") || "none"} and changes modes to: ${test.nextModes?.join(", ") || "none"}`, () => {
                if (!test.inverse) {
                    expect(() => parseLexer(test.value, parsedHtmlLexer, test.modes)).toThrow();
                } else {
                    const parsed = parseLexer(test.value, parsedHtmlLexer, test.modes);
                    expect(parsed.queue).toHaveLength(2);
                    expect(parsed[0].queue.type).toEqual(lexerType);
                    expect(parsed[1].queue.type).toEqual("EOF");
                    expect(parsed.mode).toEqual(test.nextModes || []);
                }
            });
        });
    });
    it("Can break down complex HTML structures", () => {
        expect(parseQueue("<div />")).toEqual(["<", "div", "/", ">", ""]);
        expect(parseQueue("<div></div>")).toEqual(["<", "div", ">", "<", "/", "div", ">", ""]);
        expect(parseQueue("<div><br /></div>")).toEqual(["<", "div", ">", "<", "br", " ", "/", ">", "<", "/", "div", ">", ""]);
        expect(parseQueue(`<div class="identifier" />`)).toEqual(["<", "div", "class", "=", `"identifier"`, " ", "/", ">", ""]);
        expect(parseQueue(`<div class='identifier' />`)).toEqual(["<", "div", "class", "=", `'identifier'`, " ", "/", ">", ""]);
        expect(parseQueue(`<body><div class='identifier' /></body>`)).toEqual(["<", "body", ">", "<", "div", "class", "=", `'identifier'`, " ", "/", ">", "<", "/", "body", ">", ""]);
        expect(parseQueue("<script id='1'>function() { return 'this is javascript </>'; }</script>")).toEqual(["<", "script", "id", "=", `'1'`, ">", "function() { return 'this is javascript </>'; }</script", ">"]);
        expect(parseQueue(`<style>.class #id > div { content: "</>" }</style>`)).toEqual(["<", "style>", `.class #id > div { content: "</>" }</style`, ">"])
    });
});