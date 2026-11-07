// Copyright 2021 . All rights reserved.
// Author: Zhang Daqing
// Email: 33880576@qq.com
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "runtime_client_api.h"

#include <stdio.h>
#include <stdlib.h>

pwaosResult pwaMain(PWAOS_INSTANCE_HANDLE instanceHandle) {
  printf("starting...\n");

  pwaosInstanceProperties instanceProperties = {
    .type = PWAOS_TYPE_INSTANCE_GET_PROPERTIES,
    .next = NULL
  };
  pwaosInstance_getProperties(instanceHandle, &instanceProperties);
  printf("%s is connected, its version is (%d.%d.%d)\n",
           instanceProperties.runtimeName,
           PWAOS_RUNTIME_API_VERSION_MAJOR(instanceProperties.runtimeVersion),
           PWAOS_RUNTIME_API_VERSION_MINOR(instanceProperties.runtimeVersion),
           PWAOS_RUNTIME_API_VERSION_PATCH(instanceProperties.runtimeVersion));

  PWAOS_APP_HANDLE appHandle = INVALID_PWAOS_HANDLE;
  pwaosAppCreateInfo createInfo = {
    .type = PWAOS_TYPE_PWA_CREATE_INFO,
    .next = NULL,
    .appType = appTypeConsole,
    .appUrl = "https://www.pwaos.net",
    .width = 800,
    .height = 600
  };
  pwaosResult result = pwaosInstance_createPwa(instanceHandle, &createInfo, &appHandle);
  if (result != PWAOS_RESULT_SUCCESS) {
    char err_str_buffer[PWAOS_MAX_RESULT_NAME_SIZE];
    pwaos_resultToString(result, err_str_buffer);
    printf("pwaosInstance_createPwa failed: %s\n", err_str_buffer);
    return result;
  }

  do {
    pwaosEventDataBuffer buffer;
    if (PWAOS_RESULT_SUCCESS == pwaosInstance_pollEvent(instanceHandle, &buffer)) {
      if (buffer.type == PWAOS_TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED) {
        const pwaosEventDataInstanceStatusChanged* event =
          (const pwaosEventDataInstanceStatusChanged*)&buffer;
        if (event->instance == instanceHandle) {
          if (event->status < 0)
            break;
        }
      } else if (buffer.type == PWAOS_TYPE_EVENT_DATA_APP_STATUS_CHANGED) {
        const pwaosEventDataAppStatusChanged* event =
          (const pwaosEventDataAppStatusChanged*)&buffer;
        if (event->app == appHandle) {
          if (event->status == appStatusStopping)
            break;
        }
      }
    } else {
#if defined(_POSIX_VERSION)
    #include <time.h>
      struct timespec ts;
      clock_gettime(CLOCK_MONOTONIC, &ts);
      ts.tv_nsec += 10 * 1000 * 1000;

      clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &ts, NULL);
#else
    #ifdef _WIN32
        #include <windows.h>
        Sleep(10);
    #else
        #include <time.h>

        struct timespec req;
        req.tv_sec = 0;
        req.tv_nsec = 10 * 1000 * 1000;

        nanosleep(&req, NULL);
    #endif
#endif
    }

  } while(true);

  printf("exitting...\n");
  pwaosInstance_destroyPwa(appHandle);
  return PWAOS_RESULT_SUCCESS;
}
