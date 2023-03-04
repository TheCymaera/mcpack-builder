export class Coordinate {
	constructor(public x: string, public y: string, public z: string) {}

	static fromVector(vector: {x: number, y: number, z: number}, center = true) {
		return this.absolute(vector.x, vector.y, vector.z, center);
	}
	
	/**
	 * @param center x and z coordinates default to ".5". Specify "false" to override this behaviour.
	 */
	static absolute(x: number, y: number, z: number, center = true) {
		return new Coordinate(this.#center(x, center), y.toString(), this.#center(z, center));
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

	static #center(number: number, center: boolean) {
		if (center) return number.toString();
		if (Number.isInteger(number)) return number.toFixed(1);
		return number.toString();
	}
}