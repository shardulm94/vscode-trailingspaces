Trailing Spaces
===============

A [VS Code](https://code.visualstudio.com/) extension that allows you to…

**highlight trailing spaces and delete them in a flash!**

This extension is a limited port of the popular [Sublime Text](https://www.sublimetext.com/) plugin [Trailing Spaces](https://github.com/SublimeText/TrailingSpaces).

---

- [Synopsis](#synopsis)
- [Installation](#installation)	
- [Usage](#usage)
	- [Deletion](#deletion)
	- [Highlighting](#highlighting)
- [Options](#options)	
	- [Include Current Line](#include-current-line)
	- [Include Empty Lines](#include-empty-lines)	
	- [Trim On Save](#trim-on-save)
	- [Save After Trim](#save-after-trim)
	- [Live Matching vs On-demand Matching](#live-matching-vs-on-demand-matching)
	- [Ignore Syntax](#ignore-syntax)
	- [For power-users only!](#for-power-users-only)		
		- [The matching pattern](#the-matching-pattern)

Synopsis
--------

VS Code provides a way to automate deletion of trailing spaces *by using the auto-formatting feature*. Depending on your settings, it may be more handy to just highlight them and/or delete them by hand, at any time. This plugin provides just that, and a *lot* of options to fine-tune the way you want to decimate trailing spaces.

Installation
------------

It is available through [Visual Studio Marketplace](https://marketplace.visualstudio.com/VSCode) and this is the recommended way of installation (brings automatic updates with changelogs…).


Usage
-----

### Deletion

The main feature you gain from using this plugin is that of deleting all trailing spaces in the currently edited document. In order to use this deletion feature, you may either:

* press F1 and select/type "Trailing Spaces: Delete Trailing Spaces"
* bind the deletion command to a keyboard shortcut:

To add a key binding, open "File / Preferences / Keyboard Shortcuts" and add:

``` js
{ "key": "alt+shift+t",        "command": "trailing-spaces.deleteTrailingSpaces",
                                  "when": "editorTextFocus" },
```

With this setting, pressing <kbd>Alt + Shift + t</kbd> will delete all trailing spaces at once in the current file!

### Highlighting

At any time, you can highlight the trailing spaces. You may either:

- press F1 and select/type "Trailing Spaces: Highlight Trailing Spaces"
- bind the highlighting command to a keyboard shortcut:

``` js
{ "key": "alt+shift+h",        "command": "trailing-spaces.highlightTrailingSpaces",
                                  "when": "editorTextFocus" },
```

Options
-------

Several options are available to customize the plugin's behavior. Those settings are stored in a configuration file, as JSON. You must use a specific file: Go to "File / Preferences / User Settings" to add your custom settings.

All settings are global (ie. applied to all opened documents).

### Include Current Line

*Default: true*

Highlighting of trailing spaces in the currently edited line can be annoying:
each time you are about to start a new word, the space you type is matched as a trailing spaces. Currently edited line can thus be ignored:

``` js
{ "trailing-spaces.includeCurrentLine": false }
```

Even though the trailing spaces are not highlighted on this line, they are still internally matched and will be deleted when firing the deletion command.

### Include Empty Lines

*Default: true*

When firing the deletion command, empty lines are matched as trailing regions, and end up being deleted. You can specifically ignore them:

``` js
{ "trailing-spaces.includeEmptyLines": false }
```

They will not be highlighted either.

### Trim On Save

*Default: false*

Setting this to `true` will ensure trailing spaces are deleted when you save your document. It abides by the other settings, such as *Include Empty Lines*.

``` js
{ "trailing-spaces.trimOnSave": true }
```

### Save After Trim

*Default: false*

You may not want to always trim trailing spaces on save, but the other way around could prove useful. Setting this to `true` will automatically save your document after you fire the deletion command:

``` js
{ "trailing-spaces.saveAfterTrim": true }
```

It is obviously ignored if *Trim On Save* is on.

### Live Matching vs On-demand Matching

*Default: true (reopen VS Code to update)*

By default, trailing regions are matched every time you edit the document, and when you open it.

This feature is entirely optional and you may set it off: firing the deletion command will cause the trailing spaces to be deleted as expected even though they were not matched prior to your request. If you are afraid of the plugin to cause slowness (for instance, you already installed several *heavy* extensions), you can disable live matching:

``` js
{ "trailing-spaces.liveMatching": false }
```

In this case, for no trailing regions are matched until you request them to be deleted, no highlighting occurs—it is in fact disabled. If you want to check the trailing spaces regions, you can use the `Highlight Trailing Spaces` command. In this case, it may come in handy to define a binding for the highlighting command. When "On-demand Matching" is on and some trailing spaces are highlighted, added ones will obviously not be. Running the highlight command again will refresh them.

### Ignore Syntax

*Default: []*

With this option you can ignore specific files/views based on the syntax used. An item has to match a case-sensitive substring of the syntax used in the view:

``` js
// Views with a syntax that contains "Diff" are ignored
{ "trailing-spaces.syntaxIgnore": ["Diff"]}
```

### For power-users only!

#### The matching pattern

*Default: [ \t]+*

Trailing spaces are line-ending regions containing at least one simple space, tabs, or both. This pattern should be all you ever need, but if you *do* want to abide by another definition to cover edge-cases, go ahead:

``` js
// *danger* will match newline chars and many other folks
"trailing-spaces.regexp": "[\\s]+"
```
