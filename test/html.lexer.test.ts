import { htmlLexerAtoms } from "../src/lexers";
import { parseLexer, parsedHtmlLexer } from "../src/parser";

type LexerType = keyof typeof htmlLexerAtoms;

const testMap: Record<LexerType, { matches?: "yes" | "no", modes?: string[], nextModes?: string[], value: string }[]> = {
    ATTVALUE_VALUE: [{
        value: "<!-- Hello world?! <*> / !-->"
    }, {
        value: "<!-- -->"
    }, {
        value: "<!-- Hello world?! <*> / !--",
        matches: "no",
    }, {
        value: "!-- Hello world?! <*> / !-->",
        matches: "no",
    }],
    CDATA: [],
    DTD: [],
    HTML_COMMENT: [],
    HTML_CONDITIONAL_COMMENT: [],
    HTML_TEXT: [],
    SCRIPT_BODY: [],
    SCRIPT_OPEN: [],
    SCRIPT_SHORT_BODY: [],
    SCRIPTLET: [],
    SEA_WS: [],
    STYLE_BODY: [],
    STYLE_OPEN: [],
    STYLE_SHORT_BODY: [],
    TAG_CLOSE: [],
    TAG_EQUALS: [],
    TAG_NAME: [],
    TAG_OPEN: [],
    TAG_SLASH: [],
    TAG_SLASH_CLOSE: [],
    TAG_WHITESPACE: [],
    XML: []
};

describe("Match HTML lexer items correctly", () => {
    Object.entries(testMap).forEach(([key, tests]) => {
        const lexerType = key as LexerType;
        tests.forEach((test) => {
            it(`${test.matches === "no" ? "Doesn't match" : "Matches"} ${lexerType} with value ${test.value}, in mode ${test.modes?.join(", ") || "none"} and changes modes to: ${test.nextModes?.join(", ") || "none"}`, () => {
                if (!test.matches) {
                    expect(() => parseLexer(test.value, parsedHtmlLexer, test.modes)).toThrow();
                } else {
                    const parsed = parseLexer(test.value, parsedHtmlLexer, test.modes);
                    expect(parsed.queue).toHaveLength(2);
                    expect(parsed[0].queue.type).toEqual(lexerType);
                    expect(parsed[1].queue.type).toEqual("EOF");
                    expect(parsed.mode).toEqual(test.nextModes);
                }
            });
        });
    });
});