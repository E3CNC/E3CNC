package commands

import (
	"fmt"
)

// ── check ─────────────────────────────────────────────────────────

func cmdCheck(jsonOut bool) bool {
	type checkItem struct {
		Name   string `json:"name"`
		Passed bool   `json:"passed"`
		Detail string `json:"detail"`
	}

	checks := []checkItem{
		{"Python 3.8+", hasBin("python3"), ""},
		{"git", hasBin("git"), ""},
		{"curl", hasBin("curl"), ""},
		{"unzip", hasBin("unzip"), ""},
		{"zstd", hasBin("zstd"), ""},
	}

	allPassed := true
	for _, c := range checks {
		if !c.Passed {
			allPassed = false
		}
	}

	if jsonOut {
		printJSON(map[string]interface{}{
			"all_passed": allPassed,
			"checks":     checks,
		})
		return true
	}

	for _, c := range checks {
		mark := "✓"
		if !c.Passed {
			mark = "✗"
		}
		fmt.Printf("  %s %s\n", mark, c.Name)
	}
	return true
}
