import { Command, CommandGroup, command } from "./Command.ts";
import { Duration } from "./Duration.ts";
import { Namespace, NamespacedID } from "./Namespace.ts";
import { Tag } from "./Tag.ts";
import { NormalizedMap } from "./utils.ts";

export class Datapack {
	staticFiles = new Map<string, string>();
	mcfunctions = new NamespacedIDMap<MCFunctionDeclaration>();
	onLoadFunctions?: Tag;
	onTickFunctions?: Tag;
	packMeta?: PackMeta;

	internalNamespace?: NamespacedID|Namespace;

	mcfunction(namespacedID: NamespacedID) {
		const out = new MCFunctionDeclaration(namespacedID);
		this.mcfunctions.set(namespacedID, out);
		return out;
	}

	/**
	 * Create an internal function. Will be inlined if possible.
	 * @param label A preferred name for debugging purposes
	 */
	internalMcfunction(label = "untitled") {
		if (!this.internalNamespace) throw new Error('datapack.internalId is not set.');

		const labelCleaned = 
		label.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
		.replace(/[^a-zA-Z0-9]/g, '_');

		let id = this.internalNamespace.childID(labelCleaned);
		let i = 0;
		while (this.mcfunctions.has(id)) {
			id = this.internalNamespace.childID(labelCleaned + "_" + ++i);
		}

		const out = this.mcfunction(id);
		out.inline = true;
		return out;
	}

	build() {
		let onLoad = this.onLoadFunctions?.clone();
		let onTick = this.onTickFunctions?.clone();

		const builtFunctions = new NamespacedIDMap<string>();
		
		const context = {
			buildFunction(declaration: MCFunctionDeclaration) {
				const textFile = declaration.commands.buildCommands().join('\n');
				builtFunctions.set(declaration.namespacedID, textFile);
	
				if (declaration.onLoad) {
					if (!onLoad) onLoad = new Tag();
					onLoad.values.add(declaration.namespacedID);
				}
	
				if (declaration.onTick) {
					if (!onTick) onTick = new Tag();
					onTick.values.add(declaration.namespacedID);
				}
			}
		}

		for (const declaration of this.mcfunctions.values()) {
			context.buildFunction(declaration);
		}

		const countOccurrences = (namespacedId: NamespacedID) => {
			let count = 0;

			if (onLoad?.values.has(namespacedId)) count++;
			if (onTick?.values.has(namespacedId)) count++;

			for (const text of builtFunctions.values()) {
				count += text.split(namespacedId.toString()).length - 1;
			}

			return count;
		}

		const replaceInAllFunctions = (pattern: RegExp, replacement: string) => {
			for (const [namespacedId, text] of builtFunctions) {
				builtFunctions.set(namespacedId, text.replace(pattern, replacement));
			}
		}

		// inline execute function calls
		for (const [namespacedId, text] of builtFunctions) {
			// if inline-able
			if (!this.mcfunctions.get(namespacedId)!.inline) continue;

			// if 1 line
			if (text.split('\n').length !== 1) continue;

			// if line is not a comment
			if (text.startsWith('#')) continue;

			// inline execute calls
			const command = builtFunctions.get(namespacedId)!.trim();

			// replace "^execute ... run function {id}" with "execute ... run {command}"
			replaceInAllFunctions(new RegExp(`^execute (.*) run function ${namespacedId}$`, 'gm'), `execute $1 run ${command}`);
		}

		// inline single use functions
		for (const [namespacedId, _] of builtFunctions) {
			// if inline-able
			if (!this.mcfunctions.get(namespacedId)!.inline) continue;

			// if 1 reference
			if (countOccurrences(namespacedId) !== 1) continue;

			// inline function calls
			const commands = builtFunctions.get(namespacedId)!.trim();
			replaceInAllFunctions(new RegExp(`^function ${namespacedId}$`, 'gm'), commands + "\n")
		}

		// remove unused functions
		for (const [namespacedId, _] of builtFunctions) {
			// if inline-able
			if (!this.mcfunctions.get(namespacedId)!.inline) continue;

			// if 0 references
			if (countOccurrences(namespacedId) !== 0) continue;
			
			builtFunctions.delete(namespacedId);
		}


		const files = new Map<string, string>(this.staticFiles);

		if (this.packMeta) {
			files.set('pack.mcmeta', JSON.stringify(this.packMeta));
		}

		if (onLoad) {
			files.set('data/minecraft/tags/functions/load.json', onLoad.build());
		}

		if (onTick) {
			files.set('data/minecraft/tags/functions/tick.json', onTick.build());
		}

		for (const [namespacedId, text] of builtFunctions) {
			files.set(`data/${namespacedId.namespace}/functions/${namespacedId.id}.mcfunction`, text);
		}
		
		return { files };
	}
}

export interface PackMeta {
	pack: {
		pack_format: number;
		description: string;
	};
}

export class MCFunctionDeclaration {
	inline = false;
	onLoad = false;
	onTick = false;
	commands = new CommandGroup;
	constructor(public namespacedID: NamespacedID) {}

	setOnLoad(boolean: boolean) {
		this.onLoad = boolean;
		return this;
	}

	setOnTick(boolean: boolean) {
		this.onTick = boolean;
		return this;
	}

	set(provider: ()=> Iterable<Command|CommandGroup>) {
		this.commands.commands = Array.from(provider());
		return this;
	}

	run() {
		return command`function ${this.namespacedID}`;
	}

	scheduleAppend(delay: Duration) {
		return command`schedule function ${this.namespacedID} ${delay} append`;
	}

	scheduleReplace(delay: Duration) {
		return command`schedule function ${this.namespacedID} ${delay} replace`;
	}

	scheduleClear() {
		return command`schedule clear ${this.namespacedID}`;
	}
}

class NamespacedIDMap<T> extends NormalizedMap<NamespacedID, T> {
	constructor() {
		super([], {
			coerceKey: (id: NamespacedID) => id.toString(),
			reviveKey: (id: string) => NamespacedID.fromString(id)
		});
	}
}