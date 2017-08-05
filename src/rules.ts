import { BaseNode, Node, Token } from './nodes';

function _extend_array<T>(a: T[], b: T[]) {
    for(var i = 0; i < b.length; i++) {
        a.push(b[i]);
    }
}

export class BaseRule {
    match(source: string, offset: number = 0, nodes?: BaseNode[]): [number, RuleError] {
        return null;
    }
}

export class Rule extends BaseRule {
    constructor(public name: string, public rule?: BaseRule, public opts?: any) {
        super();
    }

    match(source: string, offset: number = 0, nodes?: BaseNode[]): [number, RuleError] {
        if (!this.rule) {
            throw `rule \`${this.name}\` was forward declared, but never given a value with assign_rule()`;
        }
        let node = new Node(offset, this.name, this.opts);
        nodes.push(node);
        let error;
        [offset, error] = this.rule.match(source, offset, node.nodes);
        node.end_offset = offset;
        return [offset, error];
    }
}

export class Join extends BaseRule {
    constructor(public rules: BaseRule[]) {
        super();
    }

    match(source: string, offset: number = 0, nodes?: BaseNode[]): [number, RuleError] {
        let furthest: RuleError = null;
        let failed = false;
        for(var i = 0; i < this.rules.length; i++) {
            let rule = this.rules[i];
            let new_nodes: BaseNode[] = [];
            try {
                let error;
                [offset, error] = rule.match(source, offset, new_nodes);
                if (error != null && (furthest == null || error.offset >= furthest.offset)) {
                    furthest = error;
                }
            }
            catch(error) {
                if (!(error instanceof RuleError)) {
                    throw error;
                }
                if (furthest == null || error.offset >= furthest.offset) {
                    throw error;
                }
                else {
                    throw furthest;
                }
            }
            finally {
                //nodes.concat(new_nodes);
                _extend_array(nodes, new_nodes);
            }
        }
        return [offset, furthest];
    }
}

export class Choice extends BaseRule {
    constructor(public rules: BaseRule[]) {
        super();
    }

    match(source: string, offset: number = 0, nodes?: BaseNode[]): [number, RuleError] {
        let furthest: RuleError = null;
        let furthest_nodes: BaseNode[] = null;
        let success = false;
        for(var i = 0; i < this.rules.length; i++) {
            let rule = this.rules[i];
            let new_nodes: BaseNode[] = [];
            try {
                let error;
                [offset, error] = rule.match(source, offset, new_nodes);
                furthest_nodes = new_nodes;
                success = true;
                if (error != null && (furthest == null || error.offset >= furthest.offset)) {
                    furthest = error;
                }
                break;
            }
            catch(error) {
                if (!(error instanceof RuleError)) {
                    throw error;
                }
                if (furthest == null || error.offset >= furthest.offset) {
                    furthest_nodes = new_nodes;
                    furthest = error;
                }
            }
        }
        if (!success) {
            throw furthest;
        }
        //nodes.concat(furthest_nodes);
        _extend_array(nodes, furthest_nodes);
        return [offset, furthest];
    }
}

export class Repeat extends BaseRule {
    constructor(public rule: BaseRule, public min: number = null, public max: number = null) {
        super();
    }

    match(source: string, offset: number = 0, nodes?: BaseNode[]): [number, RuleError] {
        let last_error: RuleError = null;
        let count = 0;
        while(this.max == null || count < this.max) {
            let new_nodes: BaseNode[] = [];
            try {
                let _offset = offset;
                [offset, last_error] = this.rule.match(source, offset, new_nodes);
                //nodes.concat(new_nodes);
                _extend_array(nodes, new_nodes);
                if (_offset == offset) {
                    throw new Error("infinite loop detected inside Repeat rule");
                }
                count++;
            }
            catch(error) {
                if (!(error instanceof RuleError)) {
                    throw error;
                }
                if (this.min != null && count < this.min) {
                    _extend_array(nodes, new_nodes);
                    throw error;
                }
                else {
                    last_error = error;
                    break;
                }
            }
        }
        return [offset, last_error];
    }
}

export class Predicate extends BaseRule {
    constructor(public rule: BaseRule, public predicate: BaseRule) {
        super();
    }

    match(source: string, offset: number = 0, nodes?: BaseNode[]): [number, RuleError] {
        try {
            let [new_offset, error] = this.predicate.match(source, offset, []);
        }
        catch(error) {
            if (!(error instanceof RuleError)) {
                throw error;
            }
            return this.rule.match(source, offset, nodes);
        }
        throw new PredicateError(offset, "predicate matched", this.predicate);
    }
}

export class Terminal extends BaseRule {
    constructor(public terminal: string, public ignore_token: boolean = false, public ignore_whitespace: boolean = true) {
        super();
    }

    match(source: string, offset: number = 0, nodes?: BaseNode[]): [number, RuleError] {
        let _offset = offset;
        if (this.ignore_whitespace) {
            offset = _skip_whitespace(source, offset);
        }
        if (source.startsWith(this.terminal, offset)) {
            offset += this.terminal.length;
            let node = new Token(offset, this.terminal);
            if (!this.ignore_token) {
                nodes.push(node);
            }
            return [offset, null];
        }
        else {
            throw new TerminalError(_offset, "terminal failed to match", this);
        }
    }
}

export class Regex extends BaseRule {
    constructor(public expression: RegExp, public ignore_token: boolean = false, public ignore_whitespace: boolean = true) {
        super();
    }

    match(source: string, offset: number = 0, nodes?: BaseNode[]): [number, RuleError] {
        let _offset = offset;
        if (this.ignore_whitespace) {
            offset = _skip_whitespace(source, offset);
        }
        this.expression.lastIndex = offset;
        let result = this.expression.exec(source);
        if (result == null) {
            throw new RegexError(_offset, "regex failed to match", this);
        }
        let match = result[1];
        offset += match.length;
        if (!this.ignore_token) {
            nodes.push(new Token(offset, match));
        }
        return [offset, null];
    }
}

export class Empty extends BaseRule {
    match(source: string, offset: number = 0, nodes?: BaseNode[]): [number, RuleError] {
        return [offset, null];
    }
}

export class Silent extends BaseRule {
    constructor(public rule: BaseRule) {
        super();
    }
    
    match(source: string, offset: number = 0, nodes?: BaseNode[]): [number, RuleError] {
        return this.rule.match(source, offset, []); 
    }
}

export class EndOfStream extends BaseRule {
    constructor(public ignore_whitespace: boolean = true) {
        super();
    }

    match(source: string, offset: number = 0, nodes?: BaseNode[]): [number, RuleError] {
        if (this.ignore_whitespace) {
            offset = _skip_whitespace(source, offset);
        }
        if (offset > source.length) {
            throw new EndOfStreamError(offset, "expected end of stream", this);
        }
        return [offset, null];
    }
}


export class RuleError extends Error {
    constructor(public offset: number, public reason: string, public offending_rule: BaseRule) {
        super();
    }
}

export class TerminalError extends RuleError { }

export class RegexError extends RuleError { }

export class PredicateError extends RuleError { }

export class EndOfStreamError extends RuleError { }

export function Option(rule: BaseRule) {
    return new Repeat(rule, 0, 1);
}

let explicit_new_lines = false;

export function use_explicit_new_lines(value: boolean) {
    
}

function _skip_whitespace(source: string, offset: number): number {
    // TODO
    return offset;
}