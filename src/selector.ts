import { HtmlDocument, HtmlElement } from "./html";
import { LexerType } from "./lexers";
import { LexerItem, ParserItem, Queue, Searcher } from "./types";
import { consumeCache, inputValidation, matchAttribute, rangeComparator } from "./utils";

export interface Matcher extends ParserItem {
    match: (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[],
    ) => HtmlElement[];
}

/**
 * selectorGroup
    : selector ( Comma ws selector )*
    ;
 */
export class SelectorGroup implements Matcher {
    selector = new Selector();
    selectors: {
        comma: LexerItem<"Comma">;
        ws: Ws;
        selector: Selector;
    }[] = [];
    consumed = consumeCache(() => {
        return (
            this.selector.consumed() &&
            (this.selectors.length === 0 ||
                this.selectors.every(
                    ({ comma, selector: selector, ws }) =>
                        comma.value && selector.consumed() && ws.consumed()
                ))
        );
    });
    process = (queue: Queue): Queue => {
        if (!this.selector.consumed()) {
            const tryConsumeSelector = this.selector.process(queue);
            if (this.selector.consumed()) {
                return this.process(tryConsumeSelector);
            }
        } else {
            const current = queue.items[queue.at];
            const lastArrayItem = this.selectors[this.selectors.length - 1];
            if (
                current.type === "Comma" &&
                (!lastArrayItem || lastArrayItem.selector.consumed())
            ) {
                const item = new LexerItem("Comma");
                item.value = current.value;
                const ws = new Ws();
                const tryProcessWs = ws.process(queue.next());
                this.selectors.push({
                    comma: item,
                    selector: new Selector(),
                    ws: ws,
                });
                return this.process(tryProcessWs);
            }
            if (lastArrayItem.comma.value && !lastArrayItem.selector.consumed()) {
                const selector = new Selector();
                const tryProcessSelector = selector.process(queue);
                if (selector.consumed()) {
                    lastArrayItem.selector = selector;
                    return this.process(tryProcessSelector);
                }
            }
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedParserItem(this.selector);
        this.selectors.forEach((selector) => {
            searcher.feedLexerItem(selector.comma);
            searcher.feedParserItem(selector.ws);
            searcher.feedParserItem(selector.selector);
        });
    };
    match = (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[],
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        return Object.values(
            [this.selector, ...this.selectors.map((s) => s.selector)].reduce(
                (result: Record<string, HtmlElement>, selector) => {
                    selector
                        .match(htmlElements, allHtmlElements)
                        .forEach((htmlElement) => {
                            result[htmlElement.identifier] = htmlElement;
                        });
                    return result;
                },
                {}
            )
        );
    };
}

/**
 * selector
    : simpleSelectorSequence ws ( combinator simpleSelectorSequence ws )*
    ;
 */
export class Selector implements Matcher {
    simpleSelectorSequence = new SimpleSelectorSequence();
    ws = new Ws();
    sequences: {
        combinator: Combinator;
        simpleSelectorSequence: SimpleSelectorSequence;
        ws: Ws;
    }[] = [];
    consumed = consumeCache(() => {
        return (
            this.simpleSelectorSequence.consumed() &&
            this.ws.consumed() &&
            (this.sequences.length === 0 ||
                this.sequences.every(
                    ({ combinator, simpleSelectorSequence, ws }) =>
                        combinator.consumed() &&
                        simpleSelectorSequence.consumed() &&
                        ws.consumed()
                ))
        );
    });
    process = (queue: Queue): Queue => {
        if (!this.simpleSelectorSequence.consumed()) {
            const tryProcess = this.simpleSelectorSequence.process(queue);
            if (this.simpleSelectorSequence.consumed()) {
                const tryProcessWs = this.ws.process(tryProcess);
                return this.process(tryProcessWs);
            }
        }
        const lastArrayItem = this.sequences[this.sequences.length - 1];
        if (!lastArrayItem || lastArrayItem.simpleSelectorSequence.consumed()) {
            const combinator = new Combinator();
            const tryParse = combinator.process(queue);
            if (combinator.consumed()) {
                this.sequences.push({
                    combinator: combinator,
                    simpleSelectorSequence: new SimpleSelectorSequence(),
                    ws: new Ws(),
                });
                return this.process(tryParse);
            }
        } else if (
            lastArrayItem &&
            !lastArrayItem.simpleSelectorSequence.consumed()
        ) {
            const tryProcess = lastArrayItem.simpleSelectorSequence.process(queue);
            if (lastArrayItem.simpleSelectorSequence.consumed()) {
                const tryProcessWs = lastArrayItem.ws.process(tryProcess);
                return this.process(tryProcessWs);
            }
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedParserItem(this.simpleSelectorSequence);
        searcher.feedParserItem(this.ws);
        this.sequences.forEach((sequence) => {
            searcher.feedParserItem(sequence.combinator);
            searcher.feedParserItem(sequence.simpleSelectorSequence);
            searcher.feedParserItem(sequence.ws);
        });
    };
    match = (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[]
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        const filtered = this.simpleSelectorSequence.match(
            htmlElements,
            allHtmlElements
        );
        return this.sequences.reduce(
            (filtered, { combinator, simpleSelectorSequence }) => {
                const applyCombinator = combinator.match(filtered, allHtmlElements);
                const applySequence = simpleSelectorSequence.match(
                    applyCombinator,
                    allHtmlElements
                );
                return applySequence;
            },
            filtered
        );
    };
}

/**
    combinator
        : Plus ws
        | Greater ws
        | Tilde ws
        | Space ws
        ;
 */
export class Combinator implements Matcher {
    plus = new LexerItem("Plus");
    greater = new LexerItem("Greater");
    tilde = new LexerItem("Tilde");
    space = new LexerItem("Space");
    ws = new Ws();
    consumed = consumeCache(() => {
        return Boolean(
            this.plus.value ||
            this.greater.value ||
            this.tilde.value ||
            this.space.value
        );
    });
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        switch (current.type) {
            case "Plus":
                this.plus.value = current.value;
                const tryWsPlus = this.ws.process(queue.next());
                return tryWsPlus;
            case "Greater":
                this.greater.value = current.value;
                const tryWsGreater = this.ws.process(queue.next());
                return tryWsGreater;
            case "Tilde":
                this.tilde.value = current.value;
                const tryWsTilde = this.ws.process(queue.next());
                return tryWsTilde;
            case "Space":
                this.space.value = current.value;
                const tryWsSpace = this.ws.process(queue.next());
                return tryWsSpace;
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.plus);
        searcher.feedLexerItem(this.greater);
        searcher.feedLexerItem(this.tilde);
        searcher.feedLexerItem(this.space);
        searcher.feedParserItem(this.ws);
    };
    match = (htmlElements: HtmlElement[], _: HtmlElement[]): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        if (this.plus.value) {
            return htmlElements
                .map((element) => element.parent.nextSibling(element))
                .filter((element: HtmlElement | undefined): element is HtmlElement =>
                    Boolean(element)
                );
        }
        if (this.greater.value) {
            return htmlElements
                .map((element) => element.children())
                .reduce((elements: HtmlElement[], children) => {
                    children.forEach((child) => {
                        elements.push(child);
                    });
                    return elements;
                }, []);
        }
        if (this.tilde.value) {
            return htmlElements
                .map((element) => element.parent.prevSibling(element))
                .filter((element: HtmlElement | undefined): element is HtmlElement =>
                    Boolean(element)
                );
        }
        if (this.space.value) {
            return htmlElements.map((element) => element.descendants()).reduce((manyElements, elements) => {
                elements.forEach((element) => {
                    manyElements.push(element);
                });
                return manyElements;
            }, []);
        }
        return htmlElements;
    };
}

