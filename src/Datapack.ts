import { Command, CommandGroup, command } from "./Command.ts";
import { Duration } from "./Duration.ts";
import { Namespace, NamespacedID } from "./Namespace.ts";
import { Tag } from "./Tag.ts";
import { NormalizedMap } from "./utils.ts";

export class Datapack {
	staticFiles = new Map<string, string>();
	mcfunctions = new NormalizedMap<NamespacedID, MCFunctionDeclaration>([], {
		coerceKey: (id: NamespacedID) => id.toString(),
		reviveKey: (id: string) => NamespacedID.fromString(id)
	});
	onLoadFunctions?: Tag;
	onTickFunctions?: Tag;
	packMeta?: PackMeta;

	internalNamespace?: NamespacedID|Namespace;

	mcfunction(namespacedID: NamespacedID) {
		const out = new MCFunctionDeclaration(this, namespacedID);
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
		// generate files
		const files = new Map<string, string>(this.staticFiles);

		if (this.packMeta) files.set('pack.mcmeta', JSON.stringify(this.packMeta));

		let onLoad = this.onLoadFunctions?.clone();
		let onTick = this.onTickFunctions?.clone();

		const inlined = new Set<MCFunctionDeclaration>();
		for (const [namespacedId, declaration] of this.mcfunctions) {
			const path = `data/${namespacedId.namespace}/functions/${namespacedId.id}.mcfunction`;
			const textFile = declaration.commands.map(command => {
				if (command instanceof CommandGroup) return command.commands.map(command => command.buildCommand()).join('\n');
				return command.buildCommand();
			}).join('\n');
			files.set(path, textFile);

			let canInline = declaration.inline;

			if (declaration.onLoad) {
				canInline = false;
				if (!onLoad) onLoad = new Tag();
				onLoad.values.add(namespacedId);
			}

			if (declaration.onTick) {
				canInline = false;
				if (!onTick) onTick = new Tag();
				onTick.values.add(namespacedId);
			}

			// if more than 1 line
			if (textFile.split('\n').length > 1) canInline = false;

			// if first line is comment
			if (textFile.startsWith('#')) canInline = false;

			if (canInline) {
				inlined.add(declaration);
			}
		}

		for (const declaration of inlined) {
			const path = `data/${declaration.namespacedID.namespace}/functions/${declaration.namespacedID.id}.mcfunction`;

			const namespacedId = declaration.namespacedID.toString();
			const command = files.get(path)!.trim();

			// inline function calls
			for (const [path, file] of files) {
				// replace "^execute ... run function {id}" with "execute ... run {command}"
				files.set(path, file.replace(new RegExp(`^execute (.*) run function ${namespacedId}$`, 'gm'), `execute $1 run ${command}`));
			}

			// count references to this function
			let idReferenceCount = 0;
			for (const [, file] of files) {
				idReferenceCount += file.split(namespacedId).length - 1;
			}

			// remove if no more references
			if (idReferenceCount === 0) {
				files.delete(path);
			}
		}


		if (onLoad) {
			files.set('data/minecraft/tags/functions/load.json', onLoad.build());
		}

		if (onTick) {
			files.set('data/minecraft/tags/functions/tick.json', onTick.build());
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
	commands: (Command | CommandGroup)[] = [];
	constructor(public datapack: Datapack, public namespacedID: NamespacedID) {}

	setOnLoad(boolean: boolean) {
		this.onLoad = boolean;
		return this;
	}

	setOnTick(boolean: boolean) {
		this.onTick = boolean;
		return this;
	}

	set(provider: ()=> Iterable<Command|CommandGroup>) {
		this.commands = Array.from(provider());
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