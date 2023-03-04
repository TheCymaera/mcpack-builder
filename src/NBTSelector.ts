import { command } from "./Command.ts";
import { Execute, ExecuteCustomStoreDestination } from "./Execute.ts";
import { NBTHolder } from "./NBTHolder.ts";
import { NumericDataType } from "./NumericDataType.ts";
import { ScoreSelector } from "./ScoreSelector.ts";

export class NBTSelector {
	public target: NBTHolder;
	public path: string;

	constructor(config: {
		target: NBTHolder,
		path: string,
	}) {
		this.target = config.target;
		this.path = config.path;
	}

	toExecuteStoreDestination(dataType: NumericDataType, scale: number) {
		return new ExecuteCustomStoreDestination(
			this.target.nbtHolderType + " " + 
			this.target.buildNBTHolderSelector() + " " + 
			this.path + " " +
			dataType + " " + 
			scale
		);
	}

	assignScore(score: ScoreSelector, dataType: NumericDataType, scale: number) {
		return new Execute().storeResult(this.toExecuteStoreDestination(dataType, scale)).run(score.getValue());
	}

	assignNBT(nbt: NBTSelector) {
		return command`data modify ${this.target.nbtHolderType} ${this.target.buildNBTHolderSelector()} ${this.path} set from ${this.target.nbtHolderType} ${this.target.buildNBTHolderSelector()} ${nbt.path}`;
	}

	getValue(scale: number) {
		return command`data get ${this.target.nbtHolderType} ${this.target.buildNBTHolderSelector()} ${this.path} ${scale}`;
	}

	assignSNBT(value: string) {
		return command`data modify ${this.target.nbtHolderType} ${this.target.buildNBTHolderSelector()} ${this.path} set value ${value}`;
	}
}