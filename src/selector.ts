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
        return queue;
    };
    search = (searcher: Searcher) => { };
}

/**
   functionalPseudo
    : Function_ ws expression ')'
    ;
 */
export class FunctionalPseudo implements ParserItem {
    consumed = () => {
        return Boolean();
    };
    process = (queue: Queue): Queue => {
        return queue;
    };
    search = (searcher: Searcher) => { };
}

export class TypeSelector implements ParserItem {
    consumed = () => {
        return true;
    };
    process = (queue: Queue): Queue => {
        return queue;
    };
    search = (searcher: Searcher) => { };
}

export class ElementName implements ParserItem {
    consumed = () => {
        return true;
    };
    process = (queue: Queue): Queue => {
        return queue;
    };
    search = (searcher: Searcher) => { };
}

export class Universal implements ParserItem {
    consumed = () => {
        return true;
    };
    process = (queue: Queue): Queue => {
        return queue;
    };
    search = (searcher: Searcher) => { };
}

export class ClassName implements ParserItem {
    consumed = () => {
        return true;
    };
    process = (queue: Queue): Queue => {
        return queue;
    };
    search = (searcher: Searcher) => { };
}

export class Attrib implements ParserItem {
    consumed = () => {
        return true;
    };
    process = (queue: Queue): Queue => {
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