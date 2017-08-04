export class BaseNode {
    offset: number;
}

export class Node extends BaseNode {
    nodes: BaseNode[];
    end_offset: number;
    constructor(public offset: number, public name: string, public opts: any) {
        super();
        this.nodes = [];
        this.end_offset = null;
    }
}

export class Token extends BaseNode {
    constructor(public offset: number, public value: string) {
        super();
    }
}