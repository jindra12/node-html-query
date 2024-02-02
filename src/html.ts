// Source and inspiration for this AST: https://github.com/antlr/grammars-v4/blob/master/html/HTMLLexer.g4, https://github.com/antlr/grammars-v4/blob/master/html/HTMLParser.g4

import { ParserItem, LexerItem, Searcher, Queue } from "./types";
import { desanitizeAttribute, sanitizeAttribute, uniqueId } from "./utils";

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
    XML?: LexerItem<"XML">;
    scriptletOrSeaWs2: ScriptletOrSeaWs[] = [];
    DTD?: LexerItem<"DTD">;
    scriptletOrSeaWs3: ScriptletOrSeaWs[] = [];
    htmlElements: HtmlElements[] = [];

    cache: {
        children: { invalid: boolean; value: HtmlElement[] };
        descendants: { invalid: boolean; value: HtmlElement[] };
        indexes: { invalid: boolean; value: Partial<Record<string, number>> };
    } = {
            indexes: { invalid: true, value: {} },
            children: { invalid: true, value: [] },
            descendants: { invalid: true, value: [] },
        };

    identifier: string;

    constructor() {
        this.identifier = uniqueId("html_document");
    }

    addComment = (text: string, after?: HtmlElement | number) => {
        if (!after) {
            this.htmlElements.push(new HtmlElements(this));
            const misc = this.htmlElements[this.htmlElements.length - 1].htmlMisc1;
            misc.push(new HtmlMisc());
            const lastMisc = misc[misc.length - 1];
            lastMisc.htmlComment ||= new HtmlComment();
            lastMisc.htmlComment.htmlComment = new LexerItem("HTML_COMMENT", text);
        } else {
            const index = typeof after === "number" ? after : this.getIndex(after);
            if (index >= this.htmlElements.length) {
                this.addComment(text);
                return this;
            }
            if (index !== -1) {
                this.htmlElements[index].htmlMisc1.push(new HtmlMisc());
                const misc = this.htmlElements[index].htmlMisc1[0];
                misc.htmlComment ||= new HtmlComment();
                misc.htmlComment.htmlComment = new LexerItem("HTML_COMMENT", text);
            }
        }
        return this;
    };

    addConditionalComment = (text: string, after?: HtmlElement | number) => {
        if (!after) {
            this.htmlElements.push(new HtmlElements(this));
            const misc = this.htmlElements[this.htmlElements.length - 1].htmlMisc1;
            misc.push(new HtmlMisc());
            const lastMisc = misc[misc.length - 1];
            lastMisc.htmlComment ||= new HtmlComment();
            lastMisc.htmlComment.htmlConditionalComment = new LexerItem("HTML_CONDITIONAL_COMMENT", text);
        } else {
            const index = typeof after === "number" ? after : this.getIndex(after);
            if (index >= this.htmlElements.length) {
                this.addConditionalComment(text);
                return this;
            }
            if (index !== -1) {
                this.htmlElements[index].htmlMisc1.push(new HtmlMisc());
                const misc = this.htmlElements[
                    index
                ].htmlMisc1[0];
                misc.htmlComment ||= new HtmlComment();
                misc.htmlComment.htmlConditionalComment = new LexerItem("HTML_CONDITIONAL_COMMENT", text);
            }
        }
        return this;
    };

    descendants = () => {
        if (!this.cache.descendants.invalid) {
            return this.cache.descendants.value;
        }
        this.cache.descendants.invalid = false;
        const descendants: HtmlElement[] = [];
        const queue = [this as any as HtmlElement];
        let queueIndex = 0;
        while (queueIndex < queue.length) {
            const item = queue[queueIndex];
            queueIndex++;
            if (item) {
                const children = item.children();
                descendants.push(...children);
                queue.push(...children);
            }
        }
        this.cache.descendants.value = descendants;
        return descendants;
    };

    prevSibling = (element: HtmlElement) => {
        const index = this.getIndex(element);
        if (index === -1) {
            return undefined;
        }
        return this.children()[index - 1];
    };

    nextSibling = (element: HtmlElement) => {
        const index = this.getIndex(element);
        if (index === -1) {
            return undefined;
        }
        return this.children()[index + 1];
    };

    addChild = (child: HtmlElement, index: number | undefined = undefined) => {
        const item = new HtmlElements(this);
        item.htmlElement = child;
        child.parent = this;

        if (index === undefined) {
            this.htmlElements.push(item);
        } else {
            this.htmlElements.splice(index, 0, item);
        }
        this.cache.children.invalid = true;
        this.cache.indexes.invalid = true;
        this.cache.descendants.invalid = true;
        return this;
    };

    removeChild = (child: HtmlElement | number) => {
        if (
            typeof child === "number" &&
            child >= 0 &&
            child < this.htmlElements.length
        ) {
            this.htmlElements.splice(child, 1);
        } else if (child instanceof HtmlElement) {
            const index = this.getIndex(child);
            this.htmlElements.splice(index, 1);
        }
        this.cache.children.invalid = true;
        this.cache.indexes.invalid = true;
        this.cache.descendants.invalid = true;
        return this;
    };

    replaceChild = (child: HtmlElement | number, replacement: HtmlElement) => {
        const item = new HtmlElements(this);
        item.htmlElement = replacement;
        item.htmlElement.parent = this;
        if (
            typeof child === "number" &&
            child >= 0 &&
            child < this.htmlElements.length
        ) {
            this.htmlElements.splice(child, 1, item);
        } else if (child instanceof HtmlElement) {
            const index = this.getIndex(child);
            this.htmlElements.splice(index, 1, item);
        }
        this.cache.children.invalid = true;
        this.cache.indexes.invalid = true;
        this.cache.descendants.invalid = true;
        return this;
    };

    children = () => {
        if (!this.cache.children.invalid) {
            return this.cache.children.value;
        }
        this.cache.children.invalid = false;
        return (this.cache.children.value = this.htmlElements
            .map(({ htmlElement }) => htmlElement!));
    };

    getIndex = (element: HtmlElement) => {
        if (!this.cache.indexes.invalid) {
            return this.cache.indexes.value[element.identifier] ?? -1;
        }
        this.cache.indexes.invalid = false;
        this.cache.indexes.value = this.htmlElements
            .reduce((indexes: Record<string, number>, element, index) => {
                indexes[element.htmlElement!.identifier] = index;
                return indexes;
            }, {});
        return this.cache.indexes.value[element.identifier] ?? -1;
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
        if (!this.XML?.value && !this.DTD?.value && this.htmlElements.length === 0) {
            const scriptletOrSeaWs = new ScriptletOrSeaWs();
            const tryScriptlet = scriptletOrSeaWs.process(queue);
            if (scriptletOrSeaWs.consumed()) {
                this.scriptletOrSeaWs1.push(scriptletOrSeaWs);
                return this.process(tryScriptlet);
            }
            if (current.type === "XML") {
                const xml = new LexerItem("XML", current.value);
                this.XML = xml;
                return this.process(queue.next());
            }
        }
        if (!this.DTD?.value && this.htmlElements.length === 0) {
            const scriptletOrSeaWs = new ScriptletOrSeaWs();
            const tryScriptlet = scriptletOrSeaWs.process(queue);
            if (scriptletOrSeaWs.consumed()) {
                this.scriptletOrSeaWs2.push(scriptletOrSeaWs);
                return this.process(tryScriptlet);
            }
            if (current.type === "DTD") {
                this.DTD = new LexerItem("DTD", current.value);
                return this.process(queue.next());
            }
        }
        if (this.htmlElements.length === 0) {
            const scriptletOrSeaWs = new ScriptletOrSeaWs();
            const tryScriptlet = scriptletOrSeaWs.process(queue);
            if (scriptletOrSeaWs.consumed()) {
                this.scriptletOrSeaWs3.push(scriptletOrSeaWs);
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
    scriptlet?: LexerItem<"SCRIPTLET">;
    seaWs?: LexerItem<"SEA_WS">;

    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.scriptlet);
        searcher.feedLexerItem(this.seaWs);
    };
    consumed = () => {
        return Boolean(this.scriptlet?.value || this.seaWs?.value);
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        switch (current.type) {
            case "SCRIPTLET":
                this.scriptlet = new LexerItem("SCRIPTLET", current.value);
                return queue.next();
            case "SEA_WS":
                this.seaWs = new LexerItem("SEA_WS", current.value);
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
    htmlElement?: HtmlElement;
    htmlMisc2: HtmlMisc[] = [];
    parent: HtmlDocument;

    constructor(parent: HtmlDocument) {
        this.parent = parent;
    }

    search = (searcher: Searcher) => {
        searcher.feedParserItems(this.htmlMisc1);
        searcher.feedParserItem(this.htmlElement);
        searcher.feedParserItems(this.htmlMisc2);
    };

    consumed = () => {
        return Boolean(this.htmlElement?.consumed());
    };

    process = (queue: Queue): Queue => {
        if (!this.htmlElement?.consumed()) {
            const htmlMisc = new HtmlMisc();
            const tryHtmlMisc = htmlMisc.process(queue);
            if (htmlMisc.consumed()) {
                this.htmlMisc1.push(htmlMisc);
                return this.process(tryHtmlMisc);
            }
            const htmlElement = new HtmlElement(this.parent);
            const tryHtmlElement = htmlElement.process(queue);
            if (htmlElement.consumed()) {
                this.htmlElement = htmlElement;
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

    clone = () => {
        const htmlElements = new HtmlElements(
            this.parent
        );
        htmlElements.htmlMisc1 = this.htmlMisc1.map((misc) => misc.clone());
        htmlElements.htmlElement = this.htmlElement?.clone();
        htmlElements.htmlMisc2 = this.htmlMisc2.map((misc) => misc.clone());
        return htmlElements;
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
    tagOpen: LexerItem<"TAG_OPEN"> | undefined;
    tagWhiteSpace1: LexerItem<"TAG_WHITESPACE"> | undefined;
    tagName: LexerItem<"TAG_NAME"> | undefined;
    tagWhiteSpace2: LexerItem<"TAG_WHITESPACE"> | undefined;
    htmlAttributes: HtmlAttribute[] = [];
    tagClose?: {
        close1?: {
            tagClose?: LexerItem<"TAG_CLOSE">,
            closingGroup?: {
                htmlContent?: HtmlContent,
                tagOpen?: LexerItem<"TAG_OPEN">,
                tagSlash?: LexerItem<"TAG_SLASH">,
                tagWhiteSpace1?: LexerItem<"TAG_WHITESPACE">,
                tagName?: LexerItem<"TAG_NAME">,
                tagWhiteSpace2?: LexerItem<"TAG_WHITESPACE">,
                tagClose?: LexerItem<"TAG_CLOSE">,
            },
        },
        close2?: {
            tagSlashClose?: LexerItem<"TAG_SLASH_CLOSE">,
        },
    };
    scriptlet?: LexerItem<"SCRIPTLET">;
    script?: Script;
    style?: Style;

    data: Partial<Record<string, string>> = {};
    parent: HtmlElement | HtmlDocument;
    identifier: string;
    cache: {
        attributes: {
            value: Partial<Record<string, string>>;
            invalid: boolean;
        };
        styles: {
            value: Partial<Record<string, string>>;
            invalid: boolean;
        };
    } = {
            attributes: {
                value: {},
                invalid: true,
            },
            styles: {
                value: {},
                invalid: true,
            },
        };

    constructor(parent: HtmlElement | HtmlDocument) {
        this.parent = parent;
        this.identifier = uniqueId("htmlelement");
    }

    convertWithChildren = () => {
        if (
            this.script ||
            this.style ||
            this.scriptlet?.value
        ) {
            throw `Cannot add children to <script>, <style> or scriptlet`;
        }
        if (this.getHtmlAttributes().length === 0 && this.tagWhiteSpace2) {
            this.tagWhiteSpace2.value = "";
        }
        if (this.tagClose?.close2?.tagSlashClose?.value) {
            this.tagClose.close2.tagSlashClose.value = "";
            this.tagClose = {
                close1: {
                    tagClose: new LexerItem("TAG_CLOSE", ">"),
                    closingGroup: {
                        htmlContent: new HtmlContent(this),
                        tagClose: new LexerItem("TAG_CLOSE", ">"),
                        tagName: new LexerItem("TAG_NAME", this.tagName?.value),
                        tagOpen: new LexerItem("TAG_OPEN", "<"),
                        tagSlash: new LexerItem("TAG_SLASH", "/"),
                    }
                }
            };
            const attributes = this.getHtmlAttributes();
            const lastAttribute = attributes[attributes.length - 1];
            if (lastAttribute && lastAttribute.attribute) {
                lastAttribute.attribute.ws = undefined;
            }
        }
        if (this.tagClose?.close1?.closingGroup && !this.tagClose.close1.closingGroup.htmlContent) {
            this.tagClose.close1.closingGroup.htmlContent = new HtmlContent(this);
        }
    };

    prevSibling = (element: HtmlElement) => {
        return this.content()?.prevSibling(element);
    };

    nextSibling = (element: HtmlElement) => {
        return this.content()?.nextSibling(element);
    };

    getStyles = () => {
        if (!this.cache.styles.invalid) {
            return this.cache.styles.value;
        }
        const attributes = this.attributes();
        this.cache.styles.invalid = false;
        return (this.cache.styles.value =
            attributes["style"]
                ?.split(";")
                .map((part) => part.split(":"))
                .reduce((styles: Record<string, string>, [key, value]) => {
                    styles[key] = value.replace(/(^\s*)|(\s*$)/gu, "");
                    return styles;
                }, {}) || {});
    };

    modifyStyle = (
        styleName: string,
        styleModifier: (value?: string) => string
    ) => {
        this.cache.styles.invalid = true;
        this.cache.attributes.invalid = true;
        this.modifyAttribute("style", (attribute) => {
            if (!attribute) {
                return `${styleName}:${styleModifier()}`;
            }
            const split = attribute.split(";").map((part) => part.split(":"));
            const findIndex = split.findIndex(([key]) => key === styleName);
            if (findIndex === -1) {
                split.push([styleName, styleModifier()]);
            } else {
                split[findIndex] = [styleName, styleModifier(split[findIndex][1])];
            }
            return split.map((part) => part.join(":")).join(";");
        });
        return this;
    };

    getTagName = () => {
        if (this.script) {
            return "script";
        } else if (this.style) {
            return "style";
        }
        return this.tagName?.value;
    };

    content = () => this.tagClose?.close1?.closingGroup?.htmlContent;

    children = () => {
        return this.content()?.children() || [];
    };

    addText = (text: string) => {
        this.content()?.addText(text);
        return this;
    }

    emptyText = () => {
        this.content()?.emptyText();
        return this;
    };

    emptyComments = () => {
        this.content()?.emptyComments();
        return this;
    };

    addComment = (text: string, after?: HtmlElement | number) => {
        this.content()?.addComment(text, after);
        return this;
    };

    addConditionalComment = (text: string, after?: HtmlElement | number) => {
        this.content()?.addConditionalComment(text, after);
        return this;
    };

    texts = () => {
        return this.content()?.texts() || [];
    };

    descendants = () => {
        return this.content()?.descendants() || [];
    };

    getIndex = (
        element: HtmlElement,
        indexOthers: boolean,
        filter?: (element: HtmlElement) => boolean
    ) => {
        return this.content()?.getIndex(element, indexOthers, filter) ?? -1;
    };

    addChild = (child: HtmlElement, index: number | undefined = undefined) => {
        this.content()?.addChild(child, index);
        return this;
    };

    removeChild = (child: HtmlElement | number) => {
        this.content()?.removeChild(child);
        return this;
    };

    replaceChild = (child: HtmlElement | number, replacement: HtmlElement) => {
        this.content()?.replaceChild(child, replacement);
        return this;
    };

    getHtmlAttributes = () => {
        if (this.script) {
            return this.script.attributes;
        } else if (this.style) {
            return this.style.attributes;
        }
        return this.htmlAttributes;
    };

    addAttribute = (attributeName: string, attributeValue?: string) => {
        if (attributeName === "style") {
            this.cache.styles.invalid = true;
        }
        this.cache.attributes.invalid = true;
        const attribute = new HtmlAttribute();
        attribute.tagName = new LexerItem("TAG_NAME", attributeName);
        if (attributeValue) {
            const desanitized = desanitizeAttribute(attributeValue);
            attribute.attribute ||= {};
            attribute.attribute.tagEquals = new LexerItem("TAG_EQUALS", "=");
            attribute.attribute.value = new LexerItem("ATTVALUE_VALUE", desanitized);
            if (this.tagClose?.close2?.tagSlashClose?.value) {
                attribute.attribute.ws = new LexerItem("TAG_WHITESPACE", " ");
            } else {
                const attributes = this.getHtmlAttributes();
                const last = attributes[attributes.length - 1];
                if (last) {
                    last.attribute ||= {};
                    last.attribute.ws = new LexerItem("TAG_WHITESPACE", " ");
                }
            }
        }
        this.getHtmlAttributes().push(attribute);
        if (!this.tagWhiteSpace2?.value) {
            this.tagWhiteSpace2 = new LexerItem("TAG_WHITESPACE", " ");
        }
        return this;
    };

    removeAttribute = (attributeName: string) => {
        const attributeIndex = this.getHtmlAttributes().findIndex(
            (attribute) => attribute.tagName?.value === attributeName
        );
        if (attributeIndex !== -1) {
            this.cache.attributes.invalid = true;
            const attributes = this.getHtmlAttributes();
            attributes.splice(attributeIndex, 1);
            if (
                attributes.length === 0 &&
                !this.tagClose?.close2?.tagSlashClose?.value
            ) {
                this.tagWhiteSpace2 = new LexerItem("TAG_WHITESPACE", " ");
            }
        }
        if (attributeName === "style") {
            this.cache.styles.invalid = true;
        }
        return this;
    };

    modifyAttribute = (
        attributeName: string,
        modifier: (existingAttribute?: string) => undefined | string
    ) => {
        const attribute = this.attributes()[attributeName];
        const modified = modifier(attribute);
        this.replaceAttribute(attributeName, modified);
        return this;
    };

    replaceAttribute = (attributeName: string, nextValue?: string) => {
        this.removeAttribute(attributeName);
        this.addAttribute(attributeName, nextValue);
        this.cache.attributes.invalid = true;
        if (attributeName === "style") {
            this.cache.styles.invalid = true;
        }
        return this;
    };

    attributes = () => {
        if (!this.cache.attributes.invalid) {
            return this.cache.attributes.value;
        }
        this.cache.attributes.invalid = false;
        return (this.cache.attributes.value = this.getHtmlAttributes().reduce(
            (attributes: Record<string, string>, attribute) => {
                if (attribute.tagName) {
                    attributes[attribute.tagName.value] =
                        sanitizeAttribute(attribute.attribute?.value?.value) || "";
                }
                return attributes;
            },
            {}
        ));
    };

    noEndingTagNeeded = () =>
        [
            "meta",
            "link",
            "input",
            "img",
            "hr",
            "br",
            "area",
            "base",
            "col",
            "embed",
            "param",
            "source",
            "track",
            "wbr",
        ].includes(this.tagName?.value || "");

    endTagConsumed = () => {
        return Boolean(
            this.noEndingTagNeeded() ||
            (this.tagClose?.close1?.closingGroup?.tagOpen?.value &&
                this.tagClose?.close1?.closingGroup?.tagSlash?.value &&
                this.tagClose.close1.closingGroup.tagName?.value &&
                this.tagClose.close1.closingGroup.tagClose?.value) ||
            this.tagClose?.close2?.tagSlashClose?.value
        );
    };

    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.tagOpen);
        searcher.feedLexerItem(this.tagWhiteSpace1);
        searcher.feedLexerItem(this.tagName);
        searcher.feedLexerItem(this.tagWhiteSpace2);
        searcher.feedParserItems(this.htmlAttributes);
        searcher.feedLexerItem(this.tagClose?.close1?.tagClose);
        searcher.feedParserItem(this.tagClose?.close1?.closingGroup?.htmlContent);
        searcher.feedLexerItem(this.tagClose?.close1?.closingGroup?.tagOpen);
        searcher.feedLexerItem(this.tagClose?.close1?.closingGroup?.tagSlash);
        searcher.feedLexerItem(this.tagClose?.close1?.closingGroup?.tagWhiteSpace1);
        searcher.feedLexerItem(this.tagClose?.close1?.closingGroup?.tagName);
        searcher.feedLexerItem(this.tagClose?.close1?.closingGroup?.tagWhiteSpace2);
        searcher.feedLexerItem(this.tagClose?.close1?.closingGroup?.tagClose);
        searcher.feedLexerItem(this.tagClose?.close2?.tagSlashClose);
        searcher.feedLexerItem(this.scriptlet);
        searcher.feedParserItem(this.script);
        searcher.feedParserItem(this.style);
    };

    consumed = () => {
        if (
            this.tagOpen?.value &&
            this.tagName?.value &&
            (this.tagClose?.close1?.tagClose?.value ||
                this.tagClose?.close2?.tagSlashClose?.value) &&
            this.endTagConsumed()
        ) {
            return true;
        }
        if (this.scriptlet?.value) {
            return true;
        }
        if (this.script?.consumed()) {
            return true;
        }
        if (this.style?.consumed()) {
            return true;
        }
        return false;
    };

    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (!this.tagOpen?.value) {
            if (current.type === "SCRIPTLET") {
                this.scriptlet = new LexerItem("SCRIPTLET", current.value);
                return queue.next();
            }
            const script = new Script();
            const tryProcessScript = script.process(queue);
            if (script.consumed()) {
                this.script = script;
                return tryProcessScript;
            }
            const style = new Style();
            const tryProcessStyle = style.process(queue);
            if (style.consumed()) {
                this.style = style;
                return tryProcessStyle;
            }
        }
        if (this.tagClose?.close1?.tagClose?.value) {
            if (!this.noEndingTagNeeded()) {
                if (
                    !this.tagClose?.close1?.closingGroup?.tagOpen?.value &&
                    !this.tagClose.close1.closingGroup?.htmlContent?.consumed()
                ) {
                    this.tagClose.close1.closingGroup ||= {};
                    const htmlContent = new HtmlContent(this);
                    const tryHtmlContent = htmlContent.process(queue);
                    if (htmlContent.consumed()) {
                        this.tagClose.close1.closingGroup.htmlContent = htmlContent;
                        return this.process(tryHtmlContent);
                    }
                }
                if (current.type === "TAG_OPEN") {
                    this.tagClose ||= {};
                    this.tagClose.close1 ||= {};
                    this.tagClose.close1.closingGroup ||= {};
                    this.tagClose.close1.closingGroup.tagOpen = new LexerItem("TAG_OPEN", current.value)
                    return this.process(queue.next());
                }
            }
            if (
                this.tagClose.close1.closingGroup?.tagOpen?.value &&
                current.type === "TAG_SLASH"
            ) {
                this.tagClose.close1.closingGroup.tagSlash = new LexerItem("TAG_SLASH", current.value)
                return this.process(queue.next());
            }
            if (current.type === "TAG_WHITESPACE" && this.tagClose.close1.closingGroup) {
                if (!this.tagClose.close1.closingGroup?.tagName?.value) {
                    this.tagClose.close1.closingGroup.tagWhiteSpace1 = new LexerItem("TAG_WHITESPACE", current.value);
                } else {
                    this.tagClose.close1.closingGroup.tagWhiteSpace2 = new LexerItem("TAG_WHITESPACE", current.value);
                }
                return this.process(queue.next());
            }
            if (
                this.tagClose.close1?.closingGroup?.tagSlash?.value &&
                current.type === "TAG_NAME" &&
                current.value === this.tagName?.value
            ) {
                this.tagClose.close1.closingGroup.tagName = new LexerItem("TAG_NAME", current.value);
                return this.process(queue.next());
            }
            if (
                this.tagClose.close1.closingGroup?.tagName?.value &&
                current.type === "TAG_CLOSE"
            ) {
                this.tagClose.close1.closingGroup.tagClose = new LexerItem("TAG_CLOSE", current.value)
                return queue.next();
            }
        } else {
            if (current.type === "TAG_OPEN") {
                this.tagOpen = new LexerItem("TAG_OPEN", current.value);
                return this.process(queue.next());
            }
            if (this.tagOpen?.value && current.type === "TAG_WHITESPACE") {
                if (!this.tagName?.value) {
                    this.tagWhiteSpace1 = new LexerItem("TAG_WHITESPACE", current.value);
                } else {
                    this.tagWhiteSpace2 = new LexerItem("TAG_WHITESPACE", current.value);
                }
                return this.process(queue.next());
            }
            if (this.tagName?.value) {
                if (current.type === "TAG_CLOSE") {
                    this.tagClose ||= {}
                    this.tagClose.close1 ||= {};
                    this.tagClose.close1.tagClose = new LexerItem("TAG_CLOSE", current.value);
                    return this.process(queue.next());
                }
                if (current.type === "TAG_SLASH_CLOSE") {
                    this.tagClose ||= {};
                    this.tagClose.close2 ||= {};
                    this.tagClose.close2.tagSlashClose = new LexerItem("TAG_SLASH_CLOSE", current.value);
                    return queue.next();
                }
                const htmlAttribute = new HtmlAttribute();
                const tryProcessAttribute = htmlAttribute.process(queue);
                if (htmlAttribute.consumed()) {
                    this.htmlAttributes.push(htmlAttribute);
                    return this.process(tryProcessAttribute);
                }
            } else if (current.type === "TAG_NAME" && this.tagOpen?.value) {
                this.tagName = new LexerItem("TAG_NAME", current.value);
                return this.process(queue.next());
            }
        }
        return queue;
    };

    clone = () => {
        const element = new HtmlElement(this.parent);
        if (this.tagOpen?.value) {
            element.tagOpen = new LexerItem("TAG_OPEN", this.tagOpen?.value);
        }
        if (this.tagWhiteSpace1?.value) {
            element.tagWhiteSpace1 = new LexerItem("TAG_WHITESPACE", this.tagWhiteSpace1?.value);
        }
        if (this.tagName?.value) {
            element.tagName = new LexerItem("TAG_NAME", this.tagName?.value);
        }
        if (this.tagWhiteSpace2?.value) {
            element.tagWhiteSpace2 = new LexerItem("TAG_WHITESPACE", this.tagWhiteSpace2?.value);
        }
        element.htmlAttributes = this.htmlAttributes.map((a) => a.clone());
        if (this.tagClose) {
            element.tagClose ||= {};
            if (this.tagClose.close1) {
                element.tagClose.close1 ||= {};
                element.tagClose.close1.tagClose = new LexerItem("TAG_CLOSE", this.tagClose.close1.tagClose?.value);
                if (this.tagClose.close1.closingGroup) {
                    element.tagClose.close1.closingGroup ||= {};
                    element.tagClose.close1.closingGroup.htmlContent = this.content()?.clone();
                    if (this.tagClose.close1.closingGroup.tagClose?.value) {
                        element.tagClose.close1.closingGroup.tagClose = new LexerItem("TAG_CLOSE", this.tagClose.close1.closingGroup.tagClose?.value);
                    }
                    if (this.tagClose.close1.closingGroup.tagWhiteSpace1?.value) {
                        element.tagClose.close1.closingGroup.tagWhiteSpace1 = new LexerItem("TAG_WHITESPACE", this.tagClose.close1.closingGroup.tagWhiteSpace1?.value)
                    }
                    if (this.tagClose.close1.closingGroup.tagName?.value) {
                        element.tagClose.close1.closingGroup.tagName = new LexerItem("TAG_NAME", this.tagClose.close1.closingGroup.tagName?.value);
                    }
                    if (this.tagClose.close1.closingGroup.tagWhiteSpace2?.value) {
                        element.tagClose.close1.closingGroup.tagWhiteSpace2 = new LexerItem("TAG_WHITESPACE", this.tagClose.close1.closingGroup.tagWhiteSpace2?.value);
                    }
                    if (this.tagClose.close1.closingGroup.tagOpen?.value) {
                        element.tagClose.close1.closingGroup.tagOpen = new LexerItem("TAG_OPEN", this.tagClose.close1.closingGroup.tagOpen?.value);
                    }
                    if (this.tagClose.close1.closingGroup.tagSlash?.value) {
                        element.tagClose.close1.closingGroup.tagSlash = new LexerItem("TAG_SLASH", this.tagClose.close1.closingGroup.tagSlash?.value);
                    }
                }
            }
            if (this.tagClose.close2) {
                element.tagClose.close2 ||= {};
                if (this.tagClose.close2.tagSlashClose?.value) {
                    element.tagClose.close2.tagSlashClose = new LexerItem("TAG_SLASH_CLOSE", this.tagClose.close2.tagSlashClose?.value);
                }
            }
        }
        if (this.scriptlet?.value) {
            element.scriptlet = new LexerItem("SCRIPTLET", this.scriptlet?.value);
        }
        element.script = this.script?.clone();
        element.style = this.style?.clone();
        element.data = this.data;

        return element;
    };
}

/**
   htmlContent
    : htmlChardata? ((htmlElement | CDATA | htmlComment) htmlChardata?)*
    ;
 */
export class HtmlContent implements ParserItem {
    htmlCharData?: HtmlChardata;
    content: Array<HtmlElement | LexerItem<"CDATA"> | HtmlComment | HtmlChardata> = [];

    cache: {
        children: { invalid: boolean; value: HtmlElement[] };
        indexes: { invalid: boolean; value: Partial<Record<string, number>> };
    } = {
            indexes: { invalid: true, value: {} },
            children: { invalid: true, value: [] },
        };

    identifier: string;
    parent: HtmlElement;
    constructor(parent: HtmlElement) {
        this.parent = parent;
        this.identifier = uniqueId("html_content");
    }

    children = () => {
        if (!this.cache.children.invalid) {
            return this.cache.children.value;
        }
        this.cache.children.invalid = false;
        return this.cache.children.value = this.content
            .filter((content): content is HtmlElement => content instanceof HtmlElement)
    };

    descendants = () => {
        const descendants: HtmlElement[] = [];
        const queue = [this.parent];
        let queueIndex = 0;
        while (queueIndex < queue.length) {
            const item = queue[queueIndex];
            queueIndex++;
            if (item) {
                const children = item.children();
                descendants.push(...children);
                queue.push(...children);
            }
        }
        return descendants;
    };

    emptyComments = () => {
        this.content = this.content?.filter(content => !(content instanceof HtmlComment));
        this.children().forEach((child) => {
            child.emptyComments();
        });
    };

    emptyText = () => {
        this.htmlCharData = undefined;
        this.content = this.content.filter(content => !(content instanceof HtmlChardata));
        this.children().forEach((child) => {
            child.emptyText();
        });
        return this;
    };

    texts = () => {
        const acc: string[] = [];
        if (this.htmlCharData?.htmlText?.value) {
            acc.push(this.htmlCharData.htmlText.value);
        }
        this.content.forEach((content) => {
            if (content instanceof HtmlChardata && content.htmlText) {
                acc.push(content.htmlText.value);
            }
        });
        this.children().forEach((child) => {
            const texts = child.texts();
            texts?.forEach((text) => {
                acc.push(text);
            });
        });
        return acc.filter(Boolean);
    }

    addText = (text: string, after?: HtmlElement) => {
        if (!after) {
            this.htmlCharData ||= new HtmlChardata();
            if (this.htmlCharData.htmlText) {
                this.htmlCharData.htmlText.value += text;
            } else {
                this.htmlCharData.htmlText = new LexerItem("HTML_TEXT", text);
            }
        } else {
            const index = this.getIndex(after, true);
            if (index !== -1) {
                const charData = new HtmlChardata();
                charData.htmlText = new LexerItem("HTML_TEXT", text);
                this.content.splice(index, 0, charData);
            }
        }
        return this;
    };

    addComment = (text: string, after?: HtmlElement | number) => {
        if (!after) {
            const htmlComment = new HtmlComment();
            this.content.push(htmlComment);
            htmlComment.htmlComment = new LexerItem("HTML_COMMENT", text);
        } else {
            const index =
                typeof after === "number" ? after : this.getIndex(after, true);
            if (index >= this.content.length) {
                this.addComment(text);
                return this;
            }
            if (index !== -1) {
                const htmlComment = new HtmlComment();
                htmlComment.htmlComment = new LexerItem("HTML_COMMENT", text);
                this.content.splice(index, 0, htmlComment);
            }
        }
        return this;
    };

    addConditionalComment = (text: string, after?: HtmlElement | number) => {
        if (!after) {
            const htmlComment = new HtmlComment();
            htmlComment.htmlConditionalComment = new LexerItem("HTML_CONDITIONAL_COMMENT", text);
            this.content.push(htmlComment);
        } else {
            const index =
                typeof after === "number" ? after : this.getIndex(after, true);
            if (index >= this.content.length) {
                this.addComment(text);
                return this;
            }
            if (index !== -1) {
                const htmlComment = new HtmlComment();
                htmlComment.htmlConditionalComment = new LexerItem("HTML_CONDITIONAL_COMMENT", text);
                this.content.splice(index, 0, htmlComment);
            }
        }
        return this;
    };

    addChild = (child: HtmlElement, index: number | undefined = undefined) => {
        child.parent = this.parent;
        if (index === undefined) {
            this.content.push(child);
        } else {
            this.content.splice(index, 0, child);
        }
        this.cache.children.invalid = true;
        this.cache.indexes.invalid = true;
        if (index === 0 && this.htmlCharData?.htmlText?.value) {
            const nextCharData = this.htmlCharData.clone();
            this.htmlCharData = new HtmlChardata();
            this.content.splice(1, 0, nextCharData);
        }
        return this;
    };

    removeChild = (child: HtmlElement | number) => {
        if (
            typeof child === "number" &&
            child >= 0 &&
            child < this.content.length
        ) {
            this.content.splice(child, 1);
            this.cache.children.invalid = true;
            this.cache.indexes.invalid = true;
        } else if (child instanceof HtmlElement) {
            const index = this.getIndex(child, true);
            this.content.splice(index, 1);
            this.cache.children.invalid = true;
            this.cache.indexes.invalid = true;
        }
        return this;
    };

    replaceChild = (child: HtmlElement | number, replacement: HtmlElement) => {
        replacement.parent = this.parent;
        if (
            typeof child === "number" &&
            child >= 0 &&
            child < this.content.length
        ) {
            this.content.splice(child, 1, replacement);
            this.cache.children.invalid = true;
            this.cache.indexes.invalid = true;
        } else if (child instanceof HtmlElement) {
            const index = this.getIndex(child, true);
            this.content.splice(index, 1, replacement);
            this.cache.children.invalid = true;
            this.cache.indexes.invalid = true;
        }
        return this;
    };

    getIndex = (
        element: HtmlElement,
        indexOthers: boolean,
        filter?: (element: HtmlElement) => boolean
    ) => {
        const getIndexes = () =>
            this.content
                .filter((content) =>
                    !indexOthers ? content instanceof HtmlElement : true
                )
                .filter((content) => !filter || content instanceof HtmlElement && filter(content))
                .reduce((indexes: Record<string, number>, htmlElement, index) => {
                    if (htmlElement instanceof HtmlElement) {
                        indexes[htmlElement.identifier] = index;
                    }
                    return indexes;
                }, {});
        if (filter) {
            return getIndexes()[element.identifier];
        }
        if (!this.cache.indexes.invalid) {
            return this.cache.indexes.value[element.identifier] ?? -1;
        }
        this.cache.indexes.invalid = false;
        this.cache.indexes.value = getIndexes();
        return this.cache.indexes.value[element.identifier] ?? -1;
    };

    prevSibling = (element: HtmlElement) => {
        const index = this.getIndex(element, false);
        if (index === -1) {
            return undefined;
        }
        return this.children()[index - 1];
    };

    nextSibling = (element: HtmlElement) => {
        const index = this.getIndex(element, false);
        if (index === -1) {
            return undefined;
        }
        return this.children()[index + 1];
    };

    search = (searcher: Searcher) => {
        searcher.feedParserItem(this.htmlCharData);
        this.content.forEach((item) => {
            if (item instanceof LexerItem) {
                searcher.feedLexerItem(item);
            } else {
                searcher.feedParserItem(item);
            }
        });
    };

    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (this.content.length === 0 && !this.htmlCharData?.consumed()) {
            const htmlCharData = new HtmlChardata();
            const tryCharData = htmlCharData.process(queue);
            if (htmlCharData.consumed()) {
                this.htmlCharData = htmlCharData;
                return this.process(tryCharData);
            }
        }
        const cData = new LexerItem("CDATA");
        if (current.type === "CDATA") {
            cData.value = current.value;
            this.content.push(cData);
            return this.process(queue.next());
        }
        const htmlElement = new HtmlElement(this.parent);
        const tryHtmlElement = htmlElement.process(queue);
        if (htmlElement.consumed()) {
            this.content.push(htmlElement);
            return this.process(tryHtmlElement);
        }
        const htmlComment = new HtmlComment();
        const tryHtmlComment = htmlComment.process(queue);
        if (htmlComment.consumed()) {
            this.content.push(htmlComment);
            return this.process(tryHtmlComment);
        }
        const htmlCharData = new HtmlChardata();
        const tryProcessCharData = htmlCharData.process(queue);
        if (htmlCharData.consumed()) {
            this.content.push(htmlCharData);
            return this.process(tryProcessCharData);
        }
        return queue;
    };
    consumed = () => {
        return this.htmlCharData?.consumed() || this.content.length !== 0;
    };
    clone = () => {
        const content = new HtmlContent(this.parent);
        content.htmlCharData = this.htmlCharData?.clone();
        content.content = this.content.map((value) => {
            if (value instanceof LexerItem) {
                return new LexerItem("CDATA", value.value);
            }
            return value.clone();
        });
        return content;
    };
}

/**
   htmlAttribute
    : TAG_NAME (TAG_EQUALS ATTVALUE_VALUE)?
    ;
 */
export class HtmlAttribute implements ParserItem {
    tagName?: LexerItem<"TAG_NAME">;
    attribute?: {
        tagEquals?: LexerItem<"TAG_EQUALS">,
        value?: LexerItem<"ATTVALUE_VALUE">,
        ws?: LexerItem<"TAG_WHITESPACE">,
    };

    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.tagName);
        searcher.feedLexerItem(this.attribute?.tagEquals);
        searcher.feedLexerItem(this.attribute?.value);
        searcher.feedLexerItem(this.attribute?.ws);
    };
    consumed = () => {
        const attributeConsumed =
            (this.attribute?.tagEquals?.value && this.attribute.value?.value) ||
            (!this.attribute?.tagEquals?.value && !this.attribute?.value?.value);
        return Boolean(this.tagName?.value && attributeConsumed);
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        switch (current.type) {
            case "TAG_NAME":
                this.tagName = new LexerItem("TAG_NAME", current.value);
                return this.process(queue.next());
            case "TAG_EQUALS":
                if (this.tagName?.value) {
                    this.attribute ||= {};
                    this.attribute.tagEquals = new LexerItem("TAG_EQUALS", current.value);
                    return this.process(queue.next());
                }
                break;
            case "ATTVALUE_VALUE":
                if (this.attribute?.tagEquals?.value) {
                    this.attribute.value = new LexerItem("ATTVALUE_VALUE", current.value);
                    return this.process(queue.next());
                }
                break;
            case "TAG_WHITESPACE":
                if (this.tagName?.value) {
                    this.attribute ||= {};
                    this.attribute.ws = new LexerItem("TAG_WHITESPACE", current.value);
                    return queue.next();
                }
        }
        return queue;
    };
    clone = () => {
        const attribute = new HtmlAttribute();
        if (this.tagName?.value) {
            attribute.tagName = new LexerItem("TAG_NAME", this.tagName?.value);
        }
        if (this.attribute) {
            attribute.attribute ||= {};
            if (this.attribute.tagEquals?.value) {
                attribute.attribute.tagEquals = new LexerItem("TAG_EQUALS", this.attribute.tagEquals?.value);
            }
            if (this.attribute.value?.value) {
                attribute.attribute.value = new LexerItem("ATTVALUE_VALUE", this.attribute.value?.value);
            }
            if (this.attribute.ws?.value) {
                attribute.attribute.ws = new LexerItem("TAG_WHITESPACE", this.attribute.ws?.value);
            }
        }
        return attribute;
    };
}

