import fs from "fs";
import path from "path";
import { Query } from "../src/query";
import { parseLexer, parsedHtmlLexer } from "../src/parser";

const files = {
    "developer.mozilla.org.html": fs.readFileSync(path.join(__dirname, "developer.mozilla.org.html"), { encoding: "utf-8" }),
    "jsdom.html": fs.readFileSync(path.join(__dirname, "jsdom.html"), { encoding: "utf-8" }),
    "wikipedia.html": fs.readFileSync(path.join(__dirname, "wikipedia.html"), { encoding: "utf-8" }),
    "webpack.html": fs.readFileSync(path.join(__dirname, "webpack.html"), { encoding: "utf-8" }),
};

const parseQueue = (input: string) => parseLexer(input, parsedHtmlLexer, false).queue;

describe("Can parse and query full html file", () => {
    Object.entries(files).forEach(([fileName, file]) => {
        it(`Can transcribe the whole file in lexer and return it back - ${fileName}`, () => {
            expect(parseQueue(file).map((item) => item.value).join("")).toEqual(file);
        });
        it(`Parses whole file without throwing - ${fileName}`, () => {
            expect(() => Query(file)).not.toThrow();
        });
    });
    it("Can parse and query a complex html file", () => {
        const $ = Query(files["developer.mozilla.org.html"]);
        expect($("div").length).toEqual(142);
        expect($("header h1").text()).toEqual(":nth-child()");
        expect($("a")[0].attr("href")).toEqual("#content");
        expect($("#mozilla-footer-logo-svg").text()).toEqual("Mozilla logo");
    });
});