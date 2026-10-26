// pwaos_sdk test_package - main.
//
// Mode 1 (default): link/ABI smoke. Links against the packaged import
// library, verifies the ABI version macros and that resultToString answers
// at runtime - no pwaos_server needed.
//
// Mode 2 (PWAOS_TEST_RUNTIME=1): the full "hello" example flow from the SDK
// (pwaos_setRuntimeExecutablePath -> pwaos_init -> pwaos_createInstance ->
// pwaMain -> pwaos_destroyInstance -> pwaos_shutDown) against the packaged
// pwaos_server. Needs a working server environment (display etc.); the
// client's argv is forwarded to the spawned server, so run with
// `PWAOS_TEST_RUNTIME=1 conan test . ... -- --no-sandbox` on root/CI boxes.
// On failure it prints diagnostics and returns non-zero.
#include "runtime_client_api.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#if defined(_WIN32)
#include <windows.h>
#else
#include <unistd.h>
#include <sys/wait.h>
#include <signal.h>
#endif

/* Monotonic seconds since process start, for the pwaMain deadline. */
static struct timespec g_start;
unsigned long hello_deadline(void) {
    struct timespec now;
#if defined(_WIN32)
    now = g_start; /* not used on win path in this test */
    return 0;
#else
    clock_gettime(CLOCK_MONOTONIC, &now);
    return (unsigned long)(now.tv_sec - g_start.tv_sec);
#endif
}

static int smoke_abi(void) {
    unsigned major = (unsigned)PWAOS_RUNTIME_API_VERSION_MAJOR(PWAOS_RUNTIME_CURRENT_API_VERSION);
    unsigned minor = (unsigned)PWAOS_RUNTIME_API_VERSION_MINOR(PWAOS_RUNTIME_CURRENT_API_VERSION);
    printf("pwaos_sdk ABI %u.%u\n", major, minor);
    if (major != 0 || minor != 2) {
        printf("FAIL: unexpected ABI version\n");
        return 1;
    }

    char buf[PWAOS_MAX_RESULT_NAME_SIZE];
    memset(buf, 0, sizeof(buf));
    pwaosResult r = pwaos_resultToString(PWAOS_RESULT_SUCCESS, buf);
    if (r != PWAOS_RESULT_SUCCESS || buf[0] == '\0') {
        printf("FAIL: resultToString r=%d buf='%.20s'\n", (int)r, buf);
        return 1;
    }
    printf("resultToString(SUCCESS) = \"%s\"\n", buf);
    return 0;
}

/* Test argv, needed by pwaos_init (forwarded to the spawned server). */
int g_argc;
char** g_argv;

/* Declared in hello.c: the example's pwaMain flow. */
pwaosResult pwaMain(PWAOS_INSTANCE_HANDLE instanceHandle);

/* True when the packaged runtime dir was injected (package runenv). */
static const char* runtime_dir(void) {
    const char* env = getenv("PWAOS_RUNTIME_DIR");
    return env && env[0] ? env : NULL;
}

/* Mode 2: the hello example flow, bounded by RUNTIME_DEADLINE seconds. */
#define RUNTIME_DEADLINE_SECONDS 90

/* Forward: the full flow body (runs in the forked child on POSIX). */
static int run_runtime_flow_body(void);

/*
 * POSIX: pwaos_createInstance can block indefinitely when the server cannot
 * boot, so the flow runs in a forked child in its own process group (the
 * child spawns pwaos_server). A hard killpg at the deadline takes down the
 * whole tree and keeps `conan test` bounded.
 */
static int run_runtime_flow(void) {
    const char* rt = runtime_dir();
    if (!rt) {
        printf("SKIP: PWAOS_TEST_RUNTIME set but no PWAOS_RUNTIME_DIR\n");
        return 0;
    }
    printf("runtime flow: server dir = %s\n", rt);

#if defined(_WIN32)
    return run_runtime_flow_body();
#else
    pid_t pid = fork();
    if (pid < 0) {
        perror("fork");
        return 1;
    }
    if (pid == 0) {
        setpgid(0, 0); /* own group so the server tree dies with us */
        int rc = run_runtime_flow_body();
        _exit(rc);
    }
    /* parent: bounded wait */
    time_t start = time(NULL);
    while (time(NULL) - start < RUNTIME_DEADLINE_SECONDS) {
        int status;
        pid_t w = waitpid(pid, &status, WNOHANG);
        if (w == pid) {
            if (WIFEXITED(status))
                return WEXITSTATUS(status);
            printf("runtime flow FAIL (child crashed, signal %d)\n",
                   WTERMSIG(status));
            return 1;
        }
        if (w < 0) {
            perror("waitpid");
            return 1;
        }
        sleep(1);
    }
    printf("FAIL: runtime flow deadline (%ds) exceeded - killing client+server\n",
           RUNTIME_DEADLINE_SECONDS);
    kill(-pid, SIGKILL); /* process group: client + spawned pwaos_server */
    waitpid(pid, NULL, 0);
    return 1;
#endif
}

/* Full flow body: setRuntimeExecutablePath -> init -> createInstance ->
 * pwaMain -> destroy -> shutDown. */
