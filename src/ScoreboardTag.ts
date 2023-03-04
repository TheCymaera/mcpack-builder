import { command } from "./Command.ts";
import { EntitySelector } from "./EntitySelector.ts";

/**
 * Represents a scoreboard tag.
 * @example
 * const tag = new ScoreboardTag("myTag");
 * yield tag.add(new EntitySelector().allPlayers());
 */
export class ScoreboardTag {
	constructor(public tag: string) {}

	add(target: EntitySelector) {
		return command`tag ${target.buildEntitySelector()} add ${this.tag}`;
	}

	remove(target: EntitySelector) {
		return command`tag ${target.buildEntitySelector()} remove ${this.tag}`;
	}

	static list(target: EntitySelector) {
		return command`tag ${target.buildEntitySelector()} list`;
	}
}