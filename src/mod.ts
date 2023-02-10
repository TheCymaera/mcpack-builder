export class Namespace {
	constructor(readonly namespace: string) {}

	getID(id: string) {
		return new NamespacedID(this.namespace, id);
	}
}

export class NamespacedID {
	constructor(readonly namespace: string, readonly id: string) {
		const errors = NamespacedID.validate(this.build());
		if (errors.length > 0) {
			console.group(`Invalid namespaced ID: ${this.build()}`);
			for (const error of errors) {
				console.warn(error);
			}
			console.groupEnd();
		}
	}

	getID(id: string) {
		return new NamespacedID(this.namespace, `${this.id}/${id}`);
	}

	build() {
		return `${this.namespace}:${this.id}`;
	}

	toFunction() {
		return new FunctionReference(this);
	}

	static fromString(namespacedId: string) {
		const [namespace, id] = namespacedId.split(':');
		return new NamespacedID(namespace ?? "", id ?? "");
	}

	static validate(namespacedId: string): string[] {
		const WRONG_FORMAT = "Namespaced ID must be in the format 'namespace:id'";
		const INVALID_NAMESPACE = 'Namespaces must only contain lowercase letters, numbers, dashes, and underscores';
		const INVALID_ID = 'Ids must only contain lowercase letters, numbers, underscores, dashes, and forward-slashes';

		const [namespace, id, ...rest] = namespacedId.split(':');
		if (rest.length > 0) {
			return [WRONG_FORMAT];
		}

		if (!namespace || !id) {
			return [WRONG_FORMAT];
		}

		if (!/^[a-z0-9_-]+$/.test(namespace)) {
			return [INVALID_NAMESPACE];
		}

		if (!/^[a-z0-9_\-/]+$/.test(id)) {
			return [INVALID_ID];
		}

		return [];
	}
}

export class Duration {
	constructor(readonly value: number, readonly unit: string) {}

	build() {
		return `${this.value}${this.unit}`;
	}

	multiply(factor: number) {
		return new Duration(this.value * factor, this.unit);
	}

	toTicks() {
		switch (this.unit) {
			case "t":
				return this.value;
			case "s":
				return this.value * 20;
			case "d":
				return this.value * 24000;
		}

		throw new Error(`Unknown unit ${this.unit}`);
	}

	add(other: Duration) {
		if (this.unit !== other.unit) {
			throw new Error(`Cannot add durations with different units: ${this.unit} and ${other.unit}`);
		}

		return new Duration(this.value + other.value, this.unit);
	}

	static ticks(value: number) {
		return new Duration(value, "t");
	}

	static seconds(value: number) {
		return new Duration(value, "s");
	}

	static days(value: number) {
		return new Duration(value, "d");
	}
}

export enum ScheduleMode {
	Append = "append",
	Replace = "replace",
}

export class FunctionReference {
	constructor(readonly namespacedId: NamespacedID|TagReference) {}

	run() {
		return new CustomCommand(`function ${this.#selector()}`);
	}

	schedule(delay: Duration, mode = ScheduleMode.Replace) {
		return new CustomCommand(`schedule function ${this.#selector()} ${delay.build()} ${mode}`);
	}

	scheduleClear() {
		return new CustomCommand(`schedule clear ${this.#selector()}`);
	}

	#selector() {
		return this.namespacedId.build();
	}
}

export class TagReference {
	constructor(readonly namespacedId: NamespacedID) {}

	build() {
		return "#" + this.namespacedId.build();
	}
}

export interface Command {
	buildCommand(): string;
}

export class CustomCommand implements Command {
	constructor(readonly command: string) {}

	buildCommand() {
		if (this.command.startsWith('/')) {
			console.warn(`Command "${this.command}" starts with a slash. This is invalid syntax in datapack functions.`);
			console.warn(this);
		}

		return this.command;
	}
}

export class ScoreAllocator {
	readonly scoreboard: Scoreboard;
	readonly prefix: string;
	readonly constantPrefix: string;

