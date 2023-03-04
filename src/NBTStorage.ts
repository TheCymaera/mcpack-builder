import { NBTHolder } from "./NBTHolder.ts";
import { NamespacedID } from "./Namespace.ts";

export class NBTStorage implements NBTHolder {
	nbtHolderType = 'storage';
	constructor(public namespacedId: NamespacedID) {}

	buildNBTHolderSelector() {
		return this.namespacedId.toString();
	}
}