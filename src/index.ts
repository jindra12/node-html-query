// Source and inspiration for this AST: https://github.com/antlr/grammars-v4/blob/master/html/HTMLLexer.g4, https://github.com/antlr/grammars-v4/blob/master/html/HTMLParser.g4
/**
 [The "BSD licence"]
 Copyright (c) 2013 Tom Everett
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions
 are met:
 1. Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.
 2. Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in the
    documentation and/or other materials provided with the distribution.
 3. The name of the author may not be used to endorse or promote products
    derived from this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR
 IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT,
 INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

const fragments = {
    HEXADIGIT: () => /[a-fA-F0-9]/,
    DIGIT: () => /[0-9]/,
    TAG_NameChar: () =>
        new RegExp(
            `(${fragments.TAG_NameStartChar()}|-| |.|${fragments.DIGIT()}|\\u00B7|[\\u0300-\\u036F]|[\\u203F-\\u2040])`,
            "gmu"
        ),
    TAG_NameStartChar: () =>
        /[a-zA-Z\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/,
    ATTCHARS: () => new RegExp(`${fragments.ATTCHAR}+ ?`, "gmu"),
    ATTCHAR: () => /[\-_\.\/\+,\?=:;#0-9a-zA-Z]/gmu,
    HEXCHARS: () => /#[0-9a-fA-F]/gmu,
    DECCHARS: () => /[0-9]+%?/gmu,
    DOUBLE_QUOTE_STRING: () => /"(?!(<|"))"/gmu,
    SINGLE_QUOTE_STRING: () => /'(?!(<|'))'/gmu,
};

interface Lexer {
    value: RegExp;
    popMode?: boolean;
    mode?: "SCRIPT" | "STYLE" | "TAG" | "ATTVALUE";
    pushMode?: "SCRIPT" | "STYLE" | "TAG" | "ATTVALUE";
}

const normalizeLexer = (item: keyof typeof lexerAtoms): Lexer => {
    const value = lexerAtoms[item];
    if (value instanceof RegExp) {
        return {
            value: value,
        };
    }
    return value;
};

const lexerAtoms = {
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
            `${fragments.TAG_NameStartChar}(${fragments.TAG_NameChar})*`,
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
            ` *(${fragments.DOUBLE_QUOTE_STRING()}|${fragments.SINGLE_QUOTE_STRING()}|${fragments.ATTCHARS()}|${fragments.HEXCHARS()}|${fragments.DECCHARS()})`,
            "gmu"
        ),
        popMode: true,
        mode: "ATTVALUE",
    },
    ATTRIBUTE: {
        value: new RegExp(
            `(${fragments.DOUBLE_QUOTE_STRING()}|${fragments.SINGLE_QUOTE_STRING()}|${fragments.ATTCHARS()}|${fragments.HEXCHARS()}|${fragments.DECCHARS()})`,
            "gmu"
        ),
        mode: "ATTVALUE",
    },
} as const;

type LexerType = keyof typeof lexerAtoms;

interface QueueItem { type: LexerType, value: string }

interface Queue {
    items: QueueItem[];
    at: number;
    next: () => Queue;
}

namespace Parser {
    class LexerItem<T extends LexerType> {
        item: T;
        value = "";
        constructor(item: T) {
            this.item = item;
        }
    }
    class HTMLDocument {
       scriptletOrSeaWs1: ScriptletOrSeaWs[] = [];
       XML: LexerItem<"XML"> = new LexerItem("XML");
       scriptletOrSeaWs2: ScriptletOrSeaWs[] = [];
       DTD: LexerItem<"DTD"> = new LexerItem("DTD");
       scriptletOrSeaWs3: ScriptletOrSeaWs[] = [];
       htmlElements: HtmlElements[] = [];
    }
    class ScriptletOrSeaWs {
        scriptlet: LexerItem<"SCRIPTLET"> = new LexerItem("SCRIPTLET");
        seaWs: LexerItem<"SEA_WS"> = new LexerItem("SEA_WS");

        consumed = () => {
            return this.scriptlet.value || this.seaWs.value;
        };
        process = (queue: Queue): Queue => {
            const current = queue.items[queue.at];
            switch (current.type) {
                case "SCRIPTLET":
                    this.scriptlet.value = current.value;
                    return queue.next();
                case "SEA_WS":
                    this.seaWs.value = current.value;
                    return queue.next();
            }
            return queue;
        }
    }
    class HtmlElements {
        htmlMisc1: HtmlMisc[] = [];
        htmlElement: HtmlElement = new HtmlElement();
        htmlMisc2: HtmlMisc[] = [];
    }
    class HtmlElement {
        tagOpen: LexerItem<"TAG_OPEN"> = new LexerItem("TAG_OPEN");
        tagName: LexerItem<"TAG_NAME"> = new LexerItem("TAG_NAME");
        htmlAttribute: HtmlAttribute[] = [];
        tagClose = {
            close1: {
                closingGroup: {
                    htmlContent: new HtmlContent(),
                    tagClose: new LexerItem("TAG_CLOSE"),
                    tagName: new LexerItem("TAG_NAME"),
                    tagOpen: new LexerItem("TAG_OPEN"),
                    tagSlash: new LexerItem("TAG_SLASH"),
                },
                tag: new LexerItem("TAG_CLOSE"),
            },
            close2: {
                tagSlashClose: new LexerItem("TAG_SLASH_CLOSE"),
            },
        };
        scriptlet: LexerItem<"SCRIPTLET"> = new LexerItem("SCRIPTLET");
        script: Script = new Script();
        style: Style = new Style();
    }
    class HtmlContent {
        htmlCharData = new HtmlChardata();
        content: Array<{
            inner: {
                htmlElement: HtmlElement,
                cData: LexerItem<"CDATA">,
                htmlComment: LexerItem<"HTML_COMMENT">,
            }
            charData: HtmlChardata
        }> = [];
    }
    class HtmlAttribute {
        tagName = new LexerItem("TAG_NAME");
        attribute = {
            tagEquals: new LexerItem("TAG_EQUALS"),
            value: new LexerItem("ATTVALUE_VALUE"),
        };
        consumed = () => {
            const attributeConsumed = (this.attribute.tagEquals.value && this.attribute.value.value)
                || (!this.attribute.tagEquals.value && !this.attribute.value.value)
            return this.tagName && attributeConsumed;
        };
        process = (queue: Queue): Queue => {
            const current = queue.items[queue.at];
            switch (current.type) {
                case "TAG_NAME":
                    this.tagName.value = current.value;
                    return this.process(queue.next());
                case "TAG_EQUALS":
                    this.attribute.tagEquals.value = current.value;
                    return this.process(queue.next());
                case "ATTVALUE_VALUE":
                    this.attribute.value.value = current.value;
                    return queue.next();
            }
            return queue;
        };
    }
    class HtmlChardata {
        htmlText = new LexerItem("HTML_TEXT");
        seaWs = new LexerItem("SEA_WS");
        consumed = () => {
            return this.htmlText.value || this.seaWs.value;
        };
        process = (queue: Queue): Queue => {
            const current = queue.items[queue.at];
            switch (current.type) {
                case "HTML_TEXT":
                    this.htmlText.value = current.value;
                    return queue.next();
                case "SEA_WS":
                    this.seaWs.value = current.value;
                    return queue.next();
            }
            return queue;
        }
    }
    class HtmlMisc {
        htmlComment = new HtmlComment();
        seaWs = new LexerItem("SEA_WS");
    }
    class HtmlComment {
        htmlComment = new LexerItem("HTML_COMMENT");
        htmlConditionalComment = new LexerItem("HTML_CONDITIONAL_COMMENT");
        consumed = () => {
            return this.htmlComment.value || this.htmlConditionalComment.value;
        };
        process = (queue: Queue): Queue => {
            const current = queue.items[queue.at];
            switch (current.type) {
                case "HTML_COMMENT":
                    this.htmlComment.value = current.value;
                    return queue.next();
                case "HTML_CONDITIONAL_COMMENT":
                    this.htmlConditionalComment.value = current.value;
                    return queue.next();
            }
            return queue;
        }
    }
    class Script {
        scriptOpen = new LexerItem("SCRIPT_OPEN");
        scriptBody = new LexerItem("SCRIPT_BODY");
        scriptShortBody = new LexerItem("SCRIPT_SHORT_BODY");
    
        consumed = () => {
            return this.scriptOpen.value && (this.scriptBody.value || this.scriptShortBody.value);
        };
        process = (queue: Queue): Queue => {
            const current = queue.items[queue.at];
            switch (current.type) {
                case "SCRIPT_OPEN":
                    this.scriptOpen.value = current.value;
                    return this.process(queue.next());
                case "SCRIPT_BODY":
                    this.scriptBody.value = current.value;
                    return queue.next();
                case "SCRIPT_SHORT_BODY":
                    this.scriptShortBody.value = current.value;
                    return queue.next();
            }
            return queue;
        }
    }
    class Style {
        styleOpen = new LexerItem("STYLE_OPEN");
        styleBody = new LexerItem("STYLE_BODY");
        styleShortBody = new LexerItem("STYLE_SHORT_BODY");

        consumed = () => {
            return this.styleOpen.value && (this.styleBody.value || this.styleShortBody.value);
        };
        process = (queue: Queue): Queue => {
            const current = queue.items[queue.at];
            switch (current.type) {
                case "STYLE_OPEN":
                    this.styleOpen.value = current.value;
                    return this.process(queue.next());
                case "STYLE_BODY":
                    this.styleBody.value = current.value;
                    return queue.next();
                case "STYLE_SHORT_BODY":
                    this.styleShortBody.value = current.value;
                    return queue.next();
            }
            return queue;
        }
    }
}

/*
htmlDocument
    : scriptletOrSeaWs* XML? scriptletOrSeaWs* DTD? scriptletOrSeaWs* htmlElements*
    ;

scriptletOrSeaWs
    : SCRIPTLET
    | SEA_WS
    ;

htmlElements
    : htmlMisc* htmlElement htmlMisc*
    ;

htmlElement
    : TAG_OPEN TAG_NAME htmlAttribute*
      (TAG_CLOSE (htmlContent TAG_OPEN TAG_SLASH TAG_NAME TAG_CLOSE)? | TAG_SLASH_CLOSE)
    | SCRIPTLET
    | script
    | style
    ;

htmlContent
    : htmlChardata? ((htmlElement | CDATA | htmlComment) htmlChardata?)*
    ;

htmlAttribute
    : TAG_NAME (TAG_EQUALS ATTVALUE_VALUE)?
    ;

htmlChardata
    : HTML_TEXT
    | SEA_WS
    ;

htmlMisc
    : htmlComment
    | SEA_WS
    ;

htmlComment
    : HTML_COMMENT
    | HTML_CONDITIONAL_COMMENT
    ;

script
    : SCRIPT_OPEN (SCRIPT_BODY | SCRIPT_SHORT_BODY)
    ;

style
    : STYLE_OPEN (STYLE_BODY | STYLE_SHORT_BODY)
    ;
*/