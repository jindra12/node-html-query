import { HtmlComment, HtmlContent, HtmlDocument, HtmlElement } from "./html";
import {
    htmlParser,
    tryHtmlParser,
    tryQueryParser,
} from "./parser";
import { LexerItem, ParserItem } from "./types";
import { flatten, getItems, parserItemToString, uniqueId } from "./utils";

interface TypeCombiner {
    attr(name: string): string | undefined;
    attr(attributes: Record<string, string>): QueryInstance;
    attr(
        attributeName: string,
        value: string | ((index: number, value: string) => string)
    ): QueryInstance;
    css(propertyName: string): string | undefined;
    css(css: Record<string, string>): QueryInstance;
    css(
        propertyName: string,
        value: string | ((index: number, value: string) => string)
    ): QueryInstance;
    data(key: string): string | undefined;
    data(object: Record<string, string>): QueryInstance;
    data(): Record<string, string>;
    data(key: string, value: string): QueryInstance;
    html(): string | undefined;
    html(value: string): QueryInstance;
    html(setter: (index: number, value: string) => string): QueryInstance;
    tagName(): string;
    tagName(value: string): QueryInstance;
    tagName(setter: (index: number, tagName: string) => string): QueryInstance;
    text(): string;
    text(value: string): QueryInstance;
    text(setter: (index: number, value: string) => string): QueryInstance;
    val(): string;
    val(value: string | number | boolean): QueryInstance;
    val(
        setter: (index: number, value: string) => string | number | boolean
    ): QueryInstance;
    wrap(parent: QueryInstance): QueryInstance;
    wrap(
        parent: (index: number, child: QueryInstance) => QueryInstance | string
    ): QueryInstance;
    wrap(parent: string): QueryInstance;
    height(): string;
    height(value: string): QueryInstance;
    width(): string;
    width(value: string): QueryInstance;
}

type ValueType = TypeCombiner["val"];
type TagNameType = TypeCombiner["tagName"];
type TextType = TypeCombiner["text"];
type HtmlType = TypeCombiner["html"];
type DataType = TypeCombiner["data"];
type CssType = TypeCombiner["css"];
type AttrType = TypeCombiner["attr"];
type WrapType = TypeCombiner["wrap"];
type HeightType = TypeCombiner["height"];
type WidthType = TypeCombiner["width"];

class QueryInstance {
    private document: HtmlDocument;
    private virtualDoms: HtmlDocument[];
    private matched: HtmlElement[];
    private previous: QueryInstance;

    private addElementsToMatcher = (
        manipulator: (content: string, matched: HtmlElement) => void,
        firstArg: string | ((index: number, html: string) => string),
        ...content: string[]
    ) => {
        this.matched.forEach((element, index) => {
            const textFirstArg =
                typeof firstArg === "function"
                    ? firstArg(index, parserItemToString(element))
                    : firstArg;
            const allContent = [textFirstArg, ...content];
            allContent.forEach((content) => {
                manipulator(content, element);
            });
        });
        this.document.cache.descendants.invalid = true;
        return this;
    };

    private getLowestChild = (element: HtmlElement): HtmlElement => {
        if (element.children().length === 0) {
            return element;
        }
        return this.getLowestChild(element.children()[0]);
    };

    private getParentAssigner = (
        resolved: string | QueryInstance,
        namespaces: Record<string, string>
    ) => {
        let parent: HtmlElement | undefined = undefined;
        let appendTo: HtmlElement | undefined = undefined;
        if (typeof resolved === "string") {
            const query = tryQueryParser(resolved);
            if (query) {
                parent = query.match(
                    this.document.descendants(),
                    this.document.descendants(),
                    namespaces
                )[0];
                appendTo = parent;
            } else {
                const html = tryHtmlParser(resolved);
                if (html) {
                    parent = html.descendants()[0];
                    appendTo = this.getLowestChild(parent);
                }
            }
        } else {
            parent = resolved.matched[0]?.clone();
            appendTo = parent;
        }
        return [parent, appendTo] as const;
    };

    private filterBySelector = (
        selector: string | QueryInstance | undefined,
        elements: HtmlElement[],
        namespaces: Record<string, string>
    ) => {
        if (selector === undefined) {
            return createQuery(this.document, elements, this.virtualDoms, this);
        }
        if (typeof selector === "string") {
            const query = tryQueryParser(selector);
            if (query) {
                const matched = query.match(
                    elements,
                    this.document.descendants(),
                    namespaces
                );
                return createQuery(this.document, matched, this.virtualDoms, this);
            }
        }
        if (selector instanceof QueryInstance) {
            const map = selector.matched.reduce(
                (map: Record<string, true>, element) => {
                    map[element.identifier] = true;
                    return map;
                },
                {}
            );
            const matched = elements.filter((n) => map[n.identifier]);
            return createQuery(this.document, matched, this.virtualDoms, this);
        }
        return this;
    };

    constructor(
        document: HtmlDocument,
        matched: HtmlElement[],
        virtualDoms: HtmlDocument[],
        previous: QueryInstance | undefined
    ) {
        this.document = document;
        this.matched = Object.values(
            matched.reduce((matched: Record<string, HtmlElement>, element) => {
                matched[element.identifier] = element;
                return matched;
            }, {})
        );
        this.virtualDoms = virtualDoms;
        this.previous = previous || this;
    }

    *[Symbol.iterator]() {
        for (let i = 0; i < this.matched.length; i++) {
            yield this.eq(i);
        }
    }

