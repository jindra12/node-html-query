import { htmlParser, queryParser } from "../src/parser";
import { parserItemToString } from "../src/utils";

const testMatch = (htmlInput: string, queryInput: string, namespaces: Record<string, string> = {}) => {
    const html = htmlParser(htmlInput);
    const query = queryParser(queryInput);
    const matched = query.match(html.descendants(), html.descendants(), namespaces);
    return matched.map((m) => parserItemToString(m));
};

const matches: {
    html: string;
    query: string;
    results: string[];
    namespaces?: Record<string, string>;
}[] = [

];

describe("Can successfully match query to DOM", () => {
    matches.forEach((match) => {
        it(`Matches ${match.query} to ${match.html.slice(0, 10)}... with ${match.results.length} results`, () => {
            expect(testMatch(match.html, match.query, match.namespaces)).toEqual(match.results);
        });
    });
});