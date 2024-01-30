/**
 * fragment TAG_NameChar:
    TAG_NameStartChar
    | '-'
    | '_'
    | '.'
    | DIGIT
    | '\u00B7'
    | '\u0300' ..'\u036F'
    | '\u203F' ..'\u2040'
;

fragment TAG_NameStartChar:
    [:a-zA-Z]
    | '\u2070' ..'\u218F'
    | '\u2C00' ..'\u2FEF'
    | '\u3001' ..'\uD7FF'
    | '\uF900' ..'\uFDCF'
    | '\uFDF0' ..'\uFFFD'
;
 */
export const htmlFragments = {
    HEXADIGIT: () => /[a-fA-F0-9]/gu,
    DIGIT: () => /[0-9]/gu,
    TAG_NameChar: () => /[:a-zA-Z0-9\-_\.\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040]/gu,
    TAG_NameStartChar: () =>
        /[:a-zA-Z\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/gu,
    ATTCHARS: () => new RegExp(`${htmlFragments.ATTCHAR().source}+ ?`, "gu"),
    ATTCHAR: () => /[\-_\.\/\+,\?:;#0-9a-zA-Z]/gu,
    HEXCHARS: () => /#[0-9a-fA-F]+/gu,
    DECCHARS: () => /[0-9]+%?/gu,
    DOUBLE_QUOTE_STRING: () => /"[^"]*"/gu,
    SINGLE_QUOTE_STRING: () => /'[^']*'/gu,
} as const;

const matchScriptBody = (input: string, skip: number) => {
    const ignore = {
        doubleQuote: false,
        singleQuote: false,
        template: false,
    };
    for (let i = skip; i < input.length; i++) {
        const char = input[i];
        if (ignore.doubleQuote) {
            if (char === '"') {
                ignore.doubleQuote = false;
            }
        } else if (ignore.singleQuote) {
            if (char === "'") {
                ignore.singleQuote = false;
            }
        } else if (ignore.template) {
            if (char === "`") {
                ignore.template = false;
            }
        } else {
            if (char === '"') {
                ignore.doubleQuote = true;
            } else if (char === "'") {
                ignore.singleQuote = true;
            } else if (char === "`") {
                ignore.template = true;
            } else if (input[i] === "<" && input[i + 1] === "/") {
                const matchEndScript = /^<\/\s*script\s*>/gu.exec(input.slice(i));
                if (matchEndScript) {
                    return matchEndScript[0].length + i;
                }
            }
        }
    }
    return undefined;
};

const matchStyleBody = (input: string, skip: number) => {
    const ignore = {
        doubleQuote: false,
        singleQuote: false,
    };
    for (let i = skip; i < input.length; i++) {
        const char = input[i];
        if (ignore.doubleQuote) {
            if (char === '"') {
                ignore.doubleQuote = false;
            }
        } else if (ignore.singleQuote) {
            if (char === "'") {
                ignore.singleQuote = false;
            }
        } else {
            if (char === '"') {
                ignore.doubleQuote = true;
            } else if (char === "'") {
                ignore.singleQuote = true;
            } else if (input[i] === "<" && input[i + 1] === "/") {
                const matchEndScript = /^<\/\s*style\s*>/gu.exec(input.slice(i));
                if (matchEndScript) {
                    return matchEndScript[0].length + i;
                }
            }
        }
    }
    return undefined;
};

export const htmlLexerAtoms = {
    HTML_COMMENT: /<!--((?!-->).|\n)*-->/gu,
    HTML_CONDITIONAL_COMMENT: /<!\[((?!\]>).|\n)*\]>/gu,
    XML: /<\?xml([^>]|\n)*>/gu,
    CDATA: /<!\[CDATA\[((?!\]\]>).|\n)*\]\]>/gu,
    DTD: /<!([^>]|\n)*>/gu,
    SCRIPTLET: /(<\?[^\?]*\?>)|(<%[^%]*%>)/gu,
    SEA_WS: /(\s|\t|\r|\n)+/gu,
    SCRIPT_OPEN: { value: /<\s*script\s*/gu, pushMode: ["SCRIPT", "TAG"] },
    STYLE_OPEN: { value: /<\s*style\s*/gu, pushMode: ["STYLE", "TAG"] },
    TAG_OPEN: { value: "<", pushMode: ["TAG"] },
    HTML_TEXT: { value: /[^<]+/gu },
    TAG_CLOSE: { value: ">", popMode: true, mode: "TAG" },
    TAG_SLASH_CLOSE: { value: "/>", popMode: true, mode: "TAG" },
    TAG_SLASH: { value: "/", mode: "TAG" },
    TAG_EQUALS: { value: "=", mode: "TAG", pushMode: ["ATTVALUE"] },
    TAG_NAME: {
        value: new RegExp(
            `${htmlFragments.TAG_NameStartChar().source}(${htmlFragments.TAG_NameChar().source
            })*`,
            "gu"
        ),
        mode: "TAG",
    },
    TAG_WHITESPACE: { value: /[ \t\r\n]+/gu, mode: "TAG" },
    SCRIPT_BODY: { value: matchScriptBody, popMode: true, mode: "SCRIPT" },
    STYLE_BODY: { value: matchStyleBody, popMode: true, mode: "STYLE" },
    ATTVALUE_VALUE: {
        // DOUBLE_QUOTE_STRING | SINGLE_QUOTE_STRING | ATTCHARS | HEXCHARS | DECCHARS
        value: new RegExp(
            `(${htmlFragments.DOUBLE_QUOTE_STRING().source})|(${htmlFragments.SINGLE_QUOTE_STRING().source})|(${htmlFragments.ATTCHARS().source})|(${htmlFragments.HEXCHARS().source})|(${htmlFragments.DECCHARS().source})`,
            "gu"
        ),
        popMode: true,
        mode: "ATTVALUE",
    },
} as const;