/**
   htmlChardata
    : HTML_TEXT
    | SEA_WS
    ;
 */
export class HtmlChardata implements ParserItem {
    htmlText?: LexerItem<"HTML_TEXT">;
    seaWs?: LexerItem<"SEA_WS">;

    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.htmlText);
        searcher.feedLexerItem(this.seaWs);
    };

    consumed = () => {
        return Boolean(this.htmlText?.value || this.seaWs?.value);
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        switch (current.type) {
            case "HTML_TEXT":
                this.htmlText = new LexerItem("HTML_TEXT", current.value);
                return queue.next();
            case "SEA_WS":
                this.seaWs = new LexerItem("SEA_WS", current.value);
                return queue.next();
        }
        return queue;
    };

    clone = () => {
        const clone = new HtmlChardata();
        if (this.htmlText?.value) {
            clone.htmlText = new LexerItem("HTML_TEXT", this.htmlText?.value);
        }
        if (this.seaWs?.value) {
            clone.seaWs = new LexerItem("SEA_WS", this.seaWs?.value);
        }
        return clone;
    };
}

/**   
    htmlMisc
        : htmlComment
        | SEA_WS
        ;
 */
export class HtmlMisc implements ParserItem {
    htmlComment?: HtmlComment;
    seaWs?: LexerItem<"SEA_WS">;
    search = (searcher: Searcher) => {
        searcher.feedParserItem(this.htmlComment);
        searcher.feedLexerItem(this.seaWs);
    };
    consumed = () => {
        return Boolean(this.seaWs?.value || this.htmlComment?.consumed());
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        const htmlComment = new HtmlComment();
        const tryProcess = htmlComment.process(queue);
        if (htmlComment.consumed()) {
            this.htmlComment = htmlComment;
            return tryProcess;
        }
        if (current.type === "SEA_WS") {
            this.seaWs = new LexerItem("SEA_WS", current.value);
            return queue.next();
        }
        return queue;
    };
    clone = () => {
        const htmlMisc = new HtmlMisc();
        htmlMisc.htmlComment = this.htmlComment?.clone();
        if (this.seaWs?.value) {
            htmlMisc.seaWs = new LexerItem("SEA_WS", this.seaWs?.value);
        }
        return htmlMisc;
    };
}

