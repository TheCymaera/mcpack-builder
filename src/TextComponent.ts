import { Color } from "./Color.ts";
import { EntitySelector } from "./EntitySelector.ts";
import { NBTSelector } from "./NBTSelector.ts";
import { ScoreSelector } from "./ScoreSelector.ts";



export class TextComponentClickEvent {
	constructor(
		public action: string,
		public value: string,
	) {}
	
	static openURL(url: string) {
		return new TextComponentClickEvent("open_url", url);
	}

	static openFile(file: string) {
		return new TextComponentClickEvent("open_file", file);
	}

	static runCommand(command: string) {
		return new TextComponentClickEvent("run_command", command);
	}

	static suggestCommand(command: string) {
		return new TextComponentClickEvent("suggest_command", command);
	}

	static changePage(page: number) {
		return new TextComponentClickEvent("change_page", page.toString());
	}

	static copyToClipboard(text: string) {
		return new TextComponentClickEvent("copy_to_clipboard", text);
	}
}

export class TextComponent {
	[key: string]: unknown;
	
	/**
	 * This text is appended to the end of the text.
	 */
	extra?: TextComponent[];
	color?: Color;
	bold?: boolean;
	italic?: boolean;
	underlined?: boolean;
	strikethrough?: boolean;
	obfuscated?: boolean;
	/**
	 * When shift-clicking the text, this text will be inserted into the chat.
	 */
	insertion?: string;
	/**
	 * When clicking the text, this action will be performed.
	 */
	clickEvent?: TextComponentClickEvent;

	static plainText(text: string) {
		return { text } as TextComponent;
	}

	static translatedText(key: string, options: { with?: TextComponent[] } = {}) {
		return {
			translate: key,
			with: options.with
		} as TextComponent;
	}

	static score(score: ScoreSelector, options: { value?: string} = {}) {
		return {
			score: {
				name: score.target.buildEntitySelector(),
				objective: score.objective,
				value: options.value
			}
		} as TextComponent;
	}

	static entityNames(entity: EntitySelector, options: { separator?: TextComponent } = {}) {
		return {
			selector: entity.buildEntitySelector(),
			separator: options.separator
		} as TextComponent;
	}

	static keybind(keybind: string) {
		return { keybind } as TextComponent;
	}

	static nbt(nbt: NBTSelector, options: { interpret?: boolean, separator?: TextComponent } = {}) {
		return {
			nbt: nbt.path,
			[nbt.target.nbtHolderType]: nbt.target.buildNBTHolderSelector(),
			interpret: options.interpret,
			separator: options.separator
		} as TextComponent;
	}
}