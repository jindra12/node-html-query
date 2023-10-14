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

interface QueueItem {
    type: LexerType;
    value: string;
}

interface Queue {
    items: QueueItem[];
    at: number;
    next: () => Queue;
}

interface Searcher {
    feedParserItem: (item: Parser.ParserItem) => void;
    feedParserItems: (item: Parser.ParserItem[]) => void;
    feedLexerItem: <T extends LexerType>(item: Parser.LexerItem<T>) => void;
}

const searchProducer = (
    reducer: <T extends LexerType>(
        item: Parser.ParserItem | Parser.LexerItem<T>
    ) => void,
    filter?: (item: Parser.ParserItem) => boolean
): Searcher => {
    const searcher: Searcher = {
        feedLexerItem: (lexer) => {
            reducer(lexer);
        },
        feedParserItem: (parser) => {
            if (!parser.consumed() || filter?.(parser) === false) {
                return;
            }
            reducer(parser);
            parser.search(searcher);
        },
        feedParserItems: (parsers) => {
            parsers.forEach((parser) => searcher.feedParserItem(parser));
        }
    };
    return searcher;
};

const printer = (document: Parser.HtmlDocument) => {
    let aggregate = "";
    const searcher = searchProducer((item) => {
        if (item instanceof Parser.LexerItem) {
            aggregate += item.value;
        }
    });
    document.search(searcher);
    return aggregate;
};

namespace Parser {
    export interface ParserItem {
        consumed: () => boolean;
        process: (queue: Queue) => Queue;
        search: (searcher: Searcher) => void;
    }
    export class LexerItem<T extends LexerType> {
        item: T;
        value = "";
        constructor(item: T) {
            this.item = item;
        }
    }
    export class HtmlDocument implements ParserItem {
        scriptletOrSeaWs1: ScriptletOrSeaWs[] = [];
        XML: LexerItem<"XML"> = new LexerItem("XML");
        scriptletOrSeaWs2: ScriptletOrSeaWs[] = [];
        DTD: LexerItem<"DTD"> = new LexerItem("DTD");
        scriptletOrSeaWs3: ScriptletOrSeaWs[] = [];
        htmlElements: HtmlElements[] = [];

        search = (searcher: Searcher) => {
            searcher.feedParserItems(this.scriptletOrSeaWs1);
            searcher.feedLexerItem(this.XML);
            searcher.feedParserItems(this.scriptletOrSeaWs2);
            searcher.feedLexerItem(this.DTD);
            searcher.feedParserItems(this.scriptletOrSeaWs3);
            searcher.feedParserItems(this.htmlElements);
        };

        consumed = () => true;
        process = (queue: Queue): Queue => {
            const current = queue.items[queue.at];
            if (!this.XML.value) {
                const scriptletOrSeaWs = new ScriptletOrSeaWs();
                const tryScriptlet = scriptletOrSeaWs.process(queue);
                if (scriptletOrSeaWs.consumed()) {
                    this.scriptletOrSeaWs1.push(scriptletOrSeaWs);
                    return this.process(tryScriptlet);
                }
                if (current.type === "XML") {
                    this.XML.value = current.value;
                    return this.process(queue.next());
                }
            }
            if (!this.DTD.value) {
                const scriptletOrSeaWs = new ScriptletOrSeaWs();
                const tryScriptlet = scriptletOrSeaWs.process(queue);
                if (scriptletOrSeaWs.consumed()) {
                    this.scriptletOrSeaWs2.push(scriptletOrSeaWs);
                    return this.process(tryScriptlet);
                }
                if (current.type === "DTD") {
                    this.DTD.value = current.value;
                    return this.process(queue.next());
                }
            }
            if (this.htmlElements.length === 0) {
                const scriptletOrSeaWs = new ScriptletOrSeaWs();
                const tryScriptlet = scriptletOrSeaWs.process(queue);
                if (scriptletOrSeaWs.consumed()) {
                    this.scriptletOrSeaWs2.push(scriptletOrSeaWs);
                    return this.process(tryScriptlet);
                }
            }
            const htmlElements = new HtmlElements();
            const tryHtmlElements = htmlElements.process(queue);
            if (htmlElements.consumed()) {
                this.htmlElements.push(htmlElements);
                return this.process(tryHtmlElements);
            }
            return queue;
        };
    }
    export class ScriptletOrSeaWs implements ParserItem {
        scriptlet: LexerItem<"SCRIPTLET"> = new LexerItem("SCRIPTLET");
        seaWs: LexerItem<"SEA_WS"> = new LexerItem("SEA_WS");

