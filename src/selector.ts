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

export class Combinator implements ParserItem {
    consumed = () => {
        return true;
    };
    process = (queue: Queue): Queue => {
        return queue;
    };
    search = (searcher: Searcher) => { };
}

export class SimpleSelectorSequence implements ParserItem {
    consumed = () => {
        return true;
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