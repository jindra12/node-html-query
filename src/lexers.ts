export const htmlFragments = {
    HEXADIGIT: () => /[a-fA-F0-9]/gmu,
    DIGIT: () => /[0-9]/gmu,
    TAG_NameChar: () =>
        new RegExp(
            `(${htmlFragments.TAG_NameStartChar()}|-| |.|${htmlFragments.DIGIT()}|\\u00B7|[\\u0300-\\u036F]|[\\u203F-\\u2040])`,
            "gmu"
        ),
    TAG_NameStartChar: () =>
        /[a-zA-Z\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/gmu,
    ATTCHARS: () => new RegExp(`${htmlFragments.ATTCHAR}+ ?`, "gmu"),
    ATTCHAR: () => /[\-_\.\/\+,\?=:;#0-9a-zA-Z]/gmu,
    HEXCHARS: () => /#[0-9a-fA-F]/gmu,
    DECCHARS: () => /[0-9]+%?/gmu,
    DOUBLE_QUOTE_STRING: () => /"(?!(<|"))"/gmu,
    SINGLE_QUOTE_STRING: () => /'(?!(<|'))'/gmu,
} as const;

export const htmlLexerAtoms = {
    HTML_COMMENT: /<!--.*-->/gmu,
    HTML_CONDITIONAL_COMMENT: /<!\[.*\]>/gmu,
    XML: /<\?xml.*>/gmu,
    CDATA: /<!\[CDATA\[.*\]\]>/gmu,
    DTD: /<!.*>/gmu,
    SCRIPTLET: /(<\?.*\?>)|(<%.*%>)/gmu,
    SEA_WS: /(\s|\t|\r|\n)+/gmu,
    SCRIPT_OPEN: { value: /<script.*>/gmu, pushMode: "SCRIPT" },
    STYLE_OPEN: { value: /<style.*>/gmu, pushMode: "STYLE" },
    TAG_OPEN: { value: /</gmu, pushMode: "TAG" },
    HTML_TEXT: { value: /[^<]+/gmu },
    TAG_CLOSE: { value: />/gmu, popMode: true, mode: "TAG" },
    TAG_SLASH_CLOSE: { value: /\/>/gmu, popMode: true, mode: "TAG" },
    TAG_SLASH: { value: /\//gmu, mode: "TAG" },
    TAG_EQUALS: { value: /=/gmu, mode: "TAG", pushMode: "ATTVALUE" },
    TAG_NAME: {
        value: new RegExp(
            `${htmlFragments.TAG_NameStartChar}(${htmlFragments.TAG_NameChar})*`,
            "gmu"
        ),
        mode: "TAG",
    },
    TAG_WHITESPACE: { value: /[ \t\r\n]+/gmu },
    SCRIPT_BODY: { value: /.*<\/script>/gmu, popMode: true, mode: "SCRIPT" },
    SCRIPT_SHORT_BODY: { value: /.*<\/>/gmu, popMode: true, mode: "SCRIPT" },
    STYLE_BODY: { value: /<\/style>/gmu, popMode: true, mode: "STYLE" },
    STYLE_SHORT_BODY: { value: /.*<\/>/gmu, popMode: true, mode: "STYLE" },
    ATTVALUE_VALUE: {
        value: new RegExp(
            ` *(${htmlFragments.DOUBLE_QUOTE_STRING()}|${htmlFragments.SINGLE_QUOTE_STRING()}|${htmlFragments.ATTCHARS()}|${htmlFragments.HEXCHARS()}|${htmlFragments.DECCHARS()})`,
            "gmu"
        ),
        popMode: true,
        mode: "ATTVALUE",
    },
    ATTRIBUTE: {
        value: new RegExp(
            `(${htmlFragments.DOUBLE_QUOTE_STRING()}|${htmlFragments.SINGLE_QUOTE_STRING()}|${htmlFragments.ATTCHARS()}|${htmlFragments.HEXCHARS()}|${htmlFragments.DECCHARS()})`,
            "gmu"
        ),
        mode: "ATTVALUE",
    },
} as const;

export const cssFragments = {
   Newline: () => /\n|\r\n|\r|\f/gmu,
   Hex: () => /[0-9a-fA-F]/gmu,
   NewlineOrSpace: () => /\r\n|[ \t\r\n\f]/gmu,
   Unicode: () => new RegExp(`\\${cssFragments.Hex()}{1,6}${cssFragments.NewlineOrSpace()}`, "gmu"),
   Escape: () => new RegExp(`${cssFragments.Unicode()}|\\[^\r\n\f0-9a-fA-F]`, "gmu"),
   Nonascii: () => /[^\u0000-\u007f]/gmu,
   Nmchar: () => new RegExp(`[_a-zA-Z0-9\-]|${cssFragments.Nonascii()}|${cssFragments.Escape()}`, "gmu"),
   Nmstart: () => new RegExp(`[_a-zA-Z]|${cssFragments.Nonascii()}|${cssFragments.Escape()}`, "gmu"),
   Name: () => new RegExp(`${cssFragments.Nmchar()}+`, "gmu"),
} as const;

export const cssLexerAtoms = {
    Plus: /\+/gmu,
    Minus: /-/gmu,
    Greater: />/gmu,
    Comma: /,/gmu,
    Tilde: /~/gmu,
    PseudoGeneral: /::?/gmu,
    PseudoNot: /:not\(/gmu,
    Number: /[0-9]+|([0-9]*\.[0-9]+)/gmu,
    Includes: /~=/gmu,
    Space: /[ \t\r\n\f]+/gmu,
    String_: new RegExp(`"([^\\n\\r\\f\\"]|\\${cssFragments.Newline()}|${cssFragments.Nonascii()}|${cssFragments.Escape()})*"|'([^\\n\\r\\f\\"]|\\${cssFragments.Newline()}|${cssFragments.Nonascii()}|${cssFragments.Escape()})*'`, "gmu"),
    PrefixMatch: /\^=/gmu,
    SuffixMatch: /\$=/gmu,
    SubstringMatch: /\*=/gmu,
    Function_: new RegExp(`-?${cssFragments.Nmstart()}${cssFragments.Nmchar()}*\\(`, "gmu"),
    Hash: new RegExp(`#${cssFragments.Name()}`, "gmu"),
    Ident: new RegExp(`-?${cssFragments.Nmstart()}${cssFragments.Nmchar()}*`, "gmu"),
    BackBrace: /\)/gmu,
} as const;

export type LexerType = keyof typeof htmlLexerAtoms | keyof typeof cssLexerAtoms;

export interface Lexer {
    value: RegExp;
    popMode?: boolean;
    mode?: "SCRIPT" | "STYLE" | "TAG" | "ATTVALUE";
    pushMode?: "SCRIPT" | "STYLE" | "TAG" | "ATTVALUE";
}

export const normalizeHtmlLexer = (item: keyof typeof htmlLexerAtoms): Lexer => {
    const value = htmlLexerAtoms[item];
    if (value instanceof RegExp) {
        return {
            value: value,
        };
    }
    return value;
};