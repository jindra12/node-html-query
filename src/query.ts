import { HtmlDocument, HtmlElement } from "./html";
import { htmlParser, queryParser, tryHtmlParser, tryQueryParser } from "./parser";

class QueryInstance {
    private html: HtmlDocument;
    private virtualDoms: HtmlDocument[];
    private matched: HtmlElement[];
    private previous: QueryInstance;
    constructor(html: HtmlDocument, matched: HtmlElement[], virtualDoms: HtmlDocument[], previous: QueryInstance | undefined) {
        this.html = html;
        this.matched = matched;
        this.virtualDoms = virtualDoms;
        this.previous = previous || this;
    }
    find = (queryInput: string) => {
        const query = queryParser(queryInput);
        return new QueryInstance(this.html, query.match(this.matched, this.html.descendants()), this.virtualDoms, this);
    };
    add = (toAdd: QueryInstance | string, context?: QueryInstance) => {
        if (toAdd instanceof QueryInstance) {
            return new QueryInstance(this.html, this.matched.concat(toAdd.matched), this.virtualDoms.concat(toAdd.virtualDoms), this);
        } else {
            const cssQuery = tryQueryParser(toAdd);
            if (cssQuery) {
                if (context) {
                    const nextMatched: HtmlElement[] = [...this.matched];
                    context.matched.forEach((matched) => {
                        cssQuery.match(matched.descendants(), this.html.descendants()).forEach((element) => {
                            nextMatched.push(element);
                        });
                    });
                    return new QueryInstance(
                        this.html,
                        nextMatched,
                        this.virtualDoms,
                        this,
                    );
                } else {
                    const nextMatched: HtmlElement[] = [...this.matched];
                    cssQuery.match(this.html.descendants(), this.html.descendants()).forEach((element) => {
                        nextMatched.push(element);
                    });
                    return new QueryInstance(
                        this.html,
                        nextMatched,
                        this.virtualDoms,
                        this,
                    );
                }
            } else {
                const htmlObject = tryHtmlParser(toAdd);
                if (htmlObject) {
                    return new QueryInstance(this.html, this.matched, this.virtualDoms.concat([htmlObject]), this);
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
        this.html.cache.descendants.invalid = true;
        this.matched.forEach((element, index) => {
            element.parent.addChild(
                typeof firstArg === "string" ? 
            );
        });
        return this;
    };
}

export const Query = (htmlInput: string) => {
    const html = htmlParser(htmlInput);
    return (queryInput: string) => {
        const query = queryParser(queryInput);
        const allHtmLElements = html.descendants();
        const matched = query.match(allHtmLElements, allHtmLElements);
        return new QueryInstance(html, matched, [], undefined);
    };
};