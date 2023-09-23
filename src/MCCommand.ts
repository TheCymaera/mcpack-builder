import { NamespacedID } from "./Namespace.ts";
import { Duration } from "./dataTypes.ts";
import { stringFromTemplateParams } from "./utils.ts";

export interface BuildContext {
	mcfunctions: MCFunction[];
}

export abstract class MCCommand {
	abstract buildCommand(context: BuildContext): string;

	static contextual(builder: (context: BuildContext) => string): MCCommand {
		return {
			buildCommand: builder,
		}
	}

	static pure(command: string): MCCommand {
		return { buildCommand: () => command }
	}
}


/**
 * Tagged template literal for commands. Automatically de-dents and removes new lines
 * @example
 * command`say hello world`
 */
export function command(strings: TemplateStringsArray, ...values: any[]) {
	return MCCommand.pure(stringFromTemplateParams(strings, ...values).replaceAll(/\n\s+/g, ""));
}


export class MCFunction {
	label = "";
	constructor(
		public namespacedID: NamespacedID = NamespacedID.randomUUID(),
		public commands: MCCommand[] = [],
	) {}

	run() {
		return MCCommand.contextual(context => {
			context.mcfunctions.push(this)
			return `function ${this.namespacedID}`
		});
	}

	static run(namespacedID: NamespacedID) {
		return MCCommand.pure(`function ${namespacedID}`);
	}
}


export function mcfunction(commands: (this: MCFunction)=> Iterable<MCCommand>) {
	const fun = new MCFunction;
	fun.commands = Array.from(commands.call(fun));
	if (!fun.label) fun.label = commands.name;
	return fun;
}

export const scheduler = new class MCScheduler {
	append(delay: Duration, fun: MCFunction) {
		return MCCommand.contextual(context => {
			context.mcfunctions.push(fun)
			return `schedule function ${fun.namespacedID} ${delay} append`
		});
	}

	replace(delay: Duration, fun: MCFunction) {
		return MCCommand.contextual(context => {
			context.mcfunctions.push(fun)
			return `schedule function ${fun.namespacedID} ${delay} replace`
		});
	}
}