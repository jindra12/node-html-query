import { htmlParser } from "../src/parser";
import { parserItemToString } from "../src/utils";

const getHtmlElement = (element: string) => {
    const html = htmlParser(element);
    return html.children()[0];
};

describe("Test methods of HTML represention", () => {
    const attributeExamples = ["<div id='1' />", "<script />", "<style />", "<script>function(){}</script>", "<style>.clas { position: fixed; }</style>"];
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
    });
});