/**
    simpleSelectorSequence
        : ( typeSelector | universal ) ( Hash | className | attrib | pseudo | negation )*
        | ( Hash | className | attrib | pseudo | negation )+
        ;
 */
export class SimpleSelectorSequence implements Matcher {
    typeSelector = new TypeSelector();
    universal = new Universal();
    modifiers: {
        hash: LexerItem<"Hash">;
        className: ClassName;
        attrib: Attrib;
        pseudo: Pseudo;
        negation: Negation;
    }[] = [];

    consumed = consumeCache(() => {
        const hasPreface =
            this.typeSelector.consumed() || this.universal.consumed();
        if (hasPreface) {
            return true;
        }
        return this.modifiers.length > 0;
    });
    process = (queue: Queue): Queue => {
        if (!this.typeSelector.consumed() && !this.universal.consumed()) {
            const tryTypeSelector = this.typeSelector.process(queue);
            if (this.typeSelector.consumed()) {
                return this.process(tryTypeSelector);
            }
            const tryUniversal = this.universal.process(queue);
            if (this.universal.consumed()) {
                return this.process(tryUniversal);
            }
        }
        const current = queue.items[queue.at];
        const hash = new LexerItem("Hash");
        hash.value = current.value;
        if (current.type === "Hash") {
            this.modifiers.push({
                attrib: new Attrib(),
                className: new ClassName(),
                hash: hash,
                negation: new Negation(),
                pseudo: new Pseudo(),
            });
            return this.process(queue.next());
        }
        const className = new ClassName();
        const tryProcessClassName = className.process(queue);
        if (className.consumed()) {
            this.modifiers.push({
                attrib: new Attrib(),
                className: className,
                hash: new LexerItem("Hash"),
                negation: new Negation(),
                pseudo: new Pseudo(),
            });
            return this.process(tryProcessClassName);
        }
        const attrib = new Attrib();
        const tryProcessAttrib = attrib.process(queue);
        if (attrib.consumed()) {
            this.modifiers.push({
                attrib: attrib,
                className: new ClassName(),
                hash: new LexerItem("Hash"),
                negation: new Negation(),
                pseudo: new Pseudo(),
            });
            return this.process(tryProcessAttrib);
        }
        const pseudo = new Pseudo();
        const tryProcessPseudo = pseudo.process(queue);
        if (pseudo.consumed()) {
            this.modifiers.push({
                attrib: new Attrib(),
                className: new ClassName(),
                hash: new LexerItem("Hash"),
                negation: new Negation(),
                pseudo: pseudo,
            });
            return this.process(tryProcessPseudo);
        }
        const negation = new Negation();
        const tryProcessNegation = pseudo.process(queue);
        if (negation.consumed()) {
            this.modifiers.push({
                attrib: new Attrib(),
                className: new ClassName(),
                hash: new LexerItem("Hash"),
                negation: negation,
                pseudo: new Pseudo(),
            });
            return this.process(tryProcessNegation);
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedParserItem(this.typeSelector);
        searcher.feedParserItem(this.universal);
        this.modifiers.forEach(({ hash, className, attrib, pseudo, negation }) => {
            searcher.feedLexerItem(hash);
            searcher.feedParserItem(className);
            searcher.feedParserItem(attrib);
            searcher.feedParserItem(pseudo);
            searcher.feedParserItem(negation);
        });
    };
    match = (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[]
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        const typeMatched = this.typeSelector.match(htmlElements, allHtmlElements);
        const universalMatched = this.universal.match(typeMatched, allHtmlElements);

        return this.modifiers.reduce((htmlElements, modifier) => {
            if (modifier.attrib.consumed()) {
                return modifier.attrib.match(htmlElements, allHtmlElements);
            }
            if (modifier.className.consumed()) {
                return modifier.className.match(htmlElements, allHtmlElements);
            }
            if (modifier.hash.value) {
                const hashValue = modifier.hash.value.replace(/^#/, "");
                return htmlElements.filter((element) =>
                    matchAttribute(element.attributes(), "id", hashValue, "[attr=value]")
                );
            }
            if (modifier.negation.consumed()) {
                return modifier.negation.match(htmlElements, allHtmlElements);
            }
            if (modifier.pseudo.consumed()) {
                return modifier.pseudo.match(htmlElements, allHtmlElements);
            }
            return htmlElements;
        }, universalMatched);
    };
}

/**
 * pseudo
    : PseudoGeneral ( ident | functionalPseudo )
    ;
 */
export class Pseudo implements Matcher {
    pseudoGeneral = new LexerItem("PseudoGeneral");
    ident = new LexerItem("Ident");
    functionalPseudo = new FunctionalPseudo();
    consumed = consumeCache(() => {
        return Boolean(
            this.pseudoGeneral.value &&
            (this.ident.value || this.functionalPseudo.consumed())
        );
    });
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "PseudoGeneral") {
            this.pseudoGeneral.value = current.value;
            return this.process(queue.next());
        }
        if (current.type === "Ident") {
            this.ident.value = current.value;
            return this.process(queue.next());
        }
        const tryFunctionalPseudo = this.functionalPseudo.process(queue);
        if (this.functionalPseudo.consumed()) {
            return tryFunctionalPseudo;
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.pseudoGeneral);
        searcher.feedLexerItem(this.ident);
        searcher.feedParserItem(this.functionalPseudo);
    };
    match = (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[]
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        if (this.functionalPseudo.consumed()) {
            return this.functionalPseudo.match(htmlElements, allHtmlElements);
        }

        let indexesByParent:
            | Record<string, Record<string, { tagName: string; order: number }>>
            | undefined;
        const fillIndexes = () => {
            if (indexesByParent) {
                return indexesByParent;
            }
            indexesByParent = htmlElements.reduce(
                (
                    indexes: Record<
                        string,
                        Record<string, { tagName: string; order: number }>
                    >,
                    element
                ) => {
                    const parentIndex = element.parent.identifier;
                    if (!indexes[parentIndex]) {
                        indexes[parentIndex] = {};
                    }
                    indexes[parentIndex][element.identifier] = {
                        tagName: element.getTagName(),
                        order: element.parent.getIndex(element),
                    };
                    return indexes;
                },
                {}
            );
            return indexesByParent;
        };

        const sameType =
            (element: HtmlElement) =>
                (values: { tagName: string; order: number }[]) =>
                    values
                        .filter(({ tagName }) => element.getTagName() === tagName)
                        .map(({ order }) => order);

        return htmlElements.filter((element) => {
            const children = element.children();
            switch (this.ident.value) {
                case "checkbox":
                    return matchAttribute(element.attributes(), "type", "checkbox", "[attr=value]"); 
                case "checked":
                    return matchAttribute(element.attributes(), "checked", "", "[attr]");
                case "disabled":
                    return matchAttribute(element.attributes(), "disabled", "", "[attr]");
                case "empty":
                    return children.length === 0;
                case "enabled":
                    return matchAttribute(element.attributes(), "disabled", "", "not");
                case "first-child":
                    const indexByQuery =
                        fillIndexes()[element.parent.identifier][element.identifier];
                    return indexByQuery.order === 0 || indexByQuery.order === -1;
                case "first-of-type":
                    const lowestIndexOfQuery = Math.min(
                        ...sameType(element)(
                            Object.values(fillIndexes()[element.parent.identifier])
                        )
                    );
                    return (
                        lowestIndexOfQuery ===
                        fillIndexes()[element.parent.identifier][element.identifier].order
                    );
                case "in-range":
                    return rangeComparator(element.attributes());
                case "invalid":
                    return !inputValidation(element.attributes(), () =>
                        allHtmlElements.map((element) => element.attributes())
                    );
                case "last-child":
                    const numberOfChildren = element.parent.children().length;
                    return (
                        fillIndexes()[element.parent.identifier][element.identifier]
                            .order ===
                        numberOfChildren - 1
                    );
                case "last-of-type":
                    const numberOfType = sameType(element)(
                        Object.values(fillIndexes()[element.parent.identifier])
                    ).length;
                    return (
                        fillIndexes()[element.parent.identifier][element.identifier]
                            .order ===
                        numberOfType - 1
                    );
                case "only-of-type":
                    return (
                        sameType(element)(
                            Object.values(fillIndexes()[element.parent.identifier])
                        ).length === 1
                    );
                case "only-child":
                    return element.parent.children().length === 1;
                case "optional":
                    return !Object.keys(element.attributes()).includes("required");
                case "out-of-range":
                    return !rangeComparator(element.attributes());
                case "read-only":
                    return Object.keys(element.attributes()).includes("readonly");
                case "read-write":
                    return !Object.keys(element.attributes()).includes("readonly");
                case "required":
                    return Object.keys(element.attributes()).includes("required");
                case "root":
                    return element.parent instanceof HtmlDocument;
                case "valid":
                    return inputValidation(element.attributes(), () =>
                        allHtmlElements.map((element) => element.attributes())
                    );
                case "header":
                    return /^h[1-6]$/.test(element.tagName.value);
                case "image":
                    return element.attributes()["type"] === "image";
                case "input":
                    return ["input", "button", "textarea", "select"].includes(element.tagName.value);
                case "password":
                    return element.tagName.value === "input" && element.attributes()["type"] === "password";
                case "radio":
                    return element.tagName.value === "input" && element.attributes()["type"] === "radio";
                default:
                    return false;
            }
        });
    };
}

