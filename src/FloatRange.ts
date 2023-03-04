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