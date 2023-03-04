
export function stringFromTemplateParams(strings: TemplateStringsArray, ...values: any[]) {
	let string = "";
	for (let i = 0; i < strings.length; i++) {
		string += strings[i];
		if (i < values.length) {
			string += values[i];
		}
	}
	return string;
}