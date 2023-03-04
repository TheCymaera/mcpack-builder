import { Coordinate } from "./Coordinate.ts";
import { NBTHolder } from "./NBTHolder.ts";

export class TileEntitySelector implements NBTHolder {
	public nbtHolderType = 'block';
	constructor(public position: Coordinate) {}

	buildNBTHolderSelector() {
		return this.position.toString();
	}
}