/**
   functionalPseudo
    : Function_ ws expression ')'
    ;
 */
export class FunctionalPseudo implements Matcher {
    funct = new LexerItem("Function_");
    ws = new Ws();
    expression = new Expression(this);
    backBrace = new LexerItem("BackBrace");
    consumed = () => {
        return Boolean(
            this.funct.value && this.expression.consumed() && this.backBrace.value
        );
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "Function_") {
            this.funct.value = current.value;
            const tryWs = this.ws.process(queue.next());
            return this.process(tryWs);
        }
        if (this.funct.value) {
            const tryExpression = this.expression.process(queue);
            if (this.expression.consumed()) {
                return this.process(tryExpression);
            }
        }
        if (this.expression.consumed() && current.type === "BackBrace") {
            this.backBrace.value = current.value;
            return queue.next();
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.funct);
        searcher.feedParserItem(this.ws);
        searcher.feedParserItem(this.expression);
        searcher.feedLexerItem(this.backBrace);
    };
    /**
          :nth-child(n) 	p:nth-child(2) 	Selects every <p> element that is the second child of its parent
          :nth-last-child(n) 	p:nth-last-child(2) 	Selects every <p> element that is the second child of its parent, counting from the last child
          :nth-last-of-type(n) 	p:nth-last-of-type(2) 	Selects every <p> element that is the second <p> element of its parent, counting from the last child
          :nth-of-type(n) 	p:nth-of-type(2) 	Selects every <p> element that is the second <p> element of its parent
          :is(n)  p:is()
          :has(n)
          :where(n)
       */
    match = (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[]
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        return this.expression.match(htmlElements, allHtmlElements);
    };
}