        search = (searcher: Searcher) => {
            searcher.feedLexerItem(this.scriptlet);
            searcher.feedLexerItem(this.seaWs);
        };
        consumed = () => {
            return Boolean(this.scriptlet.value || this.seaWs.value);
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
        };
    }
    export class HtmlElements implements ParserItem {
        htmlMisc1: HtmlMisc[] = [];
        htmlElement: HtmlElement = new HtmlElement();
        htmlMisc2: HtmlMisc[] = [];

        search = (searcher: Searcher) => {
            searcher.feedParserItems(this.htmlMisc1);
            searcher.feedParserItem(this.htmlElement);
            searcher.feedParserItems(this.htmlMisc2);
        };

        consumed = () => {
            return this.htmlElement.consumed();
        };

        process = (queue: Queue): Queue => {
            if (!this.htmlElement.consumed()) {
                const htmlMisc = new HtmlMisc();
                const tryHtmlMisc = htmlMisc.process(queue);
                if (htmlMisc.consumed()) {
                    this.htmlMisc1.push(htmlMisc);
                    return this.process(tryHtmlMisc);
                }
                const tryHtmlElement = this.htmlElement.process(queue);
                if (this.htmlElement.consumed()) {
                    return this.process(tryHtmlElement);
                }
            }
            const htmlMisc = new HtmlMisc();
            const tryHtmlMisc = htmlMisc.process(queue);
            if (htmlMisc.consumed()) {
                this.htmlMisc2.push(htmlMisc);
                return this.process(tryHtmlMisc);
            }
            return queue;
        };
    }
    export class HtmlElement implements ParserItem {
        tagOpen: LexerItem<"TAG_OPEN"> = new LexerItem("TAG_OPEN");
        tagName: LexerItem<"TAG_NAME"> = new LexerItem("TAG_NAME");
        htmlAttributes: HtmlAttribute[] = [];
        tagClose = {
            close1: {
                tag: new LexerItem("TAG_CLOSE"),
                closingGroup: {
                    htmlContent: new HtmlContent(),
                    tagClose: new LexerItem("TAG_CLOSE"),
                    tagName: new LexerItem("TAG_NAME"),
                    tagOpen: new LexerItem("TAG_OPEN"),
                    tagSlash: new LexerItem("TAG_SLASH"),
                },
            },
            close2: {
                tagSlashClose: new LexerItem("TAG_SLASH_CLOSE"),
            },
        };
        scriptlet: LexerItem<"SCRIPTLET"> = new LexerItem("SCRIPTLET");
        script: Script = new Script();
        style: Style = new Style();

        endTagConsumed = () => {
            return (
                this.tagClose.close1.tag.value ||
                this.tagClose.close2.tagSlashClose.value
            );
        };

        search = (searcher: Searcher) => {
            searcher.feedLexerItem(this.tagOpen);
            searcher.feedLexerItem(this.tagName);
            searcher.feedParserItems(this.htmlAttributes);
            searcher.feedLexerItem(this.tagClose.close1.tag);
            searcher.feedParserItem(this.tagClose.close1.closingGroup.htmlContent);
            searcher.feedLexerItem(this.tagClose.close1.closingGroup.tagClose);
            searcher.feedLexerItem(this.tagClose.close1.closingGroup.tagName);
            searcher.feedLexerItem(this.tagClose.close1.closingGroup.tagOpen);
            searcher.feedLexerItem(this.tagClose.close1.closingGroup.tagSlash);
        };

        consumed = () => {
            if (this.tagOpen.value && this.tagName.value && this.endTagConsumed()) {
                return true;
            }
            if (this.scriptlet.value) {
                return true;
            }
            if (this.script.consumed()) {
                return true;
            }
            if (this.style.consumed()) {
                return true;
            }
            return false;
        };