	readonly initConstants: Command[] = [];
	readonly constants = new Set<number>();

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
			this.initConstants.push(score.assignConstant(value));
		}
		return score;
	}

	#usedNames = new Set<string>();
}

export class Comment implements Command {
	constructor(readonly comment: string) {}

	buildCommand() {
		return `# ${this.comment}`;
	}
}

export class Scoreboard {
	readonly objective: string;
	readonly criteria: string;
	readonly displayName?: TextComponent;

	constructor(options: {
		objective: string,
		criteria?: string,
		displayName?: TextComponent,
	}) {
		this.objective = options.objective;
		this.criteria = options.criteria ?? 'dummy';
		this.displayName = options.displayName;

		const error = Scoreboard.verifyObjective(this.objective);
		if (error) console.warn(error);
	}

	create() {
		if (this.displayName === undefined) {
			return new CustomCommand(`scoreboard objectives add ${this.objective} ${this.criteria}`);
		}
		return new CustomCommand(`scoreboard objectives add ${this.objective} ${this.criteria} ${JSON.stringify(this.displayName)}`);
	}

	remove() {
		return new CustomCommand(`scoreboard objectives remove ${this.objective}`);
	}

	entity(target: CustomSelector|EntitySelector) {
		return new ScoreReference(this.objective, target);
	}

