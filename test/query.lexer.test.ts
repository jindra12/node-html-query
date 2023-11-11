import { cssLexerAtoms } from "../src/lexers";
import { parseLexer, parsedQueryLexer } from "../src/parser";

type LexerType = keyof typeof cssLexerAtoms;

const testMap: Record<LexerType, { inverse?: boolean, value: string }[]> = {
    BackBrace: [{
        value: ")",
    }, {
        value: "(",
        inverse: true,
    }],
    Comma: [{
        value: ",",
    }, {
        value: ".",
        inverse: true,
    }],
    DashMatch: [{
        value: "|=",
    }, {
        value: "=",
        inverse: true,
    }],
    Dot: [{
        value: ".",
    }, {
        value: ",",
        inverse: true,
    }],
    Equals: [{
        value: "=",
    }, {
        value: "!=",
        inverse: true,
    }],
    Even: [{
        value: "even",
    }, {
        value: "evens",
        inverse: true,
    }],
    Function_: [{
        value: "-fn(",
    }, {
        value: "first-child(",
    }, {
        value: "fn(",
    }],
    Greater: [{
        value: ">",
    }],
    Hash: [{
        value: "#",
    }],
    Ident: [{
        value: "ident",
    }, {
        value: "child",
    }, {
        value: "not it",
        inverse: true,
    }],
    Includes: [{
        value: "~=",
    }, {
        value: "a",
        inverse: true,
    }],
    Minus: [{
        value: "-",
    }, {
        value: "+",
        inverse: true,
    }],
    Namespace: [{
        value: "|",
    }, {
        value: "",
        inverse: true,
    }],
    Number: [{
        value: "9",
    }, {
        value: "0",
    }, {
        value: ".01",
    }, {
        value: "9.1",
    }, {
        value: "90.01",
    }, {
        value: "9a1",
        inverse: true,
    }],
    Odd: [{
        value: "odd",
    }],
    Of: [{
        value: "of",
    }],
    Plus: [{
        value: "+",
    }],
    PrefixMatch: [{
        value: "^=",
    }, {
        value: "=",
        inverse: true,
    }],
    PseudoGeneral: [{
        value: ":",
    }, {
        value: "::",
    }, {
        value: ".:",
        inverse: true,
    }],
    PseudoNot: [{
        value: ":not(",
    }],
    Space: [{
        value: " ",
    }, {
        value: "  ",
        inverse: true,
    }],
    SquareBracket: [{
        value: "[",
    }],
    SquareBracketEnd: [{
        value: "]",
    }],
    String_: [{
        value: `""`,
    }, {
        value: `''`,
    }, {
        value: `"'"`,
    }, {
        value: `'"'`
    }, {
        value: `"""`,
        inverse: true,
    }, {
        value: `'''`,
        inverse: true,
    }, {
        value: "Hello?",
        inverse: true,
    }, {
        value: `"Hello?!<!>2ěščěřšě"`,
    }, {
        value: `'Hello?!<!>2ěščěřšě'`,
    }],
    SubstringMatch: [{
        value: "*=",
    }],
    SuffixMatch: [{
        value: "$=",
    }],
    Tilde: [{
        value: "~",
    }, {
        value: "~=",
        inverse: true,
    }],
    Universal: [{
        value: "*",
    }],
};

const parseQueue = (input: string) => parseLexer(input, parsedQueryLexer).queue.map((item) => item.value);

describe("Match CSS lexer items correctly", () => {
    Object.entries(testMap).forEach(([key, tests]) => {
        const lexerType = key as LexerType;
        tests.forEach((test) => {
            it(`${test.inverse ? "Doesn't match" : "Matches"} ${lexerType} with value ${test.value}`, () => {
                if (!test.inverse) {
                    expect(() => parseLexer(test.value, parsedQueryLexer)).toThrow();
                } else {
                    const parsed = parseLexer(test.value, parsedQueryLexer);
                    expect(parsed.queue).toHaveLength(2);
                    expect(parsed[0].queue.type).toEqual(lexerType);
                    expect(parsed[1].queue.type).toEqual("EOF");
                }
            });
        });
    });
    it("Can break down complex query structures", () => {
        expect(parseQueue(".className #id")).toEqual([".", "className", "#", "id"]);
        expect(parseQueue("#id:not(.class)::before")).toEqual(["#", "id", ":not(", ".", "class", ")", "::", "before"]);
        expect(parseQueue("li:first-child(2n + 1 of .class > #id)")).toEqual(["li", ":", "first-child(", "2n", "+", "1", "of", "class", ">", "#", "id", ")"]);
    });
});