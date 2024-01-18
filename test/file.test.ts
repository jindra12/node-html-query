import fs from "fs";
import path from "path";
import { Query } from "../src/query";

const file = fs.readFileSync(path.join(__dirname, "test", "developer.mozilla.org.html"), { encoding: "utf-8" });

describe("Can parse and query full html file", () => {
    it("Can parse a complex html file", () => {
        const $ = Query(file);
        expect($("div").length).toEqual(273);
        expect($("header h1").text()).toEqual(":nth-child()");
        expect($("a")[0].attr("href")).toEqual("https://developer.mozilla.org/en-US/docs/Web/CSS/:nth-child#content");
        expect($(".bc-head-txt-label.bc-head-icon-chrome").text()).toEqual("Chrome");
    });
});