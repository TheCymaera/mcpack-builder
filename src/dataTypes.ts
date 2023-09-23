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

export class FloatRange {
	private constructor(public min: number|undefined, public max: number|undefined) {}

	toString(): string {
		if (this.min === this.max) return this.min!.toString();
		if (this.min === undefined) return `..${this.max}`;
		if (this.max === undefined) return `${this.min}..`;
		return `${this.min}..${this.max}`;
	}

	static lessThanOrEqualTo(max: number) {
		return new FloatRange(undefined, max);
	}

	static greaterThanOrEqualTo(min: number) {
		return new FloatRange(min, undefined);
	}

	static between(min: number, max: number) {
		return new FloatRange(min, max);
	}

	static exactly(value: number) {
		return new FloatRange(value, value);
	}
}

/**
 * Represents a Minecraft duration.
 * @example
 * Duration.ticks(20 * 3)
 */
export class Duration {
	constructor(public value: number, public unit: string) {}

	toString() {
		return `${this.value}${this.unit}`;
	}

	multiply(factor: number) {
		return new Duration(this.value * factor, this.unit);
	}

	toTicks() {
		switch (this.unit) {
			case "t":
				return this.value;
			case "s":
				return this.value * 20;
			case "d":
				return this.value * 24000;
		}

		throw new Error(`Unknown unit ${this.unit}`);
	}

	add(other: Duration) {
		if (this.unit !== other.unit) {
			throw new Error(`Cannot add durations with different units: ${this.unit} and ${other.unit}`);
		}

		return new Duration(this.value + other.value, this.unit);
	}

	static ticks(value: number) {
		return new Duration(value, "t");
	}

	static seconds(value: number) {
		return new Duration(value, "s");
	}

	static days(value: number) {
		return new Duration(value, "d");
	}
}