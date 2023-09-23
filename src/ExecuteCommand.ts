import { EntitySelector } from "./EntitySelector.ts";
import { BuildContext, MCCommand, MCFunction } from "./MCCommand.ts";
import { stringFromTemplateParams } from "./utils.ts";

export class ExecuteCommand implements MCCommand {
	constructor(public subcommands: ExecuteSubCommand[] = []) {}
	append(subcommand: ExecuteSubCommand) {
		this.subcommands.push(subcommand);
		return this;
	}

	appendString(subcommand: string) {
		this.subcommands.push(new ExecuteCustomSubcommand(subcommand));
		return this;
	}

	as(target: EntitySelector) {
		return this.appendString("as " + target.buildEntitySelector());
	}

	at(target: EntitySelector) {
		return this.appendString("at " + target.buildEntitySelector());
	}

	if(condition: ExecuteCondition) {
		return this.appendString("if " + condition.buildExecuteCondition());
	}

	unless(condition: ExecuteCondition) {
		return this.appendString("unless " + condition.buildExecuteCondition());
	}

	storeResult(destination: ExecuteStoreDestination) {
		return this.appendString("store result " + destination.buildExecuteStoreDestination());
	}

	storeSuccess(destination: ExecuteStoreDestination) {
		return this.appendString("store success " + destination.buildExecuteStoreDestination());
	}

	runFunction(functionName: MCFunction) {
		return this.run(functionName.run());
	}

	run(command: MCCommand) {
		const replacement = `__${this.#commands.length}__`;
		this.#commands.push([replacement, command]);
		return this.appendString("run " + replacement);
	}

	buildCommand(context: BuildContext) {
		let subcommandString = this.subcommands.map(subcommand => subcommand.buildExecuteSubCommand()).join(' ');

		// Replace all the run commands
		for (const [replacement, command] of this.#commands) {
			subcommandString = subcommandString.replaceAll(replacement, command.buildCommand(context));
		}

		return `execute ${subcommandString}`;
	}

	#commands: [string, MCCommand][] = [];
}

/**
 * Tagged template literal for ExecuteCommand.
 * @example
 * execute`as @a at @s`.run(command)
 */
export function execute(strings?: TemplateStringsArray, ...values: any[]) {
	if (!strings) return new ExecuteCommand();
	const string = stringFromTemplateParams(strings, ...values);
	return new ExecuteCommand().appendString(string.replaceAll(/\n\s+/g, ""));
}

export interface ExecuteSubCommand {
	buildExecuteSubCommand(): string;
}

export interface ExecuteCondition {
	buildExecuteCondition(): string;
}

export interface ExecuteStoreDestination {
	buildExecuteStoreDestination(): string;
}


export class ExecuteCustomSubcommand implements ExecuteSubCommand {
	constructor(public command: string) {}

	buildExecuteSubCommand() {
		return this.command;
	}
}

export class ExecuteCustomCondition implements ExecuteCondition {
	constructor(public condition: string) {}

	buildExecuteCondition() {
		return this.condition;
	}
}

export class ExecuteCustomStoreDestination implements ExecuteStoreDestination {
	constructor(public destination: string) {}

	buildExecuteStoreDestination() {
		return this.destination;
	}
}
