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
    selector?: Selector;
    selectors: Array<LexerItem<"Comma"> | Ws | Selector> = [];

    consumed = () => {
        return Boolean(this.selector?.consumed());
    };

    process = (queue: Queue): Queue => {
        if (!this.selector?.consumed()) {
            const selector = new Selector();
            const tryConsumeSelector = selector.process(queue);
            if (selector.consumed()) {
                this.selector = selector;
                return this.process(tryConsumeSelector);
            }
        } else {
            const current = queue.items[queue.at];
            if (current.type === "Comma") {
                this.selectors.push(new LexerItem("Comma", current.value));
                const ws = new Ws();
                const tryWs = ws.process(queue.next());
                this.selectors.push(ws);
                const selector = new Selector();
                const trySelector = selector.process(tryWs);
                if (selector.consumed()) {
                    this.selectors.push(selector);
                    return this.process(trySelector);
                }
            }
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedParserItem(this.selector);
        this.selectors.forEach((selector) => {
            if (selector instanceof LexerItem) {
                searcher.feedLexerItem(selector);
            } else {
                searcher.feedParserItem(selector);
            }
        });
    };
    match = (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[],
        namespaces: Record<string, string>
    ): HtmlElement[] => {
        let selection: HtmlElement[] = [];
        const selectors = [this.selector, ...this.selectors].filter(
            (s): s is Selector => s instanceof Selector
        );
        if (selectors.length === 1) {
            selection = selectors[0].match(htmlElements, allHtmlElements, namespaces);
        } else {
            selection = Object.values(
                selectors.reduce((result: Record<string, HtmlElement>, selector) => {
                    selector
                        ?.match(htmlElements, allHtmlElements, namespaces)
                        .forEach((htmlElement) => {
                            result[htmlElement.identifier] = htmlElement;
                        });
                    return result;
                }, {})
            );
        }
        return selection;
    };
}

/**
 * selector
    : simpleSelectorSequence ( combinator simpleSelectorSequence )*
    ;
 */
