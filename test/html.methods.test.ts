import { htmlParser } from "../src/parser";
import { parserItemToString } from "../src/utils";

const getHtmlElement = (element: string) => {
    const html = htmlParser(element);
    return html.children()[0];
};

describe("Test methods of HTML represention", () => {
    const attributeExamples = ["<div id='1' />", "<script id='1' />", "<style id='1' />", "<script id='1'>function(){}</script>", "<style id='1'>.clas { position: fixed; }</style>"];
    attributeExamples.forEach((example) => {
        it(`${example} - Can read HTML attributes`, () => {
            const html = getHtmlElement(example);
            expect(html.attributes()["id"]).toBe("1");
        });
        it(`${example} - Can add HTML attributes`, () => {
            const html = getHtmlElement(example);
            html.addAttribute("class", "classname");
            expect(html.attributes()["class"]).toBe("classname");
        });
        it(`${example} - Can modify HTML attributes`, () => {
            const html = getHtmlElement(example);
            html.modifyAttribute("id", (id) => {
                return (parseInt(id || "") + 1).toString();
            })
            expect(html.attributes()["id"]).toBe("2");
        });
        it(`${example} - Can remove HTML attributes`, () => {
            const html = getHtmlElement(example);
            html.removeAttribute("id");
            expect(html.attributes()["id"]).toBeFalsy();
        });
    });
    it("Can add children", () => {
        const html = getHtmlElement("<div />");
        html.addChild(getHtmlElement("<br />"));
        html.addChild(getHtmlElement("<p>Hello?</p>"), 0);
        expect(parserItemToString(html)).toBe("<div><p>Hello?</p><br /></div>");
    });
    it("Can remove children", () => {
        const html = getHtmlElement("<div><br /><p></p><h1>Hello</h1></div>");
        html.removeChild(0);
        expect(parserItemToString(html)).toBe("<div><p></p><h1>Hello</h1></div>");
        const h1 = html.children()[1];
        html.removeChild(h1);
        expect(parserItemToString(html)).toBe("<div><p></p></div>");
    });
    it("Can replace children", () => {
        const html = getHtmlElement("<div><h1>Hello</h1><h2>Hello</h2></div>");
        const h2 = html.children()[1];
        html.replaceChild(h2, getHtmlElement("<h3>World</h3>"));
        html.replaceChild(0, getHtmlElement("<h2>Hello </h2>"));
        expect(parserItemToString(html)).toBe("<div><h2>Hello </h2><h3>World</h3></div>");
    });
    it("Can determine siblings", () => {
        const body = getHtmlElement("<body><div id='1' /><div id='2' /><div id='3' /></body>");
        const id2 = body.children()[1];
        expect(body.nextSibling(id2)?.attributes()["id"]).toEqual("3");
        expect(body.prevSibling(id2)?.attributes()["id"]).toEqual("1");
    });
    it("HTML document can add children", () => {
        const html = htmlParser("<body></body>");
        html.children()[0].addChild(getHtmlElement("<div />"));
        expect(parserItemToString(html)).toBe("<body><div /></body>");
    });
    it("HTML document can remove children", () => {
        const html = htmlParser("<body><h1>First</h1><h2>Second</h2><h3>Third</h3></body>");
        const h2 = html.children()[0].children()[1];
        html.children()[0].removeChild(0);
        html.children()[0].removeChild(h2);
        expect(parserItemToString(html)).toBe("<body><h3>Third</h3></body>");
    });
    it("HTML document can replace children", () => {
        const html = htmlParser("<body><h1>First</h1><h2>Second</h2><h3>Third</h3></body>");
        const h2 = html.children()[0].children()[1];
        html.children()[0].replaceChild(0, getHtmlElement("<h4>Fourth</h4>"));
        html.children()[0].replaceChild(h2, getHtmlElement("<h5>Fifth</h5>"));
        expect(parserItemToString(html)).toBe("<body><h4>Fourth</h4><h5>Fifth</h5><h3>Third</h3></body>");
    });
    it("HTML document has working cache", () => {
        const html = htmlParser("<body><div><h1>Hello?</h1></div></body>");
        expect(html.cache.descendants.invalid).toBeTruthy();
        expect(html.cache.children.invalid).toBeTruthy();
        expect(html.cache.indexes.invalid).toBeTruthy();
        expect(html.descendants().map(parserItemToString)).toEqual(["<body><div><h1>Hello?</h1></div></body>", "<div><h1>Hello?</h1></div>", "<h1>Hello?</h1>"])
        expect(html.cache.descendants.invalid).toBeFalsy();
        expect(html.cache.children.invalid).toBeFalsy();
        html.addChild(getHtmlElement("<div />"));
        expect(html.cache.descendants.invalid).toBeTruthy();
        expect(html.cache.children.invalid).toBeTruthy();
        expect(html.cache.indexes.invalid).toBeTruthy();
        expect(html.descendants().map(parserItemToString)).toEqual(["<body><div><h1>Hello?</h1></div></body>", "<div />", "<div><h1>Hello?</h1></div>", "<h1>Hello?</h1>"]);
        expect(html.cache.descendants.invalid).toBeFalsy();
        expect(html.cache.children.invalid).toBeFalsy();
        html.removeChild(1);
        expect(html.cache.descendants.invalid).toBeTruthy();
        expect(html.cache.children.invalid).toBeTruthy();
        expect(html.cache.indexes.invalid).toBeTruthy();
        expect(html.descendants().map(parserItemToString)).toEqual(["<body><div><h1>Hello?</h1></div></body>", "<div><h1>Hello?</h1></div>", "<h1>Hello?</h1>"]);
        expect(html.cache.descendants.invalid).toBeFalsy();
        expect(html.cache.children.invalid).toBeFalsy();
        html.replaceChild(0, getHtmlElement("<body><h2></h2></body>"));
        expect(html.cache.descendants.invalid).toBeTruthy();
        expect(html.cache.children.invalid).toBeTruthy();
        expect(html.cache.indexes.invalid).toBeTruthy();
        expect(html.descendants().map(parserItemToString)).toEqual(["<body><h2></h2></body>", "<h2></h2>"]);
        expect(html.cache.descendants.invalid).toBeFalsy();
        expect(html.cache.children.invalid).toBeFalsy();
    });
    it("HTML document can determine siblings", () => {
        const html = htmlParser("<body><div id='1' /><div id='2' /><div id='3' /></body>");
        const id2 = html.children()[0].children()[1];
        expect(html.children()[0].nextSibling(id2)?.attributes()["id"]).toEqual("3");
        expect(html.children()[0].prevSibling(id2)?.attributes()["id"]).toEqual("1");
    });
    it("HTML element has working cache", () => {
        const element = getHtmlElement("<div><h1>Hello?</h1></div>");
        expect(element.cache.attributes.invalid).toBeTruthy();
        expect(element.cache.styles.invalid).toBeTruthy();
        element.addAttribute("id", "1");
        expect(element.attributes()).toEqual({ id: "1" });
        expect(element.cache.attributes.invalid).toBeFalsy();
        element.modifyStyle("position", () => "fixed");
        expect(element.cache.attributes.invalid).toBeTruthy();
        expect(element.cache.styles.invalid).toBeTruthy();
        expect(element.getStyles()).toEqual({ position: "fixed" });
        expect(element.cache.styles.invalid).toBeFalsy();
        element.modifyStyle("position", (position) => position === "fixed" ? "relative" : "absolute");
        expect(element.cache.styles.invalid).toBeTruthy();
        expect(element.getStyles()).toEqual({ position: "relative" });
        expect(element.cache.styles.invalid).toBeFalsy();
    });
    it("HTML element does not have itself within its descendants", () => {
        const element = getHtmlElement(`<svg width="250px" viewBox="0 0 250 20" xmlns="http://www.w3.org/2000/svg"><a href="#" /></svg>`);
        expect(element.descendants().every((d) => d.identifier !== element.identifier)).toBe(true);
    })
});