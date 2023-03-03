export interface Logger {
	log(message: string): void;
	warn(message: string): void;
	error(message: string): void;
}


let log: Logger = console;
export function setLogger(logger: Logger) {
	log = logger;
}

export class Namespace {
	constructor(public namespace: string) {}

	id(id: string) {
		return new NamespacedID(this.namespace, id);
	}

	static validate(namespace: string) {
		const INVALID_NAMESPACE = 'Namespaces must only contain lowercase letters, numbers, dashes, and underscores';
		if (!/^[a-z0-9_-]+$/.test(namespace)) {
			return [INVALID_NAMESPACE];
		}
		return [];
	}
}

export class NamespacedID {
	constructor(public namespace: string, public id: string) {
		const errors = NamespacedID.validate(this.build());
		if (errors.length > 0) {
			log.warn(`Invalid namespaced ID: ${this.build()}`);
			for (const error of errors) {
				log.warn("  " + error);
			}
		}
	}

	childID(id: string) {
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
		const [namespace, id, ...rest] = namespacedId.split(':');

		if (!namespace || !id || rest.length > 0) {
			return [`Namespaced ID must be in the format "namespace:id"`];
		}

		const errors: string[] = [];
		errors.push(...Namespace.validate(namespace));

		if (!/^[a-z0-9_\-/]+$/.test(id)) {
			errors.push(`Ids must only contain lowercase letters, numbers, underscores, dashes, and forward-slashes`);
		}

		return errors;
	}
}

export class Duration {
	constructor(public value: number, public unit: string) {}

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
	constructor(public namespacedId: NamespacedID|TagReference) {}

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
	constructor(public namespacedId: NamespacedID) {}

	build() {
		return "#" + this.namespacedId.build();
	}
}

export interface Command {
	buildCommand(): string;
}

export class CustomCommand implements Command {
	constructor(public command: string) {}

	buildCommand() {
		if (this.command.startsWith('/')) {
			log.warn(`Command "${this.command}" starts with a slash. This is invalid syntax in datapack functions.`);
		}

		return this.command;
	}
}

// alias for CustomCommand, e.g. command`tellraw @a "Hello World!"`
// deno-lint-ignore no-explicit-any
export function command(strings: TemplateStringsArray, ...values: any[]) {
	let string = "";
	for (let i = 0; i < strings.length; i++) {
		string += strings[i];
		if (i < values.length) {
			string += values[i];
		}
	}

	return new CustomCommand(string);
}

export class ScoreboardTag {
	constructor(public tag: string) {}

	add(target: EntitySelector) {
		return new CustomCommand(`tag ${target.buildSelector()} add ${this.tag}`);
	}

	remove(target: EntitySelector) {
		return new CustomCommand(`tag ${target.buildSelector()} remove ${this.tag}`);
	}

	static list(target: EntitySelector) {
		return new CustomCommand(`tag ${target.buildSelector()} list`);
	}
}

export class ScoreAllocator {
	public scoreboard: Scoreboard;
	public prefix: string;
	public constantPrefix: string;

	public initConstants: Command[] = [];
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
			this.initConstants.push(score.assignConstant(value));
		}
		return score;
	}

	#usedNames = new Set<string>();
}

export class Comment implements Command {
	constructor(public comment: string) {}

	buildCommand() {
		return `# ${this.comment}`;
	}
}

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
		if (error) log.warn(error);
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
	selectorType: string;
	buildSelector(): string;
}

export class EntitySelector implements TargetSelector {
	public selectorType = 'entity';
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

	isType(type: string) {
		this.#arguments.push(`type=${type}`);
		return this;
	}

	hasScoreboardTag(tag: string|ScoreboardTag) {
		this.#arguments.push(`tag=${tag instanceof ScoreboardTag ? tag.tag : tag}`);
		return this;
	}

	noScoreboardTag(tag: string|ScoreboardTag) {
		this.#arguments.push(`tag=!${tag instanceof ScoreboardTag ? tag.tag : tag}`);
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

	#variable: string;
	#arguments: string[] = [];
}

export class CustomSelector implements TargetSelector {
	constructor(public selectorType: string, public selector: string) {}

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
	public target: TargetSelector;
	public path: string;

