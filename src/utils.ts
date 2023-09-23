import { NamespacedID } from "./Namespace.ts";

export function stringFromTemplateParams(strings: TemplateStringsArray, ...values: any[]) {
	let string = "";
	for (let i = 0; i < strings.length; i++) {
		string += strings[i];
		if (i < values.length) {
			string += values[i];
		}
	}
	return string;
}

export interface NormalizedCollectionOptions<T> {
	coerceKey: (value: T) => any;
	reviveKey: (string: any) => T;
}

export class NormalizedSet<T> implements Set<T> {
	#data = new Set<any>();

	constructor(
		iterable: Iterable<T> = [],
		private coerce: NormalizedCollectionOptions<T>
	) {
		for (const value of iterable) {
			this.add(value);
		}
	}

	add(value: T) {
		this.#data.add(this.coerce.coerceKey(value));
		return this;
	}

	delete(value: T) {
		return this.#data.delete(this.coerce.coerceKey(value));
	}

	has(value: T) {
		return this.#data.has(this.coerce.coerceKey(value));
	}

	clear() {
		return this.#data.clear();
	}

	values() {
		return [...this.#data].map(i => this.coerce.reviveKey(i)).values();
	}

	keys(): IterableIterator<T> {
		return this.values();
	}

	entries(): IterableIterator<[T, T]> {
		return [...this.values()].map(i=>[i, i] as [T, T]).values();
	}

	get size(): number {
		return this.#data.size;
	}

	forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: any): void {
		for (const value of this.values()) {
			callbackfn.call(thisArg, value, value, this);
		}
	}
	
	[Symbol.iterator](): IterableIterator<T> {
		return this.values();
	}


	[Symbol.toStringTag]: string;
}

export class NormalizedMap<K, V> implements Map<K, V> {
	#data = new Map<any, V>();

	constructor(
		iterable: Iterable<[K, V]> = [],
		private coerce: NormalizedCollectionOptions<K>
	) {
		for (const [key, value] of iterable) {
			this.set(key, value);
		}
	}

	set(key: K, value: V) {
		this.#data.set(this.coerce.coerceKey(key), value);
		return this;
	}

	get(key: K) {
		return this.#data.get(this.coerce.coerceKey(key));
	}

	has(key: K) {
		return this.#data.has(this.coerce.coerceKey(key));
	}

	delete(key: K) {
		return this.#data.delete(this.coerce.coerceKey(key));
	}

	clear() {
		return this.#data.clear();
	}

	entries() {
		return [...this.#data].map(([key, value]) => [this.coerce.reviveKey(key), value] as [K, V]).values();
	}

	keys() {
		return [...this.#data.keys()].map(i => this.coerce.reviveKey(i)).values();
	}

	values() {
		return this.#data.values();
	}

	get size(): number {
		return this.#data.size;
	}

	forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void {
		for (const [key, value] of this.entries()) {
			callbackfn.call(thisArg, value, key, this);
		}
	}

	[Symbol.iterator]() {
		return this.entries()[Symbol.iterator]();
	}

	[Symbol.toStringTag]: string;
}

export function namespacedIDMap<T>() {
	return new NormalizedMap<NamespacedID, T>([], {
		coerceKey: value => value.toString(),
		reviveKey: string => NamespacedID.fromString(string)
	});
}

export function namespacedIDSet() {
	return new NormalizedSet<NamespacedID>([], {
		coerceKey: value => value.toString(),
		reviveKey: string => NamespacedID.fromString(string)
	});
}