static int run_runtime_flow_body(void) {
    const char* rt = runtime_dir();
    char rtPath[PWAOS_MAX_FILE_PATH_LEN];
#if defined(_WIN32)
    snprintf(rtPath, sizeof(rtPath), "%s\\runtime", rt);
#else
    snprintf(rtPath, sizeof(rtPath), "%s/runtime", rt);
#endif
    pwaos_setRuntimeExecutablePath(rtPath);

    pwaosInitializeInfo initializeInfo = {
        .type = PWAOS_TYPE_INITIALIZE_INFO,
        .next = NULL,
        .argc = g_argc,
        .argv = g_argv,
        .use_dedicated_thread = true,
    };
    pwaosResult result = pwaos_init(&initializeInfo);
    if (PWAOS_RESULT_SUCCESS != result) {
        char err[PWAOS_MAX_RESULT_NAME_SIZE];
        pwaos_resultToString(result, err);
        printf("FAIL: pwaos_init: %s\n", err);
        return 1;
    }

    /* dataPath: <exe dir>/data, like the example's main(). */
    char exePath[PWAOS_MAX_FILE_PATH_LEN];
    char dataPath[PWAOS_MAX_FILE_PATH_LEN];
    dataPath[0] = '\0';
#if defined(_WIN32)
    DWORD wlen = GetModuleFileNameA(NULL, exePath, PWAOS_MAX_FILE_PATH_LEN);
    if (wlen > 0 && wlen < PWAOS_MAX_FILE_PATH_LEN) {
#else
    if (realpath(g_argv[0], exePath)) {
#endif
        char* sep = strrchr(exePath,
#if defined(_WIN32)
                            '\\'
#else
                            '/'
#endif
        );
        if (sep) {
            size_t dirLen = (size_t)(sep - exePath);
            memcpy(dataPath, exePath, dirLen);
            dataPath[dirLen] = '\0';
            strcat(dataPath, "/data");
        }
    }

    pwaosInstanceCreateInfo createInfo = {
        .type = PWAOS_TYPE_INSTANCE_CREATE_INFO,
        .next = NULL,
        .runtimeType = runtimeTypePwa,
        .serverUrl = "http://localhost",
        .dataPath = {0},
    };
    if (dataPath[0]) {
        strcpy((char*)createInfo.dataPath, dataPath);
    }

    PWAOS_INSTANCE_HANDLE instance = INVALID_PWAOS_HANDLE;
    result = pwaos_createInstance(&createInfo, &instance);
    if (result != PWAOS_RESULT_SUCCESS) {
        char err[PWAOS_MAX_RESULT_NAME_SIZE];
        pwaos_resultToString(result, err);
        printf("FAIL: pwaos_createInstance: %s\n", err);
        pwaos_shutDown();
        return 1;
    }

    int outcome = 2; /* 2 = deadline hit, 1 = failure, 0 = ok */
    do {
        if (hello_deadline() > RUNTIME_DEADLINE_SECONDS) {
            printf("FAIL: runtime flow deadline (%ds) exceeded - "
                   "instance never reached Working/stopping\n",
                   RUNTIME_DEADLINE_SECONDS);
            break;
        }
        pwaosEventDataBuffer buffer;
        if (PWAOS_RESULT_SUCCESS == pwaosInstance_pollEvent(instance, &buffer)) {
            if (buffer.type == PWAOS_TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED) {
                const pwaosEventDataInstanceStatusChanged* event =
                    (const pwaosEventDataInstanceStatusChanged*)&buffer;
                if (event->instance == instance) {
                    if (event->status == instanceStatusWorking) {
                        pwaosResult r = pwaMain(instance); /* hello.c */
                        outcome = (r == PWAOS_RESULT_SUCCESS) ? 0 : 1;
                        break;
                    }
                    if (event->status == instanceStatusStopping) {
                        printf("instance stopped before Working\n");
                        outcome = 1;
                        break;
                    }
                }
            }
        } else {
#if defined(_WIN32)
            Sleep(10);
#else
            struct timespec ts = {0, 10 * 1000 * 1000};
            nanosleep(&ts, NULL);
#endif
        }
    } while (1);

    pwaos_destroyInstance(instance);
    pwaos_shutDown();

    if (outcome == 0)
        printf("runtime flow PASS\n");
    else
        printf("runtime flow FAIL (%s)\n",
               outcome == 2 ? "deadline" : "flow error");
    return outcome == 0 ? 0 : 1;
}

int main(int argc, char** argv) {
    g_argc = argc;
    g_argv = argv;
#if !defined(_WIN32)
    clock_gettime(CLOCK_MONOTONIC, &g_start);
#else
    g_start = (struct timespec){0};
#endif
    printf("pwaos clientApp started\n");

    int failed = smoke_abi();

    const char* wantRuntime = getenv("PWAOS_TEST_RUNTIME");
    if (!failed && wantRuntime && wantRuntime[0] == '1') {
        failed |= run_runtime_flow();
    }

    printf("pwaos clientApp exited\n");
    return failed ? 1 : 0;
}
