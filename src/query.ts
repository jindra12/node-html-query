import { HtmlDocument, HtmlElement } from "./html";
import { htmlParser, queryParser } from "./parser";

class QueryInstance {
    html: HtmlDocument;
    matched: HtmlElement[];
    constructor(html: HtmlDocument, matched: HtmlElement[]) {
        this.html = html;
        this.matched = matched;
    }
    find = (queryInput: string) => {
        const query = queryParser(queryInput);
        return new QueryInstance(this.html, query.match(this.matched, this.html.descendants()));
    };
}

export const Query = (htmlInput: string) => {
    const html = htmlParser(htmlInput);
    return (queryInput: string) => {
        const query = queryParser(queryInput);
        const allHtmLElements = html.descendants();
        const matched = query.match(allHtmLElements, allHtmLElements);
        return new QueryInstance(html, matched);
    };
};