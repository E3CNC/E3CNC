// Serial communication over stdin/stdout for the host simulator.
//
// This makes the simulator a proper MCU device: data arriving on stdin is
// fed into the Klipper receive buffer (serial_rx_byte), and transmitted
// bytes are written to stdout. Klippy connects to the slave side of a PTY
// whose master side is wired to this process's stdin/stdout, so the real
// Klipper host protocol (identify, configure, stats, etc.) works end to end.
//
// This fork normalizes the simulator's serial layer so it actually reads
// stdin (the upstream example left serial_rx_byte() unimplemented) and
// self-wakes via sched_wake_task so the poll task keeps draining stdin even
// though the host simulator has no real interrupt-driven serial.
//
// Copyright (C) 2018  Kevin O'Connor <kevin@koconnor.net>

#include <fcntl.h> // fcntl
#include <unistd.h> // read, write, usleep, STDIN_FILENO, STDOUT_FILENO
#include <string.h> // memset
#include "board/io.h" // readb, writeb
#include "board/serial_irq.h" // serial_rx_byte, serial_enable_tx_irq
#include "sched.h" // DECL_INIT, DECL_TASK, sched_wake_task, task_wake

static struct task_wake sim_poll_wake;

// Put stdin/stdout in non-blocking mode so the poll task never blocks.
void
serial_init(void)
{
    int flags = fcntl(STDIN_FILENO, F_GETFL, 0);
    fcntl(STDIN_FILENO, F_SETFL, flags | O_NONBLOCK);
    flags = fcntl(STDOUT_FILENO, F_GETFL, 0);
    fcntl(STDOUT_FILENO, F_SETFL, flags | O_NONBLOCK);
    memset(&sim_poll_wake, 0, sizeof(sim_poll_wake));
}
DECL_INIT(serial_init);

// Provide a receive buffer for consumers that look one up.
void *
console_receive_buffer(void)
{
    return NULL;
}

// Drain stdin into the receive buffer, then re-arm to be called again.
void
serial_poll(void)
{
    uint8_t buf[64];
    for (;;) {
        int ret = read(STDIN_FILENO, buf, sizeof(buf));
        if (ret <= 0)
            break;
        int i;
        for (i = 0; i < ret; i++)
            serial_rx_byte(buf[i]);
    }
    // Re-arm the poll task. The host simulator has no interrupt-driven
    // serial receive, so keep requesting this task so stdin is drained.
    writeb(&sim_poll_wake.wake, 1);
    sched_wake_task(&sim_poll_wake);
    // Yield a little so this polling loop doesn't peg the CPU.
    usleep(1000);
}
DECL_TASK(serial_poll);

// Transmit any pending bytes to stdout.
// Transmit any pending bytes to stdout.
static void
do_uart(void)
{
    for (;;) {
        uint8_t data;
        int ret = serial_get_tx_byte(&data);
        if (ret)
            break;
        else
            write(STDOUT_FILENO, &data, sizeof(data));
    }
}

void
serial_enable_tx_irq(void)
{
    // There is no interrupt infrastructure on the host, so just drain the
    // transmit buffer directly each time more data becomes available.
    do_uart();
}
