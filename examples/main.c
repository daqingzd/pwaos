// Copyright 2021 . All rights reserved.
// Author: Zhang Daqing
// Email: 33880576@qq.com
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "runtime_client_api.h"

#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#if defined(WIN32)
#include <io.h>
#include <direct.h>
#define F_OK 0
#define PATH_SEPARATOR '\\'
#else
#include <unistd.h>
#define PATH_SEPARATOR '/'
#endif

#define DATA_DIR_NAME "/data"

/**
 * \brief The pwa startup entry function.
 *
 * This is the entry for pwaos client app,
 * please implement it in your pwaos client app.
 *
 * \param[in] handle The runtime instance handle.
 *
 * \return The pwa exit status.
 */
#if defined(__cplusplus)
extern "C"
#endif
pwaosResult pwaMain(PWAOS_INSTANCE_HANDLE handle);

#include <stdint.h>
#include <string.h>

#ifdef _WIN32
// Windows
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <timeapi.h>        // timeBeginPeriod, timeEndPeriod
#else
// Linux / POSIX
#include <time.h>
#include <errno.h>
#endif

void MonotonicAbsoluteSleep(int64_t delay_ns) {
#ifdef _WIN32
    LARGE_INTEGER freq;
    QueryPerformanceFrequency(&freq);

    LARGE_INTEGER now;
    QueryPerformanceCounter(&now);

    LONGLONG increment = (delay_ns * freq.QuadPart) / 1000000000LL;
    LONGLONG target = now.QuadPart + increment;

    while (1) {
        QueryPerformanceCounter(&now);
        if (now.QuadPart >= target)
            break;

        LONGLONG remaining_ticks = target - now.QuadPart;
        DWORD sleep_ms = (DWORD)((remaining_ticks * 1000) / freq.QuadPart);

        if (sleep_ms == 0) {
            continue;
        }

        timeBeginPeriod(1);
        Sleep(sleep_ms > 1 ? sleep_ms - 1 : 0);
        timeEndPeriod(1);
    }
#else
    struct timespec ts;

    clock_gettime(CLOCK_MONOTONIC, &ts);

    ts.tv_nsec += delay_ns;
    while (ts.tv_nsec >= 1000000000L) {
        ts.tv_nsec -= 1000000000L;
        ts.tv_sec++;
    }

    int ret;
    do {
        ret = clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &ts, NULL);
    } while (ret == EINTR);
#endif
}

int main(int argc, char** argv) {
  printf("pwaos clientApp started\n");

#if defined(PWAOS_SDK_DIR)
  #if defined(_WIN32)
    pwaos_setRuntimeExecutablePath(PWAOS_SDK_DIR "\\runtime");
  #else
    pwaos_setRuntimeExecutablePath(PWAOS_SDK_DIR "/runtime");
  #endif
#else
  #if defined(_WIN32)
    pwaos_setRuntimeExecutablePath("..\\runtime");
  #else
    pwaos_setRuntimeExecutablePath("../runtime");
  #endif
#endif

  pwaosInitializeInfo initializeInfo = {
    .type = PWAOS_TYPE_INITIALIZE_INFO,
    .next = NULL,
    .argc = argc,
    .argv = argv,
    .use_dedicated_thread = true,
  };
  pwaosResult result = pwaos_init(&initializeInfo);
  if (PWAOS_RESULT_SUCCESS != result) {
    printf("pwaos_init failed, error code is %d\n", result);
    return -1;
  }

  pwaosInstanceCreateInfo createInfo = {
    .type = PWAOS_TYPE_INSTANCE_CREATE_INFO,
    .next = NULL,
    .runtimeType = runtimeTypePwa,
    .serverUrl = "http://localhost",
    .dataPath = "",
  };

  if (argc > 0 && access(argv[0], F_OK) == 0) {
    // Convert to absolute exe file path
    const char* executeFilePath =
    #if defined(_WIN32)
        _fullpath(createInfo.dataPath, argv[0], PWAOS_MAX_FILE_PATH_LEN);
    #else
        realpath(argv[0], createInfo.dataPath);
    #endif

    // Compute the data path for current exe file
    const char* last_separator = strrchr(executeFilePath, PATH_SEPARATOR);
    assert(last_separator);
    int dirPathLen = last_separator - executeFilePath;
    assert(dirPathLen+sizeof(DATA_DIR_NAME)<PWAOS_MAX_FILE_PATH_LEN);
    createInfo.dataPath[dirPathLen]='\0';
    assert(chdir(createInfo.dataPath) == 0);
    strcat((char*)createInfo.dataPath, DATA_DIR_NAME);
  }

  PWAOS_INSTANCE_HANDLE instanceHandle = INVALID_PWAOS_HANDLE;
  result = pwaos_createInstance(&createInfo, &instanceHandle);
  if (result == PWAOS_RESULT_SUCCESS) {
    do {
      pwaosEventDataBuffer buffer;
      if (PWAOS_RESULT_SUCCESS == pwaosInstance_pollEvent(instanceHandle, &buffer)) {
        if (buffer.type == PWAOS_TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED) {
          const pwaosEventDataInstanceStatusChanged* event =
              (const pwaosEventDataInstanceStatusChanged*)&buffer;
          if (event->instance == instanceHandle) {
            if (event->status == instanceStatusStopping) {
                printf("pwaos instance stopped\n");
              break;
            }
            else if (event->status == instanceStatusWorking) {
              pwaMain(instanceHandle);
              break;
            }
          }
        }
      } else {
        MonotonicAbsoluteSleep(10 * 1000 * 1000);
      }

    } while(true);
    pwaos_destroyInstance(instanceHandle);
  }

  pwaos_shutDown();

  printf("pwaos clientApp exited\n");
  return 0;
}
