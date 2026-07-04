//go:build windows

package launch

import (
	"os/exec"
	"syscall"
	"time"
)

func launchViaPlatform(name, executable string, args []string) SpawnResult {
	return launchViaCmdStart(name, executable, args)
}

func launchViaCmdStart(name, executable string, args []string) SpawnResult {
	cmdArgs := append([]string{"/c", "start", "", executable}, args...)
	cmd := exec.Command("cmd.exe", cmdArgs...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
	}
	cmd.Stdin = nil
	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Start(); err != nil {
		return SpawnResult{Name: name, Success: false, Error: formatSpawnError(err)}
	}

	spawnErr := verifySpawn(cmd, spawnVerifyMS)
	if spawnErr != nil {
		return SpawnResult{Name: name, Success: false, Error: formatSpawnError(spawnErr)}
	}

	return SpawnResult{Name: name, Success: true}
}

func verifySpawn(cmd *exec.Cmd, timeout time.Duration) error {
	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

	select {
	case err := <-done:
		return err
	case <-time.After(timeout):
		return nil
	}
}
