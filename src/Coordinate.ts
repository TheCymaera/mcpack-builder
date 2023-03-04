export class Coordinate {
	constructor(public x: string, public y: string, public z: string) {}

	/**
	 * @param forceZero x and z coordinates default to ".5". Specify `true` to override this behaviour.
	 */
	static fromVector(vector: {x: number, y: number, z: number}, forceZero = false) {
		return this.absolute(vector.x, vector.y, vector.z, forceZero);
	}
	
	/**
	 * @param forceZero x and z coordinates default to ".5". Specify `true` to override this behaviour.
	 */
	static absolute(x: number, y: number, z: number, forceZero = false) {
		return new Coordinate(this.#forceZero(x, forceZero), y.toString(), this.#forceZero(z, forceZero));
	}

	static relative(x: number, y: number, z: number) {
		return new Coordinate(`~${x}`, `~${y}`, `~${z}`);
	}

	static rayCast(left: number, up: number, forward: number) {
		return new Coordinate(`^${left}`, `^${up}`, `^${forward}`);
	}

	toString() {
		return `${this.x} ${this.y} ${this.z}`;
	}

	static #forceZero(number: number, forceZero: boolean) {
		if (!forceZero) return number.toString();
		if (Number.isInteger(number)) return number.toFixed(1);
		return number.toString();
	}
}