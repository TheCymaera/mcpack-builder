import { NamespacedID } from "./Namespace.ts";
import { NormalizedCollectionOptions, NormalizedSet } from "./utils.ts";

export class Tag {
	values = new NormalizedSet<NamespacedID | TagSelector>([], normalizer);
	replace = false;

	build() {
		return JSON.stringify({
			replace: this.replace,
			values: [...this.values].map(id => id.toString())
		});
	}

	clone() {
		const out = new Tag();
		out.values = new NormalizedSet(this.values, normalizer);
		out.replace = this.replace;
		return out;
	}
}

export class TagSelector {
	constructor(public namespacedId: NamespacedID) {}

	toString() {
		return `#${this.namespacedId}`;
	}

	static orIDFromString(selector: string): NamespacedID | TagSelector {
		if (selector.startsWith('#')) {
			return new TagSelector(NamespacedID.fromString(selector.slice(1)));
		}
		return NamespacedID.fromString(selector);
	}
}

const normalizer: NormalizedCollectionOptions<NamespacedID | TagSelector> = {
	coerceKey: (value: NamespacedID | TagSelector) => {
		return value.toString();
	},
	reviveKey: (value: string) => {
		return TagSelector.orIDFromString(value);
	}
};