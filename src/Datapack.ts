import { Command, CommandGroup, command } from "./Command.ts";
import { Duration } from "./Duration.ts";
import { Namespace, NamespacedID } from "./Namespace.ts";
import { Tag } from "./Tag.ts";

export class Datapack {
	staticFiles = new Map<string, string>();
	mcfunctions = new Map<NamespacedID, MCFunctionDeclaration>();
	onLoadFunctions?: Tag;
	onTickFunctions?: Tag;
	packMeta?: PackMeta;

	internalNamespace?: NamespacedID|Namespace;

	mcfunction(namespacedID: NamespacedID) {
		const out = new MCFunctionDeclaration(this, namespacedID);
		this.mcfunctions.set(namespacedID, out);
		return out;
	}

	internalMcfunction(label = "untitled") {
		if (!this.internalNamespace) throw new Error('datapack.internalId is not set.');

		const labelCleaned = 
		label.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
		.replace(/[^a-zA-Z0-9]/g, '_');

		const hasId = (id: NamespacedID)=>{
			for (const [other] of this.mcfunctions) {
				if (other.toString() === id.toString()) return true;
			}
			return false;
		}

		let id = this.internalNamespace.childID(labelCleaned);
		let i = 0;
		while (hasId(id)) {
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

		const inlined = new Set<MCFunctionDeclaration>();
		for (const [namespacedId, declaration] of this.mcfunctions) {
			const path = `data/${namespacedId.namespace}/functions/${namespacedId.id}.mcfunction`;
			const textFile = declaration.commands.map(command => {
				if (command instanceof CommandGroup) return command.commands.map(command => command.buildCommand()).join('\n');
				return command.buildCommand()
			}).join('\n');
			files.set(path, textFile);

			let canInline = declaration.inline;

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