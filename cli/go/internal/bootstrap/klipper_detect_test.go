package bootstrap

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseMCUFromPrinterCfg_Serial(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "printer.cfg")
	content := `# printer config
[printer]
kinematics: corexy
max_velocity: 300

[mcu]
serial: /dev/serial/by-id/usb-Klipper_stm32f446xx_12345-if00

[gcode_macro PAUSE]
description: Pause the print
`
	os.WriteFile(cfgPath, []byte(content), 0644)

	mcu := parseMCUFromPrinterCfg(cfgPath)
	expected := "/dev/serial/by-id/usb-Klipper_stm32f446xx_12345-if00"
	if mcu != expected {
		t.Errorf("parseMCUFromPrinterCfg = %q, expected %q", mcu, expected)
	}
}

func TestParseMCUFromPrinterCfg_CanBusUUID(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "printer.cfg")
	content := `[mcu]
canbus_uuid: abcdef123456
`
	os.WriteFile(cfgPath, []byte(content), 0644)

	mcu := parseMCUFromPrinterCfg(cfgPath)
	expected := "canbus_uuid:abcdef123456"
	if mcu != expected {
		t.Errorf("parseMCUFromPrinterCfg = %q, expected %q", mcu, expected)
	}
}

func TestParseMCUFromPrinterCfg_NoMCU(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "printer.cfg")
	content := `[printer]
kinematics: none
`
	os.WriteFile(cfgPath, []byte(content), 0644)

	mcu := parseMCUFromPrinterCfg(cfgPath)
	if mcu != "" {
		t.Errorf("parseMCUFromPrinterCfg = %q, expected empty", mcu)
	}
}

func TestParseMCUFromPrinterCfg_MissingFile(t *testing.T) {
	mcu := parseMCUFromPrinterCfg("/nonexistent/printer.cfg")
	if mcu != "" {
		t.Errorf("parseMCUFromPrinterCfg for missing file = %q, expected empty", mcu)
	}
}

func TestParseMCUFromPrinterCfg_CommentedOut(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "printer.cfg")
	content := `# serial: /dev/ttyACM0
[mcu]
#serial: /dev/ttyAMA0
serial: /dev/serial/by-id/usb-Klipper_if00
`
	os.WriteFile(cfgPath, []byte(content), 0644)

	mcu := parseMCUFromPrinterCfg(cfgPath)
	expected := "/dev/serial/by-id/usb-Klipper_if00"
	if mcu != expected {
		t.Errorf("parseMCUFromPrinterCfg = %q, expected %q", mcu, expected)
	}
}

func TestDetectExistingKlipper_NoInstall(t *testing.T) {
	// On a system without Klipper, this should return nil
	result, err := DetectExistingKlipper()
	// We can't guarantee the test environment doesn't have Klipper,
	// but we can at least verify the function returns without panic
	if err != nil && result != nil {
		t.Errorf("DetectExistingKlipper: err=%v, result=%v — expected one or the other", err, result)
	}
}

func TestCommonKlipperPaths_Deduplication(t *testing.T) {
	home, _ := os.UserHomeDir()
	paths := commonKlipperPaths()

	// First path should be home/klipper
	expected := filepath.Join(home, "klipper")
	if len(paths) == 0 || paths[0] != expected {
		t.Errorf("commonKlipperPaths()[0] = %q, expected %q", paths[0], expected)
	}

	// No duplicates
	seen := make(map[string]bool)
	for _, p := range paths {
		if seen[p] {
			t.Errorf("duplicate path in commonKlipperPaths: %s", p)
		}
		seen[p] = true
	}
}

