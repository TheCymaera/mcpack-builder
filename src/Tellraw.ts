import { MCCommand } from "./MCCommand.ts";
import { EntitySelector } from "./EntitySelector.ts";
import { TextComponent } from "./TextComponent.ts";

export class Tellraw implements MCCommand {
	constructor(public target: EntitySelector, public message: TextComponent) {}

	buildCommand() {
		return `tellraw ${this.target.buildEntitySelector()} ${JSON.stringify(this.message)}`;
	}
}