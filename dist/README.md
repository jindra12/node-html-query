# node-html-query

Small, efficient JQuery Node.JS alternative, compatible with TypeScript

### What can it do?

Matches HTML elements and modifies DOM much like regular jQuery in browser!

```typescript

import { Query } from "node-html-query";
const $ = Query(myHtmlFile);

const allDivs = $("div");
const idMatch = allDivs.find("#myId");

```

```typescript

import { Query } from "node-html-query";
const $ = Query(myHtmlFile);

$("div").append("<p>I come after a div</p>");
const rawHtml = $("html").print(); // Whole HTML content here!

```


### Who should download this?

Anyone who's looking for preprocessing nodejs package without external dependencies, small and easy to use webscraper,
or an easy way to parse HTML content within web workers.

### How does it work?

ANTLR-inspired syntax parsers for both DOM and CSS queries combined with custom jQuery method implementation.

### What are its benefits?

Environment independence, good bundle size, extensive unit tests, high degree of memory management and pretty good performance.

### What are its limitations?

This package is brand new, so even with the extensive unit testing within the DEV package there may be bugs.
Also, it cannot process computed properties, nor access standard DOM interface.
Furthermore, this package cannot execute or parse JavaScript content within HTML, or CSS styles (it simply sees them as string).

## Footer

If you encounter any bugs, or have ideas for improvement, do not hesitate to add a task or a pull request.
