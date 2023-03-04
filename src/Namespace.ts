
/**
 * Represents a Minecraft namespace.
 */
export class Namespace {
	constructor(public namespace: string) {}

	id(id: string) {
		return new NamespacedID(this.namespace, id);
	}

	childID(id: string) {
		return this.id(id);
	}

	static validate(namespace: string) {
		const INVALID_NAMESPACE = 'Namespaces must only contain lowercase letters, numbers, dashes, and underscores';
		if (!/^[a-z0-9_-]+$/.test(namespace)) {
			return [INVALID_NAMESPACE];
		}
		return [];
	}
}

/**
 * Represents a Minecraft namespaced ID.
 * @example
 * NamespacedID.fromString(`minecraft:stone`)
 */
export class NamespacedID {
	constructor(public namespace: string, public id: string) {
		const errors = NamespacedID.validate(this.toString());
		if (errors.length > 0) {
			let string = `Invalid namespaced ID: ${this}\n`;
			for (const error of errors) {
				string += "  " + error + "\n";
			}
			throw new Error(string);
		}
	}

	childID(id: string) {
		return new NamespacedID(this.namespace, `${this.id}/${id}`);
	}

	toString() {
		return `${this.namespace}:${this.id}`;
	}

	static fromString(namespacedId: string) {
		const [namespace, id] = namespacedId.split(':');
		return new NamespacedID(namespace ?? "", id ?? "");
	}

	static validate(namespacedId: string): string[] {
		const [namespace, id, ...rest] = namespacedId.split(':');

		if (!namespace || !id || rest.length > 0) {
			return [`Namespaced ID must be in the format "namespace:id"`];
		}

		const errors: string[] = [];
		errors.push(...Namespace.validate(namespace));

		if (!/^[a-z0-9_\-/]+$/.test(id)) {
			errors.push(`Ids must only contain lowercase letters, numbers, underscores, dashes, and forward-slashes`);
		}

		return errors;
	}
}

export class NamespacedIDGenerator {
	constructor(public namespace: Namespace|NamespacedID) {}

	create(label = "untitled") {
		const labelCleaned = 
		label.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
		.replace(/[^a-zA-Z0-9]/g, '_');

		const id = labelCleaned + "_" + this.#i++;
		return this.namespace.childID(id);
	}

	#i = 0;
}