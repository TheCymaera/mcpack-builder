import { NamespacedID } from "./Namespace.ts";
import { Tag } from "./Tag.ts";
import { BuildContext, MCFunction } from "./MCCommand.ts";
import { namespacedIDMap } from "./utils.ts";

export class Datapack {
	readonly staticFiles = new Map<string, string>();
	readonly mcfunctions = namespacedIDMap<MCFunction>();
	onLoadFunctions?: Tag;
	onTickFunctions?: Tag;
	packMeta?: PackMeta;

	readonly internalFunctions: MCFunction[] = [];
	addOnLoadFunction(fun: NamespacedID|MCFunction) {
		if (!this.onLoadFunctions) this.onLoadFunctions = new Tag();
		this.onLoadFunctions.values.add(fun instanceof MCFunction ? fun.namespacedID : fun);
		if (fun instanceof MCFunction) this.internalFunctions.push(fun);
		return this;
	}

	addOnTickFunction(fun: NamespacedID|MCFunction) {
		if (!this.onTickFunctions) this.onTickFunctions = new Tag();
		this.onTickFunctions.values.add(fun instanceof MCFunction ? fun.namespacedID : fun);
		if (fun instanceof MCFunction) this.internalFunctions.push(fun);
		return this;
	}

	build(options: { internalNamespace?: NamespacedID } = {}) {
		// build functions
		const builtFunctions = namespacedIDMap<string>();
		
		const context: BuildContext = { mcfunctions: [] }

		function buildFunction(value: MCFunction) {
			if (builtFunctions.has(value.namespacedID)) return;

			const lines: string[] = [];
			for (const command of value.commands) {
				const commandString = command.buildCommand(context);
				if (commandString.startsWith("/")) {
					console.warn(`Command "${command}" starts with a slash. This is invalid syntax in datapack functions.`);
				}
				lines.push(commandString);
			}
			builtFunctions.set(value.namespacedID, lines.join('\n'));
		}

		for (const declaration of this.mcfunctions.values()) buildFunction(declaration);
		for (const declaration of this.internalFunctions) buildFunction(declaration);
		for (const declaration of context.mcfunctions) buildFunction(declaration);

		const getIdFromLabel = (label: string, internalNamespace: NamespacedID) => {
			const labelCleaned =
			label.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
			.replace(/[^a-zA-Z0-9]/g, '_') || "untitled";

			let id = internalNamespace.childID(labelCleaned);
			let i = 0;
			while (builtFunctions.has(id)) {
				id = internalNamespace.childID(labelCleaned + "_" + ++i);
			}

			return id;
		}

		let onLoad = this.onLoadFunctions?.clone();
		let onTick = this.onTickFunctions?.clone();
		const renameUUID = (oldId: NamespacedID, newId: NamespacedID) => {
			if (onLoad?.values.has(oldId)) {
				onLoad.values.delete(oldId);
				onLoad.values.add(newId);
			}
			if (onTick?.values.has(oldId)) {
				onTick.values.delete(oldId);
				onTick.values.add(newId);
			}
			
			for (const [namespacedId, text] of builtFunctions) {
				builtFunctions.set(namespacedId, text.replaceAll(oldId.toString(), newId.toString()));
			}

			const content = builtFunctions.get(oldId);
			if (content === undefined) return;
			builtFunctions.set(newId, content);
			builtFunctions.delete(oldId);
		}

		// rename functions
		for (const [namespacedID, declaration] of this.mcfunctions) {
			renameUUID(declaration.namespacedID, namespacedID);
		}

		// rename internal functions
		if (options.internalNamespace) {
			for (const declaration of [...this.internalFunctions, ...context.mcfunctions]) {
				const newId = getIdFromLabel(declaration.label, options.internalNamespace);
				renameUUID(declaration.namespacedID, newId);
			}
		}

		const canInline = (namespacedId: NamespacedID) => {
			return !this.mcfunctions.has(namespacedId);
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
			if (!canInline(namespacedId)) continue;

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
			if (!canInline(namespacedId)) continue;

			// if 1 reference
			if (countOccurrences(namespacedId) !== 1) continue;

			// inline function calls
			const commands = builtFunctions.get(namespacedId)!.trim();
			replaceInAllFunctions(new RegExp(`^function ${namespacedId}$`, 'gm'), commands + "\n")
		}

		// remove unused functions
		for (const [namespacedId, _] of builtFunctions) {
			if (!canInline(namespacedId)) continue;

			// if 0 references
			if (countOccurrences(namespacedId) !== 0) continue;
			
			builtFunctions.delete(namespacedId);
		}

		const files = new Map<string, string>(this.staticFiles);

		if (this.packMeta) {
			files.set('pack.mcmeta', JSON.stringify(this.packMeta));
		}

		if (onLoad) {
			files.set('data/minecraft/tags/function/load.json', onLoad.build());
		}

		if (onTick) {
			files.set('data/minecraft/tags/function/tick.json', onTick.build());
		}

		for (const [namespacedId, text] of builtFunctions) {
			files.set(`data/${namespacedId.namespace}/function/${namespacedId.id}.mcfunction`, text);
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