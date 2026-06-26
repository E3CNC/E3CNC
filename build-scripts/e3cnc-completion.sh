#!/usr/bin/env bash
# Tab completion for e3cnc-cli and e3cnc-tui
#
# Source this file in your ~/.bashrc or ~/.zshrc:
#   source ~/E3CNC/build-scripts/e3cnc-completion.sh

_e3cnc_cli_completions() {
    local cur prev words cword
    _init_completion || return

    local commands="install deploy update uninstall status check backup restore diagnose logs"

    # First argument: complete subcommands
    if [[ $cword -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$commands --version --help" -- "$cur"))
        return
    fi

    # Second argument and beyond: complete flags for each subcommand
    case "${words[1]}" in
        install|deploy|update|uninstall)
            COMPREPLY=($(compgen -W "--remote --check -n --verbose -v --help" -- "$cur"))
            ;;
        status|backup|diagnose)
            COMPREPLY=($(compgen -W "--remote --help" -- "$cur"))
            ;;
        check)
            COMPREPLY=($(compgen -W "--verbose -v --help" -- "$cur"))
            ;;
        restore)
            COMPREPLY=($(compgen -W "--remote --yes -y --help" -- "$cur"))
            ;;
        logs)
            COMPREPLY=($(compgen -W "--remote --lines -n --help" -- "$cur"))
            ;;
    esac
}

# Simple completion for e3cnc-tui (no flags)
_e3cnc_tui_completions() {
    local cur prev words cword
    _init_completion || return
    COMPREPLY=()
}

complete -F _e3cnc_cli_completions e3cnc-cli
complete -F _e3cnc_tui_completions e3cnc-tui
