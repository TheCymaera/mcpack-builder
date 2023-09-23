import { ExecuteCustomCondition } from "./ExecuteCommand.ts";
import { NBTSelector } from "./NBTSelector.ts";
import { ScoreboardTag } from "./ScoreboardTag.ts";
import { stringFromTemplateParams } from "./utils.ts";

export class EntitySelector {
	private constructor(variable: string) {
		this.#variable = variable;
	}

	get nbt() {
		return new NBTSelector({
			type: "entity",
			selector: this.buildNBTHolderSelector(),
			path: ""
		})
	}

	buildEntitySelector() {
		if (this.#variable[0] === "@") {
			if (this.#arguments.length === 0) return this.#variable;
			return this.#variable + "[" +  this.#arguments.join(',') + "]";
		}

		return this.#variable;
	}

	buildNBTHolderSelector() {
		return this.buildEntitySelector();
	}

	exists() {
		return new ExecuteCustomCondition("entity " + this.buildEntitySelector());
	}

	limit(count: number) {
		return this.append(`limit=${count}`);
	}

	isType(type: string) {
		return this.append(`type=${type}`);
	}

	hasScoreboardTag(tag: string|ScoreboardTag) {
		return this.append(`tag=${tag instanceof ScoreboardTag ? tag.tag : tag}`);
	}

	noScoreboardTag(tag: string|ScoreboardTag) {
		return this.append(`tag=!${tag instanceof ScoreboardTag ? tag.tag : tag}`);
	}

	sortNearest() {
		return this.append('sort=nearest');
	}

	sortFurthest() {
		return this.append('sort=furthest');
	}

	sortRandom() {
		return this.append('sort=random');
	}

	sortArbitrary() {
		return this.append('sort=arbitrary');
	}

	append(clause: string) {
		if (this.#variable[0] !== "@") throw new Error("Cannot add clauses to a player name entity selector");
		if (clause) this.#arguments.push(clause);
		return this;
	}

	static self() {
		return new EntitySelector('@s');
	}

	static nearestPlayer() {
		return new EntitySelector('@p');
	}

	static allPlayers() {
		return new EntitySelector('@a');
	}

	static allEntities() {
		return new EntitySelector('@e');
	}

	static id(name: string) {
		return new EntitySelector(name);
	}

	static fromString(string: string) {
		if (string[0] !== "@") {
			return new EntitySelector(string);
		}

		const parts = string.split("[");
		const variable = parts[0] ?? "@s";
		const clause = parts[1] ? parts[1].slice(0, -1) : "";
		return new EntitySelector(variable).append(clause);
	}

	#variable: string;
	#arguments: string[] = [];
}


/**
 * Tagged template literal for entity selectors.
 * @example
 * const selector = entities`@a`;
 */
export function entities(strings: TemplateStringsArray, ...values: any[]) {
	return EntitySelector.fromString(stringFromTemplateParams(strings, ...values));
}