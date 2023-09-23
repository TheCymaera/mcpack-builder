import { command } from "./MCCommand.ts";
import { ExecuteCommand, ExecuteCustomStoreDestination } from "./ExecuteCommand.ts";
import { ScoreSelector } from "./ScoreSelector.ts";
import { NumericDataType } from "./enums.ts";

export class NBTSelector {
	public type: string;
	public selector: string;
	public path: string;

	constructor(config: {
		type: string;
		selector: string;
		path: string,
	}) {
		this.type = config.type;
		this.selector = config.selector;
		this.path = config.path;
	}

	append(path: string) {
		if (this.path) {
			this.path += "/" + path;
		} else {
			this.path = path;
		}
		return this;
	}

	toExecuteStoreDestination(dataType: NumericDataType, scale: number) {
		return new ExecuteCustomStoreDestination(
			this.type + " " + 
			this.selector + " " + 
			this.path + " " +
			dataType + " " + 
			scale
		);
	}

	assignScore(score: ScoreSelector, dataType: NumericDataType, scale: number) {
		return new ExecuteCommand().storeResult(this.toExecuteStoreDestination(dataType, scale)).run(score.getValue());
	}

	assignNBT(nbt: NBTSelector) {
		return command`data modify ${this.type} ${this.selector} ${this.path} set from ${this.type} ${this.selector} ${nbt.path}`;
	}

	getValue(scale: number) {
		return command`data get ${this.type} ${this.selector} ${this.path} ${scale}`;
	}

	assignSNBT(value: string) {
		return command`data modify ${this.type} ${this.selector} ${this.path} set value ${value}`;
	}
}