/**
   typeNamespacePrefix
    : ( ident | '*' )? '|'
    ;
 */
export class TypeNamespacePrefix implements Matcher {
    ident = new LexerItem("Ident");
    namespace = new LexerItem("Namespace");
    universal = new LexerItem("Universal");
    consumed = () => {
        return Boolean(this.universal.value);
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "Ident") {
            this.ident.value = current.value;
            return this.process(queue.next());
        }
        if (current.type === "Namespace") {
            this.namespace.value = current.value;
            return this.process(queue.next());
        }
        if (current.type === "Universal") {
            this.universal.value = current.value;
            return queue.next();
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.ident);
        searcher.feedLexerItem(this.universal);
        searcher.feedLexerItem(this.namespace);
    };
    match = (htmlElements: HtmlElement[], _: HtmlElement[]): HtmlElement[] => {
        if (!this.consumed() || this.universal.value) {
            return htmlElements;
        }
        const namespaceRegex = new RegExp(`^${this.ident.value}:`, "gmu");
        return htmlElements.filter((htmlElement) =>
            namespaceRegex.test(htmlElement.getTagName())
        );
    };
}

/*
    typeSelector
        : typeNamespacePrefix? elementName
        ;
*/
export class TypeSelector implements Matcher {
    typeNamespacePrefix = new TypeNamespacePrefix();
    elementName = new ElementName();

