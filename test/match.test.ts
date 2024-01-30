import { htmlParser, queryParser } from "../src/parser";
import { parserItemToString } from "../src/utils";

const testMatch = (htmlInput: string, queryInput: string, namespaces: Record<string, string> = {}) => {
    const html = htmlParser(htmlInput, false);
    const query = queryParser(queryInput);
    const matched = query.match(html.descendants(), html.descendants(), namespaces);
    return matched.map((m) => parserItemToString(m).replace(/\n\s*/gu, "").replace(/\s+/gu, " "));
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
        html: "<div class='rodeo proper'></div>",
        query: ".rodeo",
        results: ["<div class='rodeo proper'></div>"],
    },
    {
        html: "<div class='rodeo proper'></div>",
        query: ".proper",
        results: ["<div class='rodeo proper'></div>"],
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
        query: `[name$="pipe"]`,
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
        html: "<span id='one-' /><span id='one' /><span /><span id='2' />",
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
        html: "<div><p>Hello?</p><span><p /></span><br /></div><p>World</p><p>!</p><span><p /></span>",
        query: "div ~ p",
        results: ["<p>World</p>", "<p>!</p>"]
    },
    {
        html: "<div /><span />",
        query: "*",
        results: ["<div />", "<span />"],
    },
    {
        html: "<body><div id='select' /><span class='class' id='select' /><input name='Hello' /><article /><p>Hello<div>?</div></p></body>",
        query: "#select, .class, p, [name='Hello']",
        results: ["<div id='select' />", "<span class='class' id='select' />", "<p>Hello<div>?</div></p>", "<input name='Hello' />"],
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
        html: `<a href="#">Not this</a><a weird:href="#" />`,
        query: "[weird|href='#']",
        results: [`<a weird:href="#" />`],
        namespaces: {
            weird: "http://www.w3.org/2000/svg",
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
        results: ["<div />", "<div></div>", "<p />"]
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
        html: "<input min='2020-01-01' max='2020-12-31' value='2021-01-01' /><input min='2020-01-01' max='2020-12-31' value='2020-05-01' step='2' /><input min='2020-01-01' max='2020-12-31' value='2020-05-02' step='2' />",
        query: "input:in-range",
        results: ["<input min='2020-01-01' max='2020-12-31' value='2020-05-02' step='2' />"],
    },
    {
        html: "<input min='2020-01-01T20:00' max='2020-12-31T21:00' value='2020-12-31T22:00' /><input min='2020-01-01T20:00' max='2020-12-31T21:00' value='2020-12-31T19:00' />",
        query: "input:in-range",
        results: ["<input min='2020-01-01T20:00' max='2020-12-31T21:00' value='2020-12-31T19:00' />"],
    },
    {
        html: "<input min='2020-01-01T20:00' max='2020-12-31T21:00' value='2020-12-31T22:00' /><input min='2020-01-01T20:00' max='2020-12-31T21:00' value='2020-12-31T19:01' step='2' /><input min='2020-01-01T20:00' max='2020-12-31T21:00' value='2020-12-31T19:00' step='2' />",
        query: "input:in-range",
        results: ["<input min='2020-01-01T20:00' max='2020-12-31T21:00' value='2020-12-31T19:00' step='2' />"],
    },
    {
        html: "<input min='2020-W10' max='2020-W20' value='2020-W21' /><input min='2020-W10' max='2020-W20' value='2021-W11' /><input min='2020-W10' max='2020-W20' value='2020-W12' />",
        query: "input:in-range",
        results: ["<input min='2020-W10' max='2020-W20' value='2020-W12' />"],
    },
    {
        html: "<input min='2020-W10' max='2020-W20' value='2020-W21' /><input min='2020-W10' max='2020-W20' value='2021-W11' /><input min='2020-W10' max='2020-W20' value='2020-W12' step='5' /><input min='2020-W10' max='2020-W20' value='2020-W12' step='6' />",
        query: "input:in-range",
        results: ["<input min='2020-W10' max='2020-W20' value='2020-W12' step='6' />"],
    },
    {
        html: "<input min='10:00' max='11:00' value='12:00' /><input min='10:00' max='11:00' value='11:01' /><input min='10:00' max='11:00' value='09:01' /><input min='05:00' max='06:00' value='05:50' />",
        query: "input:in-range",
        results: ["<input min='05:00' max='06:00' value='05:50' />"],
    },
    {
        html: "<input min='2020-01' max='2020-12' value='2021-01' /><input min='2020-01' max='2020-12' value='2020-05' />",
        query: "input:in-range",
        results: ["<input min='2020-01' max='2020-12' value='2020-05' />"],
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
        html: "<input minlength='3' maxlength='5' value='aaaa' /><input minlength='3' value='aaaa' /><input maxlength='5' value='aaaa' /><input minlength='3' maxlength='5' value='aaaaaa' />",
        query: "input:invalid",
        results: ["<input minlength='3' maxlength='5' value='aaaaaa' />"],
    },
    {
        html: "<div><p /><span></span></div>",
        query: "*:last-child",
        results: ["<div><p /><span></span></div>", "<span></span>"],
    },
    {
        html: "<div><span /><span></span></div>",
        query: "span:last-of-type",
        results: ["<span></span>"]
    },
    {
        html: "<div><p /><span /><span /></div><div><p /><p /></div>",
        query: "p:only-of-type",
        results: ["<p />"],
    },
    {
        html: "<div><p /></div><div><p /><p /></div>",
        query: "p:only-child",
        results: ["<p />"],
    },
    {
        html: "<input required /><input />",
        query: "input:optional",
        results: ["<input />"],
    },
    {
        html: "<input min='1' max='2' value='3' /><input min='1' value='2' /><input min='1' max='5' value='4' /><input max='6' value='5' />",
        query: "input:out-of-range",
        results: ["<input min='1' max='2' value='3' />"],
    },
    {
        html: "<input min='2020-01-01' max='2020-12-31' value='2021-01-01' /><input min='2020-01-01' max='2020-12-31' value='2020-05-01' />",
        query: "input:out-of-range",
        results: ["<input min='2020-01-01' max='2020-12-31' value='2021-01-01' />"],
    },
    {
        html: "<input min='2020-01-01' max='2020-12-31' value='2021-01-01' /><input min='2020-01-01' max='2020-12-31' value='2020-05-01' step='2' /><input min='2020-01-01' max='2020-12-31' value='2020-05-02' step='2' />",
        query: "input:out-of-range",
        results: ["<input min='2020-01-01' max='2020-12-31' value='2021-01-01' />", "<input min='2020-01-01' max='2020-12-31' value='2020-05-01' step='2' />"],
    },
    {
        html: "<input min='2020-01-01T20:00' max='2020-12-31T21:00' value='2020-12-31T22:00' /><input min='2020-01-01T20:00' max='2020-12-31T21:00' value='2020-12-31T19:00' />",
        query: "input:out-of-range",
        results: ["<input min='2020-01-01T20:00' max='2020-12-31T21:00' value='2020-12-31T22:00' />"],
    },
    {
        html: "<input min='2020-01-01T20:00' max='2020-12-31T21:00' value='2020-12-31T22:00' /><input min='2020-01-01T20:00' max='2020-12-31T21:00' value='2020-12-31T19:01' step='2' /><input min='2020-01-01T20:00' max='2020-12-31T21:00' value='2020-12-31T19:00' step='2' />",
        query: "input:out-of-range",
        results: ["<input min='2020-01-01T20:00' max='2020-12-31T21:00' value='2020-12-31T22:00' />", "<input min='2020-01-01T20:00' max='2020-12-31T21:00' value='2020-12-31T19:01' step='2' />"],
    },
    {
        html: "<input min='2020-W10' max='2020-W20' value='2020-W21' /><input min='2020-W10' max='2020-W20' value='2021-W11' /><input min='2020-W10' max='2020-W20' value='2020-W12' />",
        query: "input:out-of-range",
        results: ["<input min='2020-W10' max='2020-W20' value='2020-W21' />", "<input min='2020-W10' max='2020-W20' value='2021-W11' />"],
    },
    {
        html: "<input min='2020-W10' max='2020-W20' value='2020-W21' /><input min='2020-W10' max='2020-W20' value='2021-W11' /><input min='2020-W10' max='2020-W20' value='2020-W12' step='5' /><input min='2020-W10' max='2020-W20' value='2020-W12' step='6' />",
        query: "input:out-of-range",
        results: ["<input min='2020-W10' max='2020-W20' value='2020-W21' />", "<input min='2020-W10' max='2020-W20' value='2021-W11' />", "<input min='2020-W10' max='2020-W20' value='2020-W12' step='5' />"],
    },
    {
        html: "<input min='10:00' max='11:00' value='12:00' /><input min='10:00' max='11:00' value='11:01' /><input min='10:00' max='11:00' value='09:01' /><input min='05:00' max='06:00' value='05:50' />",
        query: "input:out-of-range",
        results: ["<input min='10:00' max='11:00' value='12:00' />", "<input min='10:00' max='11:00' value='11:01' />", "<input min='10:00' max='11:00' value='09:01' />"],
    },
    {
        html: "<input min='2020-01' max='2020-12' value='2021-01' /><input min='2020-01' max='2020-12' value='2020-05' />",
        query: "input:out-of-range",
        results: ["<input min='2020-01' max='2020-12' value='2021-01' />"],
    },
    {
        html: "<input readonly /><input />",
        query: "input:read-only",
        results: ["<input readonly />"],
    },
    {
        html: "<input readonly /><input />",
        query: "input:read-write",
        results: ["<input />"],
    },
    {
        html: "<input required /><input />",
        query: "input:required",
        results: ["<input required />"],
    },
    {
        html: "<body><div /></body>",
        query: ":root",
        results: ["<body><div /></body>"],
    },
    {
        html: "<input value='Hello' pattern='Wo?rld' /><input value='Wrld' pattern='Wo?rld' />",
        query: "input:valid",
        results: ["<input value='Wrld' pattern='Wo?rld' />"],
    },
    {
        html: "<input value='Hello' required /><input value='' required /><input value required /><input required />",
        query: "input:valid",
        results: ["<input value='Hello' required />"],
    },
    {
        html: "<input min='1' max='2' value='3' /><input min='1' value='2' /><input min='1' max='5' value='4' /><input max='6' value='5' />",
        query: "input:valid",
        results: ["<input min='1' value='2' />", "<input min='1' max='5' value='4' />", "<input max='6' value='5' />"],
    },
    {
        html: "<input min='1' value='2' step='3' /><input min='1' max='5' value='4' step='2' /><input max='6' value='5' step='1' />",
        query: "input:valid",
        results: ["<input min='1' max='5' value='4' step='2' />", "<input max='6' value='5' step='1' />"],
    },
    {
        html: "<input minlength='3' maxlength='5' value='aaaa' /><input minlength='3' value='aaaa' /><input maxlength='5' value='aaaa' /><input minlength='3' maxlength='5' value='aaaaaa' />",
        query: "input:valid",
        results: ["<input minlength='3' maxlength='5' value='aaaa' />", "<input minlength='3' value='aaaa' />", "<input maxlength='5' value='aaaa' />"],
    },
    {
        html: "<div><h1 /><h2 /><h3 /><h4 /><h5 /><h6 /><p></p></div>",
        query: ":header",
        results: ["<h1 />", "<h2 />", "<h3 />", "<h4 />", "<h5 />", "<h6 />"],
    },
    {
        html: "<div><input type='image' /><p /></div>",
        query: ":image",
        results: ["<input type='image' />"],
    },
    {
        html: "<div><input /><button></button><textarea></textarea><select><option value='1'>selected</option></select><p /></div>",
        query: ":input",
        results: ["<input />", "<button></button>", "<textarea></textarea>", "<select><option value='1'>selected</option></select>"],
    },
    {
        html: "<input type='password' /><input />",
        query: "input:password",
        results: ["<input type='password' />"],
    },
    {
        html: "<input type='radio' /><input />",
        query: "input:radio",
        results: ["<input type='radio' />"],
    },
    {
        html: "<button type='reset' /><button />",
        query: "button:reset",
        results: ["<button type='reset' />"],
    },
    {
        html: "<button type='submit' /><button type='reset' />",
        query: "button:submit",
        results: ["<button type='submit' />"],
    },
    {
        html: "<input type='text' /><input />",
        query: "input:text",
        results: ["<input type='text' />"],
    },
    {
        html: "<div /><p />",
        query: ":not(div)",
        results: ["<p />"],
    },
    {
        html: "<div id='1' /><div id='2' />",
        query: "div:not([id='1'])",
        results: ["<div id='2' />"],
    },
    {
        html: "<input readonly /><input />",
        query: "input:not(:read-write)",
        results: ["<input readonly />"],
    },
    {
        html: "<div id='3' /><div id='1' /><div id='2' />",
        query: "div:not([id='1'])",
        results: ["<div id='3' />", "<div id='2' />"],
    },
    {
        html: "<div id='3' /><div id='id1' /><div id='2' />",
        query: "div:not(#id1)",
        results: ["<div id='3' />", "<div id='2' />"],
    },
    {
        html: "<div class='hello' /><div class='world' />",
        query: "div:not(.world)",
        results: ["<div class='hello' />"],
    },
    {
        html: `<a href="#">Not this</a><svg width="250px" viewBox="0 0 250 20" xmlns="http://www.w3.org/2000/svg"><a href="#" /></svg>`,
        query: ":not(svg|a)",
        results: [`<a href="#">Not this</a>`, `<svg width="250px" viewBox="0 0 250 20" xmlns="http://www.w3.org/2000/svg"><a href="#" /></svg>`],
        namespaces: {
            svg: "http://www.w3.org/2000/svg",
        },
    },
    {
        html: "<ul><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li><li>7</li></ul>",
        query: ":nth-child(2)",
        results: ["<li>2</li>"],
    },
    {
        html: "<ul><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li><li>7</li></ul>",
        query: ":nth-child(even)",
        results: ["<li>2</li>", "<li>4</li>", "<li>6</li>"],
    },
    {
        html: "<ul><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li><li>7</li></ul>",
        query: "li:nth-child(odd)",
        results: ["<li>1</li>", "<li>3</li>", "<li>5</li>", "<li>7</li>"],
    },
    {
        html: "<ul><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li><li>7</li></ul>",
        query: "li:nth-child(-n + 3)",
        results: ["<li>1</li>", "<li>2</li>", "<li>3</li>"]
    },
    {
        html: "<ul><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li><li>7</li></ul>",
        query: "li:nth-child(2n)",
        results: ["<li>2</li>", "<li>4</li>", "<li>6</li>"]
    },
    {
        html: "<ul><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li><li>7</li></ul>",
        query: "li:nth-child(2n + 1)",
        results: ["<li>1</li>", "<li>3</li>", "<li>5</li>", "<li>7</li>"]
    },
    {
        html: "<ul><li>1</li><li>2</li><li class='important'>3</li><li>4</li><li>5</li><li class='important'>6</li><li>7</li></ul>",
        query: "li:nth-child(2n + 1 of li.important)",
        results: ["<li class='important'>3</li>"]
    },
    {
        html: "<ul><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li><li>7</li></ul>",
        query: "li:nth-child(n + 5)",
        results: ["<li>5</li>", "<li>6</li>", "<li>7</li>"]
    },
    {
        html: "<ul><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li><li>7</li></ul>",
        query: "li:nth-child(n)",
        results: ["<li>1</li>", "<li>2</li>", "<li>3</li>", "<li>4</li>", "<li>5</li>", "<li>6</li>", "<li>7</li>"]
    },
    {
        html: "<ul><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li><li>7</li></ul>",
        query: "li:nth-child(n + 2)",
        results: ["<li>2</li>", "<li>3</li>", "<li>4</li>", "<li>5</li>", "<li>6</li>", "<li>7</li>"]
    },
    {
        html: "<ul><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li><li>7</li></ul>",
        query: "li:nth-child(n + 2):nth-child(-n + 3)",
        results: ["<li>2</li>", "<li>3</li>", "<li>4</li>"]
    },
    {
        html: "<ul><li>1</li><div /><li>2</li><li>3</li><div /><li>4</li><li>5</li><li>6</li><p /><li>7</li></ul>",
        query: "li:nth-of-type(2n + 1)",
        results: ["<li>1</li>", "<li>3</li>", "<li>5</li>", "<li>7</li>"]
    },
    {
        html: "<ul><li>1</li><div /><li>2</li><li>3</li><div /><li>4</li><li>5</li><li>6</li><p /><li>7</li></ul>",
        query: "li:nth-of-type(-n + 3)",
        results: ["<li>1</li>", "<li>2</li>", "<li>3</li>"]
    },
    {
        html: "<ul><li>1</li><div /><li>2</li><li>3</li><div /><li>4</li><li>5</li><li>6</li><p /><li>7</li></ul>",
        query: "div:nth-of-type(-n + 3)",
        results: ["<div />", "<div />"]
    },
    {
        html: "<ul><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li><li>7</li></ul>",
        query: "li:nth-last-child(-n + 3)",
        results: ["<li>5</li>", "<li>6</li>", "<li>7</li>"]
    },
    {
        html: "<ul><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li><li>7</li></ul>",
        query: "li:nth-last-child(even)",
        results: ["<li>1</li>", "<li>3</li>", "<li>5</li>", "<li>7</li>"]
    },
    {
        html: "<ul><li>1</li><div /><li>2</li><li>3</li><div /><li>4</li><li>5</li><li>6</li><p /><li>7</li></ul>",
        query: "li:nth-last-of-type(-n + 3)",
        results: ["<li>5</li>", "<li>6</li>", "<li>7</li>"]
    },
    {
        html: "<ul><li lang='en-US'>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li><li>7</li></ul>",
        query: "li:lang(en-US)",
        results: ["<li lang='en-US'>1</li>"]
    },
    {
        html: "<ul><li>1</li><div /><li>2</li><li>3</li><div /><li>4</li><li>5</li><li>6</li><p /><li>7</li></ul>",
        query: "li:eq(0)",
        results: ["<li>1</li>"]
    },
    {
        html: "<ul><li>1</li><div /><li>2</li><li>3</li><div /><li>4</li><li>5</li><li>6</li><p /><li>7</li></ul>",
        query: "li:eq(-1)",
        results: ["<li>7</li>"]
    },
    {
        html: "<ul><li>1</li><div /><li>2</li><li>3</li><div /><li>4</li><li>5</li><li>6</li><li>67</li><p /><li>7<p>6</p></li></ul>",
        query: "li:contains(6)",
        results: ["<li>6</li>", "<li>67</li>", "<li>7<p>6</p></li>"]
    },
    {
        html: "<p><article /></p><div><article /></div><p><span /></p><div><span /></div><p><ul /></p><div><ul /></div><quote><article /></quote><h1><span id='1' /></h1>",
        query: ":is(p, div) :is(article, span)",
        results: ["<article />", "<article />", "<span />", "<span />"],
    },
    {
        html: "<p><article /></p><div><article /></div><p><span /></p><div><span /></div><p><ul /></p><div><ul /></div><quote><article /></quote><h1><span id='1' /></h1>",
        query: ":where(p, div) :where(article, span)",
        results: ["<article />", "<article />", "<span />", "<span />"],
    },
    {
        html: `
        <!DOCTYPE html>
        <html>
            <head>
                <title>Title</title>
            </head>
            <body>
                <div id='1' />
                <div id='2' />
                <p>
                    <div class='one' />
                </p>
                <ul>
                    <li>item</li>
                    <li><ol id='shallow'><li><div id='deep'>item</div></li></ol></li>
                </ul>
                <article>Lorem ipsum <span> <img /> </span> <!-- this is a comment --></article>
                <h1 style='position: fixed'>Hello</h1>
                <h2 style='height: 50%'>Hello</h2>
                <h3><div id='three' /></h3>
                <input type='text' style='width: 100px' />
            </body>
        </html> 
        `,
        query: "ul,ol",
        results: [`<ul><li>item</li><li><ol id='shallow'><li><div id='deep'>item</div></li></ol></li></ul>`, "<ol id='shallow'><li><div id='deep'>item</div></li></ol>"],
    },
    {
        html: `
        <!DOCTYPE html>
        <html>
            <head>
                <title>Title</title>
            </head>
            <body>
                <div id='1' />
                <div id='2' />
                <p>
                    <div class='one' />
                </p>
                <ul>
                    <li>item</li>
                    <li><ol id='shallow'><li><div id='deep'>item</div></li></ol></li>
                </ul>
                <article>Lorem ipsum <span> <img /> </span> <!-- this is a comment --></article>
                <h1 style='position: fixed'>Hello</h1>
                <h2 style='height: 50%'>Hello</h2>
                <h3><div id='three' /></h3>
                <input type='text' style='width: 100px' />
            </body>
        </html> 
        `,
        query: "ol",
        results: ["<ol id='shallow'><li><div id='deep'>item</div></li></ol>"],
    },
    {
        html: `
        <!DOCTYPE html>
        <html>
            <head>
                <title>Title</title>
            </head>
            <body>
                <div id='1' />
                <div id='2' />
                <p>
                    <div class='one' />
                </p>
                <ul>
                    <li>item</li>
                    <li><ol id='shallow'><li><div id='deep'>item</div></li></ol></li>
                </ul>
                <article>Lorem ipsum <span> <img /> </span> <!-- this is a comment --></article>
                <h1 style='position: fixed'>Hello</h1>
                <h2 style='height: 50%'>Hello</h2>
                <h3><div id='three' /></h3>
                <input type='text' style='width: 100px' />
            </body>
        </html> 
        `,
        query: "ul",
        results: [`<ul><li>item</li><li><ol id='shallow'><li><div id='deep'>item</div></li></ol></li></ul>`],
    },
    {
        html: "<div id='1' /><div id='2' />",
        query: "[id='1'],[id='2']",
        results: ["<div id='1' />", "<div id='2' />"]
    },
    {
        html: "<div id='1' /><div id='2' />",
        query: `[id="1"],[id="2"]`,
        results: ["<div id='1' />", "<div id='2' />"]
    },
    {
        html: "<div id='1' /><div id='2' />",
        query: `[id=1],[id=2]`,
        results: ["<div id='1' />", "<div id='2' />"]
    },
    {
        html: "<div id='1' /><div id='2' />",
        query: "[id='1'],[id='2']",
        results: ["<div id='1' />", "<div id='2' />"]
    },
    {
        html: "<div id='1' /><div id='2' />",
        query: "[id='2']",
        results: ["<div id='2' />"]
    },
    {
        html: "<div id='1' /><div id='2' />",
        query: "[id='1']",
        results: ["<div id='1' />"]
    }
];

describe("Can successfully match query to DOM", () => {
    matches.forEach((match) => {
        it(`Matches ${match.query} to ${match.html.slice(0, 10)}... with ${match.results.length} results`, () => {
            expect(testMatch(match.html, match.query, match.namespaces)).toEqual(match.results);
        });
    });
});