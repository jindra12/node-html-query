import { htmlLexerAtoms, normalizeHtmlLexer } from "../src/lexers";
import { parseLexer, parsedHtmlLexer } from "../src/parser";

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
        value: `<&//!`,
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
        value: "a=a",
        modes: ["ATTVALUE"],
        inverse: true,
    }, {
        value: "",
        modes: ["ATTVALUE"],
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
        value: `<![if lt IE 9]>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/respond.js/1.4.2/respond.js" integrity="sha512-BWbLJlfp8hzXlxT6K5KLdxPVAj+4Zn2e4FVq5P7NSFH/mkAJ18UiZRQUD4anR3jyp0/WYkeZ0Zmq5EWWrDxneQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
        <![endif]>`
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
        modes: ["TAG", "SCRIPT"],
        nextModes: ["TAG"]
    }],
    SCRIPT_OPEN: [{
        value: "script",
        nextModes: ["SCRIPT", "TAG"],
        modes: ["TAG"],
    }, {
        value: "scripts",
        modes: ["TAG"],
        inverse: true,
    }],
    SCRIPT_SHORT_BODY: [{
        value: "</>",
        nextModes: ["TAG"],
        modes: ["TAG", "SCRIPT"],
    }],
    SCRIPTLET: [{
        value: "<%%>"
    }, {
        value: "<% <div></div> %>",
    }, {
        value: "<??>",
    }, {
        value: "<% xml %>"
    }, {
        value: "<?xml ?>",
    }, {
        value: "<%xml %>",
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
        value: ".style-kind: { content: ' '; position: absolute; }</style>",
        modes: ["TAG", "STYLE"],
        nextModes: ["TAG"],
    }],
    STYLE_OPEN: [{
        value: "style",
        modes: ["TAG"],
        nextModes: ["STYLE", "TAG"],
    }],
    STYLE_SHORT_BODY: [{
        value: "</>",
        modes: ["TAG", "STYLE"],
        nextModes: ["TAG"]
    }],
    TAG_CLOSE: [{
        value: ">",
        modes: ["TAG"],
        nextModes: [],
    }],
    TAG_EQUALS: [{
        value: "=",
        modes: ["TAG"],
        nextModes: ["TAG", "ATTVALUE"],
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
    }, {
        value: "div />",
        modes: ["TAG"],
        inverse: true,
    }, {
        value: "div></div>",
        modes: ["TAG"],
        inverse: true,
    }, {
        value: "div><br /></div>",
        modes: ["TAG"],
        inverse: true,
    }],
    TAG_OPEN: [{
        value: "<",
        nextModes: ["TAG"]
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
        
        `,
        modes: ["TAG"],
        nextModes: ["TAG"],
    }, {
        value: "    ",
        modes: ["TAG"],
        nextModes: ["TAG"],
    }, {
        value: " ",
        modes: ["TAG"],
        nextModes: ["TAG"],
    }, {
        value: "",
        modes: ["TAG"],
        inverse: true,
    }],
    XML: [{
        value: "<?xml id='1' >"
    }]
};

const parseQueue = (input: string) => parseLexer(input, parsedHtmlLexer).queue;

const complexHtmlStructures: Record<string, string[]> = {
    "<div />": ["<", "div", " ", "/>", ""],
    "<div></div>": ["<", "div", ">", "<", "/", "div", ">", ""],
    "<div><br /></div>": ["<", "div", ">", "<", "br", " ", "/>", "<", "/", "div", ">", ""],
    [`<div class="identifier" />`]: ["<", "div", " ", "class", "=", `"identifier"`, " ", "/>", ""],
    [`<div class='identifier' />`]: ["<", "div", " ", "class", "=", `'identifier'`, " ", "/>", ""],
    "<body><div class='identifier' /></body>": ["<", "body", ">", "<", "div", " ", "class", "=", `'identifier'`, " ", "/>", "<", "/", "body", ">", ""],
    "<script id='1'>function() { return 'this is javascript </>'; }</script>": ["<", "script", " ", "id", "=", `'1'`, ">", "function() { return 'this is javascript </>'; }</script>", ""],
    [`<style>.class #id > div { content: "</>" }</style>`]: ["<", "style", ">", `.class #id > div { content: "</>" }</style>`, ""],
};

describe("Match HTML lexer items correctly", () => {
    Object.entries(testMap).forEach(([key, tests]) => {
        const lexerType = key as LexerType;
        const lexerValue = htmlLexerAtoms[lexerType];
        const parsedLexer = lexerValue instanceof RegExp ? { [lexerType]: { value: lexerValue } } : { [lexerType]: lexerValue };
        tests.forEach((test) => {
            it(`${test.inverse ? "Doesn't match" : "Matches"} ${lexerType} with value ${test.value}, in mode ${test.modes?.join(", ") || "none"} and changes modes to: ${test.nextModes?.join(", ") || "none"} with regex ${normalizeHtmlLexer(lexerType).value.source}`, () => {
                if (test.inverse) {
                    expect(() => parseLexer(test.value, parsedLexer, test.modes)).toThrow();
                } else {
                    const parsed = parseLexer(test.value, parsedLexer, test.modes);
                    expect(parsed.queue).toHaveLength(2);
                    expect(parsed.queue[0].type).toEqual(lexerType);
                    expect(parsed.queue[1].type).toEqual("EOF");
                    expect(parsed.mode).toEqual(test.nextModes || []);
                }
            });
        });
    });
    Object.entries(complexHtmlStructures).forEach(([input, expected]) => {
        it(`Can break down complex HTML structures: ${input}`, () => {
            expect(parseQueue(input).map((item) => item.value)).toEqual(expected);
        });
    });
});