	custom(player: string) {
		return new ScoreReference(this.objective, new CustomSelector("", player));
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

export interface TargetSelector {
	readonly selectorType: string;
	buildSelector(): string;
}

export class EntitySelector implements TargetSelector {
	readonly selectorType = 'entity';
	constructor(variable: string) {
		this.#variable = variable;
	}

	buildSelector() {
		if (this.#arguments.length === 0) return this.#variable;
		return this.#variable + "[" +  this.#arguments.join(',') + "]";
	}

	limit(count: number) {
		this.#arguments.push(`limit=${count}`);
		return this;
	}

	hasScoreboardTag(tag: string) {
		this.#arguments.push(`tag=${tag}`);
		return this;
	}

	noScoreboardTag(tag: string) {
		this.#arguments.push(`tag=!${tag}`);
		return this;
	}

	sortNearest() {
		this.#arguments.push('sort=nearest');
		return this;
	}

	sortFurthest() {
		this.#arguments.push('sort=furthest');
		return this;
	}

	sortRandom() {
		this.#arguments.push('sort=random');
		return this;
	}

	sortArbitrary() {
		this.#arguments.push('sort=arbitrary');
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

	readonly #variable: string;
	readonly #arguments: string[] = [];
}

export class CustomSelector implements TargetSelector {
	constructor(readonly selectorType: string, readonly selector: string) {}

	buildSelector() {
		return this.selector;
	}
}

export enum NumericDataType {
	Byte = 'byte',
	Short = 'short',
	Int = 'int',
	Long = 'long',
	Float = 'float',
	Double = 'double',
}

export class NBTReference {
	readonly target: TargetSelector;
	readonly path: string;

	constructor(config: {
		target: TargetSelector,
		path: string,
	}) {
		this.target = config.target;
		this.path = config.path;
	}

	assignScore(score: ScoreReference, dataType: NumericDataType, scale: number) {
		return new Execute().storeResult(new ExecuteNBTStoreDestination(this, dataType, scale)).run(score.getValue());
	}

	getValue(scale: number) {
		return new CustomCommand(`data get ${this.target.selectorType} ${this.target.buildSelector()} ${this.path} ${scale}`);
	}

	setLiteralValue(value: string) {
		return new CustomCommand(`data modify ${this.target.selectorType} ${this.target.buildSelector()} ${this.path} set value ${value}`);
	}
}

export class ScoreReference implements ExecuteStoreDestination {
	constructor(readonly objective: string, readonly target: EntitySelector|CustomSelector) {}

	getValue() {
		return new CustomCommand(`scoreboard players get ${this.target.buildSelector()} ${this.objective}`);
	}

	addConstant(value: number) {
		return new CustomCommand(`scoreboard players add ${this.target.buildSelector()} ${this.objective} ${value}`);
	}

	subtractConstant(value: number) {
		return new CustomCommand(`scoreboard players remove ${this.target.buildSelector()} ${this.objective} ${value}`);
	}

	assignConstant(value: number) {
		if (!Number.isInteger(value)) {
			console.warn(`Cannot assign non-integer value ${value} to score ${this.objective}`);
		}

		return new CustomCommand(`scoreboard players set ${this.target.buildSelector()} ${this.objective} ${value}`);
	}

	opScore(operation: string, score: ScoreReference) {
		return new CustomCommand(`scoreboard players operation ${this.target.buildSelector()} ${this.objective} ${operation} ${score.target.buildSelector()} ${score.objective}`);
	}

	addScore(score: ScoreReference) {
		return this.opScore('+=', score);
	}

	subtractScore(score: ScoreReference) {
		return this.opScore('-=', score);
	}

	assignScore(score: ScoreReference) {
		return this.opScore('=', score);
	}

	multiplyScore(score: ScoreReference) {
		return this.opScore('*=', score);
	}

	divideScore(score: ScoreReference) {
		return this.opScore('/=', score);
	}

	moduloScore(score: ScoreReference) {
		return this.opScore('%=', score);
	}

	greaterThan(other: ScoreReference|number) {
		if (typeof other === 'number') {
			return new ScoreInRange(this, NumberRange.greaterThan(other));
		}
		return new CompareScores(this, '>', other);
	}

	lessThan(other: ScoreReference|number) {
		if (typeof other === 'number') {
			return new ScoreInRange(this, NumberRange.lessThan(other));
		}
		return new CompareScores(this, '<', other);
	}

	equalTo(other: ScoreReference|number) {
		if (typeof other === 'number') {
			return new ScoreInRange(this, NumberRange.exactly(other));
		}
		return new CompareScores(this, '=', other);
	}

	between(min: number, max: number) {
		return new ScoreInRange(this, NumberRange.between(min, max));
	}

	lessThanOrEqualTo(other: ScoreReference|number) {
		if (typeof other === 'number') {
			return new ScoreInRange(this, NumberRange.lessThan(other + 1));
		}
		return new CompareScores(this, '<=', other);
	}

	greaterThanOrEqualTo(other: ScoreReference|number) {
		if (typeof other === 'number') {
			return new ScoreInRange(this, NumberRange.greaterThan(other - 1));
		}
		return new CompareScores(this, '>=', other);
	}

	assignCommand(command: Command) {
		return new Execute().storeResult(this).run(command);
	}

	buildExecuteStoreDestination() {
		return `score ${this.target.buildSelector()} ${this.objective}`;
	}
}

export class NumberRange {
	private constructor(readonly min: number|undefined, readonly max: number|undefined) {}

	build(): string {
		if (this.min === this.max) return this.min!.toString();
		if (this.min === undefined) return `..${this.max}`;
		if (this.max === undefined) return `${this.min}..`;
		return `${this.min}..${this.max}`;
	}

	static lessThan(max: number) {
		return new NumberRange(undefined, max);
	}

	static greaterThan(min: number) {
		return new NumberRange(min, undefined);
	}

	static between(min: number, max: number) {
		return new NumberRange(min, max);
	}

	static exactly(value: number) {
		return new NumberRange(value, value);
	}
}

export class Execute implements Command {
	constructor(public subcommands: ExecuteSubCommand[] = []) {}
	append(subcommand: ExecuteSubCommand) {
		this.subcommands.push(subcommand);
		return this;
	}

	as(target: EntitySelector|CustomSelector) {
		return this.append(new ExecuteCustomSubcommand("as " + target.buildSelector()));
	}

	if(condition: ExecuteCondition) {
		return this.append(new ExecuteCustomSubcommand("if " + condition.buildExecuteCondition()));
	}

	unless(condition: ExecuteCondition) {
		return this.append(new ExecuteCustomSubcommand("unless " + condition.buildExecuteCondition()));
	}

	storeResult(destination: ExecuteStoreDestination) {
		return this.append(new ExecuteCustomSubcommand("store result " + destination.buildExecuteStoreDestination()));
	}

	storeSuccess(destination: ExecuteStoreDestination) {
		return this.append(new ExecuteCustomSubcommand("store success " + destination.buildExecuteStoreDestination()));
	}

	run(command: Command) {
		return this.append(new ExecuteCustomSubcommand("run " + command.buildCommand()));
	}

	buildCommand() {
		const subcommandString = this.subcommands.map(subcommand => subcommand.buildExecuteSubCommand()).join(' ');
		return `execute ${subcommandString}`;
	}
}

export interface ExecuteSubCommand {
	buildExecuteSubCommand(): string;
}

export interface ExecuteStoreDestination {
	buildExecuteStoreDestination(): string;
}

export interface ExecuteCondition {
	buildExecuteCondition(): string;
}

export class ExecuteCustomSubcommand implements ExecuteSubCommand {
	constructor(readonly command: string) {}

	buildExecuteSubCommand() {
		return this.command;
	}
}

export class ExecuteNBTStoreDestination {
	constructor(readonly target: NBTReference, readonly dataType: NumericDataType, readonly scale: number) {}

	buildExecuteStoreDestination() {
		return `${this.target.target.selectorType} ${this.target.target.buildSelector()} ${this.target.path} ${this.dataType} ${this.scale}`;
	}
}

export type CompareScoreOperator = '<' | '<=' | '=' | '>=' | '>';

export class CompareScores implements ExecuteCondition {
	constructor(
		readonly lhs: ScoreReference,
		readonly operator: CompareScoreOperator,
		readonly rhs: ScoreReference,
	) { }

	buildExecuteCondition() {
		const lhs = this.lhs;
		const rhs = this.rhs;
		return `score ${lhs.target.buildSelector()} ${lhs.objective} ${this.operator} ${rhs.target.buildSelector()} ${rhs.objective}`;
	}
}

export class ScoreInRange implements ExecuteCondition {
	constructor(
		readonly score: ScoreReference,
		readonly range: NumberRange,
	) {}

	buildExecuteCondition() {
		return `score ${this.score.target.buildSelector()} ${this.score.objective} matches ${this.range.build()}`;
	}
}

export enum Color {
	Black = "black",
	DarkBlue = "dark_blue",
	DarkGreen = "dark_green",
	DarkAqua = "dark_aqua",
	DarkRed = "dark_red",
	DarkPurple = "dark_purple",
	Gold = "gold",
	Gray = "gray",
	DarkGray = "dark_gray",
	Blue = "blue",
	Green = "green",
	Aqua = "aqua",
	Red = "red",
	LightPurple = "light_purple",
	Yellow = "yellow",
	White = "white",
}



export class TextComponentClickEvent {
	constructor(
		readonly action: string,
		readonly value: string,
	) {}
	
	openURL(url: string) {
		return new TextComponentClickEvent("open_url", url);
	}

	openFile(file: string) {
		return new TextComponentClickEvent("open_file", file);
	}

	runCommand(command: string) {
		return new TextComponentClickEvent("run_command", command);
	}

	suggestCommand(command: string) {
		return new TextComponentClickEvent("suggest_command", command);
	}

	changePage(page: number) {
		return new TextComponentClickEvent("change_page", page.toString());
	}

	copyToClipboard(text: string) {
		return new TextComponentClickEvent("copy_to_clipboard", text);
	}
}

export interface TextComponentBase {
	/**
	 * This text is appended to the end of the text.
	 */
	readonly extra?: readonly TextComponent[];
	readonly color?: Color;
	readonly bold?: boolean;
	readonly italic?: boolean;
	readonly underlined?: boolean;
	readonly strikethrough?: boolean;
	readonly obfuscated?: boolean;
	/**
	 * When shift-clicking the text, this text will be inserted into the chat.
	 */
	readonly insertion?: string;
	/**
	 * When clicking the text, this action will be performed.
	 */
	readonly clickEvent?: TextComponentClickEvent;
}

export class TextComponent implements TextComponentBase {
	[key: string]: unknown;
	
	extra?: TextComponent[];
	color?: Color;
	bold?: boolean;
	italic?: boolean;
	underlined?: boolean;
	strikethrough?: boolean;
	obfuscated?: boolean;
	insertion?: string;
	clickEvent?: TextComponentClickEvent;

	constructor(value: unknown) {
		Object.assign(this, value);
	}

	build() {
		return JSON.stringify(this);
	}

	append(children: TextComponent[]) {
		if (!this.extra) this.extra = [];
		this.extra.push(...children);
		return this;
	}

	static plainText(text: string) {
		return new TextComponent({ text })
	}

	static translatedText(key: string, options: { with?: TextComponent[] } = {}) {
		return new TextComponent({
			translate: key,
			with: options.with
		});
	}

	static score(score: ScoreReference, options: { value?: string} = {}) {
		return new TextComponent({
			score: {
				name: score.target.buildSelector(),
				objective: score.objective,
				value: options.value
			}
		});
	}

	static entityNames(entity: EntitySelector|CustomSelector, options: { separator?: TextComponent } = {}) {
		return new TextComponent({
			selector: entity.buildSelector(),
			separator: options.separator
		});
	}

	static keybind(keybind: string) {
		return new TextComponent({ keybind });
	}

	static nbt(nbt: NBTReference, options: { interpret?: boolean, separator?: TextComponent } = {}) {
		return new TextComponent({
			nbt: nbt.path,
			[nbt.target.selectorType]: nbt.target.buildSelector(),
			interpret: options.interpret,
			separator: options.separator
		});
	}
}

export class Tellraw {
	constructor(public target: EntitySelector|CustomSelector, public message: TextComponent) {}

	buildCommand() {
		return [`tellraw ${this.target.buildSelector()} ${this.message.build()}`];
	}
}

export class Tag {
	constructor(readonly values: readonly (NamespacedID | TagReference)[], readonly replace: boolean = false) {}

	build() {
		return JSON.stringify({
			replace: this.replace,
			values: this.values.map(id => id.build())
		});
	}
}

export type DatapackFunctionProvider = Iterable<Command|Command[]> | (()=>Iterable<Command|Command[]>);

export class Datapack {
	files = new Map<string, string>();
	functions = new Map<NamespacedID, (Command|Command[])[]>();
	onLoadFunctions?: Tag;
	onTickFunctions?: Tag;

	setPackMeta(packMeta: PackMeta) {
		this.files.set('pack.mcmeta', JSON.stringify(packMeta));
	}

	setFunction(namespacedId: NamespacedID, commands: DatapackFunctionProvider) {
		if (this.functions.has(namespacedId)) {
			throw new Error(`Function ${namespacedId.build()} already exists`);
		}

		this.functions.set(namespacedId, []);
		const commandsResolved = Array.from(commands instanceof Function ? commands() : commands);
		this.functions.get(namespacedId)!.push(...commandsResolved);
		
		return new FunctionReference(namespacedId);
	}

	build() {
		for (const [namespacedId, commands] of this.functions) {
			const path = `data/${namespacedId.namespace}/functions/${namespacedId.id}.mcfunction`;
			this.files.set(path, commands.flat().map(command => command.buildCommand()).join('\n'));
		}

		if (this.onLoadFunctions) {
			this.files.set('data/minecraft/tags/functions/load.json', this.onLoadFunctions.build());
		}

		if (this.onTickFunctions) {
			this.files.set('data/minecraft/tags/functions/tick.json', this.onTickFunctions.build());
		}
		
		return this.files;
	}
}

export interface PackMeta {
	pack: {
		pack_format: number;
		description: string;
	};
}