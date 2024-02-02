import { performance } from "perf_hooks";
import path from "path";
import fs from "fs";
import jsdom from "jsdom";
import jQuery from "jquery";
import { Query } from "../src";

import v8Profiler from 'v8-profiler-next';
v8Profiler.setGenerateType(1);
const ourTitle = "my-speed-test";
const theirTitle = "their-speed-test";

const file = fs.readFileSync(path.join(__dirname, "developer.mozilla.org.html"), { encoding: "utf-8" });
const iterations = 5;
const my$ = Query(file);
const dom = new jsdom.JSDOM(file);
const their$ = jQuery(dom.window);

describe("Node-html should be faster than jQuery with JSDOM", () => {
    it("Has faster initialization time than competition", () => {
        const beforeMine = performance.now();
        for (let i = 0; i < iterations; i++) {
            Query(file);
        }
        const afterMine = performance.now();
        const mine = afterMine - beforeMine;

        const beforeTheirs = performance.now();
        for (let i = 0; i < iterations; i++) {
            const dom = new jsdom.JSDOM(file);
            jQuery(dom.window);
        }
        const afterTheirs = performance.now();
        const theirs = afterTheirs - beforeTheirs;

        console.log(`faster init than theirs by ${Math.round(100 * (theirs - mine) / theirs)}%`)
        expect(mine).toBeLessThan(theirs);
    });
    it("Has faster DOM find", () => {
        v8Profiler.startProfiling(ourTitle, true);
        const beforeTheirs = performance.now();
        for (let i = 0; i < iterations; i++) {
            (their$ as any)("div");
        }
        const afterTheirs = performance.now();
        const theirProfile = v8Profiler.stopProfiling(ourTitle);
        theirProfile.export((_, result: any) => {
            fs.writeFileSync(`${theirTitle}.cpuprofile`, result);
            theirProfile.delete();
        });

        const theirs = afterTheirs - beforeTheirs;

        v8Profiler.startProfiling(ourTitle, true);
        const beforeMine = performance.now();
        for (let i = 0; i < iterations; i++) {
            my$("div");
        }
        const afterMine = performance.now();
        const myProfile = v8Profiler.stopProfiling(ourTitle);
        myProfile.export((_, result: any) => {
            fs.writeFileSync(`${ourTitle}.cpuprofile`, result);
            myProfile.delete();
        });
    
        const mine = afterMine - beforeMine;

        console.log(`faster find than theirs by ${Math.round(100 * (theirs - mine) / theirs)}%`);
        expect(mine).toBeLessThan(theirs);

        expect(my$("div").length).toEqual(142);
        expect(their$.find("div").length).toEqual(142);
    });
    it("Has faster DOM alter", () => {
        const beforeMine = performance.now();
        for (let i = 0; i < iterations; i++) {
            my$("div").append("<p>Appended to div!</p>"); 
        }
        const afterMine = performance.now();
        const mine = afterMine - beforeMine;

        const beforeTheirs = performance.now();
        for (let i = 0; i < iterations; i++) {
            (their$ as any)("div").append("<p>Appended to div!</p>"); 
        }
        const afterTheirs = performance.now();
        const theirs = afterTheirs - beforeTheirs;

        console.log(`faster append than theirs by ${Math.round(100 * (theirs - mine) / theirs)}%`);
        expect(mine).toBeLessThan(theirs);

        expect(my$("div").length).toEqual(142);
        expect(their$.find("div").length).toEqual(142);
    });
});