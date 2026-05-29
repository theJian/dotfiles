set -gx EDITOR nvim
set -gx VISUAL nvim
set -gx BAT_THEME GitHub
set -gx GPG_TTY (tty)

# Toolchain homes
set -gx BUN_INSTALL $HOME/.bun
set -gx JAVA_HOME /Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home
set -gx ANDROID_HOME $HOME/Library/Android/sdk

# User binary paths
fish_add_path --global $HOME/.local/bin
fish_add_path --global $HOME/.cargo/bin
fish_add_path --global $HOME/.moon/bin
fish_add_path --global $HOME/.modular/bin
fish_add_path --global $HOME/.opencode/bin
fish_add_path --global $BUN_INSTALL/bin
fish_add_path --global $ANDROID_HOME/emulator
fish_add_path --global $ANDROID_HOME/platform-tools
fish_add_path --global (go env GOPATH)/bin
fish_add_path --global /opt/homebrew/opt/openjdk/bin
