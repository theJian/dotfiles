# Moonwalk Light theme for Nushell
# Base16 color mapping

export def main [] {
    # Base16 palette (base00 - base0f)
    let base00 = "#e4e2e0"  # Background
    let base01 = "#dcd8d0"  # Status line / secondary background
    let base02 = "#f2ede9"  # Selection background / current line
    let base03 = "#9c958d"  # Comments / muted / hints
    let base04 = "#7d7e82"  # Dark foreground / separator
    let base05 = "#061f4a"  # Default foreground / primary text
    let base06 = "#080808"  # Light foreground / bold text
    let base07 = "#ffebd1"  # Light background / popup highlight
    let base08 = "#af1608"  # Red / error
    let base09 = "#a33000"  # Orange / gold
    let base0a = "#bd6500"  # Yellow / search highlight
    let base0b = "#4c6129"  # Green / success
    let base0c = "#006442"  # Cyan / directories
    let base0d = "#0d50c5"  # Blue / keywords
    let base0e = "#952197"  # Purple / variables
    let base0f = "#7a0047"  # Dark red / special

    {
        # UI elements
        separator: $base04
        leading_trailing_space_bg: { attr: n }
        header: { fg: $base0b attr: b }
        empty: $base0d
        hints: $base03

        # Primitive types
        bool: $base0c
        int: $base05
        float: $base05
        filesize: $base0c
        duration: $base05
        date: $base0e
        range: $base05
        string: $base05
        nothing: $base03
        binary: $base05
        cell-path: $base05

        # Collection types
        record: $base05
        list: $base05
        block: $base05
        closure: { fg: $base0b attr: b }
        glob: { fg: $base0c attr: b }

        # Table/row indices
        row_index: { fg: $base0b attr: b }

        # Search highlighting
        search_result: { bg: $base0a fg: $base05 }

        # Syntax highlighting shapes
        shape_binary: { fg: $base0e attr: b }
        shape_block: { fg: $base0d attr: b }
        shape_bool: $base0c
        shape_closure: { fg: $base0b attr: b }
        shape_custom: $base0b
        shape_datetime: { fg: $base0c attr: b }
        shape_directory: $base0c
        shape_external: $base0c
        shape_externalarg: { fg: $base0b attr: b }
        shape_external_resolved: { fg: $base09 attr: b }
        shape_filepath: $base0c
        shape_flag: { fg: $base0d attr: b }
        shape_float: { fg: $base0e attr: b }
        shape_glob_interpolation: { fg: $base0c attr: b }
        shape_globpattern: { fg: $base0c attr: b }
        shape_int: { fg: $base0e attr: b }
        shape_internalcall: { fg: $base0c attr: b }
        shape_keyword: { fg: $base0d attr: b }
        shape_list: { fg: $base0c attr: b }
        shape_literal: $base0d
        shape_match_pattern: $base0b
        shape_matching_brackets: { fg: $base08 attr: u }
        shape_nothing: $base0c
        shape_operator: $base09
        shape_pipe: { fg: $base0e attr: b }
        shape_range: { fg: $base09 attr: b }
        shape_record: { fg: $base0c attr: b }
        shape_redirection: { fg: $base0e attr: b }
        shape_signature: { fg: $base0b attr: b }
        shape_string: $base0b
        shape_string_interpolation: { fg: $base0c attr: b }
        shape_table: { fg: $base0d attr: b }
        shape_variable: $base0e
        shape_vardecl: $base0e
        shape_raw_string: "#af88af"
        shape_garbage: {
            fg: $base00
            bg: $base08
            attr: b
        }
    }
}
