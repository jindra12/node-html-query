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
    HEXADIGIT: () => /[a-fA-F0-9]/gmu,
    DIGIT: () => /[0-9]/gmu,
    TAG_NameChar: () => /[:a-zA-Z\-_\.\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040]/gmu,
    TAG_NameStartChar: () =>
        /[:a-zA-Z\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/gmu,
    ATTCHARS: () => new RegExp(`${htmlFragments.ATTCHAR().source}+ ?`, "gmu"),
    ATTCHAR: () => /[\-_\.\/\+,\?=:;#0-9a-zA-Z]/gmu,
    HEXCHARS: () => /#[0-9a-fA-F]/gmu,
    DECCHARS: () => /[0-9]+%?/gmu,
    DOUBLE_QUOTE_STRING: () => /"[^"<]*"/gmu,
    SINGLE_QUOTE_STRING: () => /'[^'<]*'/gmu,
} as const;

export const htmlLexerAtoms = {
    HTML_COMMENT: /<!--(.|\n)*-->/gmu,
    HTML_CONDITIONAL_COMMENT: /<!\[(.|\n)*\]>/gmu,
    XML: /<\?xml(.|\n)*>/gmu,
    CDATA: /<!\[CDATA\[(.|\n)*\]\]>/gmu,
    DTD: /<![^>]*>/gmu,
    SCRIPTLET: /(<\?[^\?]*\?>)|(<%[^%]*%>)/gmu,
    SEA_WS: /(\s|\t|\r|\n)+/gmu,
    SCRIPT_OPEN: { value: /script/gmu, mode: "TAG", pushMode: ["SCRIPT"] },
    STYLE_OPEN: { value: /style/gmu, mode: "TAG", pushMode: ["STYLE"] },
    TAG_OPEN: { value: /</gmu, pushMode: ["TAG"] },
    HTML_TEXT: { value: /[^<]+/gmu },
    TAG_CLOSE: { value: />/gmu, popMode: true, mode: "TAG" },
    TAG_SLASH_CLOSE: { value: /\/>/gmu, popMode: true, mode: "TAG" },
    TAG_SLASH: { value: /\//gmu, mode: "TAG" },
    TAG_EQUALS: { value: /=/gmu, mode: "TAG", pushMode: ["ATTVALUE"] },
    TAG_NAME: {
        value: new RegExp(
            `${htmlFragments.TAG_NameStartChar().source}(${htmlFragments.TAG_NameChar().source
            })*`,
            "gmu"
        ),
        mode: "TAG",
    },
    TAG_WHITESPACE: { value: /[ \t\r\n]+/gmu, mode: "TAG" },
    SCRIPT_BODY: { value: /.*<\/script/gmu, popMode: true, mode: "SCRIPT" },
    SCRIPT_SHORT_BODY: { value: /.*<\//gmu, popMode: true, mode: "SCRIPT" },
    STYLE_BODY: { value: /.*<\/style/gmu, popMode: true, mode: "STYLE" },
    STYLE_SHORT_BODY: { value: /.*<\//gmu, popMode: true, mode: "STYLE" },
    ATTVALUE_VALUE: {
        // DOUBLE_QUOTE_STRING | SINGLE_QUOTE_STRING | ATTCHARS | HEXCHARS | DECCHARS
        value: new RegExp(
            `(${htmlFragments.DOUBLE_QUOTE_STRING().source})|(${htmlFragments.SINGLE_QUOTE_STRING().source})|(${htmlFragments.ATTCHARS().source})|(${htmlFragments.HEXCHARS().source})|(${htmlFragments.DECCHARS().source})`,
            "gmu"
        ),
        popMode: true,
        mode: "ATTVALUE",
    },
} as const;

export const cssFragments = {
    Newline: () => /\n|\r\n|\r|\f/gmu,
    Hex: () => /[0-9a-fA-F]/gmu,
    NewlineOrSpace: () => /\r\n|[ \t\r\n\f]/gmu,
    Unicode: () =>
        new RegExp(
            `\\\\${cssFragments.Hex().source}{1,6}${cssFragments.NewlineOrSpace().source
            }`,
            "gmu"
        ),
    Escape: () =>
        new RegExp(`${cssFragments.Unicode().source}|\\\\[^\r\n\f0-9a-fA-F]`, "gmu"),
    Nonascii: () => /[^\u0000-\u007f]/gmu,
    Nmchar: () =>
        new RegExp(
            `[_a-zA-Z0-9\-]|${cssFragments.Nonascii().source}|${cssFragments.Escape().source
            }`,
            "gmu"
        ),
    Nmstart: () =>
        new RegExp(
            `[_a-zA-Z]|${cssFragments.Nonascii().source}|${cssFragments.Escape().source
            }`,
            "gmu"
        ),
    Name: () => new RegExp(`${cssFragments.Nmchar().source}+`, "gmu"),
} as const;

export const cssLexerAtoms = {
    Plus: /\+/gmu,
    Minus: /-/gmu,
    Greater: />/gmu,
    Comma: /,/gmu,
    Tilde: /~/gmu,
    Dot: /\./gmu,
    PseudoGeneral: /::?/gmu,
    PseudoNot: /:not\(/gmu,
    Namespace: /\|/gmu,
    Universal: /\*/gmu,
    Number: /[0-9]+|([0-9]*\.[0-9]+)/gmu,
    Equals: /=/gmu,
    SquareBracket: /\[/gmu,
    SquareBracketEnd: /\]/gmu,
    DashMatch: /\|=/gmu,
    Includes: /~=/gmu,
    Space: /[ \t\r\n\f]+/gmu,
    String_: new RegExp(
        `"([^\\n\\r\\f"]|\\\\${cssFragments.Newline().source}|${cssFragments.Nonascii().source
        }|${cssFragments.Escape().source})*"|'([^\\n\\r\\f"]|\\\\${cssFragments.Newline().source
        }|${cssFragments.Nonascii().source}|${cssFragments.Escape().source})*'`,
        "gmu"
    ),
    PrefixMatch: /\^=/gmu,
    SuffixMatch: /\$=/gmu,
    SubstringMatch: /\*=/gmu,
    Of: /of/gmu,
    Odd: /odd/gmu,
    Even: /even/gmu,
    Function_: new RegExp(
        `-?${cssFragments.Nmstart().source}${cssFragments.Nmchar().source}*\\(`,
        "gmu"
    ),
    Hash: new RegExp(`#${cssFragments.Name().source}`, "gmu"),
    Ident: new RegExp(
        `-?${cssFragments.Nmstart().source}${cssFragments.Nmchar().source}*`,
        "gmu"
    ),
    BackBrace: /\)/gmu,
} as const;

export type LexerType =
    | keyof typeof htmlLexerAtoms
    | keyof typeof cssLexerAtoms
    | "EOF";

export interface Lexer {
    value: RegExp;
    popMode?: boolean;
    mode?: "SCRIPT" | "STYLE" | "TAG" | "ATTVALUE";
    pushMode?: ReadonlyArray<"SCRIPT" | "STYLE" | "TAG" | "ATTVALUE">;
}

export const normalizeHtmlLexer = (
    item: keyof typeof htmlLexerAtoms
): Lexer => {
    const value = htmlLexerAtoms[item];
    if (value instanceof RegExp) {
        return {
            value: value,
        };
    }
    return value;
};
