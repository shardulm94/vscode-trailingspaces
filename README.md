Trailing Spaces
===============

[![Build Status](https://travis-ci.org/shardulm94/vscode-trailingspaces.svg?branch=master)](https://travis-ci.org/shardulm94/vscode-trailingspaces)
[![VS Code Marketplace](https://vsmarketplacebadge.apphb.com/version-short/shardulm94.trailing-spaces.svg) ![Rating](https://vsmarketplacebadge.apphb.com/rating-short/shardulm94.trailing-spaces.svg) ![Installs](https://vsmarketplacebadge.apphb.com/installs/shardulm94.trailing-spaces.svg)](https://marketplace.visualstudio.com/items?itemName=shardulm94.trailing-spaces)

A [VS Code](https://code.visualstudio.com/) extension that allows you to…

**highlight trailing spaces and delete them in a flash!**

This extension is a port of the popular [Sublime Text](https://www.sublimetext.com/) plugin [Trailing Spaces](https://github.com/SublimeText/TrailingSpaces).

---

- [Synopsis](#synopsis)
- [Installation](#installation)
- [Usage](#usage)
	- [Delete](#delete)
    - [Delete - Modified Lines Only](#delete---modified-lines-only)
	- [Highlight](#highlight)
- [Options](#options)
	- [Highlight Current Line](#highlight-current-line)
	- [Include Empty Lines](#include-empty-lines)
    - [Delete Modified Lines Only](#delete-modified-lines-only)
	- [Trim On Save](#trim-on-save)
	- [~~Save After Trim~~ *[REMOVED]*](#save-after-trim-removed)
	- [Live Matching vs On-demand Matching](#live-matching-vs-on-demand-matching)
	- [Ignore Syntax](#ignore-syntax)
	- [Ignore Scheme](#ignore-scheme)
	- [Show Status Bar Message](#show-status-bar-message)
	- [Background Color](#background-color)
	- [Border Color](#border-color)
	- [For power-users only!](#for-power-users-only)
		- [The matching pattern](#the-matching-pattern)

Synopsis
--------

VS Code provides a way to automate deletion of trailing spaces *by using the Trim Trailing Whitespace command*. Depending on your settings, it may be more handy to just highlight them and/or delete them by hand, at any time. This plugin provides just that, and a *lot* of options to fine-tune the way you want to decimate trailing spaces.

Installation
------------

It is available through [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=shardulm94.trailing-spaces) and this is the recommended way of installation (brings integrated updates).


Usage
-----

### Delete

The main feature you gain from using this plugin is that of deleting all trailing spaces in the currently edited document. In order to use this deletion feature, you may either:

* press F1 and select/type "Trailing Spaces: Delete"
* bind the deletion command to a keyboard shortcut:

To add a key binding, open "File / Preferences / Keyboard Shortcuts" and add:

``` js
{ "key": "alt+shift+t",        "command": "trailing-spaces.deleteTrailingSpaces",
                                  "when": "editorTextFocus" },
```

With this setting, pressing <kbd>Alt + Shift + t</kbd> will delete all trailing spaces at once in the current file!

### Delete - Modified Lines Only

You can also delete the trailing spaces exclusively from the modified (unsaved) lines. In order to use this deletion feature, you may either:

* press F1 and select/type "Trailing Spaces: Delete - Modified Lines Only"
* bind the deletion command to a keyboard shortcut:

To add a key binding, open "File / Preferences / Keyboard Shortcuts" and add:

``` js
{ "key": "alt+shift+m",        "command": "trailing-spaces.deleteTrailingSpacesModifiedLinesOnly",
                                  "when": "editorTextFocus" },
```
### Highlight

At any time, you can highlight the trailing spaces. You may either:

- press F1 and select/type "Trailing Spaces: Highlight"
- bind the highlighting command to a keyboard shortcut:

``` js
{ "key": "alt+shift+h",        "command": "trailing-spaces.highlightTrailingSpaces",
                                  "when": "editorTextFocus" },
```

Options
-------

Several options are available to customize the plugin's behavior. Those settings are stored in a configuration file, as JSON. You must use a specific file: Go to "File / Preferences / User Settings" to add your custom settings.

All settings are global (ie. applied to all opened documents).

### Highlight Current Line

*Default: true*

Highlighting of trailing spaces in the currently edited line can be annoying:
each time you are about to start a new word, the space you type is matched as a trailing spaces. Currently edited line can thus be ignored:

``` js
{ "trailing-spaces.highlightCurrentLine": false }
```

Even though the trailing spaces are not highlighted on this line, they are still internally matched and will be deleted when firing the deletion command.

### Include Empty Lines

*Default: true*

When firing the deletion command, empty lines are matched as trailing regions, and end up being deleted. You can specifically ignore them:

``` js
{ "trailing-spaces.includeEmptyLines": false }
```

They will not be highlighted either.

*Note:* This option only deletes the trailing spaces in blank lines and not the whole line itself. If you want to delete the newline character as well, please consider [changing the regex](#the-matching-pattern).

### Delete Modified Lines Only

*Default: false*

When firing the deletion command, trailing regions *in the entire document* are deleted. There are some use-cases when deleting trailing spaces *only on lines you edited* is smarter; for instance when commiting changes to some third-party source code.

At any time, you can change which area is covered when deleting trailing regions by changing the setting:

``` js
{ "trailing-spaces.deleteModifiedLinesOnly": true }
```

### Trim On Save

*Default: false*

Setting this to `true` will ensure trailing spaces are deleted when you save your document. It abides by the other settings, such as *Include Empty Lines*.

``` js
{ "trailing-spaces.trimOnSave": true }
```

### ~~Save After Trim~~ **[REMOVED]**

*NOTE: The current VSCode lifecycle for text editor commands does not provide a clean way to implement this feature. Since I did not see a lot of folks using this option, it was better to remove it.*

*Default: false*

You may not want to always trim trailing spaces on save, but the other way around could prove useful. Setting this to `true` will automatically save your document after you fire the deletion command:

``` js
{ "trailing-spaces.saveAfterTrim": true }
```

It is obviously ignored if *Trim On Save* is on.

### Live Matching vs On-demand Matching

*Default: true (reload VS Code Window to update)*

By default, trailing regions are matched every time you edit the document, and when you open it.

This feature is entirely optional and you may set it off: firing the deletion command will cause the trailing spaces to be deleted as expected even though they were not matched prior to your request. If you are afraid of the plugin to cause slowness (for instance, you already installed several *heavy* extensions), you can disable live matching:

``` js
{ "trailing-spaces.liveMatching": false }
```

In this case, for no trailing regions are matched until you request them to be deleted, no highlighting occurs—it is in fact disabled. If you want to check the trailing spaces regions, you can use the `Highlight Trailing Spaces` command. In this case, it may come in handy to define a binding for the highlighting command. When "On-demand Matching" is on and some trailing spaces are highlighted, added ones will obviously not be. Running the highlight command again will refresh them.

### Ignore Syntax

*Default: []*

With this option you can ignore specific files based on the language used. An item has to match the case-sensitive string of the language used in the file:

``` js
// files with the language "markdown" are ignored
{ "trailing-spaces.syntaxIgnore": ["markdown"]}
```

Here is a list of all languages that VS Code supports (as of 28 March 2019):

```js
bat, c, clojure, coffeescript, cpp, csharp, css, diff, dockerfile, fsharp, git-commit, git-rebase, go, groovy, handlebars, hexdump, hlsl, hocon, html, ignore, ini, jade, java, javascript, javascriptreact, jinja, json, jsonc, jsx-tags, jupyter, less, Log, log, lua, makefile, markdown, objective-c, objective-cpp, perl, perl6, php, pig, pip-requirements, plaintext, powershell, properties, python, r, razor, ruby, rust, scss, shaderlab, shellscript, sql, swift, toml, typescript, typescriptreact, vb, xml, xsl, yaml
```

For the most recent list of langauges, please use the [known language identifiers](https://code.visualstudio.com/docs/languages/identifiers#_known-language-identifiers) page or the `languages.getLanguages()` function (details [here](https://code.visualstudio.com/docs/extensionAPI/vscode-api#languages.getLanguages)).

### Ignore Scheme

*Default: ["output"]*

With this option you can ignore documents with a specific scheme. An item has to match the case-sensitive string of the scheme of the document. For instance, if you want to ignore VSCode output windows:

``` js
// documents with the scheme "output" are ignored
{ "trailing-spaces.schemeIgnore": ["output"]}
```

### Show Status Bar Message

*Default: true*

By default, trailing space deletions will be communicated through a status bar message. Set this to `false` as below to disable these messages:

``` js
{ "trailing-spaces.showStatusBarMessage": false }
```

### Background Color

*Default: rgba(255,0,0,0.3)*

You can control the background color of the highlighting performed by Trailing Spaces using this option. To set up another color change the setting:

``` js
{ "trailing-spaces.backgroundColor": "rgba(255,0,0,0.3)" }
```

### Border Color

*Default: rgba(255,100,100,0.15)*

You can control the border color of the highlighting performed by Trailing Spaces using this option. To set up another color change the setting:

``` js
{ "trailing-spaces.borderColor": "rgba(255,100,100,0.15)" }
```


### For power-users only!

#### The matching pattern

*Default: [ \t]+*

Trailing spaces are line-ending regions containing at least one simple space, tabs, or both. This pattern should be all you ever need, but if you *do* want to abide by another definition to cover edge-cases, go ahead:

``` js
// *danger* will match newline chars and many other folks
"trailing-spaces.regexp": "[\\s]+"
```

Contributions
-------------
- [@HookyQR](https://github.com/HookyQR): Fixed error while deleting last line of text [PR #9](https://github.com/shardulm94/vscode-trailingspaces/pull/9)
- [@yustnip](https://github.com/yustnip): Added options to change background and border colors of highlighting [PR #17](https://github.com/shardulm94/vscode-trailingspaces/pull/17)
- [@ameily](https://github.com/ameily): Properly trim spaces using the new TextEditor.edit() callback [PR #26](https://github.com/shardulm94/vscode-trailingspaces/pull/26)