export class Selector implements Matcher {
    simpleSelectorSequence?: SimpleSelectorSequence;
    sequences: Array<Combinator | SimpleSelectorSequence> = [];
    consumed = () => {
        return Boolean(this.simpleSelectorSequence?.consumed());
    };
    process = (queue: Queue): Queue => {
        if (!this.simpleSelectorSequence?.consumed()) {
            const simpleSelectorSequence = new SimpleSelectorSequence();
            const tryProcess = simpleSelectorSequence.process(queue);
            if (simpleSelectorSequence.consumed()) {
                this.simpleSelectorSequence = simpleSelectorSequence;
                return this.process(tryProcess);
            }
        }
        const combinator = new Combinator();
        const tryParse = combinator.process(queue);
        if (combinator.consumed()) {
            const simpleSelectorSequence = new SimpleSelectorSequence();
            const tryParseSelector = simpleSelectorSequence.process(tryParse);
            if (simpleSelectorSequence.consumed()) {
                this.sequences.push(combinator);
                this.sequences.push(simpleSelectorSequence);
                return this.process(tryParseSelector);
            }
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedParserItem(this.simpleSelectorSequence);
        this.sequences.forEach((sequence) => {
            searcher.feedParserItem(sequence);
        });
    };
    match = (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[],
        namespaces: Record<string, string>
    ): HtmlElement[] => {
        const filtered =
            this.simpleSelectorSequence?.match(
                htmlElements,
                allHtmlElements,
                namespaces
            ) || htmlElements;
        return this.sequences.reduce((filtered, selector) => {
            return selector.match(filtered, allHtmlElements, namespaces);
        }, filtered);
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
    ws1?: Ws;
    plus?: LexerItem<"Plus">;
    greater?: LexerItem<"Greater">;
    tilde?: LexerItem<"Tilde">;
    space?: LexerItem<"Space">;
    ws2?: Ws;
    consumed = () => {
        return Boolean(
            this.plus?.value ||
            this.greater?.value ||
            this.tilde?.value ||
            this.space?.value
        );
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (!this.ws1?.consumed()) {
            const ws = new Ws();
            const tryProcessWs1 = ws.process(queue);
            if (ws.consumed()) {
                this.ws1 = ws;
                return this.process(tryProcessWs1);
            }
        }
        switch (current.type) {
            case "Plus":
                this.plus = new LexerItem("Plus", current.value);
                const wsPlus = new Ws();
                const tryWsPlus = wsPlus.process(queue.next());
                if (wsPlus.consumed()) {
                    this.ws2 = wsPlus;
                }
                return tryWsPlus;
            case "Greater":
                this.greater = new LexerItem("Greater", current.value);
                const wsGreater = new Ws();
                const tryWsGreater = wsGreater.process(queue.next());
                if (wsGreater.consumed()) {
                    this.ws2 = wsGreater;
                }
                return tryWsGreater;
            case "Tilde":
                this.tilde = new LexerItem("Tilde", current.value);
                const wsTilde = new Ws();
                const tryWsTilde = wsTilde.process(queue.next());
                if (wsTilde.consumed()) {
                    this.ws2 = wsTilde;
                }
                return tryWsTilde;
            default:
                if (this.ws1?.consumed()) {
                    const extraSpace = this.ws1.spaces.pop();
                    if (!this.ws1.consumed()) {
                        this.ws1 = undefined;
                    }
                    if (extraSpace) {
                        this.space = new LexerItem("Space", extraSpace.value);
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
        if (this.plus?.value) {
            return htmlElements
                .map((element) => element.parent.nextSibling(element))
                .filter((element: HtmlElement | undefined): element is HtmlElement =>
                    Boolean(element)
                );
        }
        if (this.greater?.value) {
            return htmlElements
                .map((element) => element.children())
                .reduce((elements: HtmlElement[], children) => {
                    children.forEach((child) => {
                        elements.push(child);
                    });
                    return elements;
                }, []);
        }
        if (this.tilde?.value) {
            return flatten(
                htmlElements.map((element) => {
                    const index = element.parent.getIndex(element, false);
                    return element.parent
                        .children()
                        .filter((child) => child.parent.getIndex(child, false) > index);
                })
            );
        }
        if (this.space?.value) {
            return flatten(htmlElements.map((element) => element.descendants()));
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
    typeSelector?: TypeSelector;
    universal?: Universal;
    modifiers: Array<LexerItem<"Hash"> | ClassName | Attrib | Pseudo | Negation> =
        [];

    consumed = () => {
        return (
            this.typeSelector?.consumed() ||
            this.universal?.consumed() ||
            this.modifiers.length > 0
        );
    };
    process = (queue: Queue): Queue => {
        if (!this.typeSelector?.consumed() && !this.universal?.consumed()) {
            const typeSelector = new TypeSelector();
            const tryTypeSelector = typeSelector.process(queue);
            if (typeSelector.consumed()) {
                this.typeSelector = typeSelector;
                return this.process(tryTypeSelector);
            }
            const universal = new Universal();
            const tryUniversal = universal.process(queue);
            if (universal.consumed()) {
                this.universal = universal;
                return this.process(tryUniversal);
            }
        }
        const current = queue.items[queue.at];
        const hash = new LexerItem("Hash");
        hash.value = current.value;
        if (current.type === "Hash") {
            this.modifiers.push(hash);
            return this.process(queue.next());
        }
        const className = new ClassName();
        const tryProcessClassName = className.process(queue);
        if (className.consumed()) {
            this.modifiers.push(className);
            return this.process(tryProcessClassName);
        }
        const attrib = new Attrib();
        const tryProcessAttrib = attrib.process(queue);
        if (attrib.consumed()) {
            this.modifiers.push(attrib);
            return this.process(tryProcessAttrib);
        }
        const pseudo = new Pseudo();
        const tryProcessPseudo = pseudo.process(queue);
        if (pseudo.consumed()) {
            this.modifiers.push(pseudo);
            return this.process(tryProcessPseudo);
        }
        const negation = new Negation();
        const tryProcessNegation = negation.process(queue);
        if (negation.consumed()) {
            this.modifiers.push(negation);
            return this.process(tryProcessNegation);
        }
        return queue;
    };
    search = (searcher: Searcher) => {
        searcher.feedParserItem(this.typeSelector);
        searcher.feedParserItem(this.universal);
        this.modifiers.forEach((modifier) => {
            if (modifier instanceof LexerItem) {
                searcher.feedLexerItem(modifier);
            } else {
                searcher.feedParserItem(modifier);
            }
        });
    };
    match = (
        htmlElements: HtmlElement[],
        allHtmlElements: HtmlElement[],
        namespaces: Record<string, string>
    ): HtmlElement[] => {
        const typeMatched =
            this.typeSelector?.match(htmlElements, allHtmlElements, namespaces) ||
            htmlElements;
        const universalMatched =
            this.universal?.match(typeMatched, allHtmlElements, namespaces) ||
            typeMatched;

        return this.modifiers.reduce((htmlElements, modifier) => {
            if (modifier instanceof LexerItem) {
                const hashValue = modifier.value.replace(/^#/, "");
                return htmlElements.filter((element) =>
                    matchAttribute(element.attributes(), "id", hashValue, "[attr=value]")
                );
            } else {
                return modifier.match(htmlElements, allHtmlElements, namespaces);
            }
        }, universalMatched);
    };
}

/**
 * pseudo
    : PseudoGeneral ( ident | functionalPseudo )
    ;
 */
export class Pseudo implements Matcher {
    pseudoGeneral?: LexerItem<"PseudoGeneral">;
    ident?: LexerItem<"Ident">;
    functionalPseudo?: FunctionalPseudo;
    consumed = () => {
        return Boolean(
            this.pseudoGeneral?.value &&
            (this.ident?.value || this.functionalPseudo?.consumed())
        );
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "PseudoGeneral" && !this.pseudoGeneral?.value) {
            this.pseudoGeneral = new LexerItem("PseudoGeneral", current.value);
            return this.process(queue.next());
        }
        if (current.type === "Ident" && !this.ident?.value) {
            this.ident = new LexerItem("Ident", current.value);
            return this.process(queue.next());
        }
        if (!this.functionalPseudo?.consumed()) {
            const functionalPseudo = new FunctionalPseudo();
            const tryFunctionalPseudo = functionalPseudo.process(queue);
            if (functionalPseudo.consumed()) {
                this.functionalPseudo = functionalPseudo;
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
        if (this.functionalPseudo) {
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
                        tagName: element.getTagName() || "",
                        order: element.parent.getIndex(element, false),
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
            switch (this.ident?.value) {
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
                    return /^h[1-6]$/.test(element.tagName?.value || "");
                case "image":
                    return element.attributes()["type"] === "image";
                case "input":
                    return ["input", "button", "textarea", "select"].includes(
                        element.tagName?.value || ""
                    );
                case "password":
                    return (
                        element.tagName?.value === "input" &&
                        element.attributes()["type"] === "password"
                    );
                case "radio":
                    return (
                        element.tagName?.value === "input" &&
                        element.attributes()["type"] === "radio"
                    );
                case "reset":
                    return element.attributes()["type"] === "reset";
                case "submit":
                    return element.attributes()["type"] === "submit";
                case "text":
                    return (
                        element.tagName?.value === "input" &&
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
    funct?: LexerItem<"Function_">;
    ws?: Ws;
    expression?: Expression;
    backBrace?: LexerItem<"BackBrace">;
    consumed = () => {
        return Boolean(
            this.funct?.value && this.expression?.consumed() && this.backBrace?.value
        );
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "Function_" && !this.funct?.value) {
            this.funct = new LexerItem("Function_", current.value);
            const ws = new Ws();
            const tryWs = ws.process(queue.next());
            this.ws = ws;
            return this.process(tryWs);
        }
        if (this.funct?.value && !this.expression?.consumed()) {
            const expression = new Expression(this);
            const tryExpression = expression.process(queue);
            if (expression.consumed()) {
                this.expression = expression;
                return this.process(tryExpression);
            }
        }
        if (
            this.expression?.consumed() &&
            !this.backBrace?.value &&
            current.type === "BackBrace"
        ) {
            this.backBrace = new LexerItem("BackBrace", current.value);
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
        return (
            this.expression?.match(htmlElements, allHtmlElements, namespaces) ||
            htmlElements
        );
    };
}

/**
   typeNamespacePrefix
    : ( ident | '*' )? '|'
    ;
 */
export class TypeNamespacePrefix implements Matcher {
    ident?: LexerItem<"Ident">;
    namespace?: LexerItem<"Namespace">;
    universal?: LexerItem<"Universal">;
    consumed = () => {
        return Boolean(this.namespace?.value);
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (
            current.type === "Ident" &&
            !this.universal?.value &&
            !this.ident?.value
        ) {
            this.ident = new LexerItem("Ident", current.value);
            return this.process(queue.next());
        }
        if (current.type === "Namespace" && !this.namespace?.value) {
            this.namespace = new LexerItem("Namespace", current.value);
            return queue.next();
        }
        if (
            current.type === "Universal" &&
            !this.universal?.value &&
            !this.ident?.value
        ) {
            this.universal = new LexerItem("Universal", current.value);
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
        if (this.universal?.value || !this.ident?.value) {
            return htmlElements;
        }
        return flatten(
            htmlElements
                .filter((htmlElement) => {
                    const attributes = htmlElement.attributes();
                    return attributes["xmlns"] === namespaces[this.ident?.value || ""];
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
    typeNamespacePrefix?: TypeNamespacePrefix;
    elementName?: ElementName;

    consumed = () => {
        return Boolean(this.elementName?.consumed());
    };
    process = (queue: Queue): Queue => {
        if (!this.typeNamespacePrefix?.consumed()) {
            const typeNamespacePrefix = new TypeNamespacePrefix();
            const tryProcessNamespace = typeNamespacePrefix.process(queue);
            if (typeNamespacePrefix.consumed()) {
                this.typeNamespacePrefix = typeNamespacePrefix;
                return this.process(tryProcessNamespace);
            }
        }
        if (!this.elementName?.consumed()) {
            const elementName = new ElementName();
            const tryProcessElementName = elementName.process(queue);
            if (elementName.consumed()) {
                this.elementName = elementName;
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
        if (this.typeNamespacePrefix) {
            const typeMatched = this.typeNamespacePrefix.match(
                htmlElements,
                allHtmlElements,
                namespaces
            );
            return (
                this.elementName?.match(typeMatched, allHtmlElements, namespaces) ||
                typeMatched
            );
        }
        return (
            this.elementName?.match(htmlElements, allHtmlElements, namespaces) ||
            htmlElements
        );
    };
}

/*
    elementName
        : ident
        ;
*/
export class ElementName implements Matcher {
    ident?: LexerItem<"Ident">;
    consumed = () => {
        return Boolean(this.ident?.value);
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "Ident") {
            this.ident = new LexerItem("Ident", current.value);
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
        return htmlElements.filter(
            (element) => element.tagName?.value === this.ident?.value
        );
    };
}

/**
   universal
    : typeNamespacePrefix? '*'
    ;
 */
export class Universal implements Matcher {
    typeNamespacePrefix?: TypeNamespacePrefix;
    universal?: LexerItem<"Universal">;

    consumed = () => {
        return Boolean(this.universal?.value);
    };
    process = (queue: Queue): Queue => {
        if (!this.typeNamespacePrefix?.consumed()) {
            const typeNamespacePrefix = new TypeNamespacePrefix();
            const tryProcessNamespace = typeNamespacePrefix.process(queue);
            if (typeNamespacePrefix.consumed()) {
                this.typeNamespacePrefix = typeNamespacePrefix;
                return this.process(tryProcessNamespace);
            }
        }
        const current = queue.items[queue.at];
        if (current.type === "Universal" && !this.universal?.value) {
            this.universal = new LexerItem("Universal", current.value);
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
        return (
            this.typeNamespacePrefix?.match(
                htmlElements,
                allHtmlElements,
                namespaces
            ) || htmlElements
        );
    };
}

/**
   className
    : '.' ident
    ;
 */
export class ClassName implements Matcher {
    dot?: LexerItem<"Dot">;
    ident?: LexerItem<"Ident">;
    consumed = () => {
        return Boolean(this.dot?.value && this.ident?.value);
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "Dot") {
            this.dot = new LexerItem("Dot", current.value);
            return this.process(queue.next());
        }
        if (current.type === "Ident") {
            this.ident = new LexerItem("Ident", current.value);
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
                this.ident?.value || "",
                "[attr~=value]"
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
    squareBracket?: LexerItem<"SquareBracket">;
    ws1?: Ws;
    typeNamespacePrefix?: TypeNamespacePrefix;
    ident1?: LexerItem<"Ident">;
    ws2?: Ws;
    prefixMatch?: LexerItem<"PrefixMatch">;
    suffixMatch?: LexerItem<"SuffixMatch">;
    substringMatch?: LexerItem<"SubstringMatch">;
    equals?: LexerItem<"Equals">;
    includes?: LexerItem<"Includes">;
    dashMatch?: LexerItem<"DashMatch">;
    ws3?: Ws;
    ident2?: LexerItem<"Ident">;
    stringIdent?: LexerItem<"String_">;
    numIdent?: LexerItem<"Number">;
    ws4?: Ws;
    squareBracketEnd?: LexerItem<"SquareBracketEnd">;
    consumed = () => {
        const hasComparator =
            this.prefixMatch?.value ||
            this.suffixMatch?.value ||
            this.substringMatch?.value ||
            this.equals?.value ||
            this.includes?.value ||
            this.dashMatch?.value;
        if (
            hasComparator &&
            !this.ident2?.value &&
            !this.stringIdent?.value &&
            !this.numIdent?.value
        ) {
            return false;
        }
        return Boolean(
            this.squareBracket?.value &&
            this.ident1?.value &&
            this.squareBracketEnd?.value
        );
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "SquareBracket") {
            this.squareBracket = new LexerItem("SquareBracket", current.value);
            const ws = new Ws();
            const tryWs = ws.process(queue.next());
            if (ws.consumed()) {
                this.ws1 = ws;
            }
            return this.process(tryWs);
        }
        if (!this.typeNamespacePrefix?.consumed()) {
            const typeNamespacePrefix = new TypeNamespacePrefix();
            const tryTypeNameSpace = typeNamespacePrefix.process(queue);
            if (typeNamespacePrefix.consumed()) {
                this.typeNamespacePrefix = typeNamespacePrefix;
                return this.process(tryTypeNameSpace);
            }
        }
        if (current.type === "Ident" && !this.ident1?.value) {
            this.ident1 = new LexerItem("Ident", current.value);
            const ws = new Ws();
            const tryWs = ws.process(queue.next());
            if (ws.consumed()) {
                this.ws2 = ws;
            }
            return this.process(tryWs);
        }
        const comparators: [LexerType, () => LexerItem<LexerType>][] = [
            ["PrefixMatch", () => (this.prefixMatch = new LexerItem("PrefixMatch"))],
            ["SuffixMatch", () => (this.suffixMatch = new LexerItem("SuffixMatch"))],
            [
                "SubstringMatch",
                () => (this.substringMatch = new LexerItem("SubstringMatch")),
            ],
            ["Equals", () => (this.equals = new LexerItem("Equals"))],
            ["Includes", () => (this.includes = new LexerItem("Includes"))],
            ["DashMatch", () => (this.dashMatch = new LexerItem("DashMatch"))],
        ];
        const foundComp = comparators.find(([type]) => type === current.type)?.[1];
        if (foundComp) {
            foundComp().value = current.value;
            const ws = new Ws();
            const tryWs = ws.process(queue.next());
            if (ws.consumed()) {
                this.ws3 = ws;
            }
            return this.process(tryWs);
        }
        if (
            this.ident1?.value &&
            !this.ident2?.value &&
            !this.stringIdent?.value &&
            !this.numIdent?.value
        ) {
            if (current.type === "Ident") {
                this.ident2 = new LexerItem("Ident", current.value);
                const ws = new Ws();
                const tryWs = ws.process(queue.next());
                if (ws.consumed()) {
                    this.ws4 = ws;
                }
                return this.process(tryWs);
            }
            if (current.type === "String_") {
                this.stringIdent = new LexerItem("String_", current.value);
                const ws = new Ws();
                const tryWs = ws.process(queue.next());
                if (ws.consumed()) {
                    this.ws4 = ws;
                }
                return this.process(tryWs);
            }
            if (current.type === "Number") {
                this.numIdent = new LexerItem("Number", current.value);
                const ws = new Ws();
                const tryWs = ws.process(queue.next());
                if (ws.consumed()) {
                    this.ws4 = ws;
                }
                return this.process(tryWs);
            }
        }
        if (current.type === "SquareBracketEnd") {
            this.squareBracketEnd = new LexerItem("SquareBracketEnd", current.value);
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
        return htmlElements.filter((element) => {
            const value =
                this.ident2?.value || this.stringIdent?.value || this.numIdent?.value;
            const name = `${this.typeNamespacePrefix && this.typeNamespacePrefix?.ident?.value
                    ? `${this.typeNamespacePrefix.ident.value}:${this.ident1?.value}`
                    : this.ident1?.value
                }`;
            if (!value) {
                return matchAttribute(element.attributes(), name, true, "[attr]");
            }
            return matchAttribute(
                element.attributes(),
                name,
                value,
                (() => {
                    if (this.prefixMatch?.value) {
                        return "[attr^=value]";
                    }
                    if (this.suffixMatch?.value) {
                        return "[attr$=value]";
                    }
                    if (this.substringMatch?.value) {
                        return "[attr*=value]";
                    }
                    if (this.equals?.value) {
                        return "[attr=value]";
                    }
                    if (this.includes?.value) {
                        return "[attr~=value]";
                    }
                    if (this.dashMatch?.value) {
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
    pseudoNot?: LexerItem<"PseudoNot">;
    ws1?: Ws;
    negationArg?: NegationArg;
    ws2?: Ws;
    backBrace?: LexerItem<"BackBrace">;
    consumed = () => {
        return Boolean(
            this.pseudoNot?.value &&
            this.negationArg?.consumed() &&
            this.backBrace?.value
        );
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "PseudoNot") {
            this.pseudoNot = new LexerItem("PseudoNot", current.value);
            const ws = new Ws();
            const tryWs = ws.process(queue.next());
            if (ws.consumed()) {
                this.ws1 = ws;
            }
            return this.process(tryWs);
        }
        if (!this.negationArg?.consumed()) {
            const negationArg = new NegationArg();
            const tryNegation = negationArg.process(queue);
            if (negationArg.consumed()) {
                this.negationArg = negationArg;
                const ws = new Ws();
                const tryWs = ws.process(tryNegation);
                if (ws.consumed()) {
                    this.ws2 = ws;
                }
                return this.process(tryWs);
            }
        }
        if (current.type === "BackBrace") {
            this.backBrace = new LexerItem("BackBrace", current.value);
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
        if (!this.negationArg) {
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
    typeSelector?: TypeSelector;
    universal?: Universal;
    hash?: LexerItem<"Hash">;
    className?: ClassName;
    attrib?: Attrib;
    pseudo?: Pseudo;
    consumed = () => {
        return Boolean(
            this.typeSelector?.consumed() ||
            this.universal?.consumed() ||
            this.hash?.value ||
            this.className?.consumed() ||
            this.attrib?.consumed() ||
            this.pseudo?.consumed()
        );
    };
    process = (queue: Queue): Queue => {
        if (!this.typeSelector?.consumed()) {
            const typeSelector = new TypeSelector();
            const tryProcessSelector = typeSelector.process(queue);
            if (typeSelector.consumed()) {
                this.typeSelector = typeSelector;
                return tryProcessSelector;
            }
        }
        if (!this.universal?.consumed()) {
            const universal = new Universal();
            const tryUniversal = universal.process(queue);
            if (universal.consumed()) {
                this.universal = universal;
                return tryUniversal;
            }
        }
        if (queue.items[queue.at].type === "Hash" && !this.hash?.value) {
            this.hash = new LexerItem("Hash", queue.items[queue.at].value);
            return queue.next();
        }
        if (!this.className?.consumed()) {
            const className = new ClassName();
            const tryClassName = className.process(queue);
            if (className.consumed()) {
                this.className = className;
                return tryClassName;
            }
        }
        if (!this.attrib?.consumed()) {
            const attrib = new Attrib();
            const tryAttrib = attrib.process(queue);
            if (attrib.consumed()) {
                this.attrib = attrib;
                return tryAttrib;
            }
        }
        if (!this.pseudo?.consumed()) {
            const pseudo = new Pseudo();
            const tryPseudo = pseudo.process(queue);
            if (pseudo.consumed()) {
                this.pseudo = pseudo;
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
        if (this.typeSelector) {
            return this.typeSelector.match(htmlElements, htmlElements, namespaces);
        }
        if (this.universal) {
            return this.universal.match(htmlElements, htmlElements, namespaces);
        }
        if (this.hash) {
            return htmlElements.filter((element) =>
                matchAttribute(
                    element.attributes(),
                    "id",
                    this.hash?.value.slice(1) || "",
                    "[attr=value]"
                )
            );
        }
        if (this.attrib) {
            return this.attrib.match(htmlElements, allHtmlElements, namespaces);
        }
        if (this.pseudo) {
            return this.pseudo.match(htmlElements, allHtmlElements, namespaces);
        }
        if (this.className) {
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
    even?: LexerItem<"Even">;
    odd?: LexerItem<"Odd">;
    combinator?: Combinator;
    selectorGroup1?: SelectorGroup;
    minus1?: LexerItem<"Minus">;
    number1?: LexerItem<"Number">;
    ident1?: LexerItem<"Ident">;
    ws2?: Ws;
    plus?: LexerItem<"Plus">;
    minus2?: LexerItem<"Minus">;
    ws3?: Ws;
    number2?: LexerItem<"Number">;
    ws4?: Ws;
    of?: LexerItem<"Of">;
    ws5?: Ws;
    selectorGroup2?: SelectorGroup;

    functionalPseudo: FunctionalPseudo;
    constructor(functionalPseudo: FunctionalPseudo) {
        this.functionalPseudo = functionalPseudo;
    }

    consumed = () => {
        if (
            this.even?.value ||
            this.odd?.value ||
            this.selectorGroup1?.consumed()
        ) {
            return true;
        }
        const ofMissing = !this.of?.value && !this.selectorGroup2?.consumed();
        const ofComplete = this.of?.value && this.selectorGroup2?.consumed();

        const validOf = Boolean(ofMissing || ofComplete);

        const optionalGroupMissing = Boolean(
            !this.plus?.value && !this.minus2?.value && !this.number2?.value
        );
        const optionalGroupComplete = Boolean(
            (this.plus?.value || this.minus2?.value) && this.number2?.value
        );

        const validGroup = optionalGroupComplete || optionalGroupMissing;

        const validOptionals = validGroup && validOf;

        if (this.ident1?.value || this.number1?.value) {
            return validOptionals;
        }

        return false;
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "Even") {
            this.even = new LexerItem("Even", current.value);
            return queue.next();
        }
        if (current.type === "Odd") {
            this.odd = new LexerItem("Odd", current.value);
            return queue.next();
        }
        if (
            !this.minus1?.value &&
            !this.ident1?.value &&
            !this.plus?.value &&
            !this.minus2?.value &&
            !this.number1?.value
        ) {
            if (!this.combinator?.consumed()) {
                const combinator = new Combinator();
                const tryConsumeCombinator = combinator.process(queue);
                if (combinator.consumed()) {
                    this.combinator = combinator;
                    return this.process(tryConsumeCombinator);
                }
            }
            const fnPseudo = this.functionalPseudo.funct?.value;
            const selectorExempt =
                fnPseudo === "lang(" ||
                fnPseudo === "contains(" ||
                fnPseudo === "eq(" ||
                current.value === "n";
            if (!this.selectorGroup1?.consumed() && !selectorExempt) {
                const selectorGroup = new SelectorGroup();
                const tryConsumeSelectorGroup = selectorGroup.process(queue);
                if (selectorGroup.consumed()) {
                    this.selectorGroup1 = selectorGroup;
                    return tryConsumeSelectorGroup;
                }
            }
        }
        if (
            !this.number1?.value &&
            !this.minus1?.value &&
            current.type === "Minus"
        ) {
            this.minus1 = new LexerItem("Minus", current.value);
            return this.process(queue.next());
        }
        if (
            !this.ident1?.value &&
            !this.number1?.value &&
            current.type === "Number"
        ) {
            this.number1 = new LexerItem("Number", current.value);
            const ws = new Ws();
            const tryWs = ws.process(queue.next());
            if (ws.consumed()) {
                this.ws2 = ws;
            }
            return this.process(tryWs);
        }
        if (!this.ident1?.value && current.type === "Ident") {
            this.ident1 = new LexerItem("Ident", current.value);
            const ws = new Ws();
            const tryWs = ws.process(queue.next());
            if (ws.consumed()) {
                this.ws2 = ws;
            }
            return this.process(tryWs);
        }
        if (this.ident1?.value) {
            if (!this.minus2?.value && !this.plus?.value && current.type === "Plus") {
                this.plus = new LexerItem("Plus", current.value);
                const ws = new Ws();
                const tryWs = ws.process(queue.next());
                if (ws.consumed()) {
                    this.ws3 = ws;
                }
                return this.process(tryWs);
            }
            if (
                !this.plus?.value &&
                !this.minus2?.value &&
                current.type === "Minus"
            ) {
                this.minus2 = new LexerItem("Minus", current.value);
                const ws = new Ws();
                const tryWs = ws.process(queue.next());
                if (ws.consumed()) {
                    this.ws3 = ws;
                }
                return this.process(tryWs);
            }
            if (
                (this.plus?.value || this.minus2?.value) &&
                !this.number2?.value &&
                current.type === "Number"
            ) {
                this.number2 = new LexerItem("Number", current.value);
                const ws = new Ws();
                const tryWs = ws.process(queue.next());
                if (ws.consumed()) {
                    this.ws4 = ws;
                }
                return this.process(tryWs);
            }
        }
        if (this.number1?.value && !this.of?.value && current.type === "Of") {
            this.of = new LexerItem("Of", current.value);
            const ws = new Ws();
            const tryWs = ws.process(queue.next());
            if (ws.consumed()) {
                this.ws5 = ws;
            }
            return this.process(tryWs);
        }
        if (this.of?.value && !this.selectorGroup2?.consumed()) {
            const selectorGroup = new SelectorGroup();
            const tryConsumeSelectorGroup = selectorGroup.process(queue);
            if (selectorGroup.consumed()) {
                this.selectorGroup2 = selectorGroup;
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
        const childrenOfType = () =>
            selected.filter(
                (otherChild) => otherChild.getTagName() === element.getTagName()
            );
        const getIndexOfType = (childrenOfType: HtmlElement[]) =>
            childrenOfType.findIndex(
                (child) => child.identifier === element.identifier
            );
        const selectedMap = selected.reduce(
            (selectedMap: Record<string, true>, element) => {
                selectedMap[element.identifier] = true;
                return selectedMap;
            },
            {}
        );
        const filter = (element: HtmlElement) => selectedMap[element.identifier];
        switch (this.functionalPseudo.funct?.value) {
            case "nth-child(":
                return element.parent.getIndex(element, false, filter) + 1;
            case "nth-last-child(":
                return Math.max(
                    -1,
                    element.parent.children().filter(filter).length -
                    (this.even?.value || this.odd?.value ? -1 : 0) -
                    element.parent.getIndex(element, false, filter)
                );
            case "nth-last-of-type(":
                const lastOfType = childrenOfType();
                return Math.max(-1, lastOfType.length - getIndexOfType(lastOfType));
            case "nth-of-type(":
                return getIndexOfType(childrenOfType()) + 1;
            default:
                return element.parent.getIndex(element, false, filter);
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
        if (this.functionalPseudo.funct?.value === "lang(") {
            if (this.ident1?.value) {
                return htmlElements.filter(
                    (htmlElements) =>
                        htmlElements.attributes()["lang"] === this.ident1?.value
                );
            }
            return [];
        }
        if (this.functionalPseudo.funct?.value === "eq(") {
            const index = parseInt(this.ident1?.value || this.number1?.value || "0");
            if (!isNaN(index)) {
                const multiplied = index * (!this.minus1?.value ? 1 : -1);
                return htmlElements.filter((_, i) =>
                    multiplied >= 0
                        ? i === multiplied
                        : htmlElements.length + multiplied === i
                );
            }
            return [];
        }
        if (this.functionalPseudo.funct?.value === "contains(") {
            const contains = this.ident1?.value || this.number1?.value;
            if (contains) {
                return htmlElements.filter((htmlElement) => {
                    return htmlElement.texts().some((text) => text.includes(contains));
                });
            }
            return [];
        }
        if (
            this.functionalPseudo.funct?.value === "is(" ||
            this.functionalPseudo.funct?.value === "where("
        ) {
            if (this.selectorGroup1 && !this.combinator) {
                return this.selectorGroup1.match(
                    htmlElements,
                    allHtmlElements,
                    namespaces
                );
            }
            return [];
        }
        if (this.functionalPseudo.funct?.value === "has(") {
            if (this.selectorGroup1) {
                const matched = this.selectorGroup1.match(
                    htmlElements,
                    allHtmlElements,
                    namespaces
                );
                if (!this.combinator || this.combinator.space?.value) {
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
                if (this.combinator.greater?.value) {
                    return htmlElements.filter((value) => {
                        return matched.some(
                            (matched) => value.content()?.getIndex(matched, false) !== -1
                        );
                    });
                }
                if (this.combinator.plus?.value) {
                    return htmlElements.filter((value) => {
                        return matched.some(
                            (matched) =>
                                value.parent.prevSibling(value)?.identifier ===
                                matched.identifier
                        );
                    });
                }
                if (this.combinator.tilde?.value) {
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
        if (this.even?.value) {
            return htmlElements.filter(
                (element) => this.getIndex(element, htmlElements) % 2 === 0
            );
        }
        if (this.odd?.value) {
            return htmlElements.filter(
                (element) => this.getIndex(element, htmlElements) % 2 === 1
            );
        }
        const ofQuery =
            this.selectorGroup2?.match(htmlElements, allHtmlElements, namespaces) ||
            htmlElements;
        if (ofQuery.length === 0) {
            return ofQuery;
        }
        if (!this.ident1?.value) {
            if (!this.minus1?.value) {
                const index = parseInt(this.number1?.value || "1");
                const element = ofQuery.find(
                    (element) => this.getIndex(element, htmlElements) === index
                );
                return element ? [element] : [];
            }
        } else {
            const modifier =
                (this.minus1?.value ? -1 : 1) * parseInt(this.number1?.value || "1");
            const addition =
                (this.minus2?.value ? -1 : this.plus?.value ? 1 : 0) *
                (parseInt(this.number2?.value || "0") || 0);
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
