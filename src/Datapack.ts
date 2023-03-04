import { Command, CommandGroup, command } from "./Command.ts";
import { Duration } from "./Duration.ts";
import { NamespacedID } from "./Namespace.ts";
import { Tag } from "./Tag.ts";

export class Datapack {
	staticFiles = new Map<string, string>();
	mcfunctions = new Map<NamespacedID, MCFunctionDeclaration>();
	onLoadFunctions?: Tag;
	onTickFunctions?: Tag;
	packMeta?: PackMeta;

	mcfunction(namespacedID: NamespacedID) {
		const out = new MCFunctionDeclaration(this, namespacedID);
		this.mcfunctions.set(namespacedID, out);
		return out;
	}

	build() {
		// generate files
		const files = new Map<string, string>(this.staticFiles);

		if (this.packMeta) files.set('pack.mcmeta', JSON.stringify(this.packMeta));

		const inlined = new Set<MCFunctionDeclaration>();
		for (const [namespacedId, declaration] of this.mcfunctions) {
			const path = `data/${namespacedId.namespace}/functions/${namespacedId.id}.mcfunction`;
			const textFile = declaration.commands.map(command => {
				if (command instanceof CommandGroup) return command.commands.map(command => command.buildCommand()).join('\n');
				return command.buildCommand()
			}).join('\n');
			files.set(path, textFile);

			let canInline = declaration.inlined;

			if (declaration.onLoad) {
				canInline = false;
				if (!this.onLoadFunctions) this.onLoadFunctions = new Tag([]);
				this.onLoadFunctions.values.push(namespacedId);
			}

			if (declaration.onTick) {
				canInline = false;
				if (!this.onTickFunctions) this.onTickFunctions = new Tag([]);
				this.onTickFunctions.values.push(namespacedId);
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
			files.delete(path);

			for (const [path, file] of files) {
				// replace "mcpack-builder:inline {id}"" with command
				files.set(path, file.replaceAll(`mcpack-builder:inline ${namespacedId}`, command));
			}
		}

		for (const [path, file] of files) {
			// replace "mcpack-builder:inline {id}" with "function {id}"
			files.set(path, file.replaceAll("mcpack-builder:inline", 'function'));
		}


		if (this.onLoadFunctions) {
			files.set('data/minecraft/tags/functions/load.json', this.onLoadFunctions.build());
		}

		if (this.onTickFunctions) {
			files.set('data/minecraft/tags/functions/tick.json', this.onTickFunctions.build());
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
	inlined = false;
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

	inline() {
		this.inlined = true;
		return command`mcpack-builder:inline ${this.namespacedID}`;
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