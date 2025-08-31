import {
	App,
	Editor,
	MarkdownView,
	Modal,
	normalizePath,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting, TAbstractFile,
	TFile
} from 'obsidian';

const DONE_CELL = 4;
type GenerationMode = "daily" | "weekly" | "everyNDays" | "onClick";

// Remember to rename these classes and interfaces!

interface ToDoPluginSettings {
	ToDoSettings: string;
	generationMode: GenerationMode;
	nDays: number;
	anchorISODate: string;
}

const DEFAULT_SETTINGS: ToDoPluginSettings = {
	ToDoSettings: "default",
	generationMode: "weekly",
	nDays: 7,
	anchorISODate: "2024-01-01"
}

export default class ToDoPlugin extends Plugin {
	settings: ToDoPluginSettings;
	private ribbonEl: HTMLElement | null = null;
	private heartbeatId: number | null = null;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ToDoSetting(this.app, this));
		this.installTriggers();
	}

	onunload() {
		this.uninstallTriggers();
	}

	public installTriggers() {
		this.uninstallTriggers();

		if (this.settings.generationMode === "onClick") {
			this.ribbonEl = this.addRibbonIcon("sticky-note", "Todo Plugin", async () => {
				await this.updateTodos();
			});
			return;
		}

		this.app.workspace.onLayoutReady(() => {
			const run = () => this.rollIfNeeded(false).catch(console.error);

			let fired = false;
			this.registerEvent(this.app.metadataCache.on("resolved", () => {
				if (fired) return;
				fired = true;
				run();
			}));

			window.setTimeout(() => {
				if (fired) return;
				const hasIndex = this.app.vault.getMarkdownFiles().length > 0;
				if (hasIndex) {
					fired = true;
					run();
				}
			}, 300);
		});

		this.heartbeatId = window.setInterval(() => this.rollIfNeeded(false), 60 * 60 * 1000);
	}

	private uninstallTriggers() {
		if (this.ribbonEl) {
			this.ribbonEl.remove();
			this.ribbonEl = null;
		}
		if (this.heartbeatId) {
			try {
				window.clearInterval(this.heartbeatId);
			} catch {
			}
			this.heartbeatId = null;
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async moveFile(prevPath: string, newPath: string) : Promise<void> {
		const note = this.app.vault.getAbstractFileByPath(normalizePath(prevPath));
		if (note instanceof TFile) {
			await this.app.fileManager.renameFile(note, normalizePath(newPath));
		}
	}

	private async createNewToDo(prevNote: string, newNote: string): Promise<void> {
		const prevFile = this.app.vault.getAbstractFileByPath(prevNote);
		console.log("PREV FILE: ", prevFile);
		let prevText = "";
		if (prevFile instanceof TFile) {
			prevText = await this.app.vault.read(prevFile);
			const newContent = await this.parseMarkdownTable(prevText);
			console.log("NEW CONTENT: ", newContent);
			await this.app.vault.create(newNote, newContent.join('\n'));
			return;
		}
		await this.app.vault.create(newNote, prevText);
	}

	private async parseMarkdownTable(markdown: string): Promise<string[]> {
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

	private async updateTodos() : Promise<void> {
		try {
			try {
				await this.app.vault.createFolder('Tasks/Archive');
			} catch (_) {}
			const prevName = this.getPreviousNote(); // e.g., "todo-2025-08-24.md"
			const todayPath = normalizePath(this.getTargetPath());
			if (this.app.vault.getAbstractFileByPath(todayPath)) {
				new Notice('[INFO] Today’s todo already exists.');
				return;
			}

			if (!prevName) {
				await this.app.vault.create(todayPath, '');
				new Notice('[SUCCESS] created new (empty) todo note!');
				return;
			}

			const prevSrc = `Tasks/${prevName}`;
			const prevDst = await this.safeArchivePath(prevName);
			await this.moveFile(prevSrc, prevDst);

			await this.createNewToDo(prevDst, todayPath);

			console.log('[SUCCESS] created new todo file');
			new Notice('[SUCCESS] created new todo note!');
		} catch (e) {}
	}

	private getTargetNote(): string {
		const d = this.getTargetMoment().format("YYYY-MM-DD");
		return `todo-${d}.md`;
	}

	private getTargetPath(): string {
		return `Tasks/${this.getTargetNote()}`;
	}

	private getPreviousNote(): string | null {
		const exclude = this.getTargetNote();

		const files = this.app.vault.getMarkdownFiles()
			.filter(f => f.path.startsWith("Tasks/") && !f.path.startsWith("Tasks/Archive/"))
			.filter(f => /^todo-\d{4}-\d{2}-\d{2}\.md$/.test(f.name))
			.filter(f => f.name !== exclude);

		if (files.length === 0) return null;

		files.sort((a, b) => {
			const da = a.name.match(/^todo-(\d{4}-\d{2}-\d{2})\.md$/)![1];
			const db = b.name.match(/^todo-(\d{4}-\d{2}-\d{2})\.md$/)![1];
			return db.localeCompare(da); // newest first
		});

		return files[0].name;
	}

	private async rollIfNeeded(force = false): Promise<void> {
		const targetPath = normalizePath(this.getTargetPath());
		const exists = !!this.app.vault.getAbstractFileByPath(targetPath);
		if (exists && !force) return;
		await this.updateTodos();
	}

	private async safeArchivePath(prevName: string): Promise<string> {
		const base = prevName.replace(/\.md$/, '');
		for (let i = 0; ; i++) {
			const candidate = normalizePath(`Tasks/Archive/${i ? `${base}-${i}.md` : `${base}.md`}`);
			if (!this.app.vault.getAbstractFileByPath(candidate)) return candidate;
		}
	}

	private getTargetMoment(): moment.Moment {
		const m = window.moment();
		switch (this.settings.generationMode) {
			case "daily":
				return m;
			case "weekly":
				return m.startOf("isoWeek");
			case "everyNDays": {
				const n = Math.max(1, Math.floor(this.settings.nDays || 1));
				const anchor = window.moment(this.settings.anchorISODate, "YYYY-MM-DD", true);
				const base = anchor.isValid() ? anchor : window.moment("2024-01-01", "YYYY-MM-DD");
				const diffDays = window.moment().diff(base, "days");
				const bucketIdx = Math.floor(diffDays / n);
				return base.clone().add(bucketIdx * n, "days");
			}
			case "onClick":
				return m;
		}
		return m.startOf("isoWeek");
	}
}

class ToDoSetting extends PluginSettingTab {
	plugin: ToDoPlugin;

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Generation interval")
			.setDesc("When should a new todo be generated?")
			.addDropdown(dd => dd
				.addOptions({
					daily: "Daily",
					weekly: "Weekly (Monday)",
					everyNDays: "Every N days",
					onClick: "On click",
				})
				.setValue(this.plugin.settings.generationMode)
				.onChange(async (v: GenerationMode) => {
					this.plugin.settings.generationMode = v;
					await this.plugin.saveSettings();
					this.plugin.installTriggers();
				})
			);

		new Setting(containerEl)
			.setName("N (days)")
			.setDesc('Used only when mode = "Every N days".')
			.addText(t => t
				.setPlaceholder("e.g. 7")
				.setValue(String(this.plugin.settings.nDays))
				.onChange(async (val) => {
					const n = Math.max(1, parseInt(val || "1", 10) || 1);
					this.plugin.settings.nDays = n;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Anchor date")
			.setDesc('YYYY-MM-DD. Buckets are counted from here for "Every N days".')
			.addText(t => t
				.setPlaceholder("2024-01-01")
				.setValue(this.plugin.settings.anchorISODate)
				.onChange(async (val) => {
					this.plugin.settings.anchorISODate = val || "2024-01-01";
					await this.plugin.saveSettings();
				})
			);
	}
}
