import { LexerItem, ParserItem, Queue, Searcher } from "./types";

/**
 * selectorGroup
    : selector ( Comma ws selector )*
    ;
 */
export class SelectorGroup implements ParserItem {
    selector = new Selector();
    selectors: {
        comma: LexerItem<"Comma">,
        ws: Ws,
        selector: Selector,
    }[] = [];
    consumed = () => {
        return this.selector.consumed() && (this.selectors.length === 0 || this.selectors.every(({
            comma,
            selector: selector,
            ws,
        }) => comma.value && selector.consumed() && ws.consumed()));
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
            if (current.type === "Comma" && (!lastArrayItem || lastArrayItem.selector.consumed())) {
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
}

/**
 * selector
    : simpleSelectorSequence ws ( combinator simpleSelectorSequence ws )*
    ;
 */
export class Selector implements ParserItem {
    simpleSelectorSequence = new SimpleSelectorSequence();
    ws = new Ws();
    sequences: {
        combinator: Combinator,
        simpleSelectorSequence: SimpleSelectorSequence,
        ws: Ws,
    }[] = [];
    consumed = () => {
        return this.simpleSelectorSequence.consumed() && this.ws.consumed() && (this.sequences.length === 0 || this.sequences.every(({
            combinator,
            simpleSelectorSequence,
            ws,
        }) => combinator.consumed() && simpleSelectorSequence.consumed() && ws.consumed()));
    };
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
        } else if (lastArrayItem && !lastArrayItem.simpleSelectorSequence.consumed()) {
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
}

/**
    combinator
        : Plus ws
        | Greater ws
        | Tilde ws
        | Space ws
        ;
 */
export class Combinator implements ParserItem {
    plus = new LexerItem("Plus");
    greater = new LexerItem("Greater");
    tilde = new LexerItem("Tilde");
    space = new LexerItem("Space");
    ws = new Ws();
    consumed = () => {
        return Boolean(
            this.plus.value || this.greater.value || this.tilde.value || this.space.value
        );
    };
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
}

/**
    simpleSelectorSequence
        : ( typeSelector | universal ) ( Hash | className | attrib | pseudo | negation )*
        | ( Hash | className | attrib | pseudo | negation )+
        ;
 */
export class SimpleSelectorSequence implements ParserItem {
    typeSelector = new TypeSelector();
    universal = new Universal();
    modifiers: {
        hash: LexerItem<"Hash">,
        className: ClassName,
        attrib: Attrib,
        pseudo: Pseudo
        negation: Negation,
    }[] = [];

    consumed = () => {
        const hasPreface = this.typeSelector.consumed() || this.universal.consumed();
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
        this.modifiers.forEach(({
            hash,
            className,
            attrib,
            pseudo,
            negation,
        }) => {
            searcher.feedLexerItem(hash);
            searcher.feedParserItem(className);
            searcher.feedParserItem(attrib);
            searcher.feedParserItem(pseudo);
            searcher.feedParserItem(negation);
        })
    };
}

/**
 * pseudo
    : PseudoGeneral ( ident | functionalPseudo )
    ;
 */
export class Pseudo implements ParserItem {
    pseudoGeneral = new LexerItem("PseudoGeneral");
    ident = new LexerItem("Ident");
    functionalPseudo = new FunctionalPseudo();
    consumed = () => {
        return Boolean(this.pseudoGeneral.value && (this.ident.value || this.functionalPseudo.consumed()))
    };
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
}

/**
   functionalPseudo
    : Function_ ws expression ')'
    ;
 */
export class FunctionalPseudo implements ParserItem {
    funct = new LexerItem("Function_");
    ws = new Ws();
    expression = new Expression();
    backBrace = new LexerItem("BackBrace");
    consumed = () => {
        return Boolean(this.funct.value && this.expression.consumed() && this.backBrace.value);
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
}

/**
   typeNamespacePrefix
    : ( ident | '*' )? '|'
    ;
 */
export class TypeNamespacePrefix implements ParserItem {
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
}

/*
    typeSelector
        : typeNamespacePrefix? elementName
        ;
*/
export class TypeSelector implements ParserItem {
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
}

/*
    elementName
        : ident
        ;
*/
export class ElementName implements ParserItem {
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
}

/**
   universal
    : typeNamespacePrefix? '*'
    ;
 */
export class Universal implements ParserItem {
    typeNamespacePrefix = new TypeNamespacePrefix()
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
}

/**
   className
    : '.' ident
    ;
 */
export class ClassName implements ParserItem {
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
}

/**
    attrib
    : '[' ws typeNamespacePrefix? ident ws ( ( PrefixMatch | SuffixMatch | SubstringMatch | '=' | Includes | DashMatch ) ws ( ident | String_ ) ws )? ']'
    ;
 */
export class Attrib implements ParserItem {
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
        return Boolean(
            this.squareBracket.value && this.ident1.value && this.squareBracketEnd.value
        );
    };
    process = (queue: Queue): Queue => {
        const current = queue.items[queue.at];
        if (current.type === "SquareBracket") {
            this.squareBracket.value = current.value;
            const tryWs = this.ws1.process(queue.next());
            return this.process(tryWs);
        }
        return queue;
    };
    search = (searcher: Searcher) => { };
}

export class Negation implements ParserItem {
    consumed = () => {
        return true;
    };
    process = (queue: Queue): Queue => {
        return queue;
    };
    search = (searcher: Searcher) => { };
}

export class NegationArg implements ParserItem {
    consumed = () => {
        return true;
    };
    process = (queue: Queue): Queue => {
        return queue;
    };
    search = (searcher: Searcher) => { };
}

export class Ws implements ParserItem {
    consumed = () => {
        return true;
    };
    process = (queue: Queue): Queue => {
        return queue;
    };
    search = (searcher: Searcher) => { };
}

/**
   expression
    : ( ( Plus | Minus | Number | String_ | ident ) ws )+
    ;
 */
export class Expression implements ParserItem {
    consumed = () => {
        return true;
    };
    process = (queue: Queue): Queue => {
        return queue;
    };
    search = (searcher: Searcher) => { };
}