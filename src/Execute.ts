import { Command } from "./Command.ts";
import { EntitySelector } from "./EntitySelector.ts";

export class Execute implements Command {
	constructor(public subcommands: ExecuteSubCommand[] = []) {}
	append(subcommand: ExecuteSubCommand) {
		this.subcommands.push(subcommand);
		return this;
	}

	as(target: EntitySelector) {
		return this.append(new ExecuteCustomSubcommand("as " + target.buildEntitySelector()));
	}

	at(target: EntitySelector) {
		return this.append(new ExecuteCustomSubcommand("at " + target.buildEntitySelector()));
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
