package internal

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"syscall"
	"time"
)

// RunResult holds the result of a Python CLI subprocess execution.
type RunResult struct {
	ExitCode  int
	Stdout    string
	Stderr    string
	TimedOut  bool
	Cancelled bool
}

// RunPython executes the Python CLI as a subprocess with streaming output.
// stdout and stderr callbacks receive output line by line.
func RunPython(ctx context.Context, pythonExe string, args []string, dir string,
	stdoutFn func(string), stderrFn func(string)) (*RunResult, error) {

	cmd := exec.CommandContext(ctx, pythonExe, args...)
	cmd.Dir = dir
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	// Set up pipes
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("stdout pipe: %w", err)
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("stderr pipe: %w", err)
	}

	// Set environment
	cmd.Env = append(os.Environ(),
		"E3CNC_FORCE_COLOR=1",
		"PYTHONUNBUFFERED=1",
	)

	// Start the subprocess
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start: %w", err)
	}

	// Read stdout and stderr concurrently
	result := &RunResult{}
	var stdoutBuf, stderrBuf []byte

	done := make(chan struct{}, 2)

	go func() {
		scanner := bufio.NewScanner(stdoutPipe)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			line := scanner.Text()
			stdoutBuf = append(stdoutBuf, line...)
			stdoutBuf = append(stdoutBuf, '\n')
			if stdoutFn != nil {
				stdoutFn(line)
			}
		}
		done <- struct{}{}
	}()

	go func() {
		scanner := bufio.NewScanner(stderrPipe)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			line := scanner.Text()
			stderrBuf = append(stderrBuf, line...)
			stderrBuf = append(stderrBuf, '\n')
			if stderrFn != nil {
				stderrFn(line)
			}
		}
		done <- struct{}{}
	}()

	// Wait for pipes to close
	<-done
	<-done

	// Wait for process to finish
	err = cmd.Wait()
	result.Stdout = string(stdoutBuf)
	result.Stderr = string(stderrBuf)

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			result.ExitCode = exitErr.ExitCode()
		} else {
			if ctx.Err() == context.Canceled {
				result.Cancelled = true
				result.ExitCode = -1
				if cmd.Process != nil {
					syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
				}
				return result, nil
			}
			if ctx.Err() == context.DeadlineExceeded {
				result.TimedOut = true
				result.ExitCode = -1
				return result, nil
			}
			return nil, fmt.Errorf("wait: %w", err)
		}
	}

	return result, nil
}

// RunPythonSimple executes the Python CLI and returns combined output.
// This is a convenience wrapper for synchronous, non-streaming use.
func RunPythonSimple(pythonExe string, args []string, dir string) (*RunResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	return RunPython(ctx, pythonExe, args, dir, nil, nil)
}
