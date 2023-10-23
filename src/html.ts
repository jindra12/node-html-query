// Source and inspiration for this AST: https://github.com/antlr/grammars-v4/blob/master/html/HTMLLexer.g4, https://github.com/antlr/grammars-v4/blob/master/html/HTMLParser.g4

import { ParserItem, LexerItem, Searcher, Queue } from "./types";
import { consumeCache, desanitizeAttribute, sanitizeAttribute, uniqueId } from "./utils";

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

    cache: {
        children: { invalid: boolean; value: HtmlElement[] };
        descendants: { invalid: boolean; value: HtmlElement[] };
        indexes: { invalid: boolean; value: Record<string, number> };
    } = {
            indexes: { invalid: true, value: {} },
            children: { invalid: true, value: [] },
            descendants: { invalid: true, value: [] },
        };

    identifier: string;

    constructor() {
        this.identifier = uniqueId("html_document");
    }

    descendants = () => {
        if (!this.consumed()) {
            return [];
        }
        if (!this.cache.descendants.invalid) {
            return this.cache.descendants.value;
        }
        this.cache.descendants.invalid = false;
        return (this.cache.descendants.value = this.children().concat(
            this.children()
                .map((child) => child.descendants())
                .reduce((flatten: HtmlElement[], elements) => {
                    elements.forEach((element) => {
                        flatten.push(element);
                    });
                    return flatten;
                }, [])
        ));
    };

    addChild = (child: HtmlElement, index: number | undefined = undefined) => {
        if (this.consumed()) {
            this.cache.children.invalid = true;
            this.cache.indexes.invalid = true;
            const item = new HtmlElements(this);
            item.htmlElement = child;
            child.parent = this;
    
            if (index === undefined) {
                this.htmlElements.push(item);
            } else {
                this.htmlElements.splice(index, 0, item);
            }
        }
        return this;
    };

    removeChild = (child: HtmlElement | number) => {
        if (this.consumed()) {
            if (
                typeof child === "number" &&
                child >= 0 &&
                child < this.htmlElements.length
            ) {
                this.htmlElements.splice(child, 1);
                this.cache.children.invalid = true;
                this.cache.indexes.invalid = true;
            } else if (child instanceof HtmlElement) {
                const index = this.getIndex(child);
                this.htmlElements.splice(index, 1);
                this.cache.children.invalid = true;
                this.cache.indexes.invalid = true;
            }
        }
        return this;
    };

    replaceChild = (child: HtmlElement | number, replacement: HtmlElement) => {
        if (this.consumed()) {
            const item = new HtmlElements(this);
            item.htmlElement = replacement;
            item.htmlElement.parent = this;
            if (
                typeof child === "number" &&
                child >= 0 &&
                child < this.htmlElements.length
            ) {
                this.htmlElements.splice(child, 1, item);
                this.cache.children.invalid = true;
                this.cache.indexes.invalid = true;
            } else if (child instanceof HtmlElement) {
                const index = this.getIndex(child);
                this.htmlElements.splice(index, 1, item);
                this.cache.children.invalid = true;
                this.cache.indexes.invalid = true;
            }
        }
        return this;
    };

    children = () => {
        if (!this.consumed()) {
            return [];
        }
        if (!this.cache.children.invalid) {
            return this.cache.children.value;
        }
        this.cache.children.invalid = false;
        return (this.cache.children.value = this.htmlElements
            .filter(({ htmlElement }) => htmlElement.consumed())
            .map(({ htmlElement }) => htmlElement));
    };

    getIndex = (element: HtmlElement) => {
        if (!this.consumed()) {
            return -1;
        }
        if (!this.cache.indexes.invalid) {
            return this.cache.indexes.value[element.identifier] ?? -1;
        }
        this.cache.indexes.invalid = false;
        this.cache.indexes.value = this.htmlElements.reduce(
            (indexes: Record<string, number>, element, index) => {
                if (element.consumed()) {
                    indexes[element.htmlElement.identifier] = index;
                }
                return indexes;
            },
            {}
        );
        return this.cache.indexes.value[element.identifier] ?? -1;
    };

    prevSibling = (element: HtmlElement) => {
        const index = this.getIndex(element);
        if (index === -1) {
            return undefined;
        }
        return this.htmlElements[index - 1]?.htmlElement;
    };

    nextSibling = (element: HtmlElement) => {
        const index = this.getIndex(element);
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

    consumed = consumeCache(() => true);
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
    consumed = consumeCache(() => {
        return Boolean(this.scriptlet.value || this.seaWs.value);
    });
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

    consumed = consumeCache(() => {
        return this.htmlElement.consumed();
    });

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
                htmlContent: new HtmlContent(this),
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

    data: Record<string, string> = {};
    parent: HtmlContent | HtmlDocument;
    identifier: string;
    cache: {
        attributes: {
            value: Record<string, string>;
            invalid: boolean;
        };
        styles: {
            value: Record<string, string>;
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

    constructor(parent: HtmlContent | HtmlDocument) {
        this.parent = parent;
        this.identifier = uniqueId("htmlelement");
    }

    getStyles = () => {
        if (!this.consumed()) {
            return {};
        }
        if (!this.cache.styles.invalid) {
            return this.cache.styles.value;
        }
        const attributes = this.attributes();
        this.cache.styles.invalid = false;
        return (this.cache.styles.value = attributes["style"]
            .split(";")
            .map((part) => part.split(":"))
            .reduce((styles: Record<string, string>, [key, value]) => {
                styles[key] = value;
                return styles;
            }, {}));
    };

    modifyStyle = (styleName: string, styleModifier: (value?: string) => string) => {
        if (this.consumed()) {
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
        }
        return this;
    };

    getTagName = () => {
        if (!this.consumed()) {
            return "";
        }
        if (this.script.consumed()) {
            return "script";
        } else if (this.style.consumed()) {
            return "style";
        }
        return this.tagName.value;
    };

    content = () => this.tagClose.close1.closingGroup.htmlContent;

    children = () => {
        if (!this.consumed() || !this.content().consumed()) {
            return [];
        }
        return this.content().children();
    };

    emptyText = () => {
        if (!this.consumed()) {
            return this;
        }
        this.content().htmlCharData.htmlText.value = "";
        this.content().content.forEach(({ charData }) => {
            charData.htmlText.value = "";
        });
        this.children().forEach((child) => {
            child.emptyText();
        });
        return this;
    };

    texts = () => {
        if (!this.consumed()) {
            return [];
        }
        const acc: string[] = [];
        if (this.content().htmlCharData.consumed()) {
            acc.push(this.content().htmlCharData.htmlText.value);
        }
        this.content().content.forEach(({ charData }) => {
            acc.push(charData.htmlText.value);
        });
        this.children().forEach((child) => {
            const texts = child.texts();
            texts.forEach((text) => {
                acc.push(text);
            });
        });
        return acc.filter(Boolean);
    };

    descendants = () => {
        if (!this.consumed()) {
            return [];
        }
        const seeker = (
            htmlElements: HtmlElement[],
            collector: (element: HtmlElement) => void
        ) => {
            htmlElements.forEach(collector);
            htmlElements.forEach((element) => seeker(element.children(), collector));
        };
        const descendants: HtmlElement[] = [];
        seeker([this], (element) => {
            descendants.push(element);
        });
        return descendants;
    };

    addChild = (child: HtmlElement, index: number | undefined) => {
        if (!this.consumed() || !this.content().consumed()) {
            return [];
        }
        this.content().addChild(child, index);
        return this;
    };

    removeChild = (child: HtmlElement | number) => {
        if (!this.consumed() || !this.content().consumed()) {
            return [];
        }
        this.content().removeChild(child);
        return this;
    };

    replaceChild = (child: HtmlElement | number, replacement: HtmlElement) => {
        if (!this.consumed() || !this.content().consumed()) {
            return [];
        }
        this.content().replaceChild(child, replacement);
        return this;
    };

    getHtmlAttributes = () => {
        if (!this.consumed()) {
            return [];
        }
        if (this.script.consumed()) {
            return this.script.attributes;
        } else if (this.style.consumed()) {
            return this.style.attributes;
        }
        return this.htmlAttributes;
    };

    addAttribute = (attributeName: string, attributeValue?: string) => {
        if (this.consumed()) {
            if (attributeName === "style") {
                this.cache.styles.invalid = true;
            }
            this.cache.attributes.invalid = true;
            const attribute = new HtmlAttribute();
            attribute.tagName.value = attributeName;
            if (attributeValue) {
                const desanitized = desanitizeAttribute(attributeValue);
                attribute.attribute.tagEquals.value = "=";
                attribute.attribute.value.value = desanitized;
            }
            this.getHtmlAttributes().push(attribute);
        }
        return this;
    };

    removeAttribute = (attributeName: string) => {
        if (this.consumed()) {
            if (attributeName === "style") {
                this.cache.styles.invalid = true;
            }
            const attributeIndex = this.getHtmlAttributes().findIndex(
                (attribute) => attribute.tagName.value === attributeName
            );
            if (attributeIndex !== -1) {
                this.cache.attributes.invalid = true;
                this.getHtmlAttributes().splice(attributeIndex, 1);
            }
        }
        return this;
    };

    modifyAttribute = (
        attributeName: string,
        modifier: (existingAttribute?: string) => undefined | string
    ) => {
        if (this.consumed()) {
            if (attributeName === "style") {
                this.cache.styles.invalid = true;
            }
            const attributeIndex = this.getHtmlAttributes().findIndex(
                (attribute) => attribute.tagName.value === attributeName
            );
            if (attributeIndex !== -1) {
                this.cache.attributes.invalid = true;
                const nextAttribute = new HtmlAttribute();
                nextAttribute.tagName.value = attributeName;
                const currentAttribute = sanitizeAttribute(
                    nextAttribute.attribute.value.value
                );
                const modifiedAttribute = modifier(currentAttribute);
                if (modifiedAttribute) {
                    const desanitized = desanitizeAttribute(modifiedAttribute);
                    nextAttribute.attribute.tagEquals.value = "=";
                    nextAttribute.attribute.value.value = desanitized;
                }
                this.getHtmlAttributes().splice(attributeIndex, 1, nextAttribute);
            }
        }
        return this;
    };

    replaceAttribute = (attributeName: string, nextValue?: string) => {
        if (this.consumed()) {
            if (attributeName === "style") {
                this.cache.styles.invalid = true;
            }
            const attributeIndex = this.getHtmlAttributes().findIndex(
                (attribute) => attribute.tagName.value === attributeName
            );
            if (attributeIndex !== -1) {
                this.cache.attributes.invalid = true;
                const nextAttribute = new HtmlAttribute();
                nextAttribute.tagName.value = attributeName;
                if (nextValue) {
                    const desanitized = desanitizeAttribute(nextValue);
                    nextAttribute.attribute.tagEquals.value = "=";
                    nextAttribute.attribute.value.value = desanitized;
                }
                this.getHtmlAttributes().splice(attributeIndex, 1, nextAttribute);
            } else {
                return this.addAttribute(attributeName, nextValue);
            }
        }
        return this;
    };

    attributes = () => {
        if (!this.consumed()) {
            return {};
        }
        if (!this.cache.attributes.invalid) {
            return this.cache.attributes.value;
        }
        this.cache.attributes.invalid = false;
        return (this.cache.attributes.value = this.getHtmlAttributes().reduce(
            (attributes: Record<string, string>, attribute) => {
                if (attribute.consumed()) {
                    attributes[attribute.tagName.value] =
                        sanitizeAttribute(attribute.attribute.value.value) || "";
                }
                return attributes;
            },
            {}
        ));
    };

    endTagConsumed = consumeCache(() => {
        return Boolean(
            this.tagClose.close1.tag.value || this.tagClose.close2.tagSlashClose.value
        );
    });

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
        searcher.feedLexerItem(this.scriptlet);
        searcher.feedParserItem(this.script);
        searcher.feedParserItem(this.style);
    };

    consumed = consumeCache(() => {
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
    });

    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (
            this.tagClose.close1.tag.value &&
            !this.tagClose.close1.closingGroup.tagOpen.value
        ) {
            const tryHtmlContent =
                this.tagClose.close1.closingGroup.htmlContent.process(queue);
            if (this.tagClose.close1.closingGroup.htmlContent.consumed()) {
                return this.process(tryHtmlContent);
            }
        }
        if (this.tagClose.close1.tag.value) {
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

    clone = () => {
        const element = new HtmlElement(this.parent);
        element.tagOpen.value = this.tagOpen.value;
        element.tagName.value = this.tagName.value;
        element.htmlAttributes = this.htmlAttributes.map((a) => a.clone());
        element.tagClose.close1.tag.value = this.tagClose.close1.tag.value;
        element.tagClose.close1.closingGroup.htmlContent = this.content().clone();
        element.tagClose.close1.closingGroup.tagClose.value =
            this.tagClose.close1.closingGroup.tagClose.value;
        element.tagClose.close1.closingGroup.tagName.value =
            this.tagClose.close1.closingGroup.tagName.value;
        element.tagClose.close1.closingGroup.tagOpen.value =
            this.tagClose.close1.closingGroup.tagOpen.value;
        element.tagClose.close1.closingGroup.tagSlash.value =
            this.tagClose.close1.closingGroup.tagSlash.value;
        element.tagClose.close2.tagSlashClose.value =
            this.tagClose.close2.tagSlashClose.value;
        element.scriptlet.value = this.scriptlet.value;
        element.script = this.script.clone();
        element.style = this.style.clone();
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
    htmlCharData = new HtmlChardata();
    content: Array<{
        inner: {
            htmlElement: HtmlElement;
            cData: LexerItem<"CDATA">;
            htmlComment: HtmlComment;
        };
        charData: HtmlChardata;
    }> = [];

    cache: {
        children: { invalid: boolean; value: HtmlElement[] };
        indexes: { invalid: boolean; value: Record<string, number> };
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
        if (!this.consumed()) {
            return [];
        }
        if (!this.cache.children.invalid) {
            return this.cache.children.value;
        }
        this.cache.children.invalid = false;
        return (this.cache.children.value = this.content
            .filter(({ inner: { htmlElement } }) => htmlElement.consumed())
            .map(({ inner: { htmlElement } }) => htmlElement));
    };

    addText = (text: string, after?: HtmlElement) => {
        if (this.consumed()) {
            if (!after) {
                this.htmlCharData.htmlText.value += text;
            } else {
                const index = this.getIndex(after);
                if (index !== -1) {
                    this.content[index].charData.htmlText.value += text;
                }
            }
        }
        return this;
    };

    addChild = (child: HtmlElement, index: number | undefined = undefined) => {
        if (this.consumed()) {
            this.cache.children.invalid = true;
            this.cache.indexes.invalid = true;
            child.parent = this;
            const item = {
                inner: {
                    htmlElement: child,
                    cData: new LexerItem("CDATA"),
                    htmlComment: new HtmlComment(),
                },
                charData: new HtmlChardata(),
            };
            if (index === undefined) {
                this.content.push(item);
            } else {
                this.content.splice(index, 0, item);
            }
        }
        return this;
    };

    removeChild = (child: HtmlElement | number) => {
        if (this.consumed()) {
            if (
                typeof child === "number" &&
                child >= 0 &&
                child < this.content.length
            ) {
                this.content.splice(child, 1);
                this.cache.children.invalid = true;
                this.cache.indexes.invalid = true;
            } else if (child instanceof HtmlElement) {
                const index = this.getIndex(child);
                this.content.splice(index, 1);
                this.cache.children.invalid = true;
                this.cache.indexes.invalid = true;
            }
        }
        return this;
    };

    replaceChild = (child: HtmlElement | number, replacement: HtmlElement) => {
        if (this.consumed()) {
            const item = {
                inner: {
                    htmlElement: replacement,
                    cData: new LexerItem("CDATA"),
                    htmlComment: new HtmlComment(),
                },
                charData: new HtmlChardata(),
            };
            item.inner.htmlElement.parent = this;
            if (
                typeof child === "number" &&
                child >= 0 &&
                child < this.content.length
            ) {
                this.content.splice(child, 1, item);
                this.cache.children.invalid = true;
                this.cache.indexes.invalid = true;
            } else if (child instanceof HtmlElement) {
                const index = this.getIndex(child);
                this.content.splice(index, 1, item);
                this.cache.children.invalid = true;
                this.cache.indexes.invalid = true;
            }
        }
        return this;
    };

    getIndex = (element: HtmlElement) => {
        if (!this.consumed()) {
            return -1;
        }
        if (!this.cache.indexes.invalid) {
            return this.cache.indexes.value[element.identifier] ?? -1;
        }
        this.cache.indexes.invalid = false;
        this.cache.indexes.value = this.content.reduce(
            (indexes: Record<string, number>, { inner: { htmlElement } }, index) => {
                if (htmlElement.consumed()) {
                    indexes[htmlElement.identifier] = index;
                }
                return indexes;
            },
            {}
        );
        return this.cache.indexes.value[element.identifier] ?? -1;
    };

    prevSibling = (element: HtmlElement) => {
        if (!this.consumed()) {
            return undefined;
        }
        const index = this.getIndex(element);
        if (index === -1) {
            return undefined;
        }
        return this.content[index - 1]?.inner.htmlElement;
    };

    nextSibling = (element: HtmlElement) => {
        if (!this.consumed()) {
            return undefined;
        }
        const index = this.getIndex(element);
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
    consumed = consumeCache(() => {
        return (
            this.content.length === 0 ||
            this.content.every(
                ({ inner: { cData, htmlComment, htmlElement } }) =>
                    cData.value || htmlComment.consumed() || htmlElement.consumed()
            )
        );
    });
    clone = () => {
        const content = new HtmlContent(this.parent);
        content.htmlCharData = this.htmlCharData.clone();
        content.content = this.content.map((value) => {
            const item = {
                charData: value.charData.clone(),
                inner: {
                    cData: new LexerItem("CDATA"),
                    htmlComment: value.inner.htmlComment.clone(),
                    htmlElement: value.inner.htmlElement.clone(),
                },
            };
            item.inner.cData.value = value.inner.cData.value;
            return item;
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
    consumed = consumeCache(() => {
        const attributeConsumed =
            (this.attribute.tagEquals.value && this.attribute.value.value) ||
            (!this.attribute.tagEquals.value && !this.attribute.value.value);
        return Boolean(this.tagName && attributeConsumed);
    });
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
    clone = () => {
        const attribute = new HtmlAttribute();
        attribute.tagName.value = this.tagName.value;
        attribute.attribute.tagEquals.value = this.attribute.tagEquals.value;
        attribute.attribute.value.value = this.attribute.value.value;
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
    htmlText = new LexerItem("HTML_TEXT");
    seaWs = new LexerItem("SEA_WS");

    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.htmlText);
        searcher.feedLexerItem(this.seaWs);
    };

    consumed = consumeCache(() => {
        return Boolean(this.htmlText.value || this.seaWs.value);
    });
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

    clone = () => {
        const clone = new HtmlChardata();
        clone.htmlText.value = this.htmlText.value;
        clone.seaWs.value = this.seaWs.value;
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
    htmlComment = new HtmlComment();
    seaWs = new LexerItem("SEA_WS");
    search = (searcher: Searcher) => {
        searcher.feedParserItem(this.htmlComment);
        searcher.feedLexerItem(this.seaWs);
    };
    consumed = consumeCache(() => {
        return Boolean(this.seaWs.value || this.htmlComment.consumed());
    });
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
    consumed = consumeCache(() => {
        return Boolean(this.htmlComment.value || this.htmlConditionalComment.value);
    });
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
    clone = () => {
        const comment = new HtmlComment();
        comment.htmlComment.value = this.htmlComment.value;
        comment.htmlConditionalComment.value = this.htmlConditionalComment.value;
        return comment;
    };
}

/**
  script
    : SCRIPT_OPEN htmlAttribute* (SCRIPT_BODY | SCRIPT_SHORT_BODY)
    ;
 */
export class Script implements ParserItem {
    scriptOpen = new LexerItem("SCRIPT_OPEN");
    scriptBody = new LexerItem("SCRIPT_BODY");
    scriptShortBody = new LexerItem("SCRIPT_SHORT_BODY");
    attributes: HtmlAttribute[] = [];
    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.scriptOpen);
        searcher.feedLexerItem(this.scriptBody);
        searcher.feedLexerItem(this.scriptShortBody);
        searcher.feedParserItems(this.attributes);
    };
    consumed = consumeCache(() => {
        return Boolean(
            this.scriptOpen.value &&
            (this.attributes.length === 0 ||
                this.attributes.every((attribute) => attribute.consumed())) &&
            (this.scriptBody.value || this.scriptShortBody.value)
        );
    });
    process = (queue: Queue): Queue => {
        if (this.scriptOpen.value) {
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
    clone = () => {
        const script = new Script();
        script.scriptOpen.value = this.scriptOpen.value;
        script.scriptBody.value = this.scriptBody.value;
        script.scriptShortBody.value = this.scriptShortBody.value;
        script.attributes = this.attributes.map((a) => a.clone());
        return script;
    };
}

/**
   style
    : STYLE_OPEN htmlAttribute* (STYLE_BODY | STYLE_SHORT_BODY)
    ;
 */
export class Style implements ParserItem {
    styleOpen = new LexerItem("STYLE_OPEN");
    styleBody = new LexerItem("STYLE_BODY");
    styleShortBody = new LexerItem("STYLE_SHORT_BODY");
    attributes: HtmlAttribute[] = [];
    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.styleOpen);
        searcher.feedLexerItem(this.styleBody);
        searcher.feedLexerItem(this.styleShortBody);
        searcher.feedParserItems(this.attributes);
    };
    consumed = consumeCache(() => {
        return Boolean(
            this.styleOpen.value &&
            (this.attributes.length === 0 ||
                this.attributes.every((attribute) => attribute.consumed())) &&
            (this.styleBody.value || this.styleShortBody.value)
        );
    });
    process = (queue: Queue): Queue => {
        if (this.styleOpen.value) {
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
    clone = () => {
        const style = new Style();
        style.styleOpen.value = this.styleOpen.value;
        style.styleBody.value = this.styleOpen.value;
        style.styleShortBody.value = this.styleShortBody.value;
        style.attributes = this.attributes.map((a) => a.clone());
        return style;
    };
}
