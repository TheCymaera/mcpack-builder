import { command } from "./MCCommand.ts";
import { EntitySelector } from "./EntitySelector.ts";
import { ScoreSelector } from "./ScoreSelector.ts";
import { TextComponent } from "./TextComponent.ts";

/**
 * Represents a scoreboard objective.
 */
export class Scoreboard {
	public objective: string;
	public criteria: string;
	public displayName?: TextComponent;

	constructor(options: {
		objective: string,
		criteria?: string,
		displayName?: TextComponent,
	}) {
		this.objective = options.objective;
		this.criteria = options.criteria ?? 'dummy';
		this.displayName = options.displayName;

		const error = Scoreboard.verifyObjective(this.objective);
		if (error) throw new Error(error);
	}

	create() {
		if (this.displayName === undefined) {
			return command`scoreboard objectives add ${this.objective} ${this.criteria}`;
		}
		return command`scoreboard objectives add ${this.objective} ${this.criteria} ${JSON.stringify(this.displayName)}`;
	}

	remove() {
		return command`scoreboard objectives remove ${this.objective}`;
	}

	entities(target: EntitySelector) {
		return new ScoreSelector(this.objective, target);
	}

	id(player: string) {
		return new ScoreSelector(this.objective, EntitySelector.id(player));
	}

	static verifyObjective(objective: string) {
		if (objective.length > 16) {
			return 'Objective name must be 16 characters or less';
		}

		if (!/^[a-zA-Z0-9_]+$/.test(objective)) {
			return 'Objective name must only contain letters, numbers, and underscores';
		}

		return undefined;
	}
}