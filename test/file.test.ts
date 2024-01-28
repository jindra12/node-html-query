import fs from "fs";
import path from "path";
import { Query } from "../src/query";
import { parseLexer, parsedHtmlLexer } from "../src/parser";

const file = fs.readFileSync(path.join(__dirname, "developer.mozilla.org.html"), { encoding: "utf-8" });

const parseQueue = (input: string) => parseLexer(input, parsedHtmlLexer).queue;

describe("Can parse and query full html file", () => {
    it("Can transcribe the whole file in lexer and return it back", () => {
        expect(parseQueue(file).map((item) => item.value).join("")).toEqual(file);
    });
    it("Can parse a complex html file", () => {
        const $ = Query(file);
        expect($("div").length).toEqual(142);
        expect($("header h1").text()).toEqual(":nth-child()");
        expect($("a")[0].attr("href")).toEqual("#content");
        expect($("#mozilla-footer-logo-svg").text()).toEqual("Mozilla logo");
    });
});