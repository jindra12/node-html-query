import { performance } from "perf_hooks";
import path from "path";
import fs from "fs";
import jsdom from "jsdom";
import jQuery from "jquery";
import { Query } from "../src";

import v8Profiler from 'v8-profiler-next';
v8Profiler.setGenerateType(1);

const file = fs.readFileSync(path.join(__dirname, "developer.mozilla.org.html"), { encoding: "utf-8" });
const iterations = 5;
const my$ = Query(file);
const dom = new jsdom.JSDOM(file);
const their$ = jQuery(dom.window);

interface Test {
    name: string;
    query: (query: typeof my$) => any;
}

const tests: Test[] = [
    {
        name: "find-div",
        query: $ => $("div"),
    },
    {
        name: "find-toggle",
        query: $ => $(".toggle"),
    },
    {
        name: "append-div",
        query: $ => $("div").append("<p>Appended to div!</p>"),
    },
    {
        name: "append-toggle",
        query: $ => $(".toggle").append("<p>Appended to div!</p>"),
    },
    {
        name: "a-toggle",
        query: $ => $("a.toggle"),
    },
    {
        name: "level-3",
        query: $ => $(".apis-link-container .submenu-icon .submenu-item-heading")
    }
];

const profilePath = path.join(__dirname, "..", "profile");

if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath);   
}

const runTest = (test: Test) => {
    it(`Has faster ${test.name} than competitors`, () => {
        const ourTitle = `my-speed-test-${test.name}`;
        const theirTitle = `their-speed-test-${test.name}`;

        const testPath = path.join(__dirname, "..", "profile", test.name);

        if (!fs.existsSync(testPath)) {
            fs.mkdirSync(testPath);
        }

        v8Profiler.startProfiling(ourTitle, true);
        const beforeMine = performance.now();
        for (let i = 0; i < iterations; i++) {
            test.query(my$);
        }
        const afterMine = performance.now();
        const myProfile = v8Profiler.stopProfiling(ourTitle);
        myProfile.export((_, result: any) => {
            fs.writeFileSync(path.join(__dirname, "..", "profile", test.name, `my.cpuprofile`), result);
            myProfile.delete();
        });
    
        const mine = afterMine - beforeMine;
        v8Profiler.startProfiling(theirTitle, true);
        const beforeTheirs = performance.now();
        for (let i = 0; i < iterations; i++) {
            test.query((their$ as any));
        }
        const afterTheirs = performance.now();
        const theirProfile = v8Profiler.stopProfiling(theirTitle);
        theirProfile.export((_, result: any) => {
            fs.writeFileSync(path.join(__dirname, "..", "profile", test.name, `their.cpuprofile`), result);
            theirProfile.delete();
        });

        const theirs = afterTheirs - beforeTheirs;

        console.log(`faster ${test.name} than theirs by ${Math.round(100 * (theirs - mine) / theirs)}%`);
        expect(mine).toBeLessThan(theirs);
    });
};

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
    tests.forEach(runTest);
});