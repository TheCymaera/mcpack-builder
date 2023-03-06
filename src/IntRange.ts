export class IntRange {
	private constructor(min: number|undefined, max: number|undefined) {
		this.#min = min;
		this.#max = max;
	}

	get min() {
		return this.#min;
	}

	get max() {
		return this.#max;
	}

	set min(value: number|undefined) {
		this.#min = value === undefined ? undefined : Math.floor(value);
	}

	set max(value: number|undefined) {
		this.#max = value === undefined ? undefined : Math.floor(value);
	}

	toString(): string {
		if (this.min === this.max) return this.min!.toString();
		if (this.min === undefined) return `..${this.max}`;
		if (this.max === undefined) return `${this.min}..`;
		return `${this.min}..${this.max}`;
	}

	static lessThanOrEqualTo(max: number) {
		return new IntRange(undefined, max);
	}

	static greaterThanOrEqualTo(min: number) {
		return new IntRange(min, undefined);
	}

	static between(min: number, max: number) {
		return new IntRange(min, max);
	}

	static exactly(value: number) {
		return new IntRange(value, value);
	}

	#min: number|undefined;
	#max: number|undefined;
}