    consumed = () => {
        return Boolean(this.elementName.consumed());
    };
    process = (queue: Queue): Queue => {
        const tryProcessNamespace = this.typeNamespacePrefix.process(queue);
        if (this.typeNamespacePrefix.consumed()) {
            return this.process(tryProcessNamespace);
        }
        const tryProcessElementName = this.elementName.process(queue);
        if (this.elementName.consumed()) {
            return tryProcessElementName;
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedParserItem(this.typeNamespacePrefix);
        searcher.feedParserItem(this.elementName);
    };
    match = (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[]
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        const typeMatched = this.typeNamespacePrefix.match(
            htmlElements,
            allHtmlElements
        );
        return this.elementName.match(typeMatched, allHtmlElements);
    };
}

/*
    elementName
        : ident
        ;
*/
export class ElementName implements Matcher {
    ident = new LexerItem("Ident");
    consumed = () => {
        return Boolean(this.ident.value);
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "Ident") {
            this.ident.value = current.value;
            return queue.next();
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.ident);
    };
    match = (htmlElements: HtmlElement[], _: HtmlElement[]): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        return htmlElements.filter(
            (element) => element.getTagName() === this.ident.value
        );
    };
}

/**
   universal
    : typeNamespacePrefix? '*'
    ;
 */
export class Universal implements Matcher {
    typeNamespacePrefix = new TypeNamespacePrefix();
    universal = new LexerItem("Universal");

    consumed = () => {
        return Boolean(this.universal.value);
    };
    process = (queue: Queue): Queue => {
        const tryProcessNamespace = this.typeNamespacePrefix.process(queue);
        if (this.typeNamespacePrefix.consumed()) {
            return this.process(tryProcessNamespace);
        }
        const current = queue.items[queue.at];
        if (current.type === "Universal") {
            this.universal.value = current.value;
            return queue.next();
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedParserItem(this.typeNamespacePrefix);
        searcher.feedLexerItem(this.universal);
    };
    match = (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[]
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        return this.typeNamespacePrefix.match(htmlElements, allHtmlElements);
    };
}

/**
   className
    : '.' ident
    ;
 */
export class ClassName implements Matcher {
    dot = new LexerItem("Dot");
    ident = new LexerItem("Ident");
    consumed = () => {
        return Boolean(this.dot.value && this.ident.value);
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "Dot") {
            this.dot.value = current.value;
            return this.process(queue.next());
        }
        if (current.type === "Ident") {
            this.ident.value = current.value;
            return queue.next();
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.dot);
        searcher.feedLexerItem(this.ident);
    };
    match = (htmlElements: HtmlElement[], _: HtmlElement[]): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        return htmlElements.filter((element) =>
            matchAttribute(
                element.attributes(),
                "class",
                this.ident.value,
                "[attr=value]"
            )
        );
    };
}

/**
    attrib
    : '[' ws typeNamespacePrefix? ident ws ( ( PrefixMatch | SuffixMatch | SubstringMatch | '=' | Includes | DashMatch ) ws ( ident | String_ ) ws )? ']'
    ;
 */
export class Attrib implements Matcher {
    squareBracket = new LexerItem("SquareBracket");
    ws1 = new Ws();
    typeNamespacePrefix = new TypeNamespacePrefix();
    ident1 = new LexerItem("Ident");
    ws2 = new Ws();
    prefixMatch = new LexerItem("PrefixMatch");
    suffixMatch = new LexerItem("SuffixMatch");
    substringMatch = new LexerItem("SubstringMatch");
    equals = new LexerItem("Equals");
    includes = new LexerItem("Includes");
    dashMatch = new LexerItem("DashMatch");
    ws3 = new Ws();
    ident2 = new LexerItem("Ident");
    stringIdent = new LexerItem("String_");
    ws4 = new Ws();
    squareBracketEnd = new LexerItem("SquareBracketEnd");
    consumed = () => {
        const hasComparator =
            this.prefixMatch.value ||
            this.suffixMatch.value ||
            this.substringMatch.value ||
            this.equals.value ||
            this.includes.value ||
            this.dashMatch.value;
        if (hasComparator && !this.ident2.value && !this.stringIdent.value) {
            return false;
        }
        return Boolean(
            this.squareBracket.value &&
            this.ident1.value &&
            this.squareBracketEnd.value
        );
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "SquareBracket") {
            this.squareBracket.value = current.value;
            const tryWs = this.ws1.process(queue.next());
            return this.process(tryWs);
        }
        const tryTypeNameSpace = this.typeNamespacePrefix.process(queue);
        if (this.typeNamespacePrefix.consumed()) {
            return this.process(tryTypeNameSpace);
        }
        if (current.type === "Ident" && !this.ident1.value) {
            this.ident1.value = current.value;
            const tryWs = this.ws2.process(queue.next());
            return this.process(tryWs);
        }
        const comparators: [LexerType, LexerItem<LexerType>][] = [
            ["PrefixMatch", this.prefixMatch],
            ["SuffixMatch", this.suffixMatch],
            ["SubstringMatch", this.substringMatch],
            ["Equals", this.equals],
            ["Includes", this.includes],
            ["DashMatch", this.dashMatch],
        ];
        const foundComp = comparators.find(([type]) => type === current.type)?.[1];
        if (foundComp) {
            foundComp.value = current.value;
            const tryWs = this.ws3.process(queue.next());
            return this.process(tryWs);
        }
        if (current.type === "Ident" && this.ident1.value) {
            this.ident2.value = current.value;
            const tryWs = this.ws4.process(queue.next());
            return this.process(tryWs);
        }
        if (current.type === "SquareBracketEnd") {
            this.squareBracketEnd.value = current.value;
            return queue.next();
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.squareBracket);
        searcher.feedParserItem(this.ws1);
        searcher.feedParserItem(this.typeNamespacePrefix);
        searcher.feedLexerItem(this.ident1);
        searcher.feedParserItem(this.ws2);
        searcher.feedLexerItem(this.prefixMatch);
        searcher.feedLexerItem(this.suffixMatch);
        searcher.feedLexerItem(this.substringMatch);
        searcher.feedLexerItem(this.equals);
        searcher.feedLexerItem(this.includes);
        searcher.feedLexerItem(this.dashMatch);
        searcher.feedParserItem(this.ws3);
        searcher.feedLexerItem(this.ident2);
        searcher.feedLexerItem(this.stringIdent);
        searcher.feedParserItem(this.ws4);
        searcher.feedLexerItem(this.squareBracketEnd);
    };
    match = (htmlElements: HtmlElement[], _: HtmlElement[]): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        return htmlElements.filter((element) =>
            matchAttribute(
                element.attributes(),
                `${this.typeNamespacePrefix.consumed() &&
                    this.typeNamespacePrefix.ident.value
                    ? `${this.typeNamespacePrefix.ident.value}:`
                    : this.ident1.value
                }`,
                this.ident2.value || this.stringIdent.value,
                (() => {
                    if (this.prefixMatch.value) {
                        return "[attr^=value]";
                    }
                    if (this.suffixMatch.value) {
                        return "[attr$=value]";
                    }
                    if (this.substringMatch.value) {
                        return "[attr*=value]";
                    }
                    if (this.equals.value) {
                        return "[attr=value]";
                    }
                    if (this.includes.value) {
                        return "[attr~=value]";
                    }
                    if (this.dashMatch.value) {
                        return "[attr|=value]";
                    }
                    return "[attr]";
                })()
            )
        );
    };
}

