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
    {
        html: "<body><div id='id1' /></body>",
        query: "#id1",
        results: ["<div id='id1' />"],
    },
    {
        html: "<div class='rodeo'></div>",
        query: ".rodeo",
        results: ["<div class='rodeo'></div>"],
    },
    {
        html: "<div name='pipe'></div><div name='pipe' />",
        query: "[name='pipe']",
        results: ["<div name='pipe'></div>", "<div name='pipe' />"]
    },
    {
        html: "<div name='pipe'></div><div name='pipe' /><span />",
        query: "[name=pipe]",
        results: ["<div name='pipe'></div>", "<div name='pipe' />"]
    },
    {
        html: "<div name='pipeline'></div><div name='pipette' /><div name='pour' />",
        query: "[name^=pipe]",
        results: ["<div name='pipeline'></div>", "<div name='pipette' />"]
    },
    {
        html: "<div name='pipeline'></div><div name='pipette' /><div name='pourpipe' />",
        query: "[name$=pipe]",
        results: ["<div name='pourpipe' />"]
    },
    {
        html: "<div name='pipeline'></div><div name='pipette' /><div name='pourpipe' />",
        query: "[name$=pipe]",
        results: ["<div name='pourpipe' />"]
    },
    {
        html: "<div name></div><div /><div />",
        query: "[name]",
        results: ["<div name></div>"]
    },
    {
        html: "<div id='one two three' /><span id='four' />",
        query: "[id~=two]",
        results: ["<div id='one two three' />"],
    },
    {
        html: "<span id='one-' /><span id='one' /><span />",
        query: "[id|=one]",
        results: ["<span id='one-' />", "<span id='one' />"]
    },
    {
        html: "<div data-bind='happydog' /><div data-bind='cathappy' /><div data-bind='doghappy' />",
        query: "[data-bind*='dog']",
        results: ["<div data-bind='happydog' />", "<div data-bind='doghappy' />"],
    },
    {
        html: "<div><span><p /></span><br /></div><span><p id='Ahoy' /></span>",
        query: "div p",
        results: ["<p />"],
    },
    {
        html: "<div><p>Hello?</p><span><p /></span><br /></div><span><p /></span>",
        query: "div > p",
        results: ["<p>Hello?</p>"],
    },
    {
        html: "<div><p>Hello?</p><span><p /></span><br /></div><p>World</p><span><p /></span>",
        query: "div + p",
        results: ["<p>World</p>"],
    },
    {
        html: "div ~ p",
        query: "<div><p>Hello?</p><span><p /></span><br /></div><p>World</p><p>!</p><span><p /></span>",
        results: ["<p>World</p>", "<p>!</p>"]
    },
    {
        html: "*",
        query: "<div /><span />",
        results: ["<div />", "<span />"],
    },
    {
        html: "<body><div id='select' /><span class='class' id='select' /><input name='Hello' /><article /><p>Hello<div>?</div></p></body>",
        query: "#select, .class, p, [name='Hello']",
        results: ["<div id='select' />", "<span class='class' id='select' />", "<input name='Hello' />", "<p>Hello<div>?</div></p>"],
    },
    {
        html: `<a href="#">Not this</a><svg width="250px" viewBox="0 0 250 20" xmlns="http://www.w3.org/2000/svg"><a href="#" /></svg>`,
        query: "svg|a",
        results: [`<a href="#" />`],
        namespaces: {
            svg: "http://www.w3.org/2000/svg",
        },
    },
    {
        html: `<a href="#">Not this</a><svg width="250px" viewBox="0 0 250 20" xmlns="http://www.w3.org/2000/svg"><a href="#" /></svg>`,
        query: "svg|*",
        results: [`<a href="#" />`],
        namespaces: {
            svg: "http://www.w3.org/2000/svg",
        },
    },
    {
        html: `<a href="#">Not this</a><svg width="250px" viewBox="0 0 250 20" xmlns="http://www.w3.org/2000/svg"><a href="#" /></svg>`,
        query: "*|a",
        results: [`<a href="#">Not this</a>`, `<a href="#" />`],
        namespaces: {
            svg: "http://www.w3.org/2000/svg",
        },
    },
    {
        html: "<input type='checkbox' /><div />",
        query: ":checkbox",
        results: ["<input type='checkbox' />"]
    },
    {
        html: "<input type='checkbox' /><div />",
        query: "input:checkbox",
        results: ["<input type='checkbox' />"]
    },
    {
        html: "<input type='checkbox' /><input type='checkbox' checked />",
        query: ":checked",
        results: ["<input type='checkbox' checked />"]
    },
    {
        html: "<input type='checkbox' /><input type='checkbox' disabled='' />",
        query: "*:disabled",
        results: ["<input type='checkbox' disabled='' />"]
    },
    {
        html: "<div><p /></div><div /><div></div><p>,</p>",
        query: ":empty",
        results: ["<div />", "<div></div>"]
    },
    {
        html: "<input type='checkbox' /><input type='checkbox' disabled='' />",
        query: "input:enabled",
        results: ["<input type='checkbox' />"],
    },
    {
        html: "<div><p></p><p /></div>",
        query: "p:first-child",
        results: ["<p></p>"],
    },
    {
        html: "<div><span /><p></p><p /></div>",
        query: "p:first-of-type",
        results: ["<p></p>"],
    },
    {
        html: "<input min='1' max='2' value='3' /><input min='1' value='2' /><input min='1' max='5' value='4' /><input max='6' value='5' />",
        query: "input:in-range",
        results: ["<input min='1' value='2' />", "<input min='1' max='5' value='4' />", "<input max='6' value='5' />"],
    },
    {
        html: "<input min='2020-01-01' max='2020-12-31' value='2021-01-01' /><input min='2020-01-01' max='2020-12-31' value='2020-05-01' />",
        query: "input:in-range",
        results: ["<input min='2020-01-01' max='2020-12-31' value='2020-05-01' />"],
    },
    {
        html: "<input min='2020-W10' max='2020-W20' value='2020-W21' /><input min='2020-W10' max='2020-W20' value='2020-W12' />",
        query: "input:in-range",
        results: ["<input min='2020-W10' max='2020-W20' value='2020-W12' />"],
    },
    {
        html: "<input value='Hello' pattern='Wo?rld' /><input value='Wrld' pattern='Wo?rld' />",
        query: "input:invalid",
        results: ["<input value='Hello' pattern='Wo?rld' />"],
    },
    {
        html: "<input value='Hello' required /><input value='' required /><input value required /><input required />",
        query: "input:invalid",
        results: ["<input value='' required />", "<input value required />", "<input required />"],
    },
    {
        html: "<input min='1' max='2' value='3' /><input min='1' value='2' /><input min='1' max='5' value='4' /><input max='6' value='5' />",
        query: "input:invalid",
        results: ["<input min='1' max='2' value='3' />"],
    },
    {
        html: "<input min='1' value='2' step='3' /><input min='1' max='5' value='4' step='2' /><input max='6' value='5' step='1' />",
        query: "input:invalid",
        results: ["<input min='1' value='2' step='3' />"],
    },
    {
        html: "",
        query: "input:invalid",
        results: [""],
    },
];

describe("Can successfully match query to DOM", () => {
    matches.forEach((match) => {
        it(`Matches ${match.query} to ${match.html.slice(0, 10)}... with ${match.results.length} results`, () => {
            expect(testMatch(match.html, match.query, match.namespaces)).toEqual(match.results);
        });
    });
});