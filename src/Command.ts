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
}

/**
 * Tagged template literal for commands. Automatically de-dents and removes new lines
 * @example
 * command`say hello world`
 */
export function command(strings: TemplateStringsArray, ...values: any[]) {
	return new CustomCommand(stringFromTemplateParams(strings, ...values).replaceAll(/\n\s+/g, ""));
}

export class CommandGroup {
	constructor(public commands: (Command | CommandGroup)[] = []) {}

	buildCommands(): string[] {
		const out: string[] = [];

		for (const command of this.commands) {
			if (command instanceof CommandGroup) {
				out.push(...command.buildCommands());
			} else {
				out.push(command.buildCommand());
			}
		}

		return out;
	}
}