/**
    negation
        : PseudoNot ws negationArg ws ')'
        ;
 */
export class Negation implements Matcher {
    pseudoNot = new LexerItem("PseudoNot");
    ws1 = new Ws();
    negationArg = new NegationArg();
    ws2 = new Ws();
    backBrace = new LexerItem("BackBrace");
    consumed = () => {
        return Boolean(
            this.pseudoNot.value &&
            this.negationArg.consumed() &&
            this.backBrace.value
        );
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "PseudoNot") {
            this.pseudoNot.value = current.value;
            const tryWs = this.ws1.process(queue.next());
            return this.process(tryWs);
        }
        const tryNegation = this.negationArg.process(queue);
        if (this.negationArg.consumed()) {
            const tryWs = this.ws2.process(tryNegation);
            return this.process(tryWs);
        }
        if (current.type === "BackBrace") {
            this.backBrace.value = current.value;
            return queue.next();
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.pseudoNot);
        searcher.feedParserItem(this.ws1);
        searcher.feedParserItem(this.negationArg);
        searcher.feedParserItem(this.ws2);
        searcher.feedLexerItem(this.backBrace);
    };
    match = (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[]
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        const matched = this.negationArg.match(htmlElements, allHtmlElements).reduce((ids: Record<string, true>, element) => {
            ids[element.identifier] = true;
            return ids;
        }, {});
        return htmlElements.filter((element) => !matched[element.identifier]);
    };
}

/**
    negationArg
        : typeSelector
        | universal
        | Hash
        | className
        | attrib
        | pseudo
        ;
 */
