import { stringFromTemplateParams } from "./utils.ts";

export interface Command {
	buildCommand(): string;
}

export class CustomCommand implements Command {
	constructor(public command: string) {}

	buildCommand() {
		if (this.command.startsWith('/')) {
			throw new Error(`Command "${this.command}" starts with a slash. This is invalid syntax in datapack functions.`);
		}

		return this.command;
	}

	static fromMultilineString(command: string) {
		return new CustomCommand(command.replaceAll(/\n\s+/g, ""));
	}
}

/**
 * Tagged template literal for commands. Automatically de-dents and removes new lines
 * @example
 * command`say hello world`
 */
export function command(strings: TemplateStringsArray, ...values: any[]) {
	return CustomCommand.fromMultilineString(stringFromTemplateParams(strings, ...values));
}

export class CommandGroup {
	constructor(public commands: Command[] = []) {}
}