export const cssFragments = {
    Newline: () => /\n|\r\n|\r|\f/gu,
    Hex: () => /[0-9a-fA-F]/gu,
    NewlineOrSpace: () => /\r\n|[ \t\r\n\f]/gu,
    Unicode: () =>
        new RegExp(
            `\\\\${cssFragments.Hex().source}{1,6}`,
            "gu"
        ),
    Escape: () =>
        new RegExp(`${cssFragments.Unicode().source}|(\\\\[^\r\n\f0-9a-fA-F])`, "gu"),
    Nonascii: () => /[\u0000-\u007f]/gu,
    Nmchar: () =>
        new RegExp(
            `[_a-zA-Z0-9\\-]|(\\\\${cssFragments.Nonascii().source}|${cssFragments.Escape().source
            })`,
            "gu"
        ),
    Nmstart: () =>
        new RegExp(
            `[_a-zA-Z]|(\\\\${cssFragments.Nonascii().source}|${cssFragments.Escape().source
            })`,
            "gu"
        ),
    Name: () => new RegExp(`${cssFragments.Nmchar().source}+`, "gu"),
} as const;

export const cssLexerAtoms = {
    DashMatch: "|=",
    Includes: "~=",
    PrefixMatch: "^=",
    SuffixMatch: "$=",
    SubstringMatch: "*=",
    Plus: "+",
    Minus: "-",
    Greater: ">",
    Comma: ",",
    Tilde: "~",
    Dot: ".",
    PseudoNot: ":not(",
    PseudoGeneral: /::?/gu,
    Namespace: "|",
    Universal: "*",
    Number: /([0-9]*\.[0-9]+|[0-9]+)/gu,
    Equals: "=",
    SquareBracket: "[",
    SquareBracketEnd: "]",
    Space: /[ \t\r\n\f]+/gu,
    String_: new RegExp(
        `"([^\\n\\r\\f"]|(\\\\(${cssFragments.Newline().source}|${cssFragments.Nonascii().source
        }|${cssFragments.Escape().source})))*"|'([^\\n\\r\\f']|(\\\\(${cssFragments.Newline().source
        }|${cssFragments.Nonascii().source}|${cssFragments.Escape().source})))*'`,
        "gu"
    ),
    Of: "of",
    Odd: "odd",
    Even: "even",
    Function_: new RegExp(
        `(-?${cssFragments.Nmstart().source})(${cssFragments.Nmchar().source})*\\(`,
        "gu"
    ),
    Hash: new RegExp(`#(${cssFragments.Name().source})+`, "gu"),
    Ident: new RegExp(
        `(-?${cssFragments.Nmstart().source})(${cssFragments.Nmchar().source})*`,
        "gu"
    ),
    BackBrace: ")",
} as const;

export type LexerType =
    | keyof typeof htmlLexerAtoms
    | keyof typeof cssLexerAtoms
    | "EOF";

export interface Lexer {
    value: string | RegExp | ((input: string, skip: number) => (number | undefined));
    popMode?: boolean;
    mode?: "SCRIPT" | "STYLE" | "TAG" | "ATTVALUE";
    pushMode?: ReadonlyArray<"SCRIPT" | "STYLE" | "TAG" | "ATTVALUE">;
}

export const normalizeHtmlLexer = (
    item: keyof typeof htmlLexerAtoms
) => {
    const value = htmlLexerAtoms[item];
    if (typeof value === "string") {
        return {
            value: value,
        };
    }
    if (value instanceof RegExp) {
        return {
            value: value,
        };
    }
    if (typeof value === "function") {
        return {
            value: value,
        };
    }
    return value;
};