	constructor(config: {
		target: TargetSelector,
		path: string,
	}) {
		this.target = config.target;
		this.path = config.path;
	}

	assignScore(score: ScoreReference, dataType: NumericDataType, scale: number) {
		return new Execute().storeResult(new ExecuteStoreNBTDestination(this, dataType, scale)).run(score.getValue());
	}

	assignNBT(nbt: NBTReference) {
		return new CustomCommand(`data modify ${this.target.selectorType} ${this.target.buildSelector()} ${this.path} set from ${nbt.target.selectorType} ${nbt.target.buildSelector()} ${nbt.path}`);
	}

	getValue(scale: number) {
		return new CustomCommand(`data get ${this.target.selectorType} ${this.target.buildSelector()} ${this.path} ${scale}`);
	}

	setValueLiteral(value: string) {
		return new CustomCommand(`data modify ${this.target.selectorType} ${this.target.buildSelector()} ${this.path} set value ${value}`);
	}
}

export class ScoreReference implements ExecuteStoreDestination {
	constructor(public objective: string, public target: EntitySelector|CustomSelector) {}

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
			log.warn(`Cannot assign non-integer value ${value} to score ${this.objective}`);
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
			return new ScoreInRange(this, NumberRange.greaterThanOrEqualTo(other + 1));
		}
		return new CompareScores(this, '>', other);
	}

	lessThan(other: ScoreReference|number) {
		if (typeof other === 'number') {
			return new ScoreInRange(this, NumberRange.lessThanOrEqualTo(other - 1));
		}
		return new CompareScores(this, '<', other);
	}

	equalTo(other: ScoreReference|number) {
		if (typeof other === 'number') {
			return new ScoreInRange(this, NumberRange.exactly(other));
		}
		return new CompareScores(this, '=', other);
	}

	/**
	 * @param min Inclusive
	 * @param max Inclusive
	 */
	between(min: number, max: number) {
		return new ScoreInRange(this, NumberRange.between(min, max));
	}

	lessThanOrEqualTo(other: ScoreReference|number) {
		if (typeof other === 'number') {
			return new ScoreInRange(this, NumberRange.lessThanOrEqualTo(other));
		}
		return new CompareScores(this, '<=', other);
	}

	greaterThanOrEqualTo(other: ScoreReference|number) {
		if (typeof other === 'number') {
			return new ScoreInRange(this, NumberRange.greaterThanOrEqualTo(other));
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
	private constructor(public min: number|undefined, public max: number|undefined) {}

	build(): string {
		if (this.min === this.max) return this.min!.toString();
		if (this.min === undefined) return `..${this.max}`;
		if (this.max === undefined) return `${this.min}..`;
		return `${this.min}..${this.max}`;
	}

	static lessThanOrEqualTo(max: number) {
		return new NumberRange(undefined, max);
	}

	static greaterThanOrEqualTo(min: number) {
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

	at(target: EntitySelector|CustomSelector) {
		return this.append(new ExecuteCustomSubcommand("at " + target.buildSelector()));
	}

	if(condition: ExecuteCondition) {
		return this.append(new ExecuteCustomSubcommand("if " + condition.buildExecuteCondition()));
	}

	unless(condition: ExecuteCondition) {
		return this.append(new ExecuteCustomSubcommand("unless " + condition.buildExecuteCondition()));
	}

	ifExists(target: TargetSelector) {
		return this.append(new ExecuteCustomSubcommand("if " + target.selectorType + " " + target.buildSelector()));
	}

	unlessExists(target: TargetSelector) {
		return this.append(new ExecuteCustomSubcommand("unless " + target.selectorType + " " + target.buildSelector()));
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
	constructor(public command: string) {}

	buildExecuteSubCommand() {
		return this.command;
	}
}

export class ExecuteStoreNBTDestination {
	constructor(public target: NBTReference, public dataType: NumericDataType, public scale: number) {}

	buildExecuteStoreDestination() {
		return `${this.target.target.selectorType} ${this.target.target.buildSelector()} ${this.target.path} ${this.dataType} ${this.scale}`;
	}
}

export type CompareScoreOperator = '<' | '<=' | '=' | '>=' | '>';

export class CompareScores implements ExecuteCondition {
	constructor(
		public lhs: ScoreReference,
		public operator: CompareScoreOperator,
		public rhs: ScoreReference,
	) { }

	buildExecuteCondition() {
		const lhs = this.lhs;
		const rhs = this.rhs;
		return `score ${lhs.target.buildSelector()} ${lhs.objective} ${this.operator} ${rhs.target.buildSelector()} ${rhs.objective}`;
	}
}

export class ScoreInRange implements ExecuteCondition {
	constructor(
		public score: ScoreReference,
		public range: NumberRange,
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
		public action: string,
		public value: string,
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

export class TextComponent {
	[key: string]: unknown;
	
	/**
	 * This text is appended to the end of the text.
	 */
	extra?: TextComponent[];
	color?: Color;
	bold?: boolean;
	italic?: boolean;
	underlined?: boolean;
	strikethrough?: boolean;
	obfuscated?: boolean;
	/**
	 * When shift-clicking the text, this text will be inserted into the chat.
	 */
	insertion?: string;
	/**
	 * When clicking the text, this action will be performed.
	 */
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
	constructor(public values: (NamespacedID | TagReference)[], public replace: boolean = false) {}

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
	functions = new Map<NamespacedID, DatapackFunctionProvider>();
	onLoadFunctions?: Tag;
	onTickFunctions?: Tag;

	setPackMeta(packMeta: PackMeta) {
		this.files.set('pack.mcmeta', JSON.stringify(packMeta));
	}

	setFunction(namespacedId: NamespacedID, commands: DatapackFunctionProvider) {
		if (this.functions.has(namespacedId)) {
			throw new Error(`Function ${namespacedId.build()} already exists`);
		}

		this.functions.set(namespacedId, commands);
		
		return new FunctionReference(namespacedId);
	}

	build() {
		for (const [namespacedId, commands] of this.functions) {
			const path = `data/${namespacedId.namespace}/functions/${namespacedId.id}.mcfunction`;

			this.functions.set(namespacedId, []);
			const commandsResolved = Array.from(commands instanceof Function ? commands() : commands);

			this.files.set(path, commandsResolved.flat().map(command => command.buildCommand()).join('\n'));
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

export class FunctionAllocator {
	readonly datapack: Datapack;
	readonly namespace: Namespace | NamespacedID;

	constructor(options: { datapack: Datapack, namespace: NamespacedID | Namespace }) { 
		this.datapack = options.datapack;
		this.namespace = options.namespace;
	}

	function(commands: DatapackFunctionProvider) {
		const name = commands instanceof Function ? commands.name || 'untitled' : 'untitled';
		const id = this.#idFromString(name);
		return this.datapack.setFunction(id, commands);
	}

	addOnLoadFunction(commands: DatapackFunctionProvider) {
		const fun = this.function(commands);
		if (!this.datapack.onLoadFunctions) {
			this.datapack.onLoadFunctions = new Tag([]);
		}
		this.datapack.onLoadFunctions.values.push(fun.namespacedId);
		return fun;
	}

	addOnTickFunction(commands: DatapackFunctionProvider) {
		const fun = this.function(commands);
		if (!this.datapack.onTickFunctions) {
			this.datapack.onTickFunctions = new Tag([]);
		}
		this.datapack.onTickFunctions.values.push(fun.namespacedId);
		return fun;
	}

	#hasId(id: NamespacedID) {
		for (const [namespacedId] of this.datapack.functions) {
			if (namespacedId.build() === id.build()) {
				return true;
			}
		}
		return false;
	}

	#idFromString(name: string) {
		const cleanedName = name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
		let id: NamespacedID;
		let i = 0;
		do {
			id = this.#id(`${cleanedName}${i === 0 ? '' : i}`);
			i++;
		} while (this.#hasId(id));

		return id;
	}

	#id(id: string) {
		if (this.namespace instanceof Namespace) {
			return this.namespace.id(id);
		} else {
			return this.namespace.childID(id);
		}
	}
}