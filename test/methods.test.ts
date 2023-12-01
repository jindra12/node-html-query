import { Query } from "../src/query";

const query = () => Query(
`
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
    </body>
</html> 
`);

const testCases: Record<keyof ReturnType<ReturnType<typeof Query>>, Array<($: ReturnType<typeof Query>) => void>> = {
    add: [($) => {
        expect($("[id='1']").add("[id='2']").add("[id='1']").print()).toEqual("<div id='1' /><div id='2' />");
        expect($().add("div:first-child").add("<div />").add("<p />").print()).toEqual("<div id='1' /><div class='one' /><div /><p />");
        expect($().add("div:first-child", $("p"))).toEqual("<div class='one' />");
    }],
    addBack: [
        ($) => {
            expect($("p").find("div").addBack().print(true)).toEqual("<p><div class='one'></p><div class='one' />");
            expect($("p").find("div").addBack(":not(div)").print(true)).toEqual("<p><div class='one'></p>");
        },
    ],
    addClass: [
        ($) => {
            expect($("[id='2']").addClass("two").print()).toEqual("<div id='2' class='two' />");
            expect($(".one").addClass((index, className) => `${className}-${index}`).print()).toEqual("<div class='one-0' />");
            expect($("[id]").addClass((_, index) => `next-${index}`).print()).toEqual("<div id='1' class='next-0' /><div id='2' class='next-1' />");
            expect($("[id]").addClass("two").print()).toEqual("<div id='1' class='two' /><div id='2' class='two' />");
        },
    ],
    after: [
        ($) => {
            $(".one").after("<p />", "<span />");
            expect($("body > p").print(true)).toEqual("<p><div class='one' /><p /><span /></p>");
        },
        ($) => {
            $(".one").after((index, html) => `<div class="hit_${index}">${html}</div>`);
            expect($(".hit_0").print()).toEqual(`<div class="hit_0"><div class='one' /></div>`);
        },
        ($) => {
            $(".one").after((index) => `<div class="hit_${index}">Random text</div>`);
            expect($(".hit_0").print()).toEqual(`<div class="hit_0">Random text</div>`);
        },
    ],
    append: [
        ($) => {
            expect($(".one").append("<p />").print()).toEqual("<div class='one'><p /></div>");
        },
        ($) => {
            expect($(".one").append("Random text").print()).toEqual("<div class='one'>Random text</div>");
        },
        ($) => {
            expect($(".one").append((index, html) => `Random text ${index} ${html}`).print()).toEqual(`<div class='one'>Random text 0 <div class='one' /></div>`);
        },
    ],
    appendTo: [
        ($) => {
            $("<p />").appendTo($(".one"));
            $("<span />").appendTo(".one");
            expect($(".one").print()).toEqual("<div class='one'><p /><span /></div>")
        },
    ],
    attr: [
        ($) => {
            expect($(".one").attr("class")).toEqual("one");
            expect($(".one").attr({
                id: "3",
                style: "position: absolute",
            }).print()).toEqual(`<div class='one' id="3" style="position: absolute" />`);
            expect($(".one").attr("id", (index, currentId) => `next_${index}_${parseInt(currentId) + 1}` ).attr("id")).toEqual("next_0_4");
        },
    ],
    before: [],
    blur: [],
    change: [],
    children: [],
    clone: [],
    closest: [],
    contextmenu: [],
    css: [],
    data: [],
    dblclick: [],
    each: [],
    empty: [],
    end: [],
    eq: [],
    even: [],
    filter: [],
    find: [],
    first: [],
    focus: [],
    focusin: [],
    focusout: [],
    get: [],
    has: [],
    hasClass: [],
    height: [],
    hide: [],
    hover: [],
    html: [],
    index: [],
    insertAfter: [],
    insertBefore: [],
    is: [],
    keydown: [],
    keypress: [],
    keyup: [],
    last: [],
    length: [],
    map: [],
    mousedown: [],
    mouseenter: [],
    mouseleave: [],
    mousemove: [],
    mouseout: [],
    mouseover: [],
    mouseup: [],
    next: [],
    nextAll: [],
    nextUntil: [],
    not: [],
    odd: [],
    off: [],
    on: [],
    once: [],
    parent: [],
    parents: [],
    parentsUntil: [],
    prepend: [],
    prependTo: [],
    prev: [],
    prevAll: [],
    prevUntil: [],
    print: [],
    pushStack: [],
    ready: [],
    reduce: [],
    remove: [],
    removeAttr: [],
    removeClass: [],
    removeData: [],
    replaceAll: [],
    replaceWith: [],
    select: [],
    siblings: [],
    slice: [],
    submit: [],
    tagName: [],
    text: [],
    toggle: [],
    toggleClass: [],
    uniqueSort: [],
    unload: [],
    unwrap: [],
    val: [],
    wrap: [],
    wrapAll: [],
    wrapInner: [],
    [Symbol.iterator]: []
};

describe("Methods of Query work as expected", () => {
    Object.entries(testCases).forEach(([method, tests]) => {
        tests.forEach((test, index) => {
            it(`Method ${method}, test n.${index} working as expected`, () => test(query()));
        })
    });
});