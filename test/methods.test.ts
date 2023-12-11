import { Query } from "../src/query";

const query = () =>
    Query(
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
        <ul>
            <li>item</li>
            <li><ol id='shallow'><li><div id='deep'>item</div></li></ol></li>
        </ul>
        <article>Lorem ipsum <span> <img /> </span> <!-- this is a comment --></article>
        <h1 style='position: fixed'>Hello</h1>
        <h2 style='height: 50%'>Hello</h2>
        <h3><div id='three' /></h3>
    </body>
</html> 
`
    );

const testCases: Record<
    keyof ReturnType<ReturnType<typeof Query>>,
    Array<($: ReturnType<typeof Query>) => void>
> = {
    add: [
        ($) => {
            expect($("[id='1']").add("[id='2']").add("[id='1']").print()).toEqual(
                "<div id='1' /><div id='2' />"
            );
            expect(
                $().add("div:first-child").add("<div />").add("<p />").print()
            ).toEqual("<div id='1' /><div class='one' /><div /><p />");
            expect($().add("div:first-child", $("p"))).toEqual("<div class='one' />");
        },
    ],
    addBack: [
        ($) => {
            expect($("p").find("div").addBack().print(true)).toEqual(
                "<p><div class='one'></p><div class='one' />"
            );
            expect($("p").find("div").addBack(":not(div)").print(true)).toEqual(
                "<p><div class='one'></p>"
            );
        },
    ],
    addClass: [
        ($) => {
            expect($("[id='2']").addClass("two").print()).toEqual(
                "<div id='2' class='two' />"
            );
            expect(
                $(".one")
                    .addClass((index, className) => `${className}-${index}`)
                    .print()
            ).toEqual("<div class='one-0' />");
            expect(
                $("body > div[id]")
                    .addClass((_, index) => `next-${index}`)
                    .print()
            ).toEqual("<div id='1' class='next-0' /><div id='2' class='next-1' />");
            expect($("body > div[id]").addClass("two").print()).toEqual(
                "<div id='1' class='two' /><div id='2' class='two' />"
            );
        },
    ],
    after: [
        ($) => {
            $(".one").after("<p />", "<span />");
            expect($("body > p").print(true)).toEqual(
                "<p><div class='one' /><p /><span /></p>"
            );
        },
        ($) => {
            $(".one").after(
                (index, html) => `<div class="hit_${index}">${html}</div>`
            );
            expect($(".hit_0").print()).toEqual(
                `<div class="hit_0"><div class='one' /></div>`
            );
        },
        ($) => {
            $(".one").after((index) => `<div class="hit_${index}">Random text</div>`);
            expect($(".hit_0").print()).toEqual(
                `<div class="hit_0">Random text</div>`
            );
        },
    ],
    append: [
        ($) => {
            expect($(".one").append("<p />").print()).toEqual(
                "<div class='one'><p /></div>"
            );
        },
        ($) => {
            expect($(".one").append("Random text").print()).toEqual(
                "<div class='one'>Random text</div>"
            );
        },
        ($) => {
            expect(
                $(".one")
                    .append((index, html) => `Random text ${index} ${html}`)
                    .print()
            ).toEqual(`<div class='one'>Random text 0 <div class='one' /></div>`);
        },
    ],
    appendTo: [
        ($) => {
            $("<p />").appendTo($(".one"));
            $("<span />").appendTo(".one");
            expect($(".one").print()).toEqual("<div class='one'><p /><span /></div>");
        },
    ],
    attr: [
        ($) => {
            expect($(".one").attr("class")).toEqual("one");
            expect(
                $(".one")
                    .attr({
                        id: "3",
                        style: "position: absolute",
                    })
                    .print()
            ).toEqual(`<div class='one' id="3" style="position: absolute" />`);
            expect(
                $(".one")
                    .attr(
                        "id",
                        (index, currentId) => `next_${index}_${parseInt(currentId) + 1}`
                    )
                    .attr("id")
            ).toEqual("next_0_4");
        },
    ],
    before: [
        ($) => {
            $(".one").before("<p />", "<span />");
            expect($("body > p").print(true)).toEqual(
                "<p><p /><span /><div class='one' /></p>"
            );
        },
        ($) => {
            $(".one").before(
                (index, html) => `<div class="hit_${index}">${html}</div>`
            );
            expect($(".hit_0").print()).toEqual(
                `<div class="hit_0"><div class='one' /></div>`
            );
        },
        ($) => {
            $(".one").before(
                (index) => `<div class="hit_${index}">Random text</div>`
            );
            expect($(".hit_0").print()).toEqual(
                `<div class="hit_0">Random text</div>`
            );
        },
    ],
    blur: [
        ($) => {
            expect(
                $(".one")
                    .blur((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onblur="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .blur((event) => event.preventDefault())
                    .blur(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onblur="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").blur("this.preventDefault()").print()).toEqual(
                `<div class='one' onblur="this.preventDefault()" />`
            );
        },
    ],
    change: [
        ($) => {
            expect(
                $(".one")
                    .change((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onchange="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .change((event) => event.preventDefault())
                    .change(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onchange="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").change("this.preventDefault()").print()).toEqual(
                `<div class='one' onchange="this.preventDefault()" />`
            );
        },
    ],
    children: [
        ($) => {
            expect($("body").children().print(true)).toEqual(
                "<div id='1' /><div id='2' /><p><div class='one' /></p>"
            );
        },
    ],
    click: [
        ($) => {
            expect(
                $(".one")
                    .click((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onclick="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .click((event) => event.preventDefault())
                    .click(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onclick="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").click("this.preventDefault()").print()).toEqual(
                `<div class='one' onclick="this.preventDefault()" />`
            );
        },
        ($) => {
            expect($(".one").click("this.preventDefault()").click((event) => event.preventDefault()).print()).toEqual(
                `<div class='one' onclick="this.preventDefault();((event) => event.preventDefault())(this)" />`
            );
        },
    ],
    clone: [
        ($) => {
            $(".one").clone().appendTo("p");
            expect($(".one").print()).toEqual(
                "<div class='one' /><div class='one' />"
            );
        },
    ],
    closest: [
        ($) => {
            expect($("#deep").closest("ol").attr("id")).toEqual("shallow");
            expect($("li").closest("ul", $("ol")).length).toEqual(1);
            expect($("li").closest("ul", $("body")).length).toEqual(3);
        },
    ],
    contents: [
        ($) => {
            expect($("article").contents()).toEqual(
                "Lorem ipsum <span> <img /> </span> <!-- this is a comment -->"
            );
        },
    ],
    contextmenu: [
        ($) => {
            expect(
                $(".one")
                    .contextmenu((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' oncontextmenu="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .contextmenu((event) => event.preventDefault())
                    .contextmenu(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' oncontextmenu="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").contextmenu("this.preventDefault()").print()).toEqual(
                `<div class='one' oncontextmenu="this.preventDefault()" />`
            );
        },
    ],
    css: [
        ($) => {
            expect($("h1").css("position")).toEqual("fixed");
            expect($("h1").css("position", "absolute").css("position")).toEqual(
                "absolute"
            );
            expect(
                $("h1")
                    .css("position", (_, position) =>
                        position === "relative" ? "inherit" : "absolute"
                    )
                    .css("position")
            ).toEqual("inherit");
            expect(
                $("h1").css({ color: "white", width: "100%" }).css("color")
            ).toEqual("white");
            expect($("h1").css("width")).toEqual("100%");
        },
    ],
    data: [
        ($) => {
            expect($("article").data({ one: "one", two: "three" }).data()).toEqual({
                one: "one",
                two: "three",
            });
            expect($("article").data("two")).toEqual("three");
            expect($("article").data("two", "four").data("two")).toEqual("four");
        },
    ],
    dblclick: [
        ($) => {
            expect(
                $(".one")
                    .dblclick((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' ondblclick="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .dblclick((event) => event.preventDefault())
                    .dblclick(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' ondblclick="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").dblclick("this.preventDefault()").print()).toEqual(
                `<div class='one' ondblclick="this.preventDefault()" />`
            );
        },
    ],
    each: [
        ($) => {
            let counter = 0;
            $("body > div").each((index, query) => {
                expect(index).toEqual(counter);
                expect(query.tagName()).toEqual("div");
                counter++;
            });
            expect(counter).toEqual(2);
        },
    ],
    empty: [
        ($) => {
            expect($("article").empty().print()).toEqual("<article></article>");
        },
    ],
    end: [
        ($) => {
            expect($("p").find(".one").end().print(true)).toEqual(
                "<p><div class='one' /></p>"
            );
        },
    ],
    eq: [
        ($) => {
            expect($("div").eq(0).attr("id")).toEqual("1");
            expect($("div").eq(1).attr("id")).toEqual("2");
            expect($("div").eq(-1).attr("id")).toEqual("1");
        },
    ],
    even: [
        ($) => {
            expect(
                $("div")
                    .even()
                    .map((_, item) => item.attr("id"))
            ).toEqual(["1", "one"]);
        },
    ],
    filter: [
        ($) => {
            expect($("div").filter("[id='1']").print()).toEqual("<div id='1' />");
            expect($("div").filter($("[id='2']")).print()).toEqual("<div id='2' />");
            expect(
                $("div")
                    .filter((_, element) => parseInt(element.attr("id") || ""))
                    .print()
            ).toEqual("<div id='1' /><div id='2' />");
        },
    ],
    find: [
        ($) => {
            expect($("ul").find("li").length).toEqual(3);
            expect($("ul").find($("li:first-child"))).toEqual(2);
            expect($("p").find("div").attr("id")).toEqual("one");
        },
    ],
    first: [
        ($) => {
            expect($("div.one").first().attr("id")).toEqual("1");
        },
    ],
    focus: [
        ($) => {
            expect(
                $(".one")
                    .focus((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onfocus="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .focus((event) => event.preventDefault())
                    .focus(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onfocus="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").focus("this.preventDefault()").print()).toEqual(
                `<div class='one' onfocus="this.preventDefault()" />`
            );
        },
    ],
    focusin: [
        ($) => {
            expect(
                $(".one")
                    .focusin((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onfocusin="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .focusin((event) => event.preventDefault())
                    .focusin(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onfocusin="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").focusin("this.preventDefault()").print()).toEqual(
                `<div class='one' onfocusin="this.preventDefault()" />`
            );
        },
    ],
    focusout: [
        ($) => {
            expect(
                $(".one")
                    .focusin((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onfocusin="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .focusin((event) => event.preventDefault())
                    .focusin(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onfocusin="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").focusin("this.preventDefault()").print()).toEqual(
                `<div class='one' onfocusin="this.preventDefault()" />`
            );
        },
    ],
    has: [
        ($) => {
            expect($(".one").has("p").print()).toEqual("<div class='one' />");
            expect($("li").has("ul").length).toEqual(3);
        },
    ],
    hasClass: [
        ($) => {
            expect($(".one").hasClass("one")).toEqual(true);
        },
    ],
    height: [
        ($) => {
            expect($("h1").height()).toBeFalsy();
            expect($("h2").height()).toEqual("50%");
            expect($("h2").height("100%").height()).toEqual("100%");
            expect($("h2").print()).toEqual("<h2 style='height: 50%'>Hello</h2>");
        },
    ],
    hide: [
        ($) => {
            expect($("h2").hide().print()).toEqual(
                `<h2 style="height: 50%;display: none">Hello</h2>`
            );
            expect($(".one").hide().print()).toEqual(
                `<div class="one" style="display: none" />`
            );
        },
    ],
    hover: [
        ($) => {
            expect(
                $(".one")
                    .hover((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onhover="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .hover((event) => event.preventDefault())
                    .hover(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onhover="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").hover("this.preventDefault()").print()).toEqual(
                `<div class='one' onhover="this.preventDefault()" />`
            );
        },
    ],
    html: [
        ($) => {
            expect($("p").html()).toEqual("<div class='one' />");
            expect($("p").html("<span class='two' />").html()).toEqual(
                "<span class='two' />"
            );
            expect(
                $("p")
                    .html((index, html) => `<div class='two'>${index} ${html}</div>`)
                    .html()
            ).toEqual("<div class='two'>0 <div class='one' /></div>");
        },
    ],
    index: [($) => {
        expect($("body > *").index("h1")).toEqual(5);
        expect($("body > *").index($("h2"))).toEqual(6);
    }],
    insertAfter: [
        ($) => {
            $(".one").add("<div class='two'><span /></div>").insertAfter("div#three");
            expect($("h3").print()).toEqual("<h3><div id='three' /><div class='one' /><div class='two'><span /></div></h3>");
        },
    ],
    insertBefore: [
        ($) => {
            $(".one").add("<div class='two'><span /></div>").insertBefore("div#three");
            expect($("h3").print()).toEqual("<h3><div class='one' /><div class='two'><span /></div><div id='three' /></h3>");
        }
    ],
    is: [
        ($) => {
            expect($("div").is(".one")).toEqual(true);
            expect($("div").is(".two")).toEqual(false);
            expect($("p").is($("body > *"))).toEqual(true);
            expect($("div").is($("ul"))).toEqual(false);
        }
    ],
    keydown: [
        ($) => {
            expect(
                $(".one")
                    .keydown((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onkeydown="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .keydown((event) => event.preventDefault())
                    .keydown(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onkeydown="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").keydown("this.preventDefault()").print()).toEqual(
                `<div class='one' onkeydown="this.preventDefault()" />`
            );
        },
    ],
    keypress: [
        ($) => {
            expect(
                $(".one")
                    .keypress((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onkeypress="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .keypress((event) => event.preventDefault())
                    .keypress(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onkeypress="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").keypress("this.preventDefault()").print()).toEqual(
                `<div class='one' onkeypress="this.preventDefault()" />`
            );
        },
    ],
    keyup: [
        ($) => {
            expect(
                $(".one")
                    .keyup((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onkeyup="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .keyup((event) => event.preventDefault())
                    .keyup(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onkeyup="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").keyup("this.preventDefault()").print()).toEqual(
                `<div class='one' onkeyup="this.preventDefault()" />`
            );
        },    
    ],
    last: [
        ($) => {
            expect($("li").last().find("div").attr("id")).toEqual("deep");
        }
    ],
    length: [
        ($) => {
            expect($("li").length).toEqual(3);
        }
    ],
    map: [
        ($) => {
            expect($(":header").map((_, header) => header.contents())).toEqual(["Hello", "Hello", "<div id='three' />"])
        }
    ],
    mousedown: [
        ($) => {
            expect(
                $(".one")
                    .mousedown((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onmousedown="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .mousedown((event) => event.preventDefault())
                    .mousedown(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onmousedown="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").mousedown("this.preventDefault()").print()).toEqual(
                `<div class='one' onmousedown="this.preventDefault()" />`
            );
        }, 
    ],
    mouseenter: [
        ($) => {
            expect(
                $(".one")
                    .mouseenter((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onmouseenter="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .mouseenter((event) => event.preventDefault())
                    .mouseenter(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onmouseenter="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").mouseenter("this.preventDefault()").print()).toEqual(
                `<div class='one' onmouseenter="this.preventDefault()" />`
            );
        }, 
    ],
    mouseleave: [
        ($) => {
            expect(
                $(".one")
                    .mouseleave((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onmouseleave="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .mouseleave((event) => event.preventDefault())
                    .mouseleave(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onmouseleave="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").mouseleave("this.preventDefault()").print()).toEqual(
                `<div class='one' onmouseleave="this.preventDefault()" />`
            );
        }, 
    ],
    mousemove: [
        ($) => {
            expect(
                $(".one")
                    .mousemove((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onmousemove="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .mousemove((event) => event.preventDefault())
                    .mousemove(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onmousemove="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").mousemove("this.preventDefault()").print()).toEqual(
                `<div class='one' onmousemove="this.preventDefault()" />`
            );
        }, 
    ],
    mouseout: [
        ($) => {
            expect(
                $(".one")
                    .mouseout((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onmouseout="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .mouseout((event) => event.preventDefault())
                    .mouseout(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onmouseout="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").mouseout("this.preventDefault()").print()).toEqual(
                `<div class='one' onmouseout="this.preventDefault()" />`
            );
        }, 
    ],
    mouseover: [
        ($) => {
            expect(
                $(".one")
                    .mouseover((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onmouseover="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .mouseover((event) => event.preventDefault())
                    .mouseover(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onmouseover="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").mouseover("this.preventDefault()").print()).toEqual(
                `<div class='one' onmouseover="this.preventDefault()" />`
            );
        }, 
    ],
    mouseup: [
        ($) => {
            expect(
                $(".one")
                    .mouseup((event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onmouseup="((event) => event.preventDefault())(this)" />`
            );
        },
        ($) => {
            expect(
                $(".one")
                    .mouseup((event) => event.preventDefault())
                    .mouseup(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onmouseup="((event) => event.preventDefault())(this);(() => alert('this'))(this)" />`
            );
        },
        ($) => {
            expect($(".one").mouseup("this.preventDefault()").print()).toEqual(
                `<div class='one' onmouseup="this.preventDefault()" />`
            );
        }, 
    ],
    next: [
        ($) => {
            expect($("#1").next().print()).toEqual("<div id='2' />");
            expect($("#1").next("#3").print()).toEqual("");
            expect($("#1").next("#2").print()).toEqual("<div id='2' />");
        },
    ],
    nextAll: [
        ($) => {
            expect($("div").nextAll("div").print()).toEqual("<div id='2' />");
            expect($("div").nextAll($("[id=2]")).print()).toEqual("<div id='2' />");
            expect($("div").nextAll(":header").print()).toEqual("<h1 style='position: fixed'>Hello</h1><h2 style='height: 50%'>Hello</h2><h3><div id='three' /></h3>");
        }
    ],
    nextUntil: [
        ($) => {
            expect($("h1").nextUntil("h3").print()).toEqual("<h2 style='height: 50%'>Hello</h2>");
            expect($("h1").nextUntil($("h3")).print()).toEqual("<h2 style='height: 50%'>Hello</h2>");
            expect($("h1").nextUntil($("h3"), "h2").print()).toEqual("<h2 style='height: 50%'>Hello</h2>");
            expect($("h1").nextUntil($("h3"), $("h2")).print()).toEqual("<h2 style='height: 50%'>Hello</h2>");
        }
    ],
    not: [
        ($) => {
            expect($(":header").not("h1").print()).toEqual("<h2 style='height: 50%'>Hello</h2><h3><div id='three' /></h3>");
            expect($(":header").not($("h1")).print()).toEqual("<h2 style='height: 50%'>Hello</h2><h3><div id='three' /></h3>");
            expect($(":header").not($("h1,h2")).print()).toEqual("<h3><div id='three' /></h3>");
            expect($(":header").not((_, element) => element.tagName() === "h1").print()).toEqual("<h2 style='height: 50%'>Hello</h2><h3><div id='three' /></h3>");
        },
    ],
    odd: [
        ($) => {
            expect(
                $("div")
                    .odd()
                    .map((_, item) => item.attr("id"))
            ).toEqual(["two"]);
        },
    ],
    off: [
        ($) => {
            expect(
                $(".one")
                    .mouseup((event) => event.preventDefault())
                    .click(() => alert("this"))
                    .print()
            ).toEqual(
                `<div class='one' onmouseup="((event) => event.preventDefault())(this);" onclick="(() => alert('this'))(this)" />`
            );
            expect(
                $(".one")
                    .off("click mouseup")
                    .print()
            ).toEqual(
                `<div class='one' />`
            );
        }
    ],
    on: [
        ($) => {
            expect(
                $(".one")
                    .on("click mouseup", (event) => event.preventDefault())
                    .print()
            ).toEqual(
                `<div class='one' onmouseup="((event) => event.preventDefault())(this);" onclick="((event) => event.preventDefault())(this);" />`
            );
        },
    ],
    once: [
        ($) => {
            expect(
                $(".one")
                    .on("click mouseup", (event) => event.preventDefault())
                    .attr("onclick")
            ).toMatch(/\(\(event\) => \{ if \(window\['[a-z0-9]+'\]\) \{ return; \} const fn = \(event\) => event\.preventDefault\(\); const result = fn\(event\); window\['[a-z0-9]+'\] = true; return result; \}\)\(this\)/gmui);
            expect($(".one").attr("onmouseup")).toMatch(/\(\(event\) => \{ if \(window\['[a-z0-9]+'\]\) \{ return; \} const fn = \(event\) => event\.preventDefault\(\); const result = fn\(event\); window\['[a-z0-9]+'\] = true; return result; \}\)\(this\)/gmui);
        },
    ],
    parent: [
        ($) => {
            expect($(".one").parent().print(true)).toEqual("<p><div class='one' /></p>");
            expect($("li").parent("ul")[0].tagName()).toEqual("ul");
            expect($("li").parent($("ol"))[0].tagName()).toEqual("ol");
        },
    ],
    parents: [
        ($) => {
            expect($(".one").parents().map((_, q) => q.tagName())).toEqual(["body", "html"]);
            expect($(":header").parents().map((_, q) => q.tagName())).toEqual(["body", "html"]);
            expect($(":header").parents("body").map((_, q) => q.tagName())).toEqual(["body"]);
            expect($(":header").parents($("body")).map((_, q) => q.tagName())).toEqual(["body"]);
        }
    ],
    parentsUntil: [
        
    ],
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
    width: [],
    wrap: [],
    wrapAll: [],
    wrapInner: [],
    [Symbol.iterator]: [],
};

describe("Methods of Query work as expected", () => {
    Object.entries(testCases).forEach(([method, tests]) => {
        tests.forEach((test, index) => {
            it(`Method ${method}, test n.${index} working as expected`, () =>
                test(query()));
        });
    });
});