export class NegationArg implements Matcher {
    typeSelector = new TypeSelector();
    universal = new Universal();
    hash = new LexerItem("Hash");
    className = new ClassName();
    attrib = new Attrib();
    pseudo = new Pseudo();
    consumed = () => {
        return Boolean(
            this.typeSelector.consumed() ||
            this.universal.consumed() ||
            this.hash.value ||
            this.className.consumed() ||
            this.attrib.consumed() ||
            this.pseudo.consumed()
        );
    };
    process = (queue: Queue): Queue => {
        const tryProcessSelector = this.typeSelector.process(queue);
        if (this.typeSelector.consumed()) {
            return tryProcessSelector;
        }
        const tryUniversal = this.universal.process(queue);
        if (this.universal.consumed()) {
            return tryUniversal;
        }
        if (queue.items[queue.at].type === "Hash") {
            this.hash.value = queue.items[queue.at].value;
            return queue.next();
        }
        const tryClassName = this.className.process(queue);
        if (this.className.consumed()) {
            return tryClassName;
        }
        const tryAttrib = this.attrib.process(queue);
        if (this.attrib.consumed()) {
            return tryAttrib;
        }
        const tryPseudo = this.pseudo.process(queue);
        if (this.pseudo.consumed()) {
            return tryPseudo;
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedParserItem(this.typeSelector);
        searcher.feedParserItem(this.universal);
        searcher.feedLexerItem(this.hash);
        searcher.feedParserItem(this.className);
        searcher.feedParserItem(this.attrib);
        searcher.feedParserItem(this.pseudo);
    };
    match = (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[]
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        if (this.typeSelector.consumed()) {
            return this.typeSelector.match(htmlElements, htmlElements);
        }
        if (this.universal.consumed()) {
            return this.universal.match(htmlElements, htmlElements);
        }
        if (this.hash.value) {
            return htmlElements.filter((element) => matchAttribute(element.attributes(), "id", this.hash.value.slice(1), "[attr=value]"));
        }
        if (this.attrib.consumed()) {
            return this.attrib.match(htmlElements, allHtmlElements);
        }
        if (this.pseudo.consumed()) {
            return this.pseudo.match(htmlElements, allHtmlElements);
        }
        return htmlElements;
    };
}

/**
    ws
        : Space*
        ;
*/
export class Ws implements ParserItem {
    spaces: LexerItem<"Space">[] = [];
    consumed = () => {
        return true;
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "Space") {
            const space = new LexerItem("Space");
            space.value = current.value;
            this.spaces.push(space);
            return this.process(queue.next());
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        this.spaces.forEach((space) => searcher.feedLexerItem(space));
    };
}

/**
   expression
    : 
        Even
        | Odd
        | (Combinator ws)? selectorGroup
        | Minus? Number (ident ws (( Plus | Minus ) ws Number)?)? ws ( Of ws selectorGroup)? )?
        | ident
        
    ;
 */
export class Expression implements Matcher {
    even = new LexerItem("Even");
    odd = new LexerItem("Odd");
    combinator = new Combinator();
    ws1 = new Ws();
    selectorGroup1 = new SelectorGroup();
    minus1 = new LexerItem("Minus");
    number1 = new LexerItem("Number");
    ident1 = new LexerItem("Ident");
    ws2 = new Ws();
    plus = new LexerItem("Plus");
    minus2 = new LexerItem("Minus");
    ws3 = new Ws();
    number2 = new LexerItem("Number");
    ws4 = new Ws();
    of = new LexerItem("Of");
    ws5 = new Ws();
    selectorGroup2 = new SelectorGroup();
    ident2 = new LexerItem("Ident");

    functionalPseudo: FunctionalPseudo;
    constructor(functionalPseudo: FunctionalPseudo) {
        this.functionalPseudo = functionalPseudo;
    }

