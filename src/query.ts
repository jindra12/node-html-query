import { HtmlContent, HtmlDocument, HtmlElement } from "./html";
import {
    htmlParser,
    queryParser,
    tryHtmlParser,
    tryQueryParser,
} from "./parser";
import { flatten, parserItemToString } from "./utils";

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
        this.document.cache.descendants.invalid = true;
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
        return this;
    };

    private filterBySelector = (
        selector: string | QueryInstance | undefined,
        elements: HtmlElement[]
    ) => {
        if (selector === undefined) {
            return createQuery(this.document, elements, this.virtualDoms, this);
        }
        if (typeof selector === "string") {
            const query = tryQueryParser(selector);
            if (query) {
                const matched = query.match(elements, this.document.descendants());
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
        this.matched = matched;
        this.virtualDoms = virtualDoms;
        this.previous = previous || this;
    }

    find = (queryInput: string) => {
        const query = queryParser(queryInput);
        return createQuery(
            this.document,
            query.match(this.matched, this.document.descendants()),
            this.virtualDoms,
            this
        );
    };
    add = (toAdd: QueryInstance | string, context?: QueryInstance) => {
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
                            .match(matched.descendants(), this.document.descendants())
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
                        .match(this.document.descendants(), this.document.descendants())
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
    addBack = (selector: string | undefined) => {
        if (selector === undefined) {
            return this.previous;
        }
        return this.previous.find(selector);
    };
    addClass = (className: string) => {
        this.matched.forEach((element) => {
            element.modifyAttribute("class", (classes) => {
                if (!classes) {
                    return className;
                }
                if (classes.includes(className)) {
                    return classes;
                }
                const classList = classes.split(" ");
                classList.push(classes);
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
                }
            },
            firstArg,
            ...content
        );
    };
    appendTo = (query: QueryInstance) => {
        this.document.cache.descendants.invalid = true;
        query.matched.forEach((element) => {
            this.matched.forEach((nextChild) => {
                element.content().addChild(nextChild);
                nextChild.parent.removeChild(nextChild);
            });
            this.virtualDoms.forEach((document) => {
                document.children().forEach((child) => {
                    element.content().addChild(child);
                });
            });
        });
        return createQuery(this.document, this.matched, [], this);
    };
    attr:
        | ((attributeName: string) => string | undefined)
        | ((attributes: Record<string, string>) => QueryInstance)
        | ((
            attributeName: string,
            value: string | ((index: number, value: string) => string)
        ) => QueryInstance) = (...args: any[]): any => {
            const firstArg = args[0];
            if (typeof firstArg === "string") {
                if (args.length === 1) {
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
    closest = (selector: string, container?: QueryInstance) => {
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
            if (parsed.match([currentNode], this.document.descendants())) {
                return currentNode;
            }
            const parent = currentNode.parent;
            if (parent instanceof HtmlDocument) {
                return undefined;
            }
            return seeker(parent.parent);
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
    contextmenu = (handler: string | ((event: Event) => void)) =>
        this.on("contextmenu", handler);
    css:
        | ((propertyName: string) => string | undefined)
        | ((propertyNames: string[]) => Record<string, string>)
        | ((css: Record<string, string>) => QueryInstance)
        | ((
            propertyName: string,
            value: string | ((index: number, value: string) => string)
        ) => QueryInstance) = (...args: any[]): any => {
            const firstArg = args[0];
            if (typeof firstArg === "string") {
                if (args.length === 1) {
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
    data:
        | ((key: string, value: string) => QueryInstance)
        | ((key: string) => string | undefined)
        | ((object: Record<string, string>) => QueryInstance)
        | (() => Record<string, string>) = (...args: any[]): any => {
            if (args.length === 0) {
                return this.matched[0]?.data || {};
            } else if (args.length === 1) {
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
            } else if (args.length === 2) {
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
    even = () => {
        return createQuery(
            this.document,
            this.matched.filter((_, i) => i % 2 === 0),
            this.virtualDoms,
            this
        );
    };
    first = () => this.get(0);
    focus = (handler: string | ((event: Event) => void)) =>
        this.on("focus", handler);
    focusin = (handler: string | ((event: Event) => void)) =>
        this.on("focusin", handler);
    focusout = (handler: string | ((event: Event) => void)) =>
        this.on("focusout", handler);
    has = (selector: string | QueryInstance) => {
        if (typeof selector === "string") {
            const query = tryQueryParser(selector);
            if (query) {
                return createQuery(
                    this.document,
                    this.matched.filter((m) => {
                        return (
                            query.match(m.descendants(), this.document.descendants()).length >
                            0
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
    get = (index: number = 0) => {
        return createQuery(
            this.document,
            [this.matched[index >= 0 ? index : this.matched.length - 1 + index]],
            this.virtualDoms,
            this
        );
    };
    height: (() => string | undefined) | ((value: number) => QueryInstance) = (
        height?: string
    ): any => {
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
    html:
        | (() => string | undefined)
        | ((html: string) => QueryInstance)
        | ((setter: (index: number, html: string) => string) => QueryInstance) = (
            ...args: any[]
        ): any => {
            if (args.length === 0) {
                if (this.matched.length > 0) {
                    return parserItemToString(this.matched[0]);
                } else {
                    return undefined;
                }
            } else {
                this.matched.forEach((m, index) => {
                    const resolveArg =
                        typeof args[0] === "string"
                            ? args[0]
                            : args[0](index, parserItemToString(m));
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
    index = (selector?: string | QueryInstance) => {
        if (selector === undefined) {
            return this.matched[0]
                ? this.matched[0].parent.getIndex(this.matched[0])
                : -1;
        }
        if (typeof selector === "string") {
            const query = tryQueryParser(selector);
            if (query) {
                const matched = query.match(this.matched, this.document.descendants());
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
    insertBefore = (selector: string | QueryInstance) => {
        this.document.cache.descendants.invalid = true;
        const toInsertBefore =
            typeof selector === "string"
                ? (() => {
                    const query = tryQueryParser(selector);
                    if (query) {
                        return query.match(this.matched, this.document.descendants());
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
        return createQuery(this.document, this.matched, [], this);
    };
    insertAfter = (selector: string | QueryInstance) => {
        this.document.cache.descendants.invalid = true;
        const toInsertAfter =
            typeof selector === "string"
                ? (() => {
                    const query = tryQueryParser(selector);
                    if (query) {
                        return query.match(this.matched, this.document.descendants());
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
        return createQuery(this.document, this.matched, [], this);
    };
    keypress = (handler: string | ((event: Event) => void)) =>
        this.on("keypress", handler);
    keydown = (handler: string | ((event: Event) => void)) =>
        this.on("keydown", handler);
    keyup = (handler: string | ((event: Event) => void)) =>
        this.on("keyup", handler);
    is = (selector: string | QueryInstance) => {
        if (typeof selector === "string") {
            const query = tryQueryParser(selector);
            if (query) {
                return (
                    query.match(this.matched, this.document.descendants()).length > 0
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
    last = () => this.get(this.matched.length - 1);
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
    next = (selector?: string | QueryInstance) => {
        const nextSiblings = this.matched
            .map((m) => m.parent.nextSibling(m)!)
            .filter(Boolean);
        return this.filterBySelector(selector, nextSiblings);
    };
    nextAll = (selector?: string | QueryInstance) => {
        const nextSiblings = flatten(
            this.matched.map((m) => {
                const index = m.parent.getIndex(m);
                return m.parent
                    .children()
                    .filter((child) => child.parent.getIndex(child) > index);
            })
        );
        return this.filterBySelector(selector, nextSiblings);
    };
    nextUntil = (selector: string | QueryInstance) => {
        const matchNextAll = this.nextAll();
        const unmatchNextAll = this.nextAll(selector).matched.reduce(
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
    not = (selector: string | QueryInstance) => {
        const filtered = this.filterBySelector(
            selector,
            this.matched
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
    parent = (selector: string | QueryInstance) => {
        return this.filterBySelector(
            selector,
            this.matched.reduce((parents: HtmlElement[], element) => {
                const parentContent = element.parent;
                if (parentContent instanceof HtmlContent) {
                    parents.push(parentContent.parent);
                }
                return parents;
            }, [])
        );
    };
    parents = (selector?: string | QueryInstance) => {
        return this.filterBySelector(
            selector,
            this.matched.reduce((parents: HtmlElement[], element) => {
                let parentContent = element.parent;
                while (parentContent instanceof HtmlContent) {
                    parents.push(parentContent.parent);
                    parentContent = parentContent.parent.parent;
                }
                return parents;
            }, [])
        );
    };
    parentsUntil = (selector: string | QueryInstance) => {
        const parentsNot = this.parents(selector).matched.reduce(
            (map: Record<string, true>, element) => {
                map[element.identifier] = true;
                return map;
            },
            {}
        );
        const parents = this.parents().matched;
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
        this.document.cache.descendants.invalid = true;
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
        return createQuery(this.document, this.matched, [], this);
    };
    prev = (selector?: string | QueryInstance) => {
        const prevSiblings = this.matched
            .map((m) => m.parent.prevSibling(m)!)
            .filter(Boolean);
        return this.filterBySelector(selector, prevSiblings);
    };
    prevAll = (selector?: string | QueryInstance) => {
        const prevSiblings = flatten(
            this.matched.map((m) => {
                const index = m.parent.getIndex(m);
                return m.parent
                    .children()
                    .filter((child) => child.parent.getIndex(child) < index);
            })
        );
        return this.filterBySelector(selector, prevSiblings);
    };
    prevUntil = (selector: string | QueryInstance) => {
        const matchPrevAll = this.prevAll();
        const unmatchPrevAll = this.prevAll(selector).matched.reduce(
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
    /**
     * Using this instead of prop()
     */
    tagName:
        | (() => string)
        | ((tagName: string) => QueryInstance)
        | ((setter: (index: number, tagName: string) => string) => QueryInstance) =
        (...args: any[]): any => {
            if (args.length === 0) {
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
        this.document.cache.descendants.invalid = true;
        const script = htmlParser(
            `<script>${wrapHandler}</script>`
        ).descendants()[0];
        this.document.addChild(script);
        return this;
    };
    remove = (selector?: string) => {
        if (selector) {
            const query = tryQueryParser(selector);
            if (query) {
                const toDelete = query.match(this.matched, this.document.descendants());
                this.document.cache.descendants.invalid = true;
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
                return target.get(tryParseKey);
            }
            return Reflect.get(target, propertyKey, receiver);
        },
    });
};

export const Query = (htmlInput: string) => {
    const html = htmlParser(htmlInput);
    return (queryInput: string) => {
        const allHtmLElements = html.descendants();
        const query = tryQueryParser(queryInput);
        if (query) {
            const matched = query.match(allHtmLElements, allHtmLElements);
            return createQuery(html, matched, [], undefined);
        } else {
            const virtualDom = tryHtmlParser(queryInput);
            if (virtualDom) {
                return createQuery(html, [], [virtualDom], undefined);
            }
            return createQuery(new HtmlDocument(), [], [], undefined);
        }
    };
};
