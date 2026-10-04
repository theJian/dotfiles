# Personal Doom configuration

Doom Emacs configuration in `~/.config/doom`, using Evil editing, Corfu
completion, Vertico search, and Ghostel terminals.

- `init.el`: enabled Doom modules.
- `config.el`: appearance, keybindings, and automatic saving.
- `packages.el`: extra package declarations (currently none).
- `themes/moonwalk-light-theme.el`: bundled Moonwalk light theme and mode colors.
- `tests/`: integration and undo/cursor persistence checks.

The editor uses CommitMono Nerd Font Mono at size 15, relative line numbers,
maximized borderless windows, and a colored editing-mode block in the modeline.
Install the font locally to use the configured text and icon glyphs.
Programming buffers truncate long lines; text buffers wrap. Tabs and trailing
whitespace are highlighted in editable programming and text files.
Org files use `~/org/`.

## Keybindings

`SPC` is the leader key in normal mode. Standard Doom menus remain available:
`SPC f` for files, `SPC g` for Git, `SPC h` for help, and `SPC t` for toggles.

| Keys | Action |
| --- | --- |
| `SPC SPC` | Toggle fold |
| `SPC x` | Toggle scratch buffer |
| `SPC o t` / `SPC o T` | Toggle terminal popup / open terminal here |
| Option + `1`–`9` | Switch workspace in normal or insert mode |
| `Ctrl-h/j/k/l` | Select left/down/up/right window in normal mode |
| `gh` / `gl` | First / last nonblank character in normal mode |
| `j` / `k` | Move by screen line; a count moves by logical lines |
| `J` / `K` in visual mode | Move selected lines down/up and reindent |
| `;` / `:` in normal or visual mode | Open Ex command / repeat character search |
| Backspace in normal mode | Clear search highlighting |

Counts greater than one with `j/k` set a jump. Visual indentation and line
movement retain the selection. Visual `*`/`#` searches literally and preserves
yank registers. Ex commands offer automatic completion.

## Automatic saving

Files save when leaving insert mode and after 500 ms of idle time following
normal-mode edits. Saving skips remote, read-only, special, externally changed,
and unwritable files, plus syntax errors detected by an existing native
tree-sitter parser. Missing parent directories are created for new local files.
Save hooks run normally; confirmation prompts pause automatic saving.
After a save error, save manually with `C-x C-s` to resume automatic saving.
Doom's recovery autosaves remain enabled with their default behavior.

## Maintenance

After editing `config.el`, run `M-x doom/reload` or restart Emacs.
After changing modules in `init.el` or packages in `packages.el`, run
`doom sync` in a shell and restart Emacs.

Run the checks with an installed Doom environment and `emacs` on your PATH:

```sh
~/.config/doom/tests/run-tests.sh
```

The checks cover appearance, keybindings, editing, workspaces, automatic saving,
and undo/cursor persistence across processes. Parser errors are simulated;
the checks do not install packages or tree-sitter grammars.