    find = (queryInput: string | QueryInstance, namespaces: Record<string, string> = {}) => {
        if (typeof queryInput === "string") {
            const query = tryQueryParser(queryInput);
            if (query) {
                return createQuery(
                    this.document,
                    query.match(this.matched, this.document.descendants(), namespaces),
                    this.virtualDoms,
                    this
                );
            }
            
        } else {
            const elementMap = queryInput.matched.reduce((map: Record<string, true>, element) => {
                map[element.identifier] = true;
                return map;
            }, {});
            return createQuery(
                this.document,
                this.matched.filter(m => elementMap[m.identifier]),
                this.virtualDoms,
                this
            );
        }
        return this;
    };
    add = (
        toAdd: QueryInstance | string,
        context?: QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        if (toAdd instanceof QueryInstance) {
            return createQuery(
                this.document,
                this.matched.concat(toAdd.matched),
                this.virtualDoms.concat(toAdd.virtualDoms),
                this
            );
        } else {
            const cssQuery = tryQueryParser(toAdd);
            if (cssQuery) {
                if (context) {
                    const nextMatched: HtmlElement[] = [...this.matched];
                    context.matched.forEach((matched) => {
                        cssQuery
                            .match(
                                matched.descendants(),
                                this.document.descendants(),
                                namespaces
                            )
                            .forEach((element) => {
                                nextMatched.push(element);
                            });
                    });
                    return createQuery(
                        this.document,
                        nextMatched,
                        this.virtualDoms,
                        this
                    );
                } else {
                    const nextMatched: HtmlElement[] = [...this.matched];
                    cssQuery
                        .match(
                            this.document.descendants(),
                            this.document.descendants(),
                            namespaces
                        )
                        .forEach((element) => {
                            nextMatched.push(element);
                        });
                    return createQuery(
                        this.document,
                        nextMatched,
                        this.virtualDoms,
                        this
                    );
                }
            } else {
                const htmlObject = tryHtmlParser(toAdd);
                if (htmlObject) {
                    return createQuery(
                        this.document,
                        this.matched,
                        this.virtualDoms.concat([htmlObject]),
                        this
                    );
                }
            }
        }
        return this;
    };
    addBack = (selector?: string, namespaces: Record<string, string> = {}) => {
        const query = selector && tryQueryParser(selector);
        const matched = this.matched.concat(this.previous.matched);
        return createQuery(
            this.document,
            query
                ? query.match(matched, this.document.descendants(), namespaces)
                : matched,
            this.virtualDoms,
            this
        );
    };
    addClass = (
        classNames:
            | string
            | ((index: number, classNames: string) => string | string[])
    ) => {
        this.matched.forEach((element, index) => {
            element.modifyAttribute("class", (classes) => {
                const resolved =
                    typeof classNames === "string"
                        ? classNames.split(" ")
                        : classNames(index, classes || "");
                const arrayify = Array.isArray(resolved)
                    ? resolved
                    : resolved.split(" ");
                if (!classes) {
                    return arrayify.join(" ");
                }
                const addedClasses = arrayify.filter((cls) => !classes.includes(cls));
                const classList = classes.split(" ");
                classList.push(...addedClasses);
                return classList.join(" ");
            });
        });
        return this;
    };
    after = (
        firstArg: string | ((index: number, html: string) => string),
        ...content: string[]
    ) => {
        return this.addElementsToMatcher(
            (content: string, matched: HtmlElement) => {
                const tryFirstArgHtml = tryHtmlParser(content);
                if (!tryFirstArgHtml) {
                    if (matched.parent instanceof HtmlContent) {
                        matched.parent.addText(content, matched);
                    }
                } else {
                    const index = matched.parent.getIndex(matched);
                    tryFirstArgHtml.descendants().forEach((descentant) => {
                        matched.parent.addChild(descentant, index + 1);
                    });
                    const comments = getItems<HtmlComment>(
                        tryFirstArgHtml,
                        (item: ParserItem | LexerItem<any>): item is HtmlComment =>
                            item instanceof HtmlComment
                    );
                    comments.forEach((comment) => {
                        if (comment.htmlComment.value) {
                            matched.parent.addComment(comment.htmlComment.value, index + 1);
                        }
                        if (comment.htmlConditionalComment.value) {
                            matched.parent.addConditionalComment(
                                comment.htmlConditionalComment.value,
                                index + 1
                            );
                        }
                    });
                }
            },
            firstArg,
            ...content
        );
    };
    append = (
        firstArg: string | ((index: number, html: string) => string),
        ...content: string[]
    ) => {
        return this.addElementsToMatcher(
            (content: string, matched: HtmlElement) => {
                const tryFirstArgHtml = tryHtmlParser(content);
                if (!tryFirstArgHtml) {
                    matched.content().addText(content, matched);
                } else {
                    tryFirstArgHtml.descendants().forEach((descentant) => {
                        matched.content().addChild(descentant);
                    });
                    const comments = getItems<HtmlComment>(
                        tryFirstArgHtml,
                        (item: ParserItem | LexerItem<any>): item is HtmlComment =>
                            item instanceof HtmlComment
                    );
                    comments.forEach((comment) => {
                        if (comment.htmlComment.value) {
                            matched.parent.addComment(comment.htmlComment.value);
                        }
                        if (comment.htmlConditionalComment.value) {
                            matched.parent.addConditionalComment(
                                comment.htmlConditionalComment.value
                            );
                        }
                    });
                }
            },
            firstArg,
            ...content
        );
    };
    appendTo = (
        query: QueryInstance | string,
        namespaces: Record<string, string> = {}
    ) => {
        const parsedQuery =
            typeof query === "string"
                ? tryQueryParser(query)?.match(
                    this.document.descendants(),
                    this.document.descendants(),
                    namespaces
                )
                : query.matched;
        parsedQuery?.forEach((element) => {
            this.matched.forEach((nextChild) => {
                element.content().addChild(nextChild);
                nextChild.parent.removeChild(nextChild);
            });
            this.virtualDoms.forEach((document) => {
                document.children().forEach((child) => {
                    element.content().addChild(child);
                });
                const comments = getItems<HtmlComment>(
                    document,
                    (item: ParserItem | LexerItem<any>): item is HtmlComment =>
                        item instanceof HtmlComment
                );
                comments.forEach((comment) => {
                    if (comment.htmlComment.value) {
                        element.content().parent.addComment(comment.htmlComment.value);
                    }
                    if (comment.htmlConditionalComment.value) {
                        element
                            .content()
                            .parent.addConditionalComment(
                                comment.htmlConditionalComment.value
                            );
                    }
                });
            });
        });
        this.document.cache.descendants.invalid = true;
        return this;
    };
    attr: AttrType = (...args: any[]): any => {
        const firstArg = args[0];
        if (typeof firstArg === "string") {
            if (args.length === 1 || args[1] === undefined) {
                return this.matched[0]?.attributes()[firstArg] || "";
            }
            this.matched.forEach((matched, index) => {
                const attributes = matched.attributes();
                const resolveValue =
                    typeof args[1] === "string"
                        ? args[1]
                        : args[1](index, attributes[firstArg] || "");
                matched.replaceAttribute(firstArg, resolveValue);
            });
        } else if (typeof firstArg === "object" && firstArg) {
            this.matched.forEach((matched) => {
                Object.entries(firstArg as Record<string, string>).forEach(
                    ([attributeName, attributeValue]) => {
                        matched.replaceAttribute(attributeName, attributeValue);
                    }
                );
            });
        }

        return this;
    };
    before = (
        firstArg: string | ((index: number, html: string) => string),
        ...content: string[]
    ) => {
        return this.addElementsToMatcher(
            (content: string, matched: HtmlElement) => {
                const tryFirstArgHtml = tryHtmlParser(content);
                if (!tryFirstArgHtml) {
                    if (matched.parent instanceof HtmlContent) {
                        matched.parent.addText(content, matched);
                    }
                } else {
                    const index = matched.parent.getIndex(matched);
                    tryFirstArgHtml.descendants().forEach((descentant) => {
                        matched.parent.addChild(descentant, index);
                    });
                    const comments = getItems<HtmlComment>(
                        tryFirstArgHtml,
                        (item: ParserItem | LexerItem<any>): item is HtmlComment =>
                            item instanceof HtmlComment
                    );
                    comments.forEach((comment) => {
                        if (comment.htmlComment.value) {
                            matched.parent.addComment(comment.htmlComment.value, index);
                        }
                        if (comment.htmlConditionalComment.value) {
                            matched.parent.addConditionalComment(
                                comment.htmlConditionalComment.value,
                                index
                            );
                        }
                    });
                }
            },
            firstArg,
            ...content
        );
    };
    blur = (handler: string | ((event: Event) => void)) =>
        this.on("blur", handler);
    change = (handler: string | ((event: Event) => void)) =>
        this.on("change", handler);
    children = () => {
        const children = flatten(this.matched.map((m) => m.children()));
        return createQuery(this.document, children, this.virtualDoms, this);
    };
    clone = () => {
        const cloned = this.matched.map((m) => m.clone());
        const virtualDom = new HtmlDocument();
        cloned.forEach((clone) => virtualDom.addChild(clone));
        return createQuery(
            this.document,
            [],
            this.virtualDoms.concat([virtualDom]),
            this
        );
    };
    closest = (
        selector: string,
        container?: QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        const parsed = tryQueryParser(selector);
        if (!parsed) {
            return this;
        }
        const descendantLimit = container?.matched.reduce(
            (descendantsMap: Record<string, true>, matched) => {
                descendantsMap[matched.identifier] = true;
                matched.descendants().forEach((descendant) => {
                    descendantsMap[descendant.identifier] = true;
                });
                return descendantsMap;
            },
            {}
        );
        const seeker = (currentNode: HtmlElement): HtmlElement | undefined => {
            if (descendantLimit && !descendantLimit[currentNode.identifier]) {
                return undefined;
            }
            if (
                parsed.match([currentNode], this.document.descendants(), namespaces)
            ) {
                return currentNode;
            }
            const parent = currentNode.parent;
            if (parent instanceof HtmlDocument) {
                return undefined;
            }
            return seeker(parent);
        };
        const ancestors = this.matched.reduce(
            (ancestors: HtmlElement[], element) => {
                const ancestor = seeker(element);
                if (ancestor) {
                    ancestors.push(ancestor);
                }
                return ancestors;
            },
            []
        );
        return createQuery(this.document, ancestors, this.virtualDoms, this);
    };
    contents = () => {
        const children = this.matched.map(
            (m) =>
                parserItemToString(m.tagClose.close1.closingGroup.htmlContent) ||
                parserItemToString(m.script) ||
                m.scriptlet.value ||
                parserItemToString(m.style)
        );
        return children.join("");
    };
    contextmenu = (handler: string | ((event: Event) => void)) =>
        this.on("contextmenu", handler);
    css: CssType = (...args: any[]): any => {
        const firstArg = args[0];
        if (typeof firstArg === "string") {
            if (args.length === 1 || args[1] === undefined) {
                return this.matched[0]?.getStyles()[firstArg];
            }
            this.matched.forEach((matched, index) => {
                const resolveValue =
                    typeof args[1] === "string"
                        ? () => args[1]
                        : (value: string | undefined) => args[1](index, value);
                matched.modifyStyle(firstArg, resolveValue);
            });
        } else if (Array.isArray(firstArg)) {
            const selectedMap = firstArg.reduce(
                (selectedMap: Record<string, true>, item: string) => {
                    selectedMap[item] = true;
                    return selectedMap;
                },
                {}
            );
            return Object.entries(this.matched[0]?.getStyles() || {}).reduce(
                (selected: Record<string, string>, [styleName, styleValue]) => {
                    if (selectedMap[styleName]) {
                        selected[styleName] = styleValue;
                    }
                    return selected;
                },
                {}
            );
        } else if (typeof firstArg === "object" && firstArg) {
            this.matched.forEach((matched) => {
                Object.entries(firstArg as Record<string, string>).forEach(
                    ([styleName, styleValue]) => {
                        matched.modifyStyle(styleName, () => styleValue);
                    }
                );
            });
        }
        return this;
    };
    data: DataType = (...args: any[]): any => {
        if (args.length === 0 || args[0] === undefined) {
            return this.matched[0]?.data || {};
        } else if (args.length === 1 || args[1] === undefined) {
            if (typeof args[0] === "string") {
                return this.matched[0]?.data[args[0]];
            }
            if (typeof args[0] === "object" && args[0]) {
                Object.keys(args[0]).forEach((key) => {
                    this.matched.forEach((matched) => {
                        matched.data[key] = args[0][key];
                    });
                });
            }
        } else if (args.length === 2 || args[2] === undefined) {
            this.matched.forEach((matched) => {
                matched.data[args[0]] = args[1];
            });
        }
        return this;
    };
    dblclick = (handler: string | ((event: Event) => void)) =>
        this.on("dblclick", handler);
    empty = () => {
        this.matched.forEach((matched) => {
            matched.emptyText();
            matched.children().forEach((child) => {
                matched.content().removeChild(child);
            });
        });
        return this;
    };
    end = () => this.previous;
    eq = (index: number) => {
        return createQuery(
            this.document,
            this.matched.filter((_, i) =>
                index >= 0 ? i === index : i === this.matched.length - 1 + index
            ),
            this.virtualDoms,
            this
        );
    };
    filter = (
        filter:
            | string
            | QueryInstance
            | ((index: number, instance: QueryInstance) => any)
    ) => {
        if (typeof filter === "string") {
            return this.find(filter);
        } else if (filter instanceof QueryInstance) {
            const matchedMap = filter.matched.reduce(
                (matchedMap: Record<string, true>, element) => {
                    matchedMap[element.identifier] = true;
                    return matchedMap;
                },
                {}
            );
            return createQuery(
                this.document,
                this.matched.filter((m) => matchedMap[m.identifier]),
                this.virtualDoms,
                this
            );
        } else if (typeof filter === "function") {
            return createQuery(
                this.document,
                this.matched.filter((m, i) =>
                    filter(i, createQuery(this.document, [m], this.virtualDoms, this))
                ),
                this.virtualDoms,
                this
            );
        }
        return this;
    };
    each = (callback: (index: number, query: QueryInstance) => void) => {
        for (let i = 0; i < this.matched.length; i++) {
            callback(i, this.eq(i));
        }
        return this;
    };
    even = () => {
        return createQuery(
            this.document,
            this.matched.filter((_, i) => i % 2 === 0),
            this.virtualDoms,
            this
        );
    };
    first = () => this.eq(0);
    focus = (handler: string | ((event: Event) => void)) =>
        this.on("focus", handler);
    focusin = (handler: string | ((event: Event) => void)) =>
        this.on("focusin", handler);
    focusout = (handler: string | ((event: Event) => void)) =>
        this.on("focusout", handler);
    has = (
        selector: string | QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        if (typeof selector === "string") {
            const query = tryQueryParser(selector);
            if (query) {
                return createQuery(
                    this.document,
                    this.matched.filter((m) => {
                        return (
                            query.match(
                                m.descendants(),
                                this.document.descendants(),
                                namespaces
                            ).length > 0
                        );
                    }),
                    this.virtualDoms,
                    this
                );
            }
        } else if (selector instanceof QueryInstance) {
            const matchedMap = selector.matched.reduce(
                (matchedMap: Record<string, true>, element) => {
                    matchedMap[element.identifier] = true;
                    return matchedMap;
                },
                {}
            );
            return createQuery(
                this.document,
                this.matched.filter((m) => {
                    return m.descendants().some((d) => matchedMap[d.identifier]);
                }),
                this.virtualDoms,
                this
            );
        }
        return this;
    };
    hasClass = (className: string) => {
        return this.matched.some((m) =>
            m
                .attributes()
            ["class"].split(" ")
                .some((cls) => cls === className)
        );
    };
    height: HeightType = (height?: any): any => {
        if (height) {
            this.matched.forEach((m) => {
                m.modifyAttribute("height", () => height);
            });
            return this;
        }
        return this.matched[0]?.attributes()["height"];
    };
    hide = () => {
        this.matched.forEach((m) => {
            m.modifyStyle("display", () => "hidden");
        });
        return this;
    };
    hover = (handler: string | ((event: Event) => void)) =>
        this.on("hover", handler);
    html: HtmlType = (...args: any[]): any => {
        if (args.length === 0 || args[0] === undefined) {
            if (this.matched.length > 0) {
                return parserItemToString(this.matched[0].content()).replace(/(^\s+|\s+$)/gmui, "");
            } else {
                return undefined;
            }
        } else {
            this.matched.forEach((m, index) => {
                const resolveArg =
                    typeof args[0] === "string"
                        ? args[0]
                        : args[0](index, parserItemToString(m.content()));
                const nextDom = tryHtmlParser(resolveArg);
                if (nextDom) {
                    m.emptyText();
                    m.children().forEach((child) => {
                        m.content().removeChild(child);
                    });
                    nextDom.descendants().forEach((d) => {
                        m.content().addChild(d);
                    });
                }
            });
        }
        return this;
    };
    index = (
        selector?: string | QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        if (selector === undefined) {
            return this.matched[0]
                ? this.matched[0].parent.getIndex(this.matched[0])
                : -1;
        }
        if (typeof selector === "string") {
            const query = tryQueryParser(selector);
            if (query) {
                const matched = query.match(
                    this.matched,
                    this.document.descendants(),
                    namespaces
                );
                if (matched.length > 0) {
                    return this.matched.findIndex(
                        (m) => m.identifier === matched[0].identifier
                    );
                }
            }
        }
        if (selector instanceof QueryInstance) {
            const firstMatch = selector.matched[0];
            if (firstMatch) {
                return this.matched.findIndex(
                    (m) => m.identifier === firstMatch.identifier
                );
            }
        }
        return -1;
    };
    insertBefore = (
        selector: string | QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        const toInsertBefore =
            typeof selector === "string"
                ? (() => {
                    const query = tryQueryParser(selector);
                    if (query) {
                        return query.match(
                            this.matched,
                            this.document.descendants(),
                            namespaces
                        );
                    }
                    return [];
                })()
                : selector.matched;
        toInsertBefore.forEach((m) => {
            this.virtualDoms.forEach((v) => {
                v.descendants().forEach((dom) => {
                    m.addChild(dom, m.parent.getIndex(m));
                });
            });
        });
        this.document.cache.descendants.invalid = true;
        return createQuery(this.document, this.matched, this.virtualDoms, this);
    };
    insertAfter = (
        selector: string | QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        const toInsertAfter =
            typeof selector === "string"
                ? (() => {
                    const query = tryQueryParser(selector);
                    if (query) {
                        return query.match(
                            this.matched,
                            this.document.descendants(),
                            namespaces
                        );
                    }
                    return [];
                })()
                : selector.matched;
        toInsertAfter.forEach((m) => {
            this.virtualDoms.forEach((v) => {
                v.descendants().forEach((dom) => {
                    m.addChild(dom, m.parent.getIndex(m) + 1);
                });
            });
        });
        this.document.cache.descendants.invalid = true;
        return createQuery(this.document, this.matched, [], this);
    };
    keypress = (handler: string | ((event: Event) => void)) =>
        this.on("keypress", handler);
    keydown = (handler: string | ((event: Event) => void)) =>
        this.on("keydown", handler);
    keyup = (handler: string | ((event: Event) => void)) =>
        this.on("keyup", handler);
    is = (
        selector: string | QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        if (typeof selector === "string") {
            const query = tryQueryParser(selector);
            if (query) {
                return (
                    query.match(this.matched, this.document.descendants(), namespaces)
                        .length > 0
                );
            }
            return false;
        }
        const map = selector.matched.reduce(
            (map: Record<string, true>, element) => {
                map[element.identifier] = true;
                return map;
            },
            {}
        );
        return this.matched.some((m) => map[m.identifier]);
    };
    last = () => this.eq(this.matched.length - 1);
    get length(): number {
        return this.matched.length;
    }
    map = <T>(iterator: (index: number, item: QueryInstance) => T): T[] => {
        return this.matched.map((m, i) =>
            iterator(i, createQuery(this.document, [m], this.virtualDoms, this))
        );
    };
    mousedown = (handler: string | ((event: Event) => void)) =>
        this.on("mousedown", handler);
    mouseenter = (handler: string | ((event: Event) => void)) =>
        this.on("mouseenter", handler);
    mouseleave = (handler: string | ((event: Event) => void)) =>
        this.on("mouseleave", handler);
    mousemove = (handler: string | ((event: Event) => void)) =>
        this.on("mousemove", handler);
    mouseout = (handler: string | ((event: Event) => void)) =>
        this.on("mouseout", handler);
    mouseover = (handler: string | ((event: Event) => void)) =>
        this.on("mouseover", handler);
    mouseup = (handler: string | ((event: Event) => void)) =>
        this.on("mouseup", handler);
    next = (
        selector?: string | QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        const nextSiblings = this.matched
            .map((m) => m.parent.nextSibling(m)!)
            .filter(Boolean);
        return this.filterBySelector(selector, nextSiblings, namespaces);
    };
    nextAll = (
        selector?: string | QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        const nextSiblings = flatten(
            this.matched.map((m) => {
                const index = m.parent.getIndex(m);
                return m.parent
                    .children()
                    .filter((child) => child.parent.getIndex(child) > index);
            })
        );
        return this.filterBySelector(selector, nextSiblings, namespaces);
    };
    nextUntil = (
        selector: string | QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        const matchNextAll = this.nextAll(undefined, namespaces);
        const unmatchNextAll = this.nextAll(selector, namespaces).matched.reduce(
            (map: Record<string, true>, element) => {
                map[element.identifier] = true;
                return map;
            },
            {}
        );
        return createQuery(
            this.document,
            matchNextAll.matched.filter((m) => !unmatchNextAll[m.identifier]),
            this.virtualDoms,
            this
        );
    };
    not = (
        selector: string | QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        const filtered = this.filterBySelector(
            selector,
            this.matched,
            namespaces
        ).matched.reduce((map: Record<string, true>, element) => {
            map[element.identifier] = true;
            return map;
        }, {});
        return createQuery(
            this.document,
            this.matched.filter((m) => !filtered[m.identifier]),
            this.virtualDoms,
            this
        );
    };
    odd = () => {
        return createQuery(
            this.document,
            this.matched.filter((_, i) => i % 2 === 1),
            this.virtualDoms,
            this
        );
    };
    off = (eventTypes: string) => {
        this.matched.forEach((m) => {
            eventTypes.split(" ").forEach((eventType) => {
                m.removeAttribute(`on${eventType}`);
            });
        });
        return this;
    };
    on = (
        eventTypes: string,
        eventHandler: string | ((event: Event) => void)
    ) => {
        const stringifyHandler =
            typeof eventHandler === "function"
                ? `(${eventHandler.toString()})(this)`
                : eventHandler;
        this.matched.forEach((match) => {
            eventTypes.split(" ").forEach((eventType) => {
                match.modifyAttribute(`on${eventType}`, (existing) => {
                    if (!existing) {
                        return stringifyHandler;
                    }
                    const split = existing.split(";");
                    split.push(stringifyHandler);
                    return split.join(";");
                });
            });
        });
        return this;
    };
    once = (
        eventTypes: string,
        eventHandler: string | ((event: Event) => void)
    ) => {
        eventTypes.split(" ").forEach((eventType) => {
            const stringifyHandler =
                typeof eventHandler === "function"
                    ? eventHandler.toString()
                    : eventHandler;
            const onceHandler = `((event) => { const fn = ${stringifyHandler}; const result = fn(event); event.target.removeEventListener('${eventType}', fn); return result; })(this)`;
            this.on(eventType, onceHandler);
        });
        return this;
    };
    parent = (
        selector: string | QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        return this.filterBySelector(
            selector,
            this.matched.reduce((parents: HtmlElement[], element) => {
                const parentContent = element.parent;
                if (parentContent instanceof HtmlContent) {
                    parents.push(parentContent.parent);
                }
                return parents;
            }, []),
            namespaces
        );
    };
    parents = (
        selector?: string | QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        return this.filterBySelector(
            selector,
            this.matched.reduce((parents: HtmlElement[], element) => {
                let parentContent = element.parent;
                while (parentContent instanceof HtmlContent) {
                    parents.push(parentContent.parent);
                    parentContent = parentContent.parent.parent;
                }
                return parents;
            }, []),
            namespaces
        );
    };
    parentsUntil = (
        selector: string | QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        const parentsNot = this.parents(selector, namespaces).matched.reduce(
            (map: Record<string, true>, element) => {
                map[element.identifier] = true;
                return map;
            },
            {}
        );
        const parents = this.parents(undefined, namespaces).matched;
        return createQuery(
            this.document,
            parents.filter((p) => !parentsNot[p.identifier]),
            this.virtualDoms,
            this
        );
    };
    prepend = (
        firstArg: string | ((index: number, html: string) => string),
        ...content: string[]
    ) => {
        return this.addElementsToMatcher(
            (content: string, matched: HtmlElement) => {
                const tryFirstArgHtml = tryHtmlParser(content);
                if (!tryFirstArgHtml) {
                    matched.content().addText(content);
                } else {
                    tryFirstArgHtml.descendants().forEach((descentant) => {
                        matched.content().addChild(descentant, 0);
                    });
                }
            },
            firstArg,
            ...content
        );
    };
    prependTo = (query: QueryInstance) => {
        query.matched.forEach((element) => {
            this.matched.forEach((nextChild) => {
                element.content().addChild(nextChild, 0);
                nextChild.parent.removeChild(nextChild);
            });
            this.virtualDoms.forEach((document) => {
                document.children().forEach((child) => {
                    element.content().addChild(child, 0);
                });
            });
        });
        this.document.cache.descendants.invalid = true;
        return createQuery(this.document, this.matched, [], this);
    };
    prev = (
        selector?: string | QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        const prevSiblings = this.matched
            .map((m) => m.parent.prevSibling(m)!)
            .filter(Boolean);
        return this.filterBySelector(selector, prevSiblings, namespaces);
    };
    prevAll = (
        selector?: string | QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        const prevSiblings = flatten(
            this.matched.map((m) => {
                const index = m.parent.getIndex(m);
                return m.parent
                    .children()
                    .filter((child) => child.parent.getIndex(child) < index);
            })
        );
        return this.filterBySelector(selector, prevSiblings, namespaces);
    };
    prevUntil = (
        selector: string | QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        const matchPrevAll = this.prevAll(undefined, namespaces);
        const unmatchPrevAll = this.prevAll(selector, namespaces).matched.reduce(
            (map: Record<string, true>, element) => {
                map[element.identifier] = true;
                return map;
            },
            {}
        );
        return createQuery(
            this.document,
            matchPrevAll.matched.filter((m) => !unmatchPrevAll[m.identifier]),
            this.virtualDoms,
            this
        );
    };
    print = (ignoreWhitespace?: boolean) => {
        const printed = this.matched
            .map(parserItemToString)
            .concat(this.virtualDoms.map(parserItemToString))
            .join("");
        return ignoreWhitespace
            ? printed.replace(/\r|\n|\t/gimu, "").replace(/\s+/gimu, "")
            : printed;
    };
    /**
     * Using this instead of prop()
     */
    tagName: TagNameType = (...args: any[]): any => {
        if (args.length === 0 || args[0] === undefined) {
            return this.matched[0]?.tagName.value;
        }
        this.matched.forEach((m, i) => {
            const resolveArg =
                typeof args[0] === "string" ? args[0] : args[0](i, m.tagName.value);
            m.tagName.value = resolveArg;
            if (!m.tagClose.close2.tagSlashClose.value) {
                m.tagClose.close1.closingGroup.tagName.value = resolveArg;
            }
        });
        return this;
    };
    pushStack = (instance: QueryInstance) =>
        createQuery(
            this.document,
            this.matched.concat(instance.matched),
            this.virtualDoms,
            this
        );
    ready = (handler: string | ((event: Event) => void)) => {
        const resolveHandler =
            typeof handler === "string" ? handler : handler.toString();
        const wrapHandler = `document.addEventListener("load", ${resolveHandler})`;
        const script = htmlParser(
            `<script>${wrapHandler}</script>`
        ).descendants()[0];
        this.document.addChild(script);
        this.document.cache.descendants.invalid = true;
        return this;
    };
    reduce = <TAccumulator>(
        reducer: (
            accumulator: TAccumulator,
            value: QueryInstance,
            index: number,
            self: QueryInstance
        ) => TAccumulator,
        initialValue: TAccumulator
    ) => {
        for (let i = 0; i < this.matched.length; i++) {
            initialValue = reducer(initialValue, this.eq(i), i, this);
        }
        return initialValue;
    };
    remove = (selector?: string, namespaces: Record<string, string> = {}) => {
        if (selector) {
            const query = tryQueryParser(selector);
            if (query) {
                const toDelete = query.match(
                    this.matched,
                    this.document.descendants(),
                    namespaces
                );
                toDelete.forEach((element) => {
                    element.parent.removeChild(element);
                });
                const deleteMap = toDelete.reduce(
                    (map: Record<string, true>, element) => {
                        map[element.identifier] = true;
                        return map;
                    },
                    {}
                );
                const nextMatched = this.matched.filter(
                    (m) => !deleteMap[m.identifier]
                );
                return createQuery(this.document, nextMatched, this.virtualDoms, this);
            }
        } else {
            this.matched.forEach((m) => m.parent.removeChild(m));
            return createQuery(this.document, [], this.virtualDoms, this);
        }
        this.document.cache.descendants.invalid = true;
        return this;
    };
    removeAttr = (attributeNames: string) => {
        this.matched.forEach((m) =>
            attributeNames
                .split(" ")
                .forEach((attributeName) => m.removeAttribute(attributeName))
        );
        return this;
    };
    removeClass = (
        classNames:
            | string
            | ((index: number, classNames: string) => string | string[])
    ) => {
        this.matched.forEach((m, index) => {
            m.modifyAttribute("class", (attribute) => {
                if (!attribute) {
                    return attribute;
                }
                const resolvedClassNames =
                    typeof classNames === "string"
                        ? classNames.split(" ")
                        : classNames(index, attribute);

                const bannedClassNames = (
                    typeof resolvedClassNames === "string"
                        ? resolvedClassNames.split(" ")
                        : resolvedClassNames
                ).reduce((banned: Record<string, true>, className) => {
                    banned[className] = true;
                    return banned;
                }, {});
                return attribute
                    .split(" ")
                    .filter((className) => !bannedClassNames[className])
                    .join(" ");
            });
        });
        return this;
    };
    removeData = (data: string | string[]) => {
        const arrayified = typeof data === "string" ? [data] : data;
        arrayified.forEach((value) => {
            this.matched.forEach((m) => {
                delete m.data[value];
            });
        });
        return this;
    };
    replaceAll = (
        replacement: string | QueryInstance | string[] | QueryInstance[],
        namespaces: Record<string, string> = {}
    ) => {
        const arrayified = Array.isArray(replacement) ? replacement : [replacement];
        const elements = flatten(
            arrayified.map((item) => {
                if (typeof item === "string") {
                    return this.find(item, namespaces).matched;
                } else {
                    return item.matched;
                }
            })
        );
        const replacements = this.matched.concat(
            flatten(this.virtualDoms.map((v) => v.descendants()))
        );
        elements.forEach((element) => {
            const parent = element.parent;
            const index = parent.getIndex(element);
            parent.removeChild(element);
            replacements.forEach((replacement) => {
                parent.addChild(replacement, index);
            });
        });
        this.document.cache.descendants.invalid = true;
        return this;
    };
    replaceWith = (
        content:
            | string
            | string[]
            | (() => string | string[] | QueryInstance | QueryInstance[])
            | QueryInstance
            | QueryInstance[],
        namespaces: Record<string, string> = {}
    ) => {
        const executed = typeof content === "function" ? content() : content;
        const arrayified = Array.isArray(executed) ? executed : [executed];
        const elements = flatten(
            arrayified.map((item) => {
                if (typeof item === "string") {
                    return this.find(item, namespaces).matched;
                } else {
                    return item.matched.concat(
                        flatten(item.virtualDoms.map((v) => v.descendants()))
                    );
                }
            })
        );

        this.matched.forEach((m) => {
            const parent = m.parent;
            const index = parent.getIndex(m);
            elements.forEach((e) => {
                parent.addChild(e, index);
            });
        });
        this.document.cache.descendants.invalid = true;
        return createQuery(this.document, [], this.virtualDoms, this);
    };
    select = (handler: string | ((event: Event) => void)) =>
        this.on("select", handler);
    siblings = (selector?: string, namespaces: Record<string, string> = {}) => {
        const matched = flatten(
            this.matched.map((m) => {
                const index = m.parent.getIndex(m);
                return m.parent.children().filter((_, i) => i !== index);
            })
        );
        return this.filterBySelector(selector, matched, namespaces);
    };
    slice = (from: number, to?: number) => {
        const matched = this.matched.slice(from, to);
        return new QueryInstance(this.document, matched, this.virtualDoms, this);
    };
    submit = (handler: string | ((event: Event) => void)) =>
        this.on("submit", handler);
    text: TextType = (...args: any[]): any => {
        if (args.length === 0 || args[0] === undefined) {
            return this.matched[0]?.texts().join("");
        }
        if (args.length === 1 || args[1] === undefined) {
            this.matched.forEach((m, index) => {
                const value = (
                    typeof args[0] === "function"
                        ? args[0](index, m.texts().join(""))
                        : args[0]
                ).toString();
                m.content().addText(value);
            });
        }
        return this;
    };
    toggle = (...args: (string | ((event: Event) => void))[]) => {
        const propName = uniqueId("handler");
        const stringified = args.map((arg) =>
            typeof arg === "function" ? arg.toString() : arg
        );
        const finalHandler = `((event) => { window.${propName} = window.${propName} ? window.${propName} : 0; const handlers = [${stringified.join(
            ","
        )}]; const result = handlers[window.${propName}](event); if (window.${propName} === result.length) { window.${propName} = 0; } else { window.${propName}++; } })(this)`;
        return this.on("click", finalHandler);
    };
    toggleClass = (
        classNames:
            | string
            | ((index: number, classNames: string) => string | string[]),
        state?: boolean
    ) => {
        if (state === true) {
            return this.addClass(classNames);
        }
        if (state === false) {
            return this.removeClass(classNames);
        }
        this.matched.forEach((m, index) => {
            m.modifyAttribute("class", (classes) => {
                const resolve =
                    typeof classNames === "function"
                        ? classNames(index, classes || "")
                        : classNames.split(" ");
                const arrayify = Array.isArray(resolve) ? resolve : resolve.split(" ");
                const classList = (classes || "").split(" ");
                const map = classList.reduce((map: Record<string, true>, cls) => {
                    map[cls] = true;
                    return map;
                }, {});
                const found = arrayify.filter((cls) => map[cls]);
                const notFound = arrayify.filter((cls) => !map[cls]);
                const toRemove = found.reduce((toRemove: Record<string, true>, cls) => {
                    toRemove[cls] = true;
                    return toRemove;
                }, {});
                const filtered = classList.filter((cls) => !toRemove[cls]);
                filtered.push(...notFound);
                return filtered.join(" ");
            });
        });
        return this;
    };
    uniqueSort = () => {
        const unique = Object.values(
            this.matched.reduce((map: Record<string, HtmlElement>, element) => {
                map[element.identifier] = element;
                return map;
            }, {})
        );
        const indexed = unique.map((element) => {
            const indexes: number[] = [];
            const seeker = (element: HtmlElement) => {
                const index = element.parent.getIndex(element);
                if (element.parent instanceof HtmlDocument) {
                    indexes.push(index);
                } else {
                    indexes.push(index);
                    seeker(element.parent);
                }
            };
            return {
                element,
                indexes,
            };
        });
        const arrayComparator = (aArray: number[], bArray: number[]) => {
            const minLength = Math.min(aArray.length, bArray.length);
            const aCommon = aArray.slice(0, minLength);
            const bCommon = bArray.slice(0, minLength);
            const diffIndex = aCommon.findIndex((a, i) => a !== bCommon[i]);
            if (diffIndex === -1) {
                return aArray.length - bArray.length;
            }
            return aCommon[diffIndex] - bCommon[diffIndex];
        };
        const sorted = indexed.sort(({ indexes: aIndex }, { indexes: bIndex }) => {
            return arrayComparator(aIndex, bIndex);
        });
        return createQuery(
            this.document,
            sorted.map(({ element }) => element),
            this.virtualDoms,
            this
        );
    };
    unload = (handler: string | ((event: Event) => void)) =>
        this.on("unload", handler);
    unwrap = (
        selector?: string | QueryInstance,
        namespaces: Record<string, string> = {}
    ) => {
        const toUnwrap = this.matched.reduce(
            (toUnwrap: { element: HtmlElement; parent: HtmlElement }[], element) => {
                if (element.parent instanceof HtmlElement) {
                    toUnwrap.push({ element, parent: element.parent });
                }
                return toUnwrap;
            },
            []
        );
        const elements = (
            selector === undefined
                ? []
                : typeof selector === "string"
                    ? (() => {
                        const parents = toUnwrap.map((u) => u.parent);
                        const query = tryQueryParser(selector);
                        if (!query) {
                            return parents;
                        }
                        return query.match(
                            parents,
                            this.document.descendants(),
                            namespaces
                        );
                    })()
                    : selector.matched
        ).reduce((elements: Record<string, true>, element) => {
            elements[element.identifier] = true;
            return elements;
        }, {});
        const unwrap = (element: HtmlElement) => {
            if (element.parent instanceof HtmlDocument) {
                return;
            }
            const grandparent = element.parent.parent;
            const siblings = element.parent.children();
            const parentIndex = grandparent.getIndex(element.parent);
            grandparent.removeChild(parentIndex);
            siblings.forEach((sibling) => grandparent.addChild(sibling));
        };
        toUnwrap
            .filter(({ parent }) => elements[parent.identifier])
            .forEach(({ element }) => {
                unwrap(element);
            });
        this.document.cache.descendants.invalid = true;
        return this;
    };
    val: ValueType = (...args: any[]): any => {
        if (args.length === 0 || args[0] === undefined) {
            return this.matched[0]?.attributes()["value"];
        }
        this.attr("value");
        return this.attr("value", args[0]);
    };
    width: WidthType = (width?: any): any => {
        if (width) {
            this.matched.forEach((m) => {
                m.modifyAttribute("height", () => width);
            });
            return this;
        }
        return this.matched[0]?.attributes()["height"];
    };
    wrap: WrapType = (...args: any[]): any => {
        this.matched.forEach((m, index) => {
            const resolved: string | QueryInstance =
                typeof args[0] === "function" ? args[0](index, m) : args[0];
            const namespaces: Record<string, string> = args[1] || {};
            const [parent, appendTo] = this.getParentAssigner(resolved, namespaces);
            if (parent && appendTo) {
                appendTo.addChild(m);
                m.parent.replaceChild(m, parent);
            }
        });
        this.document.cache.descendants.invalid = true;
        return this;
    };
    wrapAll: WrapType = (...args: any[]): any => {
        if (this.matched.length === 0) {
            return this;
        }
        const [parent, appendTo] = this.getParentAssigner(
            typeof args[0] === "function" ? args[0](0, this.eq(0)) : args[0],
            args[1] || {}
        );
        if (!parent || !appendTo) {
            return this;
        }
        const parents = this.matched.map((_, i) => this.eq(i).parents().matched);
        const parentsWithCount = parents.reduce(
            (
                parentsWithCount: Record<
                    string,
                    { count: number; lowestIndex: number; parent: HtmlElement }
                >,
                parents
            ) => {
                parents.forEach((parent, index) => {
                    if (parentsWithCount[parent.identifier]) {
                        parentsWithCount[parent.identifier].count++;
                        if (parentsWithCount[parent.identifier].lowestIndex > index) {
                            parentsWithCount[parent.identifier].lowestIndex = index;
                        }
                    } else {
                        parentsWithCount[parent.identifier] = {
                            count: 1,
                            parent: parent,
                            lowestIndex: index,
                        };
                    }
                });
                return parentsWithCount;
            },
            {}
        );

        const commonParents = Object.values(parentsWithCount).filter(
            ({ count }) => count === this.matched.length
        );
        const lowestIndex = commonParents.sort(
            (aParent, bParent) => aParent.lowestIndex - bParent.lowestIndex
        )[0];
        if (lowestIndex) {
            lowestIndex.parent.children().forEach((child) => {
                appendTo.addChild(child);
                lowestIndex.parent.removeChild(child);
            });
            lowestIndex.parent.addChild(parent);
        } else {
            this.document.children().forEach((child) => {
                appendTo.addChild(child);
                this.document.removeChild(child);
            });
            this.document.addChild(parent);
        }
        this.document.cache.descendants.invalid = true;
        return this;
    };
    wrapInner: WrapType = (...args: any[]): any => {
        this.matched.forEach((m, index) => {
            const resolved: string | QueryInstance =
                typeof args[0] === "function" ? args[0](index, m) : args[0];
            const namespaces: Record<string, string> = args[1] || {};
            const [parent, appendTo] = this.getParentAssigner(resolved, namespaces);
            if (parent && appendTo) {
                m.children().forEach((child) => {
                    appendTo.addChild(child);
                    m.removeChild(child);
                });
                m.addChild(parent);
            }
        });
        this.document.cache.descendants.invalid = true;
        return this;
    };
}

