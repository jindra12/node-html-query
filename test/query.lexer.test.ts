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
    }, {
        value: "f n(",
        inverse: true,
    }],
    Greater: [{
        value: ">",
    }],
    Hash: [{
        value: "#",
        inverse: true,
    }, {
        value: "#identifier"
    }],
    Ident: [{
        value: "ident",
    }, {
        value: "child",
    }, {
        value: "not it",
        inverse: true,
    }, {
        value: "data-id~='text']",
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
        value: "   ",
    }, {
        value: "a",
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

const parseQueue = (input: string) => parseLexer(input, parsedQueryLexer).queue;

const complexQueryStructures: Record<string, string[]> = {
    ".className #id": [".", "className", " ", "#id", ""],
    "#id:not(.class)::before": ["#id", ":not(", ".", "class", ")", "::", "before", ""],
    "li:first-child(2n + 1 of .class > #id)": ["li", ":", "first-child(", "2", "n", " ", "+", " ", "1", " ", "of", " ", ".", "class", " ", ">", " ", "#id", ")", ""],
    "[id='1'],[id='2']": ["[", "id", "=", "'1'", "]", ",", "[", "id", "=", "'2'", "]", ""],
    [`[id="1"],[id="2"]`]: ["[", "id", "=", `"1"`, "]", ",", "[", "id", "=", `"2"`, "]", ""],
    "[id=1],[id=2]": ["[", "id", "=", "1", "]", ",", "[", "id", "=", "2", "]", ""],
    "[id=yes],[id=no]": ["[", "id", "=", "yes", "]", ",", "[", "id", "=", "no", "]", ""],
};


describe("Match query lexer items correctly", () => {
    Object.entries(testMap).forEach(([key, tests]) => {
        const lexerType = key as LexerType;
        const lexerValue = cssLexerAtoms[lexerType];
        const parsedLexer = lexerValue instanceof RegExp ? { [lexerType]: { value: lexerValue } } : { [lexerType]: lexerValue };
        tests.forEach((test) => {
            it(`${test.inverse ? "Doesn't match" : "Matches"} ${lexerType} with value ${test.value}, with regex ${cssLexerAtoms[lexerType].source}`, () => {
                if (test.inverse) {
                    expect(() => parseLexer(test.value, parsedLexer)).toThrow();
                } else {
                    const parsed = parseLexer(test.value, parsedLexer);
                    expect(parsed.queue).toHaveLength(2);
                    expect(parsed.queue[0].type).toEqual(lexerType);
                    expect(parsed.queue[1].type).toEqual("EOF");
                }
            });
        });
    });
    Object.entries(complexQueryStructures).forEach(([input, expected]) => {
        it(`Can break down complex HTML structures: ${input}`, () => {
            expect(parseQueue(input).map((item) => item.value)).toEqual(expected);
        });
    });
});