import { Command, command } from "./Command.ts";
import { EntitySelector } from "./EntitySelector.ts";
import { Execute, ExecuteCondition, ExecuteStoreDestination } from "./Execute.ts";
import { FloatRange } from "./FloatRange.ts";

/**
 * Represents a score target.
 */
export class ScoreSelector implements ExecuteStoreDestination {
	constructor(public objective: string, public target: EntitySelector) {}

	getValue() {
		return command`scoreboard players get ${this.target.buildEntitySelector()} ${this.objective}`;
	}

	addConstant(value: number) {
		return command`scoreboard players add ${this.target.buildEntitySelector()} ${this.objective} ${value}`;
	}

	subtractConstant(value: number) {
		return command`scoreboard players remove ${this.target.buildEntitySelector()} ${this.objective} ${value}`;
	}

	assignConstant(value: number) {
		if (!Number.isInteger(value)) {
			new Error(`Cannot assign non-integer value ${value} to score ${this.objective}`);
		}

		return command`scoreboard players set ${this.target.buildEntitySelector()} ${this.objective} ${value}`;
	}

	opScore(operation: string, score: ScoreSelector) {
		return command`scoreboard players operation ${this.target.buildEntitySelector()} ${this.objective} ${operation} ${score.target.buildEntitySelector()} ${score.objective}`;
	}

	addScore(score: ScoreSelector) {
		return this.opScore('+=', score);
	}

	subtractScore(score: ScoreSelector) {
		return this.opScore('-=', score);
	}

	assignScore(score: ScoreSelector) {
		return this.opScore('=', score);
	}

	multiplyScore(score: ScoreSelector) {
		return this.opScore('*=', score);
	}

	divideScore(score: ScoreSelector) {
		return this.opScore('/=', score);
	}

	moduloScore(score: ScoreSelector) {
		return this.opScore('%=', score);
	}



	greaterThan(other: ScoreSelector|number) {
		if (typeof other === 'number') {
			return new ScoreInRange(this, FloatRange.greaterThanOrEqualTo(other + 1));
		}
		return new CompareScores(this, '>', other);
	}

	lessThan(other: ScoreSelector|number) {
		if (typeof other === 'number') {
			return new ScoreInRange(this, FloatRange.lessThanOrEqualTo(other - 1));
		}
		return new CompareScores(this, '<', other);
	}

	equalTo(other: ScoreSelector|number) {
		if (typeof other === 'number') {
			return new ScoreInRange(this, FloatRange.exactly(other));
		}
		return new CompareScores(this, '=', other);
	}

	/**
	 * @param min Inclusive
	 * @param max Inclusive
	 */
	between(min: number, max: number) {
		return new ScoreInRange(this, FloatRange.between(min, max));
	}

	lessThanOrEqualTo(other: ScoreSelector|number) {
		if (typeof other === 'number') {
			return new ScoreInRange(this, FloatRange.lessThanOrEqualTo(other));
		}
		return new CompareScores(this, '<=', other);
	}

	greaterThanOrEqualTo(other: ScoreSelector|number) {
		if (typeof other === 'number') {
			return new ScoreInRange(this, FloatRange.greaterThanOrEqualTo(other));
		}
		return new CompareScores(this, '>=', other);
	}

	assignCommand(command: Command) {
		return new Execute().storeResult(this).run(command);
	}

	buildExecuteStoreDestination() {
		return `score ${this.target.buildEntitySelector()} ${this.objective}`;
	}
}

export type CompareScoreOperator = '<' | '<=' | '=' | '>=' | '>';

export class CompareScores implements ExecuteCondition {
	constructor(
		public lhs: ScoreSelector,
		public operator: CompareScoreOperator,
		public rhs: ScoreSelector,
	) { }

	buildExecuteCondition() {
		const lhs = this.lhs;
		const rhs = this.rhs;
		return `score ${lhs.target.buildEntitySelector()} ${lhs.objective} ${this.operator} ${rhs.target.buildEntitySelector()} ${rhs.objective}`;
	}
}

export class ScoreInRange implements ExecuteCondition {
	constructor(
		public score: ScoreSelector,
		public range: FloatRange,
	) {}

	buildExecuteCondition() {
		return `score ${this.score.target.buildEntitySelector()} ${this.score.objective} matches ${this.range}`;
	}
}