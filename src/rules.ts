import { BaseNode, Node, Token } from './nodes';

export class BaseRule {
    match(source: string, offset: number = 0, nodes?: BaseNode[]): [number, string] {
        return null;
    }
}

export class Rule extends BaseRule {
    constructor(public name: string, public rule?: BaseRule, public opts?: any) {
        super();
    }

    match(source: string, offset: number = 0, nodes?: BaseNode[]): [number, string] {
        if (!this.rule) {
            throw `rule \`${this.name}\` was forward declared, but never given a value with assign_rule()`;
        }
        let node = new Node(offset, this.name, this.opts);
        nodes.push(node);
        let error: string;
        [offset, error] = this.rule.match(source, offset, node.nodes);
        node.end_offset = offset;
        return [offset, error];
    }
}

export class Join extends BaseRule {
    constructor(public rules: BaseRule[]) {
        super();
    }

    match(source: string, offset: number = 0, nodes?: BaseNode[]): [number, string] {
        let furthest = null;
        let failed = false;
        this.rules.forEach(rule => {
            try {
                let new_nodes = [];
            }
            catch(e) {
                let a = "";
            }
        });
        return null;
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