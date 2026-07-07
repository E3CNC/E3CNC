// Package internal provides shared utilities for the e3cnc-tui Go binary.
package internal

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// CommandDef represents a single command definition from commands.json.
type CommandDef struct {
	Name        string     `json:"name"`
	Aliases     []string   `json:"aliases"`
	Destructive bool       `json:"destructive"`
	Blocking    bool       `json:"blocking"`
	Interactive bool       `json:"interactive"`
	Flags       []FlagDef  `json:"flags"`
}

// FlagDef represents a single flag for a command.
type FlagDef struct {
	Name       string `json:"name"`
	Type       string `json:"type"`
	Short      string `json:"short,omitempty"`
	Help       string `json:"help"`
	Default    any    `json:"default,omitempty"`
	Positional bool   `json:"positional,omitempty"`
}

// CommandsManifest is the root structure of commands.json.
type CommandsManifest struct {
	Version  string       `json:"version"`
	Commands []CommandDef `json:"commands"`
}

// LoadCommands reads and parses commands.json.
// It searches the repo checkout path relative to the binary location.
func LoadCommands() (*CommandsManifest, error) {
	// Find commands.json relative to the binary
	candidates := []string{
		// From bin/e3cnc-tui: ../../cli/commands.json
		filepath.Join("..", "..", "cli", "commands.json"),
		// From cmd/e3cnc-tui/: ../../../../cli/commands.json
		filepath.Join("..", "..", "..", "..", "cli", "commands.json"),
	}

	// Also try absolute path relative to executable
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		candidates = append(candidates,
			filepath.Join(exeDir, "..", "..", "cli", "commands.json"),
			filepath.Join(exeDir, "..", "..", "..", "..", "cli", "commands.json"),
		)
	}

	for _, path := range candidates {
		absPath, err := filepath.Abs(path)
		if err != nil {
			continue
		}
		if _, err := os.Stat(absPath); err == nil {
			data, err := os.ReadFile(absPath)
			if err != nil {
				return nil, fmt.Errorf("reading %s: %w", absPath, err)
			}
			var manifest CommandsManifest
			if err := json.Unmarshal(data, &manifest); err != nil {
				return nil, fmt.Errorf("parsing %s: %w", absPath, err)
			}
			return &manifest, nil
		}
	}
	return nil, fmt.Errorf("commands.json not found in any expected location")
}

// FindCommand looks up a command by name or alias. Returns nil if not found.
func (m *CommandsManifest) FindCommand(name string) *CommandDef {
	for i, cmd := range m.Commands {
		if cmd.Name == name {
			return &m.Commands[i]
		}
		for _, alias := range cmd.Aliases {
			if alias == name {
				return &m.Commands[i]
			}
		}
	}
	return nil
}

// IsKnownCommand checks if a string is a known command name or alias.
func (m *CommandsManifest) IsKnownCommand(name string) bool {
	return m.FindCommand(name) != nil
}

// AllCommandNames returns all command names and aliases.
func (m *CommandsManifest) AllCommandNames() []string {
	var names []string
	for _, cmd := range m.Commands {
		names = append(names, cmd.Name)
		names = append(names, cmd.Aliases...)
	}
	return names
}
