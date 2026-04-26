# dotfiles

Personal dotfiles managed with [chezmoi](https://www.chezmoi.io/).

## Dependencies

Install with [Homebrew Bundle](https://github.com/Homebrew/homebrew-bundle):

```bash
brew bundle
```

## Quick start

```bash
# Install chezmoi and apply dotfiles
chezmoi init --apply https://github.com/jian/dotfiles.git

# Edit a file
chezmoi edit ~/.gitconfig

# Apply changes
chezmoi apply

# Check diff
chezmoi diff
```
