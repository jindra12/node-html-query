// Source and inspiration for this AST: https://github.com/antlr/grammars-v4/blob/master/html/HTMLLexer.g4, https://github.com/antlr/grammars-v4/blob/master/html/HTMLParser.g4

import { ParserItem, LexerItem, Searcher, Queue } from "./types";
import { uniqueId } from "./utils";

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

/**
   htmlDocument
    : scriptletOrSeaWs* XML? scriptletOrSeaWs* DTD? scriptletOrSeaWs* htmlElements*
    ;
 */
export class HtmlDocument implements ParserItem {
    scriptletOrSeaWs1: ScriptletOrSeaWs[] = [];
    XML: LexerItem<"XML"> = new LexerItem("XML");
    scriptletOrSeaWs2: ScriptletOrSeaWs[] = [];
    DTD: LexerItem<"DTD"> = new LexerItem("DTD");
    scriptletOrSeaWs3: ScriptletOrSeaWs[] = [];
    htmlElements: HtmlElements[] = [];

    prevSibling = (element: HtmlElement) => {
        const index = this.htmlElements.findIndex(
            (htmlElement) =>
                htmlElement.consumed() && htmlElement.htmlElement === element
        );
        if (index === -1) {
            return undefined;
        }
        return this.htmlElements[index - 1]?.htmlElement;
    };

    nextSibling = (element: HtmlElement) => {
        const index = this.htmlElements.findIndex(
            (htmlElement) =>
                htmlElement.consumed() && htmlElement.htmlElement === element
        );
        if (index === -1) {
            return undefined;
        }
        return this.htmlElements[index + 1]?.htmlElement;
    };

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
        const htmlElements = new HtmlElements(this);
        const tryHtmlElements = htmlElements.process(queue);
        if (htmlElements.consumed()) {
            this.htmlElements.push(htmlElements);
            return this.process(tryHtmlElements);
        }
        return queue;
    };
}

/**
  scriptletOrSeaWs
    : SCRIPTLET
    | SEA_WS
    ; 
 */
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

/**
   htmlElements
    : htmlMisc* htmlElement htmlMisc*
    ;
 */
export class HtmlElements implements ParserItem {
    htmlMisc1: HtmlMisc[] = [];
    htmlElement: HtmlElement;
    htmlMisc2: HtmlMisc[] = [];

    constructor(parent: HtmlDocument) {
        this.htmlElement = new HtmlElement(parent);
    }

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

/**
    htmlElement
        : TAG_OPEN TAG_NAME htmlAttribute*
        (TAG_CLOSE (htmlContent TAG_OPEN TAG_SLASH TAG_NAME TAG_CLOSE)? | TAG_SLASH_CLOSE)
        | SCRIPTLET
        | script
        | style
        ;
 */
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

    parent: HtmlContent | HtmlDocument;
    identifier: string;

    constructor(parent: HtmlContent | HtmlDocument) {
        this.parent = parent;
        this.identifier = uniqueId("htmlelement");
    }

    endTagConsumed = () => {
        return (
            this.tagClose.close1.tag.value || this.tagClose.close2.tagSlashClose.value
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
                current.type === "TAG_NAME" &&
                current.value === this.tagName.value
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

/**
   htmlContent
    : htmlChardata? ((htmlElement | CDATA | htmlComment) htmlChardata?)*
    ;
 */
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

    prevSibling = (element: HtmlElement) => {
        const index = this.content.findIndex(
            ({ inner: { htmlElement } }) =>
                htmlElement.consumed() && htmlElement.identifier === element.identifier
        );
        if (index === -1) {
            return undefined;
        }
        return this.content[index - 1]?.inner.htmlElement;
    };

    nextSibling = (element: HtmlElement) => {
        const index = this.content.findIndex(
            ({ inner: { htmlElement } }) =>
                htmlElement.consumed() && htmlElement.identifier === element.identifier
        );
        if (index === -1) {
            return undefined;
        }
        return this.content[index + 1]?.inner.htmlElement;
    };

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
            const htmlElement = new HtmlElement(this);
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
                            htmlElement: new HtmlElement(this),
                        },
                    });
                    return this.process(tryProcessCharData);
                } else {
                    this.content.push({
                        charData: new HtmlChardata(),
                        inner: {
                            cData: new LexerItem("CDATA"),
                            htmlComment: htmlComment,
                            htmlElement: new HtmlElement(this),
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

/**
   htmlAttribute
    : TAG_NAME (TAG_EQUALS ATTVALUE_VALUE)?
    ;
 */
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

/**
   htmlChardata
    : HTML_TEXT
    | SEA_WS
    ;
 */
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

/**   
    htmlMisc
        : htmlComment
        | SEA_WS
        ;
 */
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

/**
   htmlComment
    : HTML_COMMENT
    | HTML_CONDITIONAL_COMMENT
    ;
 */
class HtmlComment implements ParserItem {
    htmlComment = new LexerItem("HTML_COMMENT");
    htmlConditionalComment = new LexerItem("HTML_CONDITIONAL_COMMENT");
    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.htmlComment);
        searcher.feedLexerItem(this.htmlConditionalComment);
    };
    consumed = () => {
        return Boolean(this.htmlComment.value || this.htmlConditionalComment.value);
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

/**
  script
    : SCRIPT_OPEN (SCRIPT_BODY | SCRIPT_SHORT_BODY)
    ;
 */
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

/**
   style
    : STYLE_OPEN (STYLE_BODY | STYLE_SHORT_BODY)
    ;
 */
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