        process = (queue: Queue): Queue => {
            const current = queue.items[queue.at];
            if (this.tagClose.close1.tag.value) {
                const tryHtmlContent =
                    this.tagClose.close1.closingGroup.htmlContent.process(queue);
                if (this.tagClose.close1.closingGroup.htmlContent.consumed()) {
                    return this.process(tryHtmlContent);
                }
                return queue;
            }
            if (this.tagClose.close1.closingGroup.htmlContent.consumed()) {
                if (current.type === "TAG_OPEN") {
                    this.tagClose.close1.closingGroup.tagOpen.value = current.value;
                    return this.process(queue.next());
                }
                if (
                    this.tagClose.close1.closingGroup.tagOpen.value &&
                    current.type === "TAG_SLASH"
                ) {
                    this.tagClose.close1.closingGroup.tagSlash.value = current.value;
                    return this.process(queue.next());
                }
                if (
                    this.tagClose.close1.closingGroup.tagSlash.value &&
                    current.type === "TAG_NAME"
                ) {
                    this.tagClose.close1.closingGroup.tagName.value = current.value;
                    return this.process(queue.next());
                }
                if (
                    this.tagClose.close1.closingGroup.tagName.value &&
                    current.type === "TAG_CLOSE"
                ) {
                    this.tagClose.close1.closingGroup.tagClose.value = current.value;
                    return queue.next();
                }
            }
            if (current.type === "TAG_OPEN") {
                this.tagOpen.value = current.value;
                return this.process(queue.next());
            }
            if (current.type === "TAG_NAME" && this.tagOpen.value) {
                this.tagName.value = current.value;
                return this.process(queue.next());
            }
            if (this.tagName.value && !this.endTagConsumed()) {
                const htmlAttribute = new HtmlAttribute();
                const tryProcessAttribute = htmlAttribute.process(queue);
                if (htmlAttribute.consumed()) {
                    this.htmlAttributes.push(htmlAttribute);
                    return this.process(tryProcessAttribute);
                }
                if (current.type === "TAG_CLOSE") {
                    this.tagClose.close1.tag.value = current.value;
                    return this.process(queue.next());
                }
                if (current.type === "TAG_SLASH_CLOSE") {
                    this.tagClose.close2.tagSlashClose.value = current.value;
                    return this.process(queue.next());
                }
            }
            if (current.type === "SCRIPTLET") {
                this.scriptlet.value = current.value;
                return queue.next();
            }
            const tryProcessScript = this.script.process(queue);
            if (this.script.consumed()) {
                return tryProcessScript;
            }
            const tryProcessStyle = this.style.process(queue);
            if (this.style.consumed()) {
                return tryProcessStyle;
            }
            return queue;
        };
    }
    export class HtmlContent implements ParserItem {
        htmlCharData = new HtmlChardata();
        content: Array<{
            inner: {
                htmlElement: HtmlElement;
                cData: LexerItem<"CDATA">;
                htmlComment: HtmlComment;
            };
            charData: HtmlChardata;
        }> = [];

        search = (searcher: Searcher) => {
            searcher.feedParserItem(this.htmlCharData);
            this.content.forEach((item) => {
                searcher.feedParserItem(item.inner.htmlElement);
                searcher.feedLexerItem(item.inner.cData);
                searcher.feedParserItem(item.inner.htmlComment);
                searcher.feedParserItem(item.charData);
            });
        };

        process = (queue: Queue): Queue => {
            const current = queue.items[queue.at];
            if (this.content.length === 0) {
                const tryCharData = this.htmlCharData.process(queue);
                if (this.htmlCharData.consumed()) {
                    return this.process(tryCharData);
                }
            } else {
                const htmlElement = new HtmlElement();
                const tryHtmlElement = htmlElement.process(queue);
                const cData = new LexerItem("CDATA");
                const htmlComment = new HtmlComment();
                const tryHtmlComment = htmlComment.process(queue);
                if (htmlElement.consumed()) {
                    const htmlCharData = new HtmlChardata();
                    const tryProcessCharData = htmlCharData.process(tryHtmlElement);
                    if (htmlCharData.consumed()) {
                        this.content.push({
                            charData: htmlCharData,
                            inner: {
                                cData: new LexerItem("CDATA"),
                                htmlComment: new HtmlComment(),
                                htmlElement: htmlElement,
                            },
                        });
                        return this.process(tryProcessCharData);
                    } else {
                        this.content.push({
                            charData: new HtmlChardata(),
                            inner: {
                                cData: new LexerItem("CDATA"),
                                htmlComment: new HtmlComment(),
                                htmlElement: htmlElement,
                            },
                        });
                        return this.process(tryHtmlElement);
                    }
                }
                if (current.type === "CDATA") {
                    cData.value = current.value;
                    const htmlCharData = new HtmlChardata();
                    const tryProcessCharData = htmlCharData.process(queue.next());
                    if (htmlCharData.consumed()) {
                        this.content.push({
                            charData: htmlCharData,
                            inner: {
                                cData: new LexerItem("CDATA"),
                                htmlComment: new HtmlComment(),
                                htmlElement: htmlElement,
                            },
                        });
                        return this.process(tryProcessCharData);
                    } else {
                        this.content.push({
                            charData: new HtmlChardata(),
                            inner: {
                                cData: cData,
                                htmlComment: new HtmlComment(),
                                htmlElement: htmlElement,
                            },
                        });
                        return this.process(queue.next());
                    }
                }
                if (htmlComment.consumed()) {
                    const htmlCharData = new HtmlChardata();
                    const tryProcessCharData = htmlCharData.process(tryHtmlComment);
                    if (htmlCharData.consumed()) {
                        this.content.push({
                            charData: htmlCharData,
                            inner: {
                                cData: new LexerItem("CDATA"),
                                htmlComment: htmlComment,
                                htmlElement: new HtmlElement(),
                            },
                        });
                        return this.process(tryProcessCharData);
                    } else {
                        this.content.push({
                            charData: new HtmlChardata(),
                            inner: {
                                cData: new LexerItem("CDATA"),
                                htmlComment: htmlComment,
                                htmlElement: new HtmlElement(),
                            },
                        });
                        return this.process(tryHtmlComment);
                    }
                }
            }
            return queue;
        };
        consumed = () => true;
    }
    export class HtmlAttribute implements ParserItem {
        tagName = new LexerItem("TAG_NAME");
        attribute = {
            tagEquals: new LexerItem("TAG_EQUALS"),
            value: new LexerItem("ATTVALUE_VALUE"),
        };

