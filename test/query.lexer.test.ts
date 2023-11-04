import { cssLexerAtoms } from "../src/lexers";
import { parseLexer, parsedHtmlLexer } from "../src/parser";

type LexerType = keyof typeof cssLexerAtoms;

const testMap: Record<LexerType, { matches?: "yes" | "no", modes?: string[], nextModes?: string[], value: string }[]> = {
    BackBrace: [],
    Comma: [],
    DashMatch: [],
    Dot: [],
    Equals: [],
    Even: [],
    Function_: [],
    Greater: [],
    Hash: [],
    Ident: [],
    Includes: [],
    Minus: [],
    Namespace: [],
    Number: [],
    Odd: [],
    Of: [],
    Plus: [],
    PrefixMatch: [],
    PseudoGeneral: [],
    PseudoNot: [],
    Space: [],
    SquareBracket: [],
    SquareBracketEnd: [],
    String_: [],
    SubstringMatch: [],
    SuffixMatch: [],
    Tilde: [],
    Universal: [],
};

describe("Match query lexer items correctly", () => {
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