const createQuery = (
    document: HtmlDocument,
    matched: HtmlElement[],
    virtualDoms: HtmlDocument[],
    previous: QueryInstance | undefined
): QueryInstance => {
    const instance = new QueryInstance(document, matched, virtualDoms, previous);
    return new Proxy(instance, {
        get(target: QueryInstance, propertyKey, receiver) {
            const tryParseKey = parseInt(propertyKey.toString());
            if (!isNaN(tryParseKey)) {
                return target.eq(tryParseKey);
            }
            return Reflect.get(target, propertyKey, receiver);
        },
        apply(target: QueryInstance, _, args: [string | ((event: Event) => void)]) {
            return target.ready(args[0]);
        },
    });
};

export const Query = (htmlInput: string) => {
    const html = htmlParser(htmlInput);
    return (
        queryInput?: string | ((event: Event) => void),
        namespaces: Record<string, string> = {}
    ) => {
        const allHtmLElements = html.descendants();
        if (typeof queryInput === "function") {
            const query = createQuery(html, [], [], undefined);
            return query.ready(queryInput);
        }
        if (!queryInput) {
            return createQuery(html, [], [], undefined);
        }
        const query = tryQueryParser(queryInput);
        if (query) {
            const matched = query.match(allHtmLElements, allHtmLElements, namespaces);
            return createQuery(html, matched, [], undefined);
        } else {
            const virtualDom = tryHtmlParser(queryInput);
            if (virtualDom) {
                return createQuery(html, [], [virtualDom], undefined);
            }
            return createQuery(html, [], [], undefined).ready(queryInput);
        }
    };
};
