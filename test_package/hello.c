// pwaos_sdk test_package - pwaMain portion.
// Taken from the SDK "hello" example (examples/hello/hello.c): reports the
// connected runtime's properties and launches a console PWA, then waits for
// terminal events. Adapted with a wall-clock deadline so a runtime that
// never becomes ready cannot hang `conan test` forever.
#include "runtime_client_api.h"

#include <stdio.h>

#if defined(_WIN32)
#include <windows.h>
static void sleep_ms(int ms) { Sleep(ms); }
#else
#include <time.h>
static void sleep_ms(int ms) {
    struct timespec ts;
    ts.tv_sec = ms / 1000;
    ts.tv_nsec = (ms % 1000) * 1000 * 1000L;
    nanosleep(&ts, NULL);
}
#endif

/* Wall-clock budget for the whole pwaMain flow (seconds). */
#define HELLO_DEADLINE_SECONDS 45

extern unsigned long hello_deadline(void);  /* monotonic seconds, test_package.c */

pwaosResult pwaMain(PWAOS_INSTANCE_HANDLE instanceHandle) {
    printf("starting...\n");

    pwaosInstanceProperties instanceProperties = {
        .type = PWAOS_TYPE_INSTANCE_GET_PROPERTIES,
        .next = NULL
    };
    pwaosResult result = pwaosInstance_getProperties(instanceHandle, &instanceProperties);
    if (result != PWAOS_RESULT_SUCCESS) {
        char err[PWAOS_MAX_RESULT_NAME_SIZE];
        pwaos_resultToString(result, err);
        printf("pwaosInstance_getProperties failed: %s\n", err);
        return result;
    }
    printf("%s is connected, its version is (%u.%u.%u)\n",
           instanceProperties.runtimeName,
           (unsigned)PWAOS_RUNTIME_API_VERSION_MAJOR(instanceProperties.runtimeVersion),
           (unsigned)PWAOS_RUNTIME_API_VERSION_MINOR(instanceProperties.runtimeVersion),
           (unsigned)PWAOS_RUNTIME_API_VERSION_PATCH(instanceProperties.runtimeVersion));

    PWAOS_APP_HANDLE appHandle = INVALID_PWAOS_HANDLE;
    pwaosAppCreateInfo createInfo = {
        .type = PWAOS_TYPE_PWA_CREATE_INFO,
        .next = NULL,
        .appType = appTypeConsole,
        .appUrl = "https://www.pwaos.net",
        .width = 800,
        .height = 600
    };
    result = pwaosInstance_createPwa(instanceHandle, &createInfo, &appHandle);
    if (result != PWAOS_RESULT_SUCCESS) {
        char err[PWAOS_MAX_RESULT_NAME_SIZE];
        pwaos_resultToString(result, err);
        printf("pwaosInstance_createPwa failed: %s\n", err);
        return result;
    }

    do {
        if (hello_deadline() > HELLO_DEADLINE_SECONDS) {
            printf("hello: deadline exceeded waiting for app events\n");
            break;
        }
        pwaosEventDataBuffer buffer;
        if (PWAOS_RESULT_SUCCESS == pwaosInstance_pollEvent(instanceHandle, &buffer)) {
            if (buffer.type == PWAOS_TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED) {
                const pwaosEventDataInstanceStatusChanged* event =
                    (const pwaosEventDataInstanceStatusChanged*)&buffer;
                if (event->instance == instanceHandle && event->status < 0)
                    break;
            } else if (buffer.type == PWAOS_TYPE_EVENT_DATA_APP_STATUS_CHANGED) {
                const pwaosEventDataAppStatusChanged* event =
                    (const pwaosEventDataAppStatusChanged*)&buffer;
                if (event->app == appHandle && event->status == appStatusStopping)
                    break;
            }
        } else {
            sleep_ms(10);
        }
    } while (1);

    printf("exiting...\n");
    pwaosInstance_destroyPwa(appHandle);
    return PWAOS_RESULT_SUCCESS;
}
