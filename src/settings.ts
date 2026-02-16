import {App, PluginSettingTab, Setting} from "obsidian";
import type ExternalDiffPlugin from "./main";

export interface ExternalDiffSettings {
	enabled: boolean;
	debounceMs: number;
}

export const DEFAULT_SETTINGS: ExternalDiffSettings = {
	enabled: true,
	debounceMs: 1000,
};

export class ExternalDiffSettingTab extends PluginSettingTab {
	plugin: ExternalDiffPlugin;

	constructor(app: App, plugin: ExternalDiffPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Enable external change detection")
			.setDesc("Automatically detect when external tools modify markdown files")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enabled)
				.onChange(async (value) => {
					this.plugin.settings.enabled = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Debounce delay (ms)")
			.setDesc("Time after an internal edit before external changes are detected again")
			.addText(text => text
				.setValue(String(this.plugin.settings.debounceMs))
				.onChange(async (value) => {
					const num = parseInt(value, 10);
					if (!isNaN(num) && num >= 0) {
						this.plugin.settings.debounceMs = num;
						await this.plugin.saveSettings();
					}
				}));
	}
}
