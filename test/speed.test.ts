import { performance } from "perf_hooks";
import path from "path";
import fs from "fs";
import jsdom from "jsdom";
import jQuery from "jquery";
import { Query } from "../src";

import v8Profiler from 'v8-profiler-next';
v8Profiler.setGenerateType(1);

const file = fs.readFileSync(path.join(__dirname, "developer.mozilla.org.html"), { encoding: "utf-8" });
const smallExample = "<div class='toggle'><a class='toggle' /><div class='apis-link-container'><div class='submenu-icon' /><div class='submenu-item-heading'>Hello</div></div></div>"

interface Test {
    name: string;
    html: string;
    query: (query: ReturnType<typeof Query>) => any;
}

const tests: Test[] = [
    {
        name: "big-find-div",
        html: file,
        query: $ => $("div"),
    },
    {
        name: "big-find-toggle",
        html: file,
        query: $ => $(".toggle"),
    },
    {
        name: "big-append-div",
        html: file,
        query: $ => $("div").append("<p>Appended to div!</p>"),
    },
    {
        name: "big-append-toggle",
        html: file,
        query: $ => $(".toggle").append("<p>Appended to div!</p>"),
    },
    {
        name: "big-a-toggle",
        html: file,
        query: $ => $("a.toggle"),
    },
    {
        name: "big-level-3",
        html: file,
        query: $ => $(".apis-link-container .submenu-icon .submenu-item-heading")
    },
    {
        name: "small-find-div",
        html: smallExample,
        query: $ => $("div"),
    },
    {
        name: "small-toggle",
        html: smallExample,
        query: $ => $(".toggle"),
    },
    {
        name: "small-append-div",
        html: smallExample,
        query: $ => $("div").append("<p>Appended to div!</p>"),
    },
    {
        name: "small-append-toggle",
        html: smallExample,
        query: $ => $(".toggle").append("<p>Appended to div!</p>"),
    },
    {
        name: "small-a-toggle",
        html: smallExample,
        query: $ => $("a.toggle"),
    },
    {
        name: "small-level-3",
        html: smallExample,
        query: $ => $(".apis-link-container .submenu-icon .submenu-item-heading")
    }
];

const profilePath = path.join(__dirname, "..", "profile");

if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath);   
}

const runTest = (test: Test, iterations = 5) => {
    const runConditionalProfile = (measure: boolean) => {
        const ourTitle = `my-speed-test-${test.name}`;
        const theirTitle = `their-speed-test-${test.name}`;

        const testPath = path.join(__dirname, "..", "profile", test.name);

        if (!fs.existsSync(testPath)) {
            fs.mkdirSync(testPath);
        }

        if (measure) {
            v8Profiler.startProfiling(ourTitle, true);
        }
        const beforeMine = performance.now();
        for (let i = 0; i < iterations; i++) {
            const my$ = Query(test.html);
            test.query(my$);
        }
        const afterMine = performance.now();
        if (measure) {
            const myProfile = v8Profiler.stopProfiling(ourTitle);
            myProfile.export((_, result: any) => {
                fs.writeFileSync(path.join(__dirname, "..", "profile", test.name, `my.cpuprofile`), result);
                myProfile.delete();
            });
        }
    
        const mine = afterMine - beforeMine;
        if (measure) {
            v8Profiler.startProfiling(theirTitle, true);
        }
        const beforeTheirs = performance.now();
        for (let i = 0; i < iterations; i++) {
            const dom = new jsdom.JSDOM(test.html);
            const their$ = jQuery(dom.window);
            test.query((their$ as any));
        }
        const afterTheirs = performance.now();
        if (measure) {
            const theirProfile = v8Profiler.stopProfiling(theirTitle);
            theirProfile.export((_, result: any) => {
                fs.writeFileSync(path.join(__dirname, "..", "profile", test.name, `their.cpuprofile`), result);
                theirProfile.delete();
            });
        }

        const theirs = afterTheirs - beforeTheirs;

        if (!measure) {
            console.log(`faster ${test.name} than theirs by ${Math.round(100 * (theirs - mine) / theirs)}%`);
            expect(mine).toBeLessThan(theirs);
        }
    };
    // runConditionalProfile(true);
    it(`Has faster ${test.name} than competitors`, () => {
        runConditionalProfile(false);
    });
};

describe("Node-html should be faster than jQuery with JSDOM", () => {
    it("Won't crash when I run my test 30", () => {
        for (let i = 0; i < 30; i++) {
            tests[0].query(Query(file));
        }
    });
    it("Has faster initialization time than competition", () => {
        const beforeMine = performance.now();
        for (let i = 0; i < 5; i++) {
            Query(file);
        }
        const afterMine = performance.now();
        const mine = afterMine - beforeMine;

        const beforeTheirs = performance.now();
        for (let i = 0; i < 5; i++) {
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