import { NamespacedID } from "./Namespace.ts";

export class Tag {
	constructor(public values: (NamespacedID | TagSelector)[], public replace: boolean = false) {}

	build() {
		return JSON.stringify({
			replace: this.replace,
			values: this.values.map(id => id.toString())
		});
	}
}

export class TagSelector {
	constructor(public namespacedId: NamespacedID) {}

	build() {
		return `#${this.namespacedId}`;
	}
}