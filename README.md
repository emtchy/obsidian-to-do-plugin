# Obsidian ToDo Plugin

An Obsidian plugin that automatically generates structured to-do notes at regular intervals (daily, weekly, every N days, or manually on click).  
It also **carries over unfinished tasks** from the previous note and archives the old file — keeping your task management tidy and consistent.

This plugin is based on the [Obsidian sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin), but has been extended and customized.

## Features

- Generate new task notes automatically:
	- **Daily**
	- **Weekly (Monday)**
	- **Every N days** (customizable)
	- **On click** via ribbon icon
- Automatically **move old notes to an archive** folder.
- Carry over all **unfinished tasks** into the new note.
- Notes marked with **'X' or 'x'** are considered done in the corresponding column.
- Provides a simple **table structure** for tasks:
  ```markdown
  |Subject|Task|Due|Done|
  |-|-|-|-|

## How to use

- Clone this repo.
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## API Documentation

See https://github.com/obsidianmd/obsidian-api

## License:

This project is licensed under the MIT License.  
Portions of the code are based on the [Obsidian sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin).  
See the [LICENSE](LICENSE) file for details.
