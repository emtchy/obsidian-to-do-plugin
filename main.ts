import {
	App,
	Editor,
	MarkdownView,
	Modal,
	normalizePath,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile, TFile
} from 'obsidian';

const DONE_CELL = 4;

// Remember to rename these classes and interfaces!

interface ToDoPluginSettings {
	ToDoSettings: string;
}

const DEFAULT_SETTINGS: ToDoPluginSettings = {
	ToDoSettings: 'default'
}

export default class ToDoPlugin extends Plugin {
	settings: ToDoPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('sticky-note', 'Todo Plugin', async (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			const todayStr = window.moment().format("YYYY-MM-DD");
			const notePath = `Tasks/todo-${todayStr}.md`;
			const prevStr = window.moment().subtract(7, "days").format("YYYY-MM-DD");
			const prevNotePath = `Tasks/todo-${prevStr}.md`
			const p = normalizePath(prevNotePath)
			const fileContent = this.app.vault.getAbstractFileByPath(p);
			let prevText = "";
			if (fileContent instanceof TFile) {
				prevText = await this.app.vault.read(fileContent);
			}
			const newContent = parseMarkdownTable(prevText);
			// TODO const fileContent
			try {
				await this.app.vault.create(notePath, newContent.join('\n'));
				console.log('[SUCCESS] created new todo file');
				new Notice('[SUCCESS] created new todo note!');
			} catch (e) {
				console.error('[FAIL] error creating file');
				new Notice('[FAIL] Could not create new todo - File probably exists already!');
			}
		});

		// TODO: find better way to find X in Done cell
		function parseMarkdownTable(markdown:string): string[] {
			const rows = markdown.trim().split('\n');
			let newTableContent = [];
			for (let i = 0; i < rows.length; i++) {
				if (i == 0 || i == 1) {
					newTableContent.push(rows[i]);
					continue;
				}
				let content = rows[i].trim().split('|');
				if (!content[DONE_CELL].includes('X')) {
					newTableContent.push(rows[i]);
				}
			}
			return newTableContent;
		}

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: ToDoPlugin;

	constructor(app: App, plugin: ToDoPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.ToDoSettings)
				.onChange(async (value) => {
					this.plugin.settings.ToDoSettings = value;
					await this.plugin.saveSettings();
				}));
	}
}