/**
   htmlComment
    : HTML_COMMENT
    | HTML_CONDITIONAL_COMMENT
    ;
 */
export class HtmlComment implements ParserItem {
    htmlComment?: LexerItem<"HTML_COMMENT">;
    htmlConditionalComment?: LexerItem<"HTML_CONDITIONAL_COMMENT">;
    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.htmlComment);
        searcher.feedLexerItem(this.htmlConditionalComment);
    };
    consumed = () => {
        return Boolean(this.htmlComment?.value || this.htmlConditionalComment?.value);
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        switch (current.type) {
            case "HTML_COMMENT":
                this.htmlComment = new LexerItem("HTML_COMMENT", current.value);
                return queue.next();
            case "HTML_CONDITIONAL_COMMENT":
                this.htmlConditionalComment = new LexerItem("HTML_CONDITIONAL_COMMENT", current.value);
                return queue.next();
        }
        return queue;
    };
    clone = () => {
        const comment = new HtmlComment();
        if (this.htmlComment?.value) {
            comment.htmlComment = new LexerItem("HTML_COMMENT", this.htmlComment?.value);
        }
        if (this.htmlConditionalComment?.value) {
            comment.htmlConditionalComment = new LexerItem("HTML_CONDITIONAL_COMMENT", this.htmlConditionalComment?.value);
        }
        return comment;
    };
}