        search = (searcher: Searcher) => {
            searcher.feedLexerItem(this.tagName);
            searcher.feedLexerItem(this.attribute.tagEquals);
            searcher.feedLexerItem(this.attribute.value);
        };
        consumed = () => {
            const attributeConsumed =
                (this.attribute.tagEquals.value && this.attribute.value.value) ||
                (!this.attribute.tagEquals.value && !this.attribute.value.value);
            return Boolean(this.tagName && attributeConsumed);
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
    export class HtmlChardata implements ParserItem {
        htmlText = new LexerItem("HTML_TEXT");
        seaWs = new LexerItem("SEA_WS");

        search = (searcher: Searcher) => {
            searcher.feedLexerItem(this.htmlText);
            searcher.feedLexerItem(this.seaWs);
        };

        consumed = () => {
            return Boolean(this.htmlText.value || this.seaWs.value);
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
        };
    }
    export class HtmlMisc implements ParserItem {
        htmlComment = new HtmlComment();
        seaWs = new LexerItem("SEA_WS");
        search = (searcher: Searcher) => {
            searcher.feedParserItem(this.htmlComment);
            searcher.feedLexerItem(this.seaWs);
        };
        consumed = () => {
            return Boolean(this.seaWs.value || this.htmlComment.consumed());
        };
        process = (queue: Queue): Queue => {
            const current = queue.items[queue.at];
            const tryProcess = this.htmlComment.process(queue);
            if (this.htmlComment.consumed()) {
                return tryProcess;
            }
            if (current.type === "SEA_WS") {
                this.seaWs.value = current.value;
                return queue.next();
            }
            return queue;
        };
    }
    class HtmlComment implements ParserItem {
        htmlComment = new LexerItem("HTML_COMMENT");
        htmlConditionalComment = new LexerItem("HTML_CONDITIONAL_COMMENT");
        search = (searcher: Searcher) => {
            searcher.feedLexerItem(this.htmlComment);
            searcher.feedLexerItem(this.htmlConditionalComment);
        };
        consumed = () => {
            return Boolean(
                this.htmlComment.value || this.htmlConditionalComment.value
            );
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
        };
    }
    export class Script implements ParserItem {
        scriptOpen = new LexerItem("SCRIPT_OPEN");
        scriptBody = new LexerItem("SCRIPT_BODY");
        scriptShortBody = new LexerItem("SCRIPT_SHORT_BODY");
        search = (searcher: Searcher) => {
            searcher.feedLexerItem(this.scriptOpen);
            searcher.feedLexerItem(this.scriptBody);
            searcher.feedLexerItem(this.scriptShortBody);
        };
        consumed = () => {
            return Boolean(
                this.scriptOpen.value &&
                (this.scriptBody.value || this.scriptShortBody.value)
            );
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
        };
    }
    export class Style implements ParserItem {
        styleOpen = new LexerItem("STYLE_OPEN");
        styleBody = new LexerItem("STYLE_BODY");
        styleShortBody = new LexerItem("STYLE_SHORT_BODY");
        search = (searcher: Searcher) => {
            searcher.feedLexerItem(this.styleOpen);
            searcher.feedLexerItem(this.styleBody);
            searcher.feedLexerItem(this.styleShortBody);
        };
        consumed = () => {
            return Boolean(
                this.styleOpen.value &&
                (this.styleBody.value || this.styleShortBody.value)
            );
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
        };
    }
}
