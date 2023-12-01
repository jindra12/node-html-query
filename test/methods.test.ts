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
        expect($().add("div:first-child").add("<div />").add("<p />").print()).toEqual("<div id='1' /><div /><p />");
        expect($().add("div:first-child", $("p"))).toEqual("<div class='one' />");
    }],
    addBack: [
        
    ],
    addClass: [],
    after: [],
    append: [],
    appendTo: [],
    attr: [],
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