/**
  script
    : TAG_OPEN SCRIPT_OPEN htmlAttribute* ((TAG_CLOSE SCRIPT_BODY) | TAG_SLASH_CLOSE)
    ;
 */
export class Script implements ParserItem {
    scriptOpen?: LexerItem<"SCRIPT_OPEN">;
    scriptBody?: LexerItem<"SCRIPT_BODY">;
    tagClose?: LexerItem<"TAG_CLOSE">;
    tagSlashClose?: LexerItem<"TAG_SLASH_CLOSE">;
    attributes: HtmlAttribute[] = [];
    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.scriptOpen);
        searcher.feedParserItems(this.attributes);
        searcher.feedLexerItem(this.tagClose);
        searcher.feedLexerItem(this.scriptBody);
        searcher.feedLexerItem(this.tagSlashClose);
    };
    consumed = () => {
        return Boolean(
            this.scriptOpen?.value && ((this.scriptBody?.value && this.tagClose?.value) ||
                this.tagSlashClose?.value)
        );
    };
    process = (queue: Queue): Queue => {
        if (this.scriptOpen?.value && !this.tagClose?.value) {
            const attribute = new HtmlAttribute();
            const tryParseAttribute = attribute.process(queue);
            if (attribute.consumed()) {
                this.attributes.push(attribute);
                return this.process(tryParseAttribute);
            }
        }
        const current = queue.items[queue.at];
        switch (current.type) {
            case "SCRIPT_OPEN":
                if (!this.scriptOpen?.value) {
                    this.scriptOpen = new LexerItem("SCRIPT_OPEN", current.value);
                    return this.process(queue.next());
                }
                break;
            case "TAG_CLOSE":
                if (this.scriptOpen?.value) {
                    this.tagClose = new LexerItem("TAG_CLOSE", current.value);
                    return this.process(queue.next());
                }
                break;
            case "SCRIPT_BODY":
                if (this.scriptOpen?.value) {
                    this.scriptBody = new LexerItem("SCRIPT_BODY", current.value);
                    return queue.next();
                }
                break;
            case "TAG_SLASH_CLOSE":
                if (
                    this.scriptOpen?.value &&
                    !this.scriptBody?.value &&
                    !this.tagClose?.value &&
                    !this.tagSlashClose?.value
                ) {
                    this.tagSlashClose = new LexerItem("TAG_SLASH_CLOSE", current.value);
                    return queue.next();
                }
                break;
        }
        return queue;
    };
    clone = () => {
        const script = new Script();
        if (this.scriptOpen?.value) {
            script.scriptOpen = new LexerItem("SCRIPT_OPEN", this.scriptOpen?.value);
        }
        if (this.tagClose?.value) {
            script.tagClose = new LexerItem("TAG_CLOSE", this.tagClose?.value);
        }
        if (this.scriptBody?.value) {
            script.scriptBody = new LexerItem("SCRIPT_BODY", this.scriptBody?.value);
        }
        if (this.tagSlashClose?.value) {
            script.tagSlashClose = new LexerItem("TAG_SLASH_CLOSE", this.tagSlashClose?.value);
        }
        script.attributes = this.attributes.map((a) => a.clone());
        return script;
    };
}

