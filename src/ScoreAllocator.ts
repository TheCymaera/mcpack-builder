import { CommandGroup } from "./Command.ts";
import { Scoreboard } from "./Scoreboard.ts";

/**
 * A helper class for managing scoreboards.
 * @example
 * const scoreboard = new Scoreboard("my_scoreboard");
 * const score = scoreboard.constant(5);
 */
export class ScoreAllocator {
	public scoreboard: Scoreboard;
	public prefix: string;
	public constantPrefix: string;

	public initConstants = new CommandGroup();
	public constants = new Set<number>();

	constructor(config: {
		scoreboard: Scoreboard,
		prefix?: string,
		constantPrefix?: string,
	}) {
		this.scoreboard = config.scoreboard;
		this.prefix = config.prefix ?? "A_";
		this.constantPrefix = config.constantPrefix ?? "C_";
	}

	score() {
		let i = 0;
		let name: string;
		do {
			name = `${this.prefix}${i}`;
			i++;
		} while (this.#usedNames.has(name));
		this.#usedNames.add(name);

		const score = this.scoreboard.custom(name);
		return score
	}

	constant(value: number) {
		const name = `${this.constantPrefix}${value}`;
		const score = this.scoreboard.custom(name);
		if (!this.constants.has(value)) {
			this.initConstants.commands.push(score.assignConstant(value));
		}
		return score;
	}

	#usedNames = new Set<string>();
}
