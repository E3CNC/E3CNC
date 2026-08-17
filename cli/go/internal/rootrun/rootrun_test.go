package rootrun

import (
	"errors"
	"reflect"
	"testing"
)

func TestIsRootUsesRootCheck(t *testing.T) {
	orig := rootCheck
	defer func() { rootCheck = orig }()

	rootCheck = func() bool { return true }
	if !IsRoot() {
		t.Error("IsRoot() should be true when rootCheck returns true")
	}

	rootCheck = func() bool { return false }
	if IsRoot() {
		t.Error("IsRoot() should be false when rootCheck returns false")
	}
}

func TestRunAsRootWhenRoot(t *testing.T) {
	origRoot, origExec := rootCheck, Exec
	defer func() { rootCheck, Exec = origRoot, origExec }()

	rootCheck = func() bool { return true }
	var gotName string
	var gotArgs []string
	Exec = func(name string, args ...string) ([]byte, error) {
		gotName, gotArgs = name, args
		return []byte("root out"), nil
	}

	out, err := RunAsRoot("supervisorctl", "status", "x")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(out) != "root out" {
		t.Errorf("unexpected output: %q", out)
	}
	// When root, the command runs directly with no sudo prefix.
	if gotName != "supervisorctl" || !reflect.DeepEqual(gotArgs, []string{"status", "x"}) {
		t.Errorf("when root expected direct exec, got name=%q args=%v", gotName, gotArgs)
	}
}

func TestRunAsRootWhenNonRoot(t *testing.T) {
	origRoot, origExec := rootCheck, Exec
	defer func() { rootCheck, Exec = origRoot, origExec }()

	rootCheck = func() bool { return false }
	var gotName string
	var gotArgs []string
	Exec = func(name string, args ...string) ([]byte, error) {
		gotName, gotArgs = name, args
		return []byte("sudo out"), nil
	}

	out, err := RunAsRoot("supervisorctl", "status", "x")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(out) != "sudo out" {
		t.Errorf("unexpected output: %q", out)
	}
	// When non-root, the command is prefixed with sudo -n.
	if gotName != "sudo" || !reflect.DeepEqual(gotArgs, []string{"-n", "supervisorctl", "status", "x"}) {
		t.Errorf("when non-root expected sudo -n exec, got name=%q args=%v", gotName, gotArgs)
	}
}

func TestRunAsRootPropagatesError(t *testing.T) {
	origRoot, origExec := rootCheck, Exec
	defer func() { rootCheck, Exec = origRoot, origExec }()

	rootCheck = func() bool { return false }
	boom := errors.New("sudo requires a password")
	Exec = func(name string, args ...string) ([]byte, error) {
		return []byte("the password prompt"), boom
	}

	_, err := RunAsRoot("apt-get", "update")
	if !errors.Is(err, boom) {
		t.Errorf("expected the underlying sudo error to propagate, got: %v", err)
	}
}