/**
   style
    : TAG_OPEN STYLE_OPEN htmlAttribute* ((TAG_CLOSE STYLE_BODY) | TAG_SLASH_CLOSE)
    ;
 */
export class Style implements ParserItem {
    styleOpen?: LexerItem<"STYLE_OPEN">;
    styleBody?: LexerItem<"STYLE_BODY">;
    tagClose?: LexerItem<"TAG_CLOSE">;
    tagSlashClose?: LexerItem<"TAG_SLASH_CLOSE">;
    attributes: HtmlAttribute[] = [];
    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.styleOpen);
        searcher.feedParserItems(this.attributes);
        searcher.feedLexerItem(this.tagClose);
        searcher.feedLexerItem(this.styleBody);
        searcher.feedLexerItem(this.tagSlashClose);
    };
    consumed = () => {
        return Boolean(
            this.styleOpen?.value &&
            ((this.styleBody?.value && this.tagClose?.value) ||
                this.tagSlashClose?.value)
        );
    };
    process = (queue: Queue): Queue => {
        if (this.styleOpen?.value && !this.tagClose?.value) {
            const attribute = new HtmlAttribute();
            const tryParseAttribute = attribute.process(queue);
            if (attribute.consumed()) {
                this.attributes.push(attribute);
                return this.process(tryParseAttribute);
            }
        }
        const current = queue.items[queue.at];
        switch (current.type) {
            case "STYLE_OPEN":
                if (!this.styleOpen?.value) {
                    this.styleOpen = new LexerItem("STYLE_OPEN", current.value);
                    return this.process(queue.next());
                }
                break;
            case "TAG_CLOSE":
                if (this.styleOpen?.value) {
                    this.tagClose = new LexerItem("TAG_CLOSE", current.value);
                    return this.process(queue.next());
                }
                break;
            case "STYLE_BODY":
                if (this.styleOpen?.value) {
                    this.styleBody = new LexerItem("STYLE_BODY", current.value);
                    return queue.next();
                }
                break;
            case "TAG_SLASH_CLOSE":
                if (
                    this.styleOpen?.value &&
                    !this.styleBody?.value &&
                    !this.tagClose?.value &&
                    !this.tagSlashClose?.value
                ) {
                    this.tagSlashClose = new LexerItem("TAG_SLASH_CLOSE", current.value);
                    return queue.next();
                }
                break;
        }
        return queue;
    };
    clone = () => {
        const style = new Style();
        if (this.styleOpen?.value) {
            style.styleOpen = new LexerItem("STYLE_OPEN", this.styleOpen?.value);
        }
        if (this.styleBody?.value) {
            style.styleBody = new LexerItem("STYLE_BODY", this.styleBody?.value);
        }
        style.attributes = this.attributes.map((a) => a.clone());
        if (this.tagClose?.value) {
            style.tagClose = new LexerItem("TAG_CLOSE", this.tagClose?.value);
        }
        if (this.tagSlashClose?.value) {
            style.tagSlashClose = new LexerItem("TAG_SLASH_CLOSE", this.tagSlashClose?.value);
        }
        return style;
    };
}