    consumed = () => {
        if (this.ident2.value) {
            return true;
        }
        if (this.even.value || this.odd.value || this.selectorGroup1.consumed()) {
            return true;
        }
        const ofMissing = !this.of.value && !this.selectorGroup2.consumed();
        const ofComplete = this.of.value && this.selectorGroup2.consumed();
    
        if (this.number1.value) {
            if (this.ident1.value) {
                const optionalGroupMissing = !this.plus.value && !this.minus2.value && !this.number2.value;
                const optionalGroupComplete = (this.plus.value || this.minus2.value) && this.number2.value;
                if (optionalGroupComplete || optionalGroupMissing) {
                    return Boolean(ofMissing || ofComplete);
                }
            } else if (!this.plus.value && !this.minus2.value && !this.number2.value) {
                return Boolean(ofMissing || ofComplete);
            }
        }
        return false;
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "Ident" && !this.number1.value && !this.minus1.value) {
            this.ident2.value = current.value;
            return queue.next();
        }
        if (current.type === "Even") {
            this.even.value = current.value;
            return queue.next();
        }
        if (current.type === "Odd") {
            this.odd.value = current.value;
            return queue.next();
        }
        if (!this.minus1.value && !this.number1.value) {
            const tryConsumeCombinator = this.combinator.process(queue);
            if (this.combinator.consumed()) {
                const tryWs = this.ws1.process(tryConsumeCombinator);
                return this.process(tryWs);
            }
            const tryConsumeSelectorGroup = this.selectorGroup1.process(queue);
            if (this.selectorGroup1.consumed()) {
                return tryConsumeSelectorGroup;
            }
        }
        if (!this.number1.value && current.type === "Minus") {
            this.minus1.value = current.value;
            return this.process(queue.next());
        }
        if (!this.ident1.value && current.type === "Number") {
            this.number1.value = current.value;
            return this.process(queue.next());
        }
        if (this.number1.value && current.type === "Ident") {
            this.ident1.value = current.value;
            const tryWs = this.ws2.process(queue.next());
            return this.process(tryWs);
        }
        if (this.ident1.value) {
            if (!this.minus2.value && current.type === "Plus") {
                this.plus.value = current.value;
                const tryWs = this.ws3.process(queue.next());
                return this.process(tryWs);
            }
            if (!this.plus.value && current.type === "Minus") {
                this.minus2.value = current.value;
                const tryWs = this.ws3.process(queue.next());
                return this.process(tryWs);
            }
            if (this.plus.value || this.minus2.value && current.type === "Number") {
                this.number2.value = current.value;
                const tryWs = this.ws4.process(queue.next());
                return this.process(tryWs);
            }
        }
        if (this.number1.value && current.type === "Of") {
            this.of.value = current.value;
            const tryWs = this.ws5.process(queue.next());
            return this.process(tryWs);
        }
        if (this.of.value) {
            const tryConsumeSelectorGroup = this.selectorGroup1.process(queue);
            if (this.selectorGroup1.consumed()) {
                return tryConsumeSelectorGroup;
            }
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.even);
        searcher.feedLexerItem(this.odd);
        searcher.feedParserItem(this.combinator);
        searcher.feedParserItem(this.ws1);
        searcher.feedParserItem(this.selectorGroup1);
        searcher.feedLexerItem(this.minus1);
        searcher.feedLexerItem(this.number1);
        searcher.feedLexerItem(this.ident1);
        searcher.feedParserItem(this.ws2);
        searcher.feedLexerItem(this.plus);
        searcher.feedLexerItem(this.minus2);
        searcher.feedParserItem(this.ws3);
        searcher.feedLexerItem(this.number2);
        searcher.feedParserItem(this.ws4);
        searcher.feedLexerItem(this.of);
        searcher.feedParserItem(this.ws5);
        searcher.feedParserItem(this.selectorGroup2);
        searcher.feedLexerItem(this.ident2);
    };
    getIndex = (element: HtmlElement) => {
        const childrenOfType = () => element.parent.children().filter((otherChild) => otherChild.getTagName() === element.getTagName());
        const getIndexOfType = (childrenOfType: HtmlElement[]) => childrenOfType.findIndex((child) => child.identifier === element.identifier);
        switch (this.functionalPseudo.funct.value) {
            case "nth-child(":
                return element.parent.getIndex(element);
            case "nth-last-child(":
                return Math.max(-1, element.parent.children().length - 1 - element.parent.getIndex(element));
            case "nth-last-of-type(":
                const lastOfType = childrenOfType();
                return Math.max(-1, lastOfType.length - 1 - getIndexOfType(lastOfType));
            case "nth-of-type(":
                return getIndexOfType(childrenOfType());
            default:
                return element.parent.getIndex(element);
        }
    };
    match = (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[],
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        if (this.functionalPseudo.funct.value === ":lang") {
            if (this.ident1.value) {
                return htmlElements.filter((htmlElements) => htmlElements.attributes()["lang"] === this.ident1.value);
            }
            return [];
        }
        if (this.functionalPseudo.funct.value === "eq(") {
            const index = parseInt(this.ident2.value);
            if (!isNaN(index)) {
                return htmlElements.filter((_, i) => index >= 0 ? i === index : (htmlElements.length - 1 + index) === i);
            }
            return [];
        }
        if (this.functionalPseudo.funct.value === "contains(") {
            if (this.ident2.value) {
                return htmlElements.filter((htmlElement) => {
                    return htmlElement.texts().some((text) => text.includes(this.ident2.value));
                });
            }
            return [];
        }
        if (this.functionalPseudo.funct.value === "is(" || this.functionalPseudo.funct.value === "where(") {
            if (this.selectorGroup1.consumed() && !this.combinator.consumed()) {
                return this.selectorGroup1.match(htmlElements, allHtmlElements);
            }
            return [];
        }
        if (this.functionalPseudo.funct.value === "has(") {
            if (this.selectorGroup1.consumed()) {
                const matched = this.selectorGroup1.match(htmlElements, allHtmlElements);
                if (!this.combinator.consumed() || this.combinator.space.value) {
                    return htmlElements.filter((value) => {
                        return matched.some(matched => value.descendants().some((descendant) => descendant.identifier === matched.identifier))
                    });
                }
                if (this.combinator.greater.value) {
                    return htmlElements.filter((value) => {
                        return matched.some(matched => value.content().getIndex(matched) !== -1)
                    });
                }
                if (this.combinator.plus.value) {
                    return htmlElements.filter((value) => {
                        return matched.some(matched => value.parent.prevSibling(value)?.identifier === matched.identifier);
                    });
                }
                if (this.combinator.tilde.value) {
                    return htmlElements.filter((value) => {
                        return matched.some(matched => value.parent.nextSibling(value)?.identifier === matched.identifier);
                    });
                }
            }
            return [];
        }
        if (this.even.value) {
            return htmlElements.filter((element) => (this.getIndex(element) + 1) % 2 === 0);
        }
        if (this.odd.value) {
            return htmlElements.filter((element) => (this.getIndex(element) + 1) % 2 === 1);
        }
        const ofQuery = this.selectorGroup2.match(htmlElements, allHtmlElements);
        if (ofQuery.length === 0) {
            return ofQuery;
        }
        if (this.number1.value) {
            if (!this.ident1.value) {
                if (!this.minus1.value) {
                    const index = parseInt(this.number1.value);
                    const element = ofQuery.find((element) => this.getIndex(element) + 1 === index);
                    return element ? [element] : [];
                }
            } else {
                const modifier = (this.minus1.value ? -1 : 1) * parseInt(this.number1.value);
                const addition = (this.minus2.value ? -1 : (this.plus.value ? 1 : 0)) * (parseInt(this.number2.value) || 0);
                const upperIndexMatch = Math.max(...ofQuery.map((element) => this.getIndex(element) + 1));
                const indexAcc: Record<number, true> = {};
                for (let i = 1; i < ofQuery.length + 1; i++) {
                    const resultIndex = modifier * i + addition;
                    if (resultIndex < 0 || resultIndex > upperIndexMatch) {
                        break;
                    }
                    indexAcc[resultIndex] = true;
                }
                return ofQuery.filter((element) => indexAcc[this.getIndex(element) + 1]);
            }
        }
        return [];
    };
}
