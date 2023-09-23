import { NamespacedID } from "./Namespace.ts";
import { NormalizedCollectionOptions, NormalizedSet } from "./utils.ts";

export class Tag {
	values = new NormalizedSet<NamespacedID | NamespacedTag>([], normalizer);
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

export class NamespacedTag {
	constructor(public namespacedId: NamespacedID) {}

	toString() {
		return `#${this.namespacedId}`;
	}

	static orIDFromString(selector: string): NamespacedID | NamespacedTag {
		if (selector.startsWith('#')) {
			return new NamespacedTag(NamespacedID.fromString(selector.slice(1)));
		}
		return NamespacedID.fromString(selector);
	}
}

const normalizer: NormalizedCollectionOptions<NamespacedID | NamespacedTag> = {
	coerceKey: (value: NamespacedID | NamespacedTag) => {
		return value.toString();
	},
	reviveKey: (value: string) => {
		return NamespacedTag.orIDFromString(value);
	}
};