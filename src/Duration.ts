

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