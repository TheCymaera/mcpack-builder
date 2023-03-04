/**
 * Represents a game object that can contain NBT data.
 * Used as execute store targets and text components.
 */
export interface NBTHolder {
	nbtHolderType: string;
	buildNBTHolderSelector(): string;
}