func TestCommonConfigPaths(t *testing.T) {
	home, _ := os.UserHomeDir()
	paths := commonConfigPaths("/home/pi/klipper")

	if len(paths) == 0 {
		t.Fatal("commonConfigPaths returned empty slice")
	}

	// First check should be baseDir/printer.cfg
	expected := "/home/pi/klipper/printer.cfg"
	if paths[0] != expected {
		t.Errorf("commonConfigPaths[0] = %q, expected %q", paths[0], expected)
	}

	// Should include ~/printer.cfg
	homeCfg := filepath.Join(home, "printer.cfg")
	found := false
	for _, p := range paths {
		if p == homeCfg {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("commonConfigPaths should include %q", homeCfg)
	}
}

func TestDetectExistingKlipper_WithMockDir(t *testing.T) {
	// Create a mock Klipper directory structure
	tmpDir := t.TempDir()
	klipperDir := filepath.Join(tmpDir, "klipper")
	klippyDir := filepath.Join(klipperDir, "klippy")
	os.MkdirAll(klippyDir, 0755)
	os.WriteFile(filepath.Join(klippyDir, "klippy.py"), []byte("#!/usr/bin/env python3"), 0644)

	// Create printer.cfg
	cfgDir := filepath.Join(klipperDir, "config")
	os.MkdirAll(cfgDir, 0755)
	cfgContent := `[mcu]
serial: /dev/serial/by-id/test-mcu-12345
`
	os.WriteFile(filepath.Join(cfgDir, "printer.cfg"), []byte(cfgContent), 0644)

	// Create moonraker alongside
	moonrakerDir := filepath.Join(tmpDir, "moonraker")
	os.MkdirAll(moonrakerDir, 0755)

	// Save and restore original home
	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)

	// Override commonKlipperPaths to only check our mock
	// Since we can't easily override the function, let's just verify
	// that the path scanning works by checking the helper functions
	paths := commonKlipperPaths()
	found := false
	for _, p := range paths {
		if p == klipperDir {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("commonKlipperPaths should include %q when HOME=%s", klipperDir, tmpDir)
	}

	// Verify config path scanning
	cfgPaths := commonConfigPaths(klipperDir)
	foundCfg := false
	for _, p := range cfgPaths {
		if p == filepath.Join(cfgDir, "printer.cfg") {
			foundCfg = true
			break
		}
	}
	if !foundCfg {
		t.Errorf("commonConfigPaths(%q) should include %q", klipperDir, filepath.Join(cfgDir, "printer.cfg"))
	}
}

func TestDetectExistingKlipper_Integration(t *testing.T) {
	// Create a complete mock Klipper install
	tmpDir := t.TempDir()

	// Klipper dir at ~/klipper
	klipperDir := filepath.Join(tmpDir, "klipper")
	os.MkdirAll(filepath.Join(klipperDir, "klippy"), 0755)
	os.WriteFile(filepath.Join(klipperDir, "klippy", "klippy.py"), []byte("#!/usr/bin/env python3"), 0644)

	// Config dir at ~/klipper/config
	cfgDir := filepath.Join(klipperDir, "config")
	os.MkdirAll(cfgDir, 0755)
	cfgContent := `[printer]
kinematics: corexy
max_velocity: 300
max_accel: 3000

[mcu]
serial: /dev/serial/by-id/usb-Klipper_test_12345-if00

[pause_resume]
[gcode_macro PAUSE]
`
	os.WriteFile(filepath.Join(cfgDir, "printer.cfg"), []byte(cfgContent), 0644)

	// Moonraker at ~/moonraker
	moonrakerDir := filepath.Join(tmpDir, "moonraker")
	os.MkdirAll(moonrakerDir, 0755)

	// Override HOME to our tmp dir
	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)

	result, err := DetectExistingKlipper()
	if err != nil {
		t.Fatalf("DetectExistingKlipper should find mock install: %v", err)
	}

	if result.KlipperDir != klipperDir {
		t.Errorf("KlipperDir = %q, expected %q", result.KlipperDir, klipperDir)
	}
	if result.KlippyPy != filepath.Join(klipperDir, "klippy", "klippy.py") {
		t.Errorf("KlippyPy = %q, expected %q", result.KlippyPy, filepath.Join(klipperDir, "klippy", "klippy.py"))
	}
	if result.PrinterCfg != filepath.Join(cfgDir, "printer.cfg") {
		t.Errorf("PrinterCfg = %q, expected %q", result.PrinterCfg, filepath.Join(cfgDir, "printer.cfg"))
	}
	if result.MCUPath != "/dev/serial/by-id/usb-Klipper_test_12345-if00" {
		t.Errorf("MCUPath = %q, expected %q", result.MCUPath, "/dev/serial/by-id/usb-Klipper_test_12345-if00")
	}
	if !result.MoonrakerInstalled {
		t.Error("MoonrakerInstalled should be true when moonraker dir exists")
	}
	if result.MoonrakerDir != moonrakerDir {
		t.Errorf("MoonrakerDir = %q, expected %q", result.MoonrakerDir, moonrakerDir)
	}
}