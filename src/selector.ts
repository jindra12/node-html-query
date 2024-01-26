import { HtmlDocument, HtmlElement } from "./html";
import { LexerType } from "./lexers";
import { LexerItem, ParserItem, Queue, Searcher } from "./types";
import {
    flatten,
    inputValidation,
    matchAttribute,
    rangeComparator,
} from "./utils";

export interface Matcher extends ParserItem {
    match: (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[],
        namespaces: Record<string, string>
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
    consumed = () => {
        return (
            this.selector.consumed() &&
            (this.selectors.length === 0 ||
                this.selectors.every(
                    ({ comma, selector: selector, ws }) =>
                        comma.value && selector.consumed() && ws.consumed()
                ))
        );
    };
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
            if (lastArrayItem?.comma.value && !lastArrayItem.selector.consumed()) {
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
        namespaces: Record<string, string>
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        return Object.values(
            [this.selector, ...this.selectors.map((s) => s.selector)].reduce(
                (result: Record<string, HtmlElement>, selector) => {
                    selector
                        .match(htmlElements, allHtmlElements, namespaces)
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
    : simpleSelectorSequence ( combinator simpleSelectorSequence )*
    ;
 */
export class Selector implements Matcher {
    simpleSelectorSequence = new SimpleSelectorSequence();
    sequences: {
        combinator: Combinator;
        simpleSelectorSequence: SimpleSelectorSequence;
    }[] = [];
    consumed = () => {
        return (
            this.simpleSelectorSequence.consumed() &&
            this.sequences.every(
                ({ combinator, simpleSelectorSequence }) =>
                    combinator.consumed() && simpleSelectorSequence.consumed()
            )
        );
    };
    process = (queue: Queue): Queue => {
        if (!this.simpleSelectorSequence.consumed()) {
            const tryProcess = this.simpleSelectorSequence.process(queue);
            if (this.simpleSelectorSequence.consumed()) {
                return this.process(tryProcess);
            }
        }
        const lastArrayItem = this.sequences[this.sequences.length - 1];
        if (
            !lastArrayItem ||
            (lastArrayItem.simpleSelectorSequence.consumed() &&
                lastArrayItem.combinator.consumed())
        ) {
            const combinator = new Combinator();
            const tryCombinator = combinator.process(queue);
            if (combinator.consumed()) {
                const simpleSelectorSequence = new SimpleSelectorSequence();
                const trySimple = simpleSelectorSequence.process(tryCombinator);
                if (simpleSelectorSequence.consumed()) {
                    this.sequences.push({
                        combinator: combinator,
                        simpleSelectorSequence: simpleSelectorSequence,
                    });
                    return this.process(trySimple);
                } else {
                    this.sequences.push({
                        combinator: new Combinator(),
                        simpleSelectorSequence: new SimpleSelectorSequence(),
                    });
                }
            }
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedParserItem(this.simpleSelectorSequence);
        this.sequences.forEach((sequence) => {
            searcher.feedParserItem(sequence.combinator);
            searcher.feedParserItem(sequence.simpleSelectorSequence);
        });
    };
    match = (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[],
        namespaces: Record<string, string>
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        const filtered = this.simpleSelectorSequence.match(
            htmlElements,
            allHtmlElements,
            namespaces
        );
        return this.sequences.reduce(
            (filtered, { combinator, simpleSelectorSequence }) => {
                const applyCombinator = combinator.match(
                    filtered,
                    allHtmlElements,
                    namespaces
                );
                const applySequence = simpleSelectorSequence.match(
                    applyCombinator,
                    allHtmlElements,
                    namespaces
                );
                return applySequence;
            },
            filtered
        );
    };
}

/**
    combinator
        : ws Plus ws
        | ws Greater ws
        | ws Tilde ws
        | ws Space
        ;
 */
export class Combinator implements Matcher {
    ws1 = new Ws();
    plus = new LexerItem("Plus");
    greater = new LexerItem("Greater");
    tilde = new LexerItem("Tilde");
    space = new LexerItem("Space");
    ws2 = new Ws();
    consumed = () => {
        return Boolean(
            this.plus.value ||
            this.greater.value ||
            this.tilde.value ||
            this.space.value
        );
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (!this.ws1.consumed()) {
            const tryProcessWs1 = this.ws1.process(queue);
            if (this.ws1.consumed()) {
                return this.process(tryProcessWs1);
            }
        }
        switch (current.type) {
            case "Plus":
                this.plus.value = current.value;
                const tryWsPlus = this.ws2.process(queue.next());
                return tryWsPlus;
            case "Greater":
                this.greater.value = current.value;
                const tryWsGreater = this.ws2.process(queue.next());
                return tryWsGreater;
            case "Tilde":
                this.tilde.value = current.value;
                const tryWsTilde = this.ws2.process(queue.next());
                return tryWsTilde;
            default:
                if (this.ws1.consumed()) {
                    const extraSpace = this.ws1.spaces.pop();
                    if (extraSpace) {
                        this.space.value = extraSpace.value;
                    }
                }
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedParserItem(this.ws1);
        searcher.feedLexerItem(this.plus);
        searcher.feedLexerItem(this.greater);
        searcher.feedLexerItem(this.tilde);
        searcher.feedLexerItem(this.space);
        searcher.feedParserItem(this.ws2);
    };
    match = (
        htmlElements: HtmlElement[],
        _: HtmlElement[],
        __: Record<string, string>
    ): HtmlElement[] => {
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
            return flatten(
                htmlElements.map((element) => {
                    const index = element.parent.getIndex(element);
                    return element.parent
                        .children()
                        .filter((child) => child.parent.getIndex(child) > index);
                })
            );
        }
        if (this.space.value) {
            return htmlElements
                .map((element) => element.descendants())
                .reduce((manyElements, elements) => {
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

    consumed = () => {
        const hasPreface =
            this.typeSelector.consumed() || this.universal.consumed();
        if (hasPreface) {
            return true;
        }
        return this.modifiers.length > 0;
    };
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
        const tryProcessNegation = negation.process(queue);
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
        allHtmlElements: HtmlElement[],
        namespaces: Record<string, string>
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        const typeMatched = this.typeSelector.match(
            htmlElements,
            allHtmlElements,
            namespaces
        );
        const universalMatched = this.universal.match(
            typeMatched,
            allHtmlElements,
            namespaces
        );

        return this.modifiers.reduce((htmlElements, modifier) => {
            if (modifier.attrib.consumed()) {
                return modifier.attrib.match(htmlElements, allHtmlElements, namespaces);
            }
            if (modifier.className.consumed()) {
                return modifier.className.match(
                    htmlElements,
                    allHtmlElements,
                    namespaces
                );
            }
            if (modifier.hash.value) {
                const hashValue = modifier.hash.value.replace(/^#/, "");
                return htmlElements.filter((element) =>
                    matchAttribute(element.attributes(), "id", hashValue, "[attr=value]")
                );
            }
            if (modifier.negation.consumed()) {
                return modifier.negation.match(
                    htmlElements,
                    allHtmlElements,
                    namespaces
                );
            }
            if (modifier.pseudo.consumed()) {
                return modifier.pseudo.match(htmlElements, allHtmlElements, namespaces);
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
    consumed = () => {
        return Boolean(
            this.pseudoGeneral.value &&
            (this.ident.value || this.functionalPseudo.consumed())
        );
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "PseudoGeneral" && !this.pseudoGeneral.value) {
            this.pseudoGeneral.value = current.value;
            return this.process(queue.next());
        }
        if (current.type === "Ident" && !this.ident.value) {
            this.ident.value = current.value;
            return this.process(queue.next());
        }
        if (!this.functionalPseudo.consumed()) {
            const tryFunctionalPseudo = this.functionalPseudo.process(queue);
            if (this.functionalPseudo.consumed()) {
                return tryFunctionalPseudo;
            }
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
        allHtmlElements: HtmlElement[],
        namespaces: Record<string, string>
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        if (this.functionalPseudo.consumed()) {
            return this.functionalPseudo.match(
                htmlElements,
                allHtmlElements,
                namespaces
            );
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
                    return matchAttribute(
                        element.attributes(),
                        "type",
                        "checkbox",
                        "[attr=value]"
                    );
                case "checked":
                    return matchAttribute(
                        element.attributes(),
                        "checked",
                        true,
                        "[attr]"
                    );
                case "disabled":
                    return matchAttribute(
                        element.attributes(),
                        "disabled",
                        true,
                        "[attr]"
                    );
                case "empty":
                    return children.length === 0 && element.texts().join("") === "";
                case "enabled":
                    return matchAttribute(element.attributes(), "disabled", true, "not");
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
                    return ["input", "button", "textarea", "select"].includes(
                        element.tagName.value
                    );
                case "password":
                    return (
                        element.tagName.value === "input" &&
                        element.attributes()["type"] === "password"
                    );
                case "radio":
                    return (
                        element.tagName.value === "input" &&
                        element.attributes()["type"] === "radio"
                    );
                case "reset":
                    return element.attributes()["type"] === "reset";
                case "submit":
                    return element.attributes()["type"] === "submit";
                case "text":
                    return (
                        element.tagName.value === "input" &&
                        element.attributes()["type"] === "text"
                    );
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
        if (current.type === "Function_" && !this.funct.value) {
            this.funct.value = current.value;
            const tryWs = this.ws.process(queue.next());
            return this.process(tryWs);
        }
        if (this.funct.value && !this.expression.consumed()) {
            const tryExpression = this.expression.process(queue);
            if (this.expression.consumed()) {
                return this.process(tryExpression);
            }
        }
        if (
            this.expression.consumed() &&
            !this.backBrace.value &&
            current.type === "BackBrace"
        ) {
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
    match = (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[],
        namespaces: Record<string, string>
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        return this.expression.match(htmlElements, allHtmlElements, namespaces);
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
        return Boolean(this.namespace.value);
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (
            current.type === "Ident" &&
            !this.universal.value &&
            !this.ident.value
        ) {
            this.ident.value = current.value;
            return this.process(queue.next());
        }
        if (current.type === "Namespace" && !this.namespace.value) {
            this.namespace.value = current.value;
            return queue.next();
        }
        if (
            current.type === "Universal" &&
            !this.universal.value &&
            !this.ident.value
        ) {
            this.universal.value = current.value;
            return this.process(queue.next());
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.ident);
        searcher.feedLexerItem(this.universal);
        searcher.feedLexerItem(this.namespace);
    };
    match = (
        htmlElements: HtmlElement[],
        _: HtmlElement[],
        namespaces: Record<string, string>
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        if (this.universal.value || !this.ident.value) {
            return htmlElements;
        }
        return flatten(
            htmlElements
                .filter((htmlElement) => {
                    const attributes = htmlElement.attributes();
                    return attributes["xmlns"] === namespaces[this.ident.value];
                })
                .map((htmlElement) => htmlElement.descendants())
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
        if (!this.typeNamespacePrefix.consumed()) {
            const tryProcessNamespace = this.typeNamespacePrefix.process(queue);
            if (this.typeNamespacePrefix.consumed()) {
                return this.process(tryProcessNamespace);
            }
        }
        if (!this.elementName.consumed()) {
            const tryProcessElementName = this.elementName.process(queue);
            if (this.elementName.consumed()) {
                return tryProcessElementName;
            }
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedParserItem(this.typeNamespacePrefix);
        searcher.feedParserItem(this.elementName);
    };
    match = (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[],
        namespaces: Record<string, string>
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        const typeMatched = this.typeNamespacePrefix.match(
            htmlElements,
            allHtmlElements,
            namespaces
        );
        return this.elementName.match(typeMatched, allHtmlElements, namespaces);
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
    match = (
        htmlElements: HtmlElement[],
        _: HtmlElement[],
        __: Record<string, string>
    ): HtmlElement[] => {
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
        if (!this.typeNamespacePrefix.consumed()) {
            const tryProcessNamespace = this.typeNamespacePrefix.process(queue);
            if (this.typeNamespacePrefix.consumed()) {
                return this.process(tryProcessNamespace);
            }
        }
        const current = queue.items[queue.at];
        if (current.type === "Universal" && !this.universal.value) {
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
        allHtmlElements: HtmlElement[],
        namespaces: Record<string, string>
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        return this.typeNamespacePrefix.match(
            htmlElements,
            allHtmlElements,
            namespaces
        );
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
    match = (
        htmlElements: HtmlElement[],
        _: HtmlElement[],
        __: Record<string, string>
    ): HtmlElement[] => {
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
    numIdent = new LexerItem("Number");
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
        if (
            hasComparator &&
            !this.ident2.value &&
            !this.stringIdent.value &&
            !this.numIdent.value
        ) {
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
        if (!this.typeNamespacePrefix.consumed()) {
            const tryTypeNameSpace = this.typeNamespacePrefix.process(queue);
            if (this.typeNamespacePrefix.consumed()) {
                return this.process(tryTypeNameSpace);
            }
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
        if (
            this.ident1.value &&
            !this.ident2.value &&
            !this.stringIdent.value &&
            !this.numIdent.value
        ) {
            if (current.type === "Ident") {
                this.ident2.value = current.value;
                const tryWs = this.ws4.process(queue.next());
                return this.process(tryWs);
            }
            if (current.type === "String_") {
                this.stringIdent.value = current.value;
                const tryWs = this.ws4.process(queue.next());
                return this.process(tryWs);
            }
            if (current.type === "Number") {
                this.numIdent.value = current.value;
                const tryWs = this.ws4.process(queue.next());
                return this.process(tryWs);
            }
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
        searcher.feedLexerItem(this.numIdent);
        searcher.feedParserItem(this.ws4);
        searcher.feedLexerItem(this.squareBracketEnd);
    };
    match = (
        htmlElements: HtmlElement[],
        _: HtmlElement[],
        __: Record<string, string>
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        return htmlElements.filter((element) => {
            const value =
                this.ident2.value || this.stringIdent.value || this.numIdent.value;
            const name = `${this.typeNamespacePrefix.consumed() &&
                    this.typeNamespacePrefix.ident.value
                    ? `${this.typeNamespacePrefix.ident.value}:${this.ident1.value}`
                    : this.ident1.value
                }`;
            if (!value) {
                return matchAttribute(element.attributes(), name, true, "[attr]");
            }
            return matchAttribute(
                element.attributes(),
                name,
                value,
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
            );
        });
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
        if (!this.negationArg.consumed()) {
            const tryNegation = this.negationArg.process(queue);
            if (this.negationArg.consumed()) {
                const tryWs = this.ws2.process(tryNegation);
                return this.process(tryWs);
            }
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
        allHtmlElements: HtmlElement[],
        namespaces: Record<string, string>
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        const matched = this.negationArg
            .match(htmlElements, allHtmlElements, namespaces)
            .reduce((ids: Record<string, true>, element) => {
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
        if (!this.typeSelector.consumed()) {
            const tryProcessSelector = this.typeSelector.process(queue);
            if (this.typeSelector.consumed()) {
                return tryProcessSelector;
            }
        }
        if (!this.universal.consumed()) {
            const tryUniversal = this.universal.process(queue);
            if (this.universal.consumed()) {
                return tryUniversal;
            }
        }
        if (queue.items[queue.at].type === "Hash" && !this.hash.value) {
            this.hash.value = queue.items[queue.at].value;
            return queue.next();
        }
        if (!this.className.consumed()) {
            const tryClassName = this.className.process(queue);
            if (this.className.consumed()) {
                return tryClassName;
            }
        }
        if (!this.attrib.consumed()) {
            const tryAttrib = this.attrib.process(queue);
            if (this.attrib.consumed()) {
                return tryAttrib;
            }
        }
        if (!this.pseudo.consumed()) {
            const tryPseudo = this.pseudo.process(queue);
            if (this.pseudo.consumed()) {
                return tryPseudo;
            }
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
        allHtmlElements: HtmlElement[],
        namespaces: Record<string, string>
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        if (this.typeSelector.consumed()) {
            return this.typeSelector.match(htmlElements, htmlElements, namespaces);
        }
        if (this.universal.consumed()) {
            return this.universal.match(htmlElements, htmlElements, namespaces);
        }
        if (this.hash.value) {
            return htmlElements.filter((element) =>
                matchAttribute(
                    element.attributes(),
                    "id",
                    this.hash.value.slice(1),
                    "[attr=value]"
                )
            );
        }
        if (this.attrib.consumed()) {
            return this.attrib.match(htmlElements, allHtmlElements, namespaces);
        }
        if (this.pseudo.consumed()) {
            return this.pseudo.match(htmlElements, allHtmlElements, namespaces);
        }
        if (this.className.consumed()) {
            return this.className.match(htmlElements, allHtmlElements, namespaces);
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
        return this.spaces.length > 0;
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
        | Combinator? selectorGroup
        | Minus? Number (ident ws (( Plus | Minus ) ws Number)?)? ws ( Of ws selectorGroup)? )?
        | ident
        
    ;
 */
export class Expression implements Matcher {
    even = new LexerItem("Even");
    odd = new LexerItem("Odd");
    combinator = new Combinator();
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

    functionalPseudo: FunctionalPseudo;
    constructor(functionalPseudo: FunctionalPseudo) {
        this.functionalPseudo = functionalPseudo;
    }

    consumed = () => {
        if (this.even.value || this.odd.value || this.selectorGroup1.consumed()) {
            return true;
        }
        const ofMissing = !this.of.value && !this.selectorGroup2.consumed();
        const ofComplete = this.of.value && this.selectorGroup2.consumed();

        const validOf = Boolean(ofMissing || ofComplete);

        const optionalGroupMissing = Boolean(
            !this.plus.value && !this.minus2.value && !this.number2.value
        );
        const optionalGroupComplete = Boolean(
            (this.plus.value || this.minus2.value) && this.number2.value
        );

        const validGroup = optionalGroupComplete || optionalGroupMissing;

        const validOptionals = validGroup && validOf;

        if (this.ident1.value || this.number1.value) {
            return validOptionals;
        }

        return false;
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "Even") {
            this.even.value = current.value;
            return queue.next();
        }
        if (current.type === "Odd") {
            this.odd.value = current.value;
            return queue.next();
        }
        if (
            !this.minus1.value &&
            !this.ident1.value &&
            !this.plus.value &&
            !this.minus2.value &&
            !this.number1.value
        ) {
            if (!this.combinator.consumed()) {
                const tryConsumeCombinator = this.combinator.process(queue);
                if (this.combinator.consumed()) {
                    return this.process(tryConsumeCombinator);
                }
            }
            const fnPseudo = this.functionalPseudo.funct.value;
            const selectorExempt = fnPseudo === "lang(" || fnPseudo === "contains(" || fnPseudo === "eq(" || current.value === "n";
            if (!this.selectorGroup1.consumed() && !selectorExempt) {
                const tryConsumeSelectorGroup = this.selectorGroup1.process(queue);
                if (this.selectorGroup1.consumed()) {
                    return tryConsumeSelectorGroup;
                }
            }
        }
        if (!this.number1.value && !this.minus1.value && current.type === "Minus") {
            this.minus1.value = current.value;
            return this.process(queue.next());
        }
        if (
            !this.ident1.value &&
            !this.number1.value &&
            current.type === "Number"
        ) {
            this.number1.value = current.value;
            const tryWs = this.ws2.process(queue.next());
            return this.process(tryWs);
        }
        if (!this.ident1.value && current.type === "Ident") {
            this.ident1.value = current.value;
            const tryWs = this.ws2.process(queue.next());
            return this.process(tryWs);
        }
        if (this.ident1.value) {
            if (!this.minus2.value && !this.plus.value && current.type === "Plus") {
                this.plus.value = current.value;
                const tryWs = this.ws3.process(queue.next());
                return this.process(tryWs);
            }
            if (!this.plus.value && !this.minus2.value && current.type === "Minus") {
                this.minus2.value = current.value;
                const tryWs = this.ws3.process(queue.next());
                return this.process(tryWs);
            }
            if (
                (this.plus.value || this.minus2.value) &&
                !this.number2.value &&
                current.type === "Number"
            ) {
                this.number2.value = current.value;
                const tryWs = this.ws4.process(queue.next());
                return this.process(tryWs);
            }
        }
        if (this.number1.value && !this.of.value && current.type === "Of") {
            this.of.value = current.value;
            const tryWs = this.ws5.process(queue.next());
            return this.process(tryWs);
        }
        if (this.of.value && !this.selectorGroup2.consumed()) {
            const tryConsumeSelectorGroup = this.selectorGroup2.process(queue);
            if (this.selectorGroup2.consumed()) {
                return tryConsumeSelectorGroup;
            }
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedLexerItem(this.even);
        searcher.feedLexerItem(this.odd);
        searcher.feedParserItem(this.combinator);
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
    };
    getIndex = (element: HtmlElement, selected: HtmlElement[]) => {
        const childrenOfType = () => selected.filter(
            (otherChild) =>
                otherChild.getTagName() === element.getTagName()
        );
        const getIndexOfType = (childrenOfType: HtmlElement[]) =>
            childrenOfType.findIndex(
                (child) => child.identifier === element.identifier
            );
        const selectedMap = selected.reduce((selectedMap: Record<string, true>, element) => {
            selectedMap[element.identifier] = true;
            return selectedMap;
        }, {});
        const filter = (element: HtmlElement) => selectedMap[element.identifier];
        switch (this.functionalPseudo.funct.value) {
            case "nth-child(":
                return element.parent.getIndex(element, filter) + 1;
            case "nth-last-child(":
                return Math.max(
                    -1,
                    element.parent.children().filter(filter).length - 
                    (this.even.value || this.odd.value ? -1 : 0) - 
                    element.parent.getIndex(element, filter)
                );
            case "nth-last-of-type(":
                const lastOfType = childrenOfType();
                return Math.max(-1, lastOfType.length - getIndexOfType(lastOfType));
            case "nth-of-type(":
                return getIndexOfType(childrenOfType()) + 1;
            default:
                return element.parent.getIndex(element, filter);
        }
    };
    match = (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[],
        namespaces: Record<string, string>
    ): HtmlElement[] => {
        if (!this.consumed()) {
            return htmlElements;
        }
        if (this.functionalPseudo.funct.value === "lang(") {
            if (this.ident1.value) {
                return htmlElements.filter(
                    (htmlElements) =>
                        htmlElements.attributes()["lang"] === this.ident1.value
                );
            }
            return [];
        }
        if (this.functionalPseudo.funct.value === "eq(") {
            const index = parseInt(this.ident1.value || this.number1.value);
            if (!isNaN(index)) {
                const multiplied = index * (!this.minus1.value ? 1 : -1);
                return htmlElements.filter((_, i) =>
                    multiplied >= 0 ? i === multiplied : htmlElements.length + multiplied === i
                );
            }
            return [];
        }
        if (this.functionalPseudo.funct.value === "contains(") {
            const contains = this.ident1.value || this.number1.value;
            if (contains) {
                return htmlElements.filter((htmlElement) => {
                    return htmlElement
                        .texts()
                        .some((text) => text.includes(contains));
                });
            }
            return [];
        }
        if (
            this.functionalPseudo.funct.value === "is(" ||
            this.functionalPseudo.funct.value === "where("
        ) {
            if (this.selectorGroup1.consumed() && !this.combinator.consumed()) {
                return this.selectorGroup1.match(
                    htmlElements,
                    allHtmlElements,
                    namespaces
                );
            }
            return [];
        }
        if (this.functionalPseudo.funct.value === "has(") {
            if (this.selectorGroup1.consumed()) {
                const matched = this.selectorGroup1.match(
                    htmlElements,
                    allHtmlElements,
                    namespaces
                );
                if (!this.combinator.consumed() || this.combinator.space.value) {
                    return htmlElements.filter((value) => {
                        return matched.some((matched) =>
                            value
                                .descendants()
                                .some(
                                    (descendant) => descendant.identifier === matched.identifier
                                )
                        );
                    });
                }
                if (this.combinator.greater.value) {
                    return htmlElements.filter((value) => {
                        return matched.some(
                            (matched) => value.content().getIndex(matched) !== -1
                        );
                    });
                }
                if (this.combinator.plus.value) {
                    return htmlElements.filter((value) => {
                        return matched.some(
                            (matched) =>
                                value.parent.prevSibling(value)?.identifier ===
                                matched.identifier
                        );
                    });
                }
                if (this.combinator.tilde.value) {
                    return htmlElements.filter((value) => {
                        return matched.some(
                            (matched) =>
                                value.parent.nextSibling(value)?.identifier ===
                                matched.identifier
                        );
                    });
                }
            }
            return [];
        }
        if (this.even.value) {
            return htmlElements.filter(
                (element) => this.getIndex(element, htmlElements) % 2 === 0
            );
        }
        if (this.odd.value) {
            return htmlElements.filter(
                (element) => this.getIndex(element, htmlElements) % 2 === 1
            );
        }
        const ofQuery = this.selectorGroup2.match(
            htmlElements,
            allHtmlElements,
            namespaces
        );
        if (ofQuery.length === 0) {
            return ofQuery;
        }
        if (!this.ident1.value) {
            if (!this.minus1.value) {
                const index = parseInt(this.number1.value || "1");
                const element = ofQuery.find(
                    (element) => this.getIndex(element, htmlElements) === index
                );
                return element ? [element] : [];
            }
        } else {
            const modifier =
                (this.minus1.value ? -1 : 1) * parseInt(this.number1.value || "1");
            const addition =
                (this.minus2.value ? -1 : this.plus.value ? 1 : 0) *
                (parseInt(this.number2.value) || 0);
            const indexAcc: Record<number, true> = {};
            for (let i = 0; i < ofQuery.length + 1; i++) {
                const resultIndex = modifier * i + addition;
                if (resultIndex < 0) {
                    break;
                }
                indexAcc[resultIndex] = true;
            }
            return ofQuery.filter(
                (element) => indexAcc[this.getIndex(element, htmlElements)]
            );
        }
        return [];
    };
}
