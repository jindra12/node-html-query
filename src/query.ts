import { HtmlContent, HtmlDocument, HtmlElement } from "./html";
import { htmlParser, queryParser, tryHtmlParser, tryQueryParser } from "./parser";
import { flatten, parserItemToString } from "./utils";

class QueryInstance {
    private document: HtmlDocument;
    private virtualDoms: HtmlDocument[];
    private matched: HtmlElement[];
    private previous: QueryInstance;

    private addElementsToMatcher = (manipulator: (content: string, matched: HtmlElement) => void, firstArg: string | ((index: number, html: string) => string), ...content: string[]) => {
        this.document.cache.descendants.invalid = true;
        this.matched.forEach((element, index) => {
            const textFirstArg = typeof firstArg === "function" ? firstArg(index, parserItemToString(element)) : firstArg;
            const allContent = [textFirstArg, ...content];
            allContent.forEach((content) => {
                manipulator(content, element);
            });
        });
        return this;
    }

    constructor(document: HtmlDocument, matched: HtmlElement[], virtualDoms: HtmlDocument[], previous: QueryInstance | undefined) {
        this.document = document;
        this.matched = matched;
        this.virtualDoms = virtualDoms;
        this.previous = previous || this;
    }

    find = (queryInput: string) => {
        const query = queryParser(queryInput);
        return new QueryInstance(this.document, query.match(this.matched, this.document.descendants()), this.virtualDoms, this);
    };
    add = (toAdd: QueryInstance | string, context?: QueryInstance) => {
        if (toAdd instanceof QueryInstance) {
            return new QueryInstance(this.document, this.matched.concat(toAdd.matched), this.virtualDoms.concat(toAdd.virtualDoms), this);
        } else {
            const cssQuery = tryQueryParser(toAdd);
            if (cssQuery) {
                if (context) {
                    const nextMatched: HtmlElement[] = [...this.matched];
                    context.matched.forEach((matched) => {
                        cssQuery.match(matched.descendants(), this.document.descendants()).forEach((element) => {
                            nextMatched.push(element);
                        });
                    });
                    return new QueryInstance(
                        this.document,
                        nextMatched,
                        this.virtualDoms,
                        this,
                    );
                } else {
                    const nextMatched: HtmlElement[] = [...this.matched];
                    cssQuery.match(this.document.descendants(), this.document.descendants()).forEach((element) => {
                        nextMatched.push(element);
                    });
                    return new QueryInstance(
                        this.document,
                        nextMatched,
                        this.virtualDoms,
                        this,
                    );
                }
            } else {
                const htmlObject = tryHtmlParser(toAdd);
                if (htmlObject) {
                    return new QueryInstance(this.document, this.matched, this.virtualDoms.concat([htmlObject]), this);
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
    after = (firstArg: string | ((index: number, html: string) => string), ...content: string[]) => {
        return this.addElementsToMatcher((content: string, matched: HtmlElement) => {
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
        }, firstArg, ...content);
    };
    append = (firstArg: string | ((index: number, html: string) => string), ...content: string[]) => {
        return this.addElementsToMatcher((content: string, matched: HtmlElement) => {
            const tryFirstArgHtml = tryHtmlParser(content);
                if (!tryFirstArgHtml) {
                    matched.content().addText(content);
                } else {
                    tryFirstArgHtml.descendants().forEach((descentant) => {
                        matched.content().addChild(descentant);
                    });
                }
        }, firstArg, ...content);
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
            this.virtualDoms = [];
        });
        return this;
    };
    attr: (
        ((attributeName: string) => (string | undefined)) | ((attributes: Record<string, string>) => QueryInstance) | ((attributeName: string, value: string | ((index: number, value: string) => string)) => QueryInstance)
    ) = (...args: any[]): any => {
        const firstArg = args[0];
        if (typeof firstArg === "string") {
            if (args.length === 1) {
                return this.matched[0]?.attributes()[firstArg] || "";
            }
            this.matched.forEach((matched, index) => {
                const attributes = matched.attributes();
                const resolveValue = typeof args[1] === "string" ? args[1] : args[1](index, attributes[firstArg] || "");
                matched.replaceAttribute(firstArg, resolveValue);
            });
        } else if (typeof firstArg === "object" && firstArg) {
            this.matched.forEach((matched) => {
                Object.entries(firstArg as Record<string, string>).forEach(([attributeName, attributeValue]) => {
                    matched.replaceAttribute(attributeName, attributeValue);
                });
            });
        }

        return this;
    };
    before = (firstArg: string | ((index: number, html: string) => string), ...content: string[]) => {
        return this.addElementsToMatcher((content: string, matched: HtmlElement) => {
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
        }, firstArg, ...content);
    };
    bind = (eventType: string, eventHandler: string | ((event: Event) => void)) => {
        const stringifyHandler = typeof eventHandler === "function" ? `(${eventHandler.toString()})(this)` : eventHandler;
        this.matched.forEach((match) => {
            match.modifyAttribute(`on${eventType}`, (existing) => {
                if (!existing) {
                    return stringifyHandler;
                }
                const split = existing.split(";");
                split.push(stringifyHandler);
                return split.join(";");
            });
        });
        return this;
    };
    blur = (handler: string | ((event: Event) => void)) => this.bind("blur", handler);
    change = (handler: string | ((event: Event) => void)) => this.bind("change", handler);
    children = () => {
        const children = flatten(this.matched.map((m) => m.children()));
        return new QueryInstance(this.document, children, this.virtualDoms, this);
    };
    clone = () => {
        const cloned = this.matched.map((m) => m.clone());
        const virtualDom = new HtmlDocument();
        cloned.forEach((clone) => virtualDom.addChild(clone));
        return new QueryInstance(this.document, [], this.virtualDoms.concat([virtualDom]), this);
    };
    closest = (selector: string, container?: QueryInstance) => {
        const parsed = tryQueryParser(selector);
        if (!parsed) {
            return this;
        }
        const descendantLimit = container?.matched.reduce((descendantsMap: Record<string, true>, matched) => {
            descendantsMap[matched.identifier] = true;
            matched.descendants().forEach((descendant) => {
                descendantsMap[descendant.identifier] = true;
            });
            return descendantsMap;
        }, {});
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
        const ancestors = this.matched.reduce((ancestors: HtmlElement[], element) => {
            const ancestor = seeker(element);
            if (ancestor) {
                ancestors.push(ancestor);
            }
            return ancestors;
        }, []);
        return new QueryInstance(this.document, ancestors, this.virtualDoms, this);
    };
    contextmenu = (handler: string | ((event: Event) => void)) => this.bind("contextmenu", handler);
    css: (
        ((propertyName: string) => (string | undefined)) | ((propertyNames: string[]) => Record<string, string>) | ((css: Record<string, string>) => QueryInstance) | ((propertyName: string, value: string | ((index: number, value: string) => string)) => QueryInstance)
    ) = (...args: any[]): any => {
        const firstArg = args[0];
        if (typeof firstArg === "string") {
            if (args.length === 1) {
                return this.matched[0]?.getStyles()[firstArg];
            }
            this.matched.forEach((matched, index) => {
                const resolveValue = typeof args[1] === "string" ? () => args[1] : (value: string | undefined) => args[1](index, value);
                matched.modifyStyle(firstArg, resolveValue);
            });
        } else if (Array.isArray(firstArg)) {
            const selectedMap = firstArg.reduce((selectedMap: Record<string, true>, item: string) => {
                selectedMap[item] = true;
                return selectedMap;
            }, {});
            return Object.entries(this.matched[0]?.getStyles() || {}).reduce((selected: Record<string, string>, [styleName, styleValue]) => {
                if (selectedMap[styleName]) {
                    selected[styleName] = styleValue;
                }
                return selected;
            }, {});
        } else if (typeof firstArg === "object" && firstArg) {
            this.matched.forEach((matched) => {
                Object.entries(firstArg as Record<string, string>).forEach(([styleName, styleValue]) => {
                    matched.modifyStyle(styleName, () => styleValue);
                });
            });
        }
        return this;
    };
    data: (
        ((key: string, value: string) => QueryInstance) | ((key: string) => (string | undefined)) | ((object: Record<string, string>) => QueryInstance) | (() => Record<string, string>)
    ) = (...args: any[]): any => {
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
            })
        }
        return this;
    };
    dblclick = (handler: string | ((event: Event) => void)) => this.bind("dblclick", handler);
    detach = (selector: string) => {
        const query = tryQueryParser(selector)
        if (query) {
            const toDelete = query.match(this.matched, this.document.descendants());
            this.document.cache.descendants.invalid = true;
            toDelete.forEach((element) => {
                element.parent.removeChild(element);
            });
            const deleteMap = toDelete.reduce((map: Record<string, true>, element) => {
                map[element.identifier] = true;
                return map;
            }, {});
            const nextMatched = this.matched.filter((m) => !deleteMap[m.identifier]);
            return new QueryInstance(this.document, nextMatched, this.virtualDoms, this);
        }
        return this;
    }
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
        return new QueryInstance(this.document, this.matched.filter((_, i) => index >= 0 ? i === index : i === (this.matched.length - 1 + index)), this.virtualDoms, this);
    };
    filter = (filter: string | QueryInstance) => {
        if (typeof filter === "string") {
            return this.find(filter);
        } else if (filter instanceof QueryInstance) {
            const matchedMap = filter.matched.reduce((matchedMap: Record<string, true>, element) => {
                matchedMap[element.identifier] = true;
                return matchedMap;
            }, {});
            return new QueryInstance(
                this.document,
                this.matched.filter((m) => matchedMap[m.identifier]),
                this.virtualDoms,
                this,
            );
        }
        return this;
    };
    even = () => {
        return new QueryInstance(this.document, this.matched.filter((_, i) => i % 2 === 0), this.virtualDoms, this);
    };
    first = () => this.get(0);
    focus = (handler: string | ((event: Event) => void)) => this.bind("focus", handler);
    focusin = (handler: string | ((event: Event) => void)) => this.bind("focusin", handler);
    focusout = (handler: string | ((event: Event) => void)) => this.bind("focusout", handler);
    has = (selector: string | QueryInstance) => {
        if (typeof selector === "string") {
            const query = tryQueryParser(selector);
            if (query) {
                return new QueryInstance(this.document, this.matched.filter((m) => {
                    return query.match(m.descendants(), this.document.descendants()).length > 0;
                }), this.virtualDoms, this);
            }
        } else if (selector instanceof QueryInstance) {
            const matchedMap = selector.matched.reduce((matchedMap: Record<string, true>, element) => {
                matchedMap[element.identifier] = true;
                return matchedMap;
            }, {});
            return new QueryInstance(this.document, this.matched.filter((m) => {
                return m.descendants().some((d) => matchedMap[d.identifier]);
            }), this.virtualDoms, this);
        }
        return this;
    };
    hasClass = (className: string) => {
        return this.matched.some((m) => m.attributes()["class"].split(" ").some((cls) => cls === className));
    };
    get = (index: number = 0) => {
        return new QueryInstance(this.document, [this.matched[index >= 0 ? index : this.matched.length - 1 + index]], this.virtualDoms, this);
    };
    height: (
        (() => string | undefined) | ((value: number) => QueryInstance)
    ) = (height?: string): any => {
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
    hover = (handler: string | ((event: Event) => void)) => this.bind("hover", handler);
    html: (
        (() => string | undefined) | ((html: string) => QueryInstance) | ((setter: (index: number, html: string) => string) => QueryInstance)
    ) = (...args: any[]): any => {
        if (args.length === 0) {
            if (this.matched.length > 0) {
                return parserItemToString(this.matched[0]);
            } else {
                return undefined;
            }
        } else {
            this.matched.forEach((m, index) => {
                const resolveArg = typeof args[0] === "string" ? args[0] : args[0](index, parserItemToString(m));
                const nextDom = tryHtmlParser(resolveArg);
                if (nextDom) {
                    m.emptyText();
                    m.children().forEach((child) => {
                        m.content().removeChild(child);
                    });
                    nextDom.descendants().forEach((d) => {
                        m.content().addChild(d);
                    })
                }
            });
        }
        return this;
    };
    
}

export const Query = (htmlInput: string) => {
    const html = htmlParser(htmlInput);
    return (queryInput: string) => {
        const allHtmLElements = html.descendants();
        const query = tryQueryParser(queryInput);
        if (query) {
            const matched = query.match(allHtmLElements, allHtmLElements);
            return new QueryInstance(html, matched, [], undefined);
        } else {
            const virtualDom = tryHtmlParser(queryInput);
            if (virtualDom) {
                return new QueryInstance(html, [], [virtualDom], undefined);
            }
            return new QueryInstance(new HtmlDocument(), [], [], undefined);
        }
    };
};