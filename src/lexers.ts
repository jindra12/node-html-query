export const htmlFragments = {
    HEXADIGIT: () => /[a-fA-F0-9]/,
    DIGIT: () => /[0-9]/,
    TAG_NameChar: () =>
        new RegExp(
            `(${htmlFragments.TAG_NameStartChar()}|-| |.|${htmlFragments.DIGIT()}|\\u00B7|[\\u0300-\\u036F]|[\\u203F-\\u2040])`,
            "gmu"
        ),
    TAG_NameStartChar: () =>
        /[a-zA-Z\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/,
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
            "gmui"
        ),
        mode: "TAG",
    },
    TAG_WHITESPACE: { value: /[ \t\r\n]+/ },
    SCRIPT_BODY: { value: /.*<\/script>/, popMode: true, mode: "SCRIPT" },
    SCRIPT_SHORT_BODY: { value: /.*<\/>/, popMode: true, mode: "SCRIPT" },
    STYLE_BODY: { value: /<\/style>/, popMode: true, mode: "STYLE" },
    STYLE_SHORT_BODY: { value: /.*<\/>/, popMode: true, mode: "STYLE" },
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
    /*
    fragment At
        : '@'
        ;

    fragment Hex
        : [0-9a-fA-F]
        ;

    fragment NewlineOrSpace
        : '\r\n'
        | [ \t\r\n\f]
        |
        ;

    fragment Unicode
        : '\\' Hex Hex? Hex? Hex? Hex? Hex? NewlineOrSpace
        ;

    fragment Escape
        : Unicode
        | '\\' ~[\r\n\f0-9a-fA-F]
        ;

    fragment Nmstart
        : [_a-zA-Z]
        | Nonascii
        | Escape
        ;

    fragment Nmchar
        : [_a-zA-Z0-9\-]
        | Nonascii
        | Escape
        ;
    fragment Name
        : Nmchar+
        ;
    */
} as const;

export const cssLexerAtoms = {

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