// Copyright 2021 . All rights reserved.
// Author: PwaOS Team
// Email: daqingzd@pwaos.com
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef PWAOS_RUNTIME_CLIENT_API_H
#define PWAOS_RUNTIME_CLIENT_API_H

// This API is for client app of pwaos runtime sevice

#ifdef __cplusplus
#  include <cstddef>
#  include <cstdint>
#else
#  include <stdbool.h>
#  include <stdint.h>
#endif

#if defined(WIN32)
#include <windows.h>

// d3d11.h defines __d3d11_h__
#if defined(__d3d11_h__) && !defined(PWAOS_USE_GRAPHICS_API_D3D11)
#define PWAOS_USE_GRAPHICS_API_D3D11
#endif

// d3d12.h defines __d3d12_h__
#if defined(__d3d12_h__) && !defined(PWAOS_USE_GRAPHICS_API_D3D12)
#define PWAOS_USE_GRAPHICS_API_D3D12
#endif

#ifdef PWAOSDLL_EXPORT
#define PWAOS_DLL_EXPORT __declspec(dllexport)
#else
#define PWAOS_DLL_EXPORT __declspec(dllimport)
#endif

#else

#ifdef PWAOSDLL_EXPORT
#define PWAOS_DLL_EXPORT __attribute__((visibility("default")))
#else
//#define PWAOS_DLL_EXPORT __attribute__((visibility("hidden")))
#define PWAOS_DLL_EXPORT
#endif

#endif // WIN32

#if defined(__ANDROID__)
#include <android/input.h>
#endif

// vulkan.h defines VULKAN_H_
#if defined(VULKAN_H_) && !defined(PWAOS_USE_GRAPHICS_API_VULKAN)
#define PWAOS_USE_GRAPHICS_API_VULKAN
#endif

// egl.h defines __egl_h_
#if defined(__egl_h_) && !defined(PWAOS_USE_GRAPHICS_API_EGL)
#define PWAOS_USE_GRAPHICS_API_EGL
#endif

#ifdef __cplusplus
extern "C" {
#endif

#define PWAOS_RUNTIME_API_MAKE_VERSION(major, minor, patch) \
    ((((major) & 0xffffULL) << 48) | (((minor) & 0xffffULL) << 32) | ((patch) & 0xffffffffULL))

#define PWAOS_RUNTIME_CURRENT_API_VERSION PWAOS_RUNTIME_API_MAKE_VERSION(0, 2, 1)

#define PWAOS_RUNTIME_API_VERSION_0_2 \
    PWAOS_RUNTIME_API_MAKE_VERSION(0, 2, PWAOS_RUNTIME_API_VERSION_PATCH(PWAOS_RUNTIME_CURRENT_API_VERSION))

#define PWAOS_RUNTIME_API_VERSION_MAJOR(version) (uint16_t)(((uint64_t)(version) >> 48)& 0xffffULL)
#define PWAOS_RUNTIME_API_VERSION_MINOR(version) (uint16_t)(((uint64_t)(version) >> 32) & 0xffffULL)
#define PWAOS_RUNTIME_API_VERSION_PATCH(version) (uint32_t)((uint64_t)(version) & 0xffffffffULL)

typedef uint64_t pwaosVersion;

/**
 *  \brief pwaos handle
 */
typedef void* pwaosHandle;

/**
 *  \brief if developer can use mojo directly, please enable USE_MOJO
 */
#if defined(USE_MOJO)
using PWAOS_INSTANCE_HANDLE = mojo::Remote<pwaos::mojom::pwaRuntime>*;
#else
/**
 *  \brief pwaos service instance handle
 */
typedef pwaosHandle PWAOS_INSTANCE_HANDLE;
#endif

/**
 *  \brief pwaos app handle
 */
typedef pwaosHandle PWAOS_APP_HANDLE;

/**
 *  \brief INVALID_PWAOS_HANDLE is NULL
 */
#define INVALID_PWAOS_HANDLE  NULL

/**
 *  \brief represent the max length for appId of pwa as string
 */
#define PWAOS_MAX_APP_ID_LEN                (64)

/**
 *  \brief represent the max size of result string
 */
#define PWAOS_MAX_RESULT_NAME_SIZE          (64)

/**
 *  \brief represent the max size of name
 */
#define PWAOS_MAX_NAME_SIZE                 (64)

/**
 *  \brief represent the max length of file path
 *  On Linux, MAX_PATH: 4096 is defined in limits.h
 */
#define PWAOS_MAX_FILE_PATH_LEN             (4096)

/**
 *  \brief represent the max length of url
 */
#define PWAOS_MAX_URL_LEN                   (4096)

/**
 *  \brief represent the max length of user agent
 */
#define PWAOS_MAX_USER_AGENT_LEN            (512)

/**
 *  \brief pwaosStructureType, the pwaOS runtime structure types
 */
typedef enum pwaosStructureType {
    PWAOS_TYPE_UNKNOWN = 0,
    PWAOS_TYPE_INITIALIZE_INFO = 1,
    PWAOS_TYPE_INSTANCE_CREATE_INFO = 2,
    PWAOS_TYPE_INSTANCE_GET_PROPERTIES = 3,
    PWAOS_TYPE_PWA_CREATE_INFO = 4,
    PWAOS_TYPE_PROJECTOR_CREATE_INFO = 5,
    PWAOS_TYPE_PROJECTOR_CREATE_NATIVE_INFO_EXT = 6,
    PWAOS_TYPE_PROJECTOR_CREATE_EGL_INFO_EXT = 7,
    PWAOS_TYPE_PROJECTOR_CREATE_VULKAN_INFO_EXT = 8,
    PWAOS_TYPE_PROJECTOR_CREATE_D3D11_INFO_EXT = 9,
    PWAOS_TYPE_PROJECTOR_CREATE_D3D12_INFO_EXT = 10,
    PWAOS_TYPE_PROJECTOR_DRAW_CALLBACK_DATA = 11,
    PWAOS_TYPE_PROJECTOR_DRAW_CALLBACK_BITMAP_DATA = 12,
    PWAOS_TYPE_PROJECTOR_DRAW_CALLBACK_EGL_DATA = 13,
    PWAOS_TYPE_PROJECTOR_DRAW_CALLBACK_VULKAN_DATA = 14,
    PWAOS_TYPE_PROJECTOR_DRAW_CALLBACK_D3D11_DATA = 15,
    PWAOS_TYPE_PROJECTOR_DRAW_CALLBACK_D3D12_DATA = 16,
    PWAOS_TYPE_DEVTOOLS_URI_INFO = 17,
    PWAOS_TYPE_OBJECT_INTERFACE_CREATE_INFO = 18,
    PWAOS_TYPE_WINDOW_BOUNDS_INFO = 19,
    PWAOS_TYPE_USER_AGENT_INFO = 20,
    PWAOS_TYPE_INITIALIZE_ANDROID_INFO_EXT = 21,
    PWAOS_TYPE_NETWORK_PROXY_INFO = 22,               /*!< Network proxy information structure */
    PWAOS_TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED = 23,
    PWAOS_TYPE_EVENT_DATA_APP_STATUS_CHANGED = 24,
    PWAOS_TYPE_ASYNC_CALLBACK_INFO = 25,
    PWAOS_TYPE_APP_FPS_INFO = 26,
    PWAOS_TYPE_APP_STOPPING_INFO_EXT = 27,
} pwaosStructureType;

#if !defined(PWAOS_MAY_ALIAS)
#if defined(__clang__) || (defined(__GNUC__) && (__GNUC__ > 4))
#define PWAOS_MAY_ALIAS __attribute__((__may_alias__))
#else
#define PWAOS_MAY_ALIAS
#endif
#endif

typedef struct PWAOS_MAY_ALIAS pwaosBaseInStructure {
    pwaosStructureType                    type;
    const struct pwaosBaseInStructure*    next;
} pwaosBaseInStructure;

typedef struct PWAOS_MAY_ALIAS pwaosBaseOutStructure {
    pwaosStructureType               type;
    struct pwaosBaseOutStructure*    next;
} pwaosBaseOutStructure;

/**
 *  \brief pwaosResult, the pwaOS runtime return result types
 */
typedef enum pwaosResult {
    PWAOS_RESULT_SUCCESS = 0, /*!< Function successfully completed. */
    PWAOS_RESULT_PENDING = 1, /*!< The client app will be launched by pwaos_server. */
    PWAOS_RESULT_EVENT_UNAVAILABLE = 2, /*!< The event queue has no event or not ready. */
    PWAOS_RESULT_ERROR_INTERNAL = -1, /*!< The pwaos runtime has errors inside. */
    PWAOS_RESULT_ERROR_RUNTIME_CONNECTION_LOST = -2, /*!< The connection with pwaos server is lost. */
    PWAOS_RESULT_ERROR_RUNTIME_NOT_READY = -3, /*!< The pwaos runtime is not in the ready state. */
    PWAOS_RESULT_ERROR_VALIDATION_FAILURE = -4, /*!< The function usage was invalid in some way. */
    PWAOS_RESULT_ERROR_HANDLE_INVALID = -5, /*!< The resource handle provided invalid. */
    PWAOS_RESULT_ERROR_NOT_IMPLEMENT = -6, /*!< The function usage is not implement now. */
    PWAOS_RESULT_ERROR_NOT_SUPPORT = -7, /*!< The function usage is not support. */
    PWAOS_RESULT_ERROR_DUPLICATED_NAME = -8, /*!< The name provided was a duplicate of an already-existing resource. */
    PWAOS_RESULT_ERROR_NOT_ENOUGH_MEMORY = -9, /*!< Memory is not enough, a memory allocation has failed. */
    PWAOS_RESULT_ERROR_NOT_DEFINED_NAME = -10, /*!< The name provided was not defined before. */
    PWAOS_RESULT_ERROR_DATA_PATH_NOT_ABSOLUTE = -11, /*!< The data path provided is not absolute path. */
    PWAOS_RESULT_ERROR_COMPOSITING_NOT_SYNCHRONIZED = -12, /*!< The compositing of pwa is not synchronized. */
    PWAOS_RESULT_ERROR_INVALID_THREAD = -13, /*!< this function must be invoked on the correct thread. */
    PWAOS_RESULT_ERROR_NAME_RESERVED = -14, /*!< this name can' be used, it is reserved. */
    PWAOS_RESULT_ERROR_MAX = -17,
} pwaosResult;

/**
 * \brief return the result description in string.
 *
 * This function is to return the result description in string.
 *
 * \param[in]  value The value of pwaos result.
 * \param[out] buffer The output buffer to save the result description in string.
 *
 * \return #PWAOS_RESULT_SUCCESS the function is successfully completed, the result description was saved in the buffer.
 * \return #PWAOS_RESULT_ERROR_VALIDATION_FAILURE the value is invalid, it should be one of the pwaosResult.
 */
PWAOS_DLL_EXPORT pwaosResult pwaos_resultToString(
                                pwaosResult value, char buffer[PWAOS_MAX_RESULT_NAME_SIZE]);

/**
 *  \brief pwaosInitializeInfo, the pwaOS initialize info
 */
typedef struct pwaosInitializeInfo {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    int                                 argc;  /*!< The commandline arguments count. */
    char**                              argv;  /*!< The commandline arguments pointer array. */
    bool                                use_dedicated_thread;  /*!< The runtime can either be integrated into any caller-provided thread or run on its own dedicated thread. The boolean flag use_dedicated_thread controls this choice: true creates a dedicated thread for the runtime, while false runs it on the caller’s thread. */
} pwaosInitializeInfo;

#if defined(__ANDROID__)
/**
 *  \brief pwaosInitializeAndroidInfoExt, the pwaOS initialize info for android
 */
typedef struct pwaosInitializeAndroidInfoExt {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    void* PWAOS_MAY_ALIAS               applicationVM; /*!< The global handle on the process's Java VM. */
    void* PWAOS_MAY_ALIAS               applicationActivity; /*!< The ANativeActivity object instance that this app is running in. */
} pwaosInitializeAndroidInfoExt;
#endif

/**
 *  \brief pwaosAsyncCallback
 */
typedef void (*pwaosAsyncCallback)(pwaosResult, void* userData);

typedef struct pwaosAsyncCallbackInfo {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    pwaosAsyncCallback                  callback;  /*!< The result from async operation. */
    void*                               userData;  /*!< The userData. */
} pwaosAsyncCallbackInfo;

/**
 * \brief Initialize the pwaos runtime client library.
 *
 * This function is to setup the connection with the pwaos server side.
 *
 * \param[in] argc The count of arguments.
 * \param[in] argv The array of arguments.
 *
 * \return #PWAOS_RESULT_SUCCESS the function is successfully completed, the pwaos runtime was initialized.
 * \return #PWAOS_RESULT_PENDING the function is also successfully completed, the pwaos_server will launch the clientApp ASAP.
 */
PWAOS_DLL_EXPORT pwaosResult pwaos_init(const pwaosInitializeInfo* initializeInfo);

/**
 * \brief Shutdown the pwaos runtime client library.
 *
 * This function is to disconnect with the pwaos server side.
 *
 * \return #PWAOS_RESULT_SUCCESS the function is successfully completed, the pwaos runtime was closed.
 */
PWAOS_DLL_EXPORT pwaosResult pwaos_shutDown();

/**
 * \brief Retrieves the command-line string for the pwaos runtime client library.
 *
 * This function is to retrieve the command-line string.
 *
 * \return the return value is a pointer to the command-line string for the pwaos runtime client library.
 */
PWAOS_DLL_EXPORT const char* pwaos_getCommandLine();

/**
 * \brief Set the pwaos runtime executable path.
 *
 * This function configures the pwaos runtime executable path, this path is used when launching or interacting with pwaos runtime server.
 * If not explicitly set, the system will fall back to searching for the runtime executable in the following order:
 * 1. The current working directory.
 * 2. The directory containing the current application executable.
 * 3. The system's default path.
 *
 * \param[in] runtimeExecutablePath Null-terminated utf8 string specifying the new path to the runtime executable.
 *                                  Can be an absolute path, or a relative path which will be resolved based on the current working directory of the calling process.
 *                                  The length must not exceed #PWAOS_MAX_FILE_PATH_LEN, excluding the NULL terminator.
 *
 * \return #PWAOS_RESULT_SUCCESS The runtime executable path was successfully set.
 * \return #PWAOS_RESULT_ERROR_VALIDATION_FAILURE the function usage was invalid, please check whether the length of runtimeExecutablePath exceed PWAOS_MAX_FILE_PATH_LEN, and whether the pointer is NULL.
 */
PWAOS_DLL_EXPORT pwaosResult pwaos_setRuntimeExecutablePath(
                                const char* runtimeExecutablePath);

/**
 *  \brief pwaosRuntimeType, the supported pwaOS runtime types
 */
typedef enum pwaosRuntimeType {
  runtimeTypeUnknown = 0, /*!< unknow runtime */
  runtimeTypePwa,     /*!< pwa runtime */
} pwaosRuntimeType;

/**
 *  \brief pwaosInstanceCreateInfo, the pwaOS instance create info
 */
typedef struct pwaosInstanceCreateInfo {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    pwaosRuntimeType                    runtimeType;  /*!< The runtime type */
    const char                          serverUrl[PWAOS_MAX_URL_LEN];  /*!< The pwaos server URI */
    char                                dataPath[PWAOS_MAX_FILE_PATH_LEN]; /*!< The absolute path of the directory where this pwaosApp's data is stored, if it is NULL the profilePath will be saved on the server side. */
} pwaosInstanceCreateInfo;

typedef struct pwaosInstanceProperties {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    pwaosVersion                        runtimeVersion;
    char                                runtimeName[PWAOS_MAX_NAME_SIZE];
} pwaosInstanceProperties;

/**
 * \brief Create and connect the pwa service on the pwaos server side.
 *
 * This function is to create pwa service on pwaos server side, and setup the connection in the client side.
 *
 * \param[in] createInfo The info of creating pwaos service instance.
 * \param[out] out_instanceHandle The instance handle of the created pwaos service.
 *
 * \return #PWAOS_RESULT_SUCCESS the function is successfully completed, the created pwaos service instance handle was saved in out_instanceHandle.
 * \return #PWAOS_RESULT_ERROR_VALIDATION_FAILURE the function usage was invalid, please check createInfo and its members, and whether the pointer is NULL.
 * \return #PWAOS_RESULT_ERROR_NOT_IMPLEMENT only the pwa runtime is implemented now.
 * \return #PWAOS_RESULT_ERROR_NOT_ENOUGH_MEMORY allocation error occurs.
 * \return #PWAOS_RESULT_ERROR_DATA_PATH_NOT_ABSOLUTE the dataPath must be absolute.
 */
PWAOS_DLL_EXPORT pwaosResult pwaos_createInstance(
                               const pwaosInstanceCreateInfo* createInfo,
                               PWAOS_INSTANCE_HANDLE* out_instanceHandle);

/**
 * \brief Destroy and close the pwa service instance in both server and client side.
 *
 * This function is to destroy the pwa service which is created on the server side.
 *
 * \param[in] instanceHandle The handle of pwa service instance.
 *
 * \return #PWAOS_RESULT_SUCCESS the function is successfully completed, the instance is destroyed.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the instance handle is invalid.
 */
PWAOS_DLL_EXPORT pwaosResult pwaos_destroyInstance(
                               PWAOS_INSTANCE_HANDLE instanceHandle);

/**
 * \brief Get properties of the pwa service instance.
 *
 * This function is to get properties of the pwa service instance.
 *
 * \param[in] instanceHandle The handle of pwa service instance.
 *
 * \return #PWAOS_RESULT_SUCCESS the function is successfully completed, the properties is returned.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the instance handle is invalid.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_CONNECTION_LOST the connection between pwaos service instance and pwaos server is broken.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_NOT_READY the pwaos server is starting.
 * \return #PWAOS_RESULT_ERROR_VALIDATION_FAILURE the function usage was invalid, please check instanceProperties and its member, whether the pointer is NULL.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosInstance_getProperties(
                               PWAOS_INSTANCE_HANDLE instanceHandle,
                               pwaosInstanceProperties* instanceProperties);

/**
 *  \brief pwaosInstanceStatus, the status of pwaos service instance which is running on pwaos_server process
 */
typedef enum pwaosInstanceStatus {
  instanceStatusUnavailable = -1, /*!< instance is crashed or not ready */
  instanceStatusAvailable = 0, /*!< instance is ready */
  instanceStatusStarting = 1, /*!< instance is starting */
  instanceStatusWorking = 2, /*!< instance is working */
  instanceStatusStopping = 3, /*!< instance is closing */
  instanceStatusConnectionLost = 4, /*!< connection of instance is lost */
} pwaosInstanceStatus;

/**
 *  \brief the pwaos service instance status change callback function type for pwaos service instance
 *
 * \param stat The status of pwaos service instance.
 * \param userData The userData.
 */
typedef void (*pwaosInstanceCallback)(const pwaosInstanceStatus stat,
                                      void* userData);

/**
 * \brief Set instance status change callback function on pwaos service.
 *
 * This function can monitor the pwaos service status on the server side.
 *
 * \param[in] handle The handle of pwaos service instance.
 * \param[in] callback The callback function, if the callback is NULL, the last callback setted will be clear.
 * \param[in] userData The userData.
 *
 * \return #PWAOS_RESULT_SUCCESS the function is successfully completed, callback function is set or clear.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the instance handle is invalid.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosInstance_setCallback(
                                PWAOS_INSTANCE_HANDLE handle,
                                pwaosInstanceCallback callback,
                                void* userData);

/**
 *  \brief pwaosAppType, the pwaOS runtime supported application types
 */
typedef enum pwaosAppType {
  appTypeUnknown = 0,
  appTypePwa,     /*!< run as native app */
  appTypeBrowser, /*!< run as native browser app */
  appTypeConsole, /*!< run as native console app */
  appTypeDesktop, /*!< run as native desktop app, only one desktop app can running */
  appTypePwaContents, /*!< run as headless, the client need to do display */
} pwaosAppType;

/**
 *  \brief pwaosAppCreateInfo, the pwaOS applicaton create info
 */
typedef struct pwaosAppCreateInfo {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    pwaosAppType                        appType;  /*!< The pwa showing type */
    const char                          appUrl[PWAOS_MAX_URL_LEN];  /*!< The pwa startup URL */
    int                                 width;  /*!< The pwa window width */
    int                                 height;  /*!< The pwa window height */
} pwaosAppCreateInfo;

/**
 * \brief Create and launch the pwa with specify type and url.
 *
 * This function is to create pwa app on the pwaos server side.
 *
 * \param[in] handle The handle of pwa instance.
 * \param[in] createInfo The info of creating pwaosApp.
 * \param[out] out_appHandle The app handle of the created pwa.
 *
 * \return #PWAOS_RESULT_SUCCESS the pwa app was launched successfully on the pwaos server side.
 * \return #PWAOS_RESULT_ERROR_VALIDATION_FAILURE the function usage was invalid, please check createInfo and its members, and whether the pointer is NULL, and the appUrl is invalid.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the instance handle is invalid.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_CONNECTION_LOST the connection between pwaos service instance and pwaos server is broken.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_NOT_READY the pwaos server is starting.
 * \return #PWAOS_RESULT_ERROR_INTERNAL some exception occurs.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosInstance_createPwa(
                               PWAOS_INSTANCE_HANDLE handle,
                               const pwaosAppCreateInfo* createInfo,
                               PWAOS_APP_HANDLE* out_appHandle);

/**
 * \brief Destroy and close the pwa app.
 *
 * This function is to destroy the pwa app which is created on the server side.
 *
 * \param[in] appHandle The handle of pwa app.
 *
 * \return #PWAOS_RESULT_SUCCESS the pwa app was destroyed successfully.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the appHandle is invalid.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosInstance_destroyPwa(PWAOS_APP_HANDLE appHandle);

/**
 *  \brief pwaos object interface handle
 */
typedef pwaosHandle PWAOS_OBJECT_INTERFACE_HANDLE;

/**
 *  \brief the defined method callback function type for pwaos object interface
 *
 * This callback is to define the method of object interface.
 *
 * \param[in] argc The count of arguments.
 * \param[in] argvJsonStr The string of all arguments which is encoded by json string
 * \param[in] resultJsonStr The string of result which is encoded by json string.
 * \param[in] maxResultJsonStrLength The max length of the string buffer.
 * \param[in] userData The userData.
 *
 * \return true the defined method is executed successfully, the result is stored as json string.
 * \return false failed to execute the defined method, the resultJsonStr should be ignored.
 */
typedef bool (*pwaosObjectInterfaceMethodCallback)(
                                      int argc,
                                      const char* argvJsonStr,
                                      char* resultJsonStr,
                                      int maxResultJsonStrLength,
                                      void* userData);

/**
 *  \brief the constructor callback function type for pwaos object interface
 *
 * This callback is to construct object of the object interface.
 *
 * \param[in] userData The userData.
 *
 */
typedef void (*pwaosObjectInterfaceConstructorCallback)(void* userData);

/**
 *  \brief the destructor callback function type for pwaos object interface
 *
 * This callback is to destruct object of the object interface.
 *
 * \param[in] userData The userData.
 *
 */
typedef void (*pwaosObjectInterfaceDestructorCallback)(void* userData);

/**
 *  \brief pwaosObjectInterfaceCreateInfo, the pwaOS object interface create info
 */
typedef struct pwaosObjectInterfaceCreateInfo {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    pwaosObjectInterfaceConstructorCallback     constructor;  /*!< The object interface constructor */
    void*                               constructorUserData;  /*!< The userData of constructor */
    pwaosObjectInterfaceDestructorCallback      destructor;  /*!< The object interface destructor */
    void*                               destructorUserData;  /*!< The userData of destructor */
} pwaosObjectInterfaceCreateInfo;

/**
 * \brief Create pwa object interface on the pwaos server side.
 *
 * This function is to create pwa object interface on the pwaos server side.
 *
 * \param[in] handle The handle of pwa app.
 * \param[in] createInfo The info of creating object interface.
 * \param[out] out_objInfHandle The instance handle of the created pwaos object interface.
 *
 * \return #PWAOS_RESULT_SUCCESS the object interface was created successfully on the pwaos server side.
 * \return #PWAOS_RESULT_ERROR_VALIDATION_FAILURE the function usage was invalid, please check createInfo and its members, and whether the pointer is NULL.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the handle is invalid.
 * \return #PWAOS_RESULT_ERROR_NOT_ENOUGH_MEMORY allocation error occurs.
 * \return #PWAOS_RESULT_ERROR_INTERNAL some exception occurs.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosInstance_createObjectInterface(
                                PWAOS_INSTANCE_HANDLE handle,
                                const pwaosObjectInterfaceCreateInfo* createInfo,
                                PWAOS_OBJECT_INTERFACE_HANDLE* out_objInfHandle);

/**
 * \brief Destroy and release the pwa object interface.
 *
 * This function is to destroy and release the pwa object interface.
 *
 * \param[in] objInfHandle The handle of pwaos object interface.
 *
 * \return #PWAOS_RESULT_SUCCESS the object interface was destroyed on the pwaos server side, it can't be used anymore.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the objInfHandle is invalid.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosInstance_destroyObjectInterface(PWAOS_OBJECT_INTERFACE_HANDLE objInfHandle);

/**
 * \brief Add custom javascript interface on the DOM, let the pwa developer can use native methods/properties.
 *
 * This function to add custom javascript interface on the DOM.
 *
 * \param[in] appHandle The handle of pwa app.
 * \param[in] name the javascript interface name on the DOM.
 * \param[in] objInfHandle The handle of pwaos object interface.
 *
 * \return #PWAOS_RESULT_SUCCESS the object interface was added on the DOM successfully.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the appHandle is invalid.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_CONNECTION_LOST the connection between pwaos service instance and pwaos server is broken.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_NOT_READY the pwaos server is starting.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_addJavascriptInterface(
                                PWAOS_APP_HANDLE appHandle,
                                const char* name,
                                PWAOS_OBJECT_INTERFACE_HANDLE objInfHandle);

/**
 * \brief Remove custom javascript interface on the DOM.
 *
 * This function to remove custom javascript interface on the DOM.
 *
 * \param[in] appHandle The handle of pwa app.
 * \param[in] name the javascript interface name on the DOM.
 *
 * \return #PWAOS_RESULT_SUCCESS the javascript interface was removed from the DOM successfully.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the appHandle is invalid.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_CONNECTION_LOST the connection between pwaos service instance and pwaos server is broken.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_NOT_READY the pwaos server is starting.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_removeJavascriptInterface(
                                PWAOS_APP_HANDLE appHandle,
                                const char* name);

/**
 * \brief Define native method on pwaos object interface.
 *
 * This function to define native method on pwaos object interface.
 *
 * \param[in] objInfHandle The handle of pwaos object interface.
 * \param[in] name the method name on the pwaos object interface.
 * \param[in] methodCallback The native callback function.
 * \param[in] userData The userData.
 *
 * \return #PWAOS_RESULT_SUCCESS the method was defined on the object interface successfully.
 * \return #PWAOS_RESULT_ERROR_VALIDATION_FAILURE the function usage was invalid, please check name and methodCallback.
 * \return #PWAOS_RESULT_ERROR_DUPLICATED_NAME the object interface already has defined the same name method.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosObjectInterface_defineMethod(
                                PWAOS_OBJECT_INTERFACE_HANDLE objInfHandle,
                                const char* name,
                                pwaosObjectInterfaceMethodCallback methodCallback,
                                void* userData);

/**
 * \brief Remove native method on pwaos object interface.
 *
 * This function to remove native method on pwaos object interface.
 *
 * \param[in] objInfHandle The handle of pwaos object interface.
 * \param[in] name the method name on the pwaos object interface.
/ *
 * \return #PWAOS_RESULT_SUCCESS the method was removed from the object interface successfully.
 * \return #PWAOS_RESULT_ERROR_VALIDATION_FAILURE the function usage was invalid, please check name.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the objInfHandle is invalid.
 * \return #PWAOS_RESULT_ERROR_NOT_DEFINED_NAME the object interface has no such method.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosObjectInterface_removeMethod(
                                PWAOS_OBJECT_INTERFACE_HANDLE objInfHandle,
                                const char* name);

/**
 *  \brief the property setter callback function type for pwaos object interface
 *
 * This callback is to define the property setter callback.
 *
 * \param[in] propJsonStr The property value which is encoded by json string.
 * \param[in] userData The userData.
 *
 * \return true.
 * \return false.
 */
typedef bool (*pwaosObjectInterfaceSetPropertyCallback)(
                                      const char* propJsonStr,
                                      void* userData);

/**
 *  \brief the property getter callback function type for pwaos object interface
 *
 * This callback is to define the property getter callback.
 *
 * \param[out] out_propJsonStr The return property value which is encoded by json string.
 * \param[in] maxPropJsonStrLength The max length of the string buffer.
 * \param[in] userData The userData.
 *
 * \return true.
 * \return false.
 */
typedef bool (*pwaosObjectInterfaceGetPropertyCallback)(
                                      char* out_propJsonStr,
                                      int maxPropJsonStrLength,
                                      void* userData);

/**
 * \brief Define native property on pwaos object interface.
 *
 * This function to define native property on pwaos object interface.
 *
 * \param[in] objInfHandle The handle of pwaos object interface.
 * \param[in] name the property name on the pwaos object interface.
 * \param[in] setterCallback The native property setter callback function.
 * \param[in] getterCallback The native property getter callback function.
 * \param[in] userData The userData.
 *
 * \return #PWAOS_RESULT_SUCCESS the property was defined on the object interface successfully.
 * \return #PWAOS_RESULT_ERROR_VALIDATION_FAILURE the function usage was invalid, please check name, setterCallback and getterCallback.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the objInfHandle is invalid.
 * \return #PWAOS_RESULT_ERROR_DUPLICATED_NAME the object interface already has defined the same name property.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosObjectInterface_defineProperty(
                                PWAOS_OBJECT_INTERFACE_HANDLE objInfHandle,
                                const char* name,
                                pwaosObjectInterfaceSetPropertyCallback setterCallback,
                                pwaosObjectInterfaceGetPropertyCallback getterCallback,
                                void* userData);

/**
 * \brief Remove native property on pwaos object interface.
 *
 * This function to remove native property on pwaos object interface.
 *
 * \param[in] objInfHandle The handle of pwaos object interface.
 * \param[in] name the property name on the pwaos object interface.
 *
 * \return #PWAOS_RESULT_SUCCESS the property was removed on the object interface successfully.
 * \return #PWAOS_RESULT_ERROR_VALIDATION_FAILURE the function usage was invalid, please check name.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the objInfHandle is invalid.
 * \return #PWAOS_RESULT_ERROR_NOT_DEFINED_NAME the object interface has no such property.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosObjectInterface_removeProperty(
                                PWAOS_OBJECT_INTERFACE_HANDLE objInfHandle,
                                const char* name);

typedef struct pwaosWindowBoundsInfo {
    pwaosStructureType          type;  /*!< must be PWAOS_TYPE_WINDOW_BOUNDS_Info. */
    const void* PWAOS_MAY_ALIAS next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    int                         x;
    int                         y;
    int                         width;
    int                         height;
} pwaosWindowBoundsInfo;

/**
 * \brief Get the position and size for the specified pwa app.
 *
 * This function get the position and size for the specified pwa app.
 *
 * \param[in] appHandle The handle of pwa app.
 * \param[out] out_bounds The output bounds for pwa app position and size.
 *
 * \return #PWAOS_RESULT_SUCCESS the bounds of pwa app was fetched successfully.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the appHandle is invalid.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_CONNECTION_LOST the connection between pwaos service instance and pwaos server is broken.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_NOT_READY the pwaos server is starting.
 * \return #PWAOS_RESULT_ERROR_VALIDATION_FAILURE the function usage was invalid, please check whether the out_bounds is NULL.
 * \return #PWAOS_RESULT_ERROR_INTERNAL some exception occurs.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_getBounds(
                                PWAOS_APP_HANDLE appHandle,
                                pwaosWindowBoundsInfo* out_bounds);

/**
 * \brief Set position and size for the specified pwa app.
 *
 * This function can set position and size for the specified pwa app.
 *
 * \param[in] appHandle The handle of pwa app.
 * \param[in] bounds The bounds for pwa app position and size.
 *
 * \return #PWAOS_RESULT_SUCCESS the bounds of pwa app was updated successfully.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the appHandle is invalid.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_CONNECTION_LOST the connection between pwaos service instance and pwaos server is broken.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_NOT_READY the pwaos server is starting.
 * \return #PWAOS_RESULT_ERROR_VALIDATION_FAILURE the function usage was invalid, please check whether the bounds is NULL.
 * \return #PWAOS_RESULT_ERROR_INTERNAL some exception occurs.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_setBounds(
                                PWAOS_APP_HANDLE appHandle,
                                const pwaosWindowBoundsInfo* bounds);

/**
 * \brief Emulate mouse or controller input on pwa app.
 *
 * This function to emulate mouse or controller input on pwa app.
 *
 * \param[in] appHandle The handle of pwa app.
 * \param[in] isLeft leftMouseButton/leftController or not.
 * \param[in] isClicked MouseButton/Controller is clicked.
 *
 * \return #PWAOS_RESULT_SUCCESS the click input event was handled by pwa app successfully.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the appHandle is invalid.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_CONNECTION_LOST the connection between pwaos service instance and pwaos server is broken.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_NOT_READY the pwaos server is starting.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_handleClick(
                                PWAOS_APP_HANDLE appHandle,
                                bool isLeft, bool isClicked);

/**
 * \brief Emulate pointer input on pwa app.
 *
 * This function to emulate pointer input on pwa app.
 *
 * \param[in] appHandle The handle of pwa app.
 * \param[in] isLeft leftMouseButton/leftController or not.
 * \param[in] x the X position of pointer input on the pwa window.
 * \param[in] y the Y position of pointer input on the pwa window.
 *
 * \return #PWAOS_RESULT_SUCCESS the pointer input event was handled by pwa app successfully.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the appHandle is invalid.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_CONNECTION_LOST the connection between pwaos service instance and pwaos server is broken.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_NOT_READY the pwaos server is starting.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_handlePointerInput(
                                PWAOS_APP_HANDLE appHandle,
                                bool isLeft, float x, float y);

#if defined(__ANDROID__)
/**
 * \brief Dispatch android input event on pwa app.
 *
 * This function to dispatch android input event on pwa app.
 *
 * \param[in] appHandle The handle of pwa app.
 * \param[in] aEvent android input event.
 *
 * \return #PWAOS_RESULT_SUCCESS the android input event was handled by pwa app successfully.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the appHandle is invalid or the android input event is NULL.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_CONNECTION_LOST the connection between pwaos service instance and pwaos server is broken.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_NOT_READY the pwaos server is starting.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_handleAInputEvent(
                                PWAOS_APP_HANDLE appHandle,
                                const AInputEvent* aEvent);
#endif

#define MAX_URI_LEN 255
typedef struct pwaosUriInfo {
    pwaosStructureType          type;  /*!< must be PWAOS_TYPE_DEVTOOLS_URI_INFO. */
    const void* PWAOS_MAY_ALIAS next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    char                        url[MAX_URI_LEN]; /*!< url string buffer. */
} pwaosUriInfo;

/**
 * \brief Get the devtools uri data for pwa app.
 *
 * This function is to fetch the devtools Uri for the pwa app.
 *
 * \param[in] appHandle The handle of pwa app.
 * \param[out] out_uriData The uri data of the devtools.
 *
 * \return #PWAOS_RESULT_SUCCESS the devtools uri was fetched successfully.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the appHandle is invalid.
 * \return #PWAOS_RESULT_ERROR_VALIDATION_FAILURE the function usage was invalid, please check out_uriData.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_CONNECTION_LOST the connection between pwaos service instance and pwaos server is broken.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_NOT_READY the pwaos server is starting.
 * \return #PWAOS_RESULT_ERROR_NOT_SUPPORT.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_getDevToolsUri(
                               PWAOS_APP_HANDLE appHandle,
                               pwaosUriInfo* out_uriData);

typedef struct pwaosUserAgentInfo {
    pwaosStructureType          type;  /*!< must be PWAOS_TYPE_USER_AGENT_INFO. */
    const void* PWAOS_MAY_ALIAS next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    char                        userAgent[PWAOS_MAX_USER_AGENT_LEN]; /*!< userAgent string buffer. */
} pwaosUserAgentInfo;

/**
 * \brief Set the userAgent for pwa app.
 *
 * This function is to set the userAgent for pwa app.
 *
 * \param[in] appHandle The handle of pwa app.
 * \param[in] userAgentData The userAgent data.
 *
 * \return result .
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_setUserAgent(
                               PWAOS_APP_HANDLE appHandle,
                               const pwaosUserAgentInfo* userAgentData);

/**
 * \brief Get the userAgent data for pwa app.
 *
 * This function is to get the userAgent data for pwa app.
 *
 * \param[in] appHandle The handle of pwa app.
 * \param[out] out_userAgentData The userAgent data of the pwa app.
 *
 * \return result .
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_getUserAgent(
                               PWAOS_APP_HANDLE appHandle,
                               pwaosUserAgentInfo* out_userAgentData);

/**
 * \brief Execute JavaScript in the pwa app.
 *
 * This function is to execute JavaScript in the pwa app.
 *
 * \param[in] appHandle The handle of pwa app.
 * \param[in] javascript The javascript content in utf8 string.
 *
 * \return #PWAOS_RESULT_SUCCESS the javscript was executed on the pwa app successfully.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the appHandle is invalid.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_CONNECTION_LOST the connection between pwaos service instance and pwaos server is broken.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_NOT_READY the pwaos server is starting.
 * \return #PWAOS_RESULT_ERROR_INTERNAL some exception occurs.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_executeJavaScript(
                               PWAOS_APP_HANDLE appHandle,
                               const char* javascript);

typedef struct pwaosAppFpsInfo {
    pwaosStructureType          type;  /*!< must be PWAOS_TYPE_APP_FPS_INFO. */
    const void* PWAOS_MAY_ALIAS next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    float                       fps; /*!< the application frame rate in frames per second (FPS). */
} pwaosAppFpsInfo;

/**
 * \brief Set FPS on pwa app.
 *
 * This function is to control the pwa app display FPS.
 *
 * \param[in] appHandle The handle of pwa app.
 * \param[in] appFpsinfo The fps info value.
 *
 * \return #PWAOS_RESULT_SUCCESS the FPS of pwa app was updated successfully.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the appHandle is invalid.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_CONNECTION_LOST the connection between pwaos service instance and pwaos server is broken.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_NOT_READY the pwaos server is starting.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_setFPS(
                               PWAOS_APP_HANDLE appHandle,
                               const pwaosAppFpsInfo* appFpsinfo);

/**
 * \brief Proxy configuration mode enumeration
 */
typedef enum pwaosNetworkProxyType {
  PWAOS_NETWORK_PROXY_TYPE_DIRECT = 0,    /*!< Never use a proxy */
  PWAOS_NETWORK_PROXY_TYPE_AUTO_DETECT,   /*!< Auto-detect proxy settings */
  PWAOS_NETWORK_PROXY_TYPE_PAC_SCRIPT,    /*!< Use PAC script */
  PWAOS_NETWORK_PROXY_TYPE_FIXED_SERVERS, /*!< Use fixed proxy servers */
  PWAOS_NETWORK_PROXY_TYPE_SYSTEM         /*!< Use system proxy settings */
} pwaosNetworkProxyType;

typedef enum pwaosNetworkProxyServerMode {
  PWAOS_PROXY_SERVER_HTTP = 0,    /*!< HTTP proxy - scheme in PAC: "PROXY" or "HTTP" */
  PWAOS_PROXY_SERVER_HTTPS,       /*!< HTTPS proxy (SSL/TLS) - scheme in PAC: "HTTPS" */
  PWAOS_PROXY_SERVER_SOCKS4,      /*!< SOCKS4 proxy - scheme in PAC: "SOCKS4" */
  PWAOS_PROXY_SERVER_SOCKS5,      /*!< SOCKS5 proxy - scheme in PAC: "SOCKS5" */
  PWAOS_PROXY_SERVER_SOCKS,       /*!< SOCKS proxy (version auto-negotiation) - defaults to SOCKS5 */
  PWAOS_PROXY_SERVER_FTP,         /*!< FTP proxy - scheme in PAC: "FTP" */
  PWAOS_PROXY_SERVER_QUIC,        /*!< QUIC proxy (experimental) */
  PWAOS_PROXY_SERVER_ALL,         /*!< Proxy for all protocols (default/fallback) */
} pwaosNetworkProxyServerMode;

/**
 * \brief Per-protocol proxy server configuration
 */
typedef struct pwaosNetworkProxyServerInfo {
  pwaosNetworkProxyServerMode mode;
  char                        host[MAX_URI_LEN]; /*!< Proxy server hostname or IP address. */
  int                         port;              /*!< Proxy server port (0 = use default for protocol). */
  char                        username[PWAOS_MAX_NAME_SIZE];    /*!< Proxy authentication username (empty if not needed) */
  char                        password[PWAOS_MAX_NAME_SIZE];    /*!< Proxy authentication password (empty if not needed) */
} pwaosNetworkProxyServerInfo;

/**
 * \brief The proxy auto-config file configuration
 */
typedef struct pwaosNetworkProxyPACScriptInfo {
  char                        pac_url[MAX_URI_LEN]; /*!< Indicates the URL of the proxy auto-config file. */
  uint8_t                     pac_mandatory;        /*!< Blocks all traffic in case fetching the PAC script from |pac_url_| fails. */
} pwaosNetworkProxyPACScriptInfo;

/**
 * \brief Union of possible proxy details (based on mode).
 */
typedef union pwaosNetworkProxyDetails {
  pwaosNetworkProxyServerInfo         server;
  pwaosNetworkProxyPACScriptInfo      pac_script;
} pwaosNetworkProxyDetails;

/**
 * \brief Network proxy configuration structure for pwa app.
 */
typedef struct pwaosNetworkProxyInfo {
  pwaosStructureType          type;  /*!< must be PWAOS_TYPE_NETWORK_PROXY_INFO. */
  const void* PWAOS_MAY_ALIAS next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
  pwaosNetworkProxyType       proxyType;
  pwaosNetworkProxyDetails    details;
} pwaosNetworkProxyInfo;

/**
 * \brief Set network proxy on pwa app.
 *
 * This function is to control the pwa app network proxy.
 *
 * \param[in] appHandle Handle of the PWA application.
 * \param[in] proxyInfo Proxy configuration to apply.
 *
 * \return #PWAOS_RESULT_SUCCESS the FPS of pwa app was updated successfully.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the appHandle is invalid.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_CONNECTION_LOST the connection between pwaos service instance and pwaos server is broken.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_NOT_READY the pwaos server is starting.
 * \return #PWAOS_RESULT_ERROR_VALIDATION_FAILURE the function usage was invalid, please check whether the proxyInfo is NULL or the proxyInfo is invalid.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_setNetworkProxy(
                               PWAOS_APP_HANDLE appHandle,
                               const pwaosNetworkProxyInfo* proxyInfo);

/**
 * \brief Retrieve the current  network proxy configuration for PWA application.
 *
 * This function retrieves the current network proxy settings for a PWA application.
 *
 * \param[in] appHandle The handle of the PWA application.
 * \param[out] proxyInfo  Pointer to a pwaosNetworkProxyInfo structure that will
 *                        receive the current proxy configuration. The
 *                        pwaosNetworkProxyType field indicates the active proxy
 *                        mode, and the details union contains the corresponding
 *                        proxy servers or PAC script information.
 *
 * \return #PWAOS_RESULT_SUCCESS Proxy configuration was retrieved successfully.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID The appHandle is invalid.
 * \return #PWAOS_RESULT_ERROR_INVALID_PARAMETER proxyInfo is NULL.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_CONNECTION_LOST Connection to PWAOS service is broken.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_NOT_READY PWAOS server is starting.
 *
 * \note Check the flags field to determine which fields are configured.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_getNetworkProxy(
                               PWAOS_APP_HANDLE appHandle,
                               pwaosNetworkProxyInfo* proxyInfo);

/**
 *  \brief pwaosAppStatus, the status of pwa which is running on pwaos_server process
 */
typedef enum pwaosAppStatus {
  appStatusInVisible = 0, /*!< pwa is not visible */
  appStatusStopping = 1,  /*!< pwa is closing */
  appStatusReady = 2, /*!< pwa is ready */
  appStatusSynchronized = 3, /*!< compositing of pwa is synchronized */
  appStatusVisible = 4, /*!< pwa is visible */
  appStatusFocused = 5, /*!< pwa has focus */
  appStatusUnFocused = 6, /*!< pwa has no focus */
} pwaosAppStatus;

/**
 *  \brief the pwa app status change callback function type for pwa app
 */
typedef void (*pwaosAppCallback)(const pwaosAppStatus stat,
                                 void* userData);

/**
 * \brief Set pwa app status change callback function on pwa app.
 *
 * This function can monitor the pwa app status.
 *
 * \param[in] appHandle The handle of pwa app.
 * \param[in] callback The callback function.
 * \param[in] userData The userData.
 *
 * \return #PWAOS_RESULT_SUCCESS the function is successfully completed, callback function is set or clear.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the appHandle is invalid.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_setCallback(
                                PWAOS_APP_HANDLE appHandle,
                                pwaosAppCallback callback,
                                void* userData);

/**
 * \brief Set the display density for pwa app.
 *
 * This function can control the display density of pwa app.
 *
 * \param[in] appHandle The handle of pwa app.
 * \param[in] density The display density, the scope is (0.01 - 100.0).
 *
 * \return #PWAOS_RESULT_SUCCESS the function is successfully completed, callback function is set or clear.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the appHandle is invalid, and the pwaosAppType must be appTypePwaContents.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_setDensity(
                                PWAOS_APP_HANDLE appHandle,
                                float density);

/**
 * \brief Get the display density for pwa app.
 *
 * This function can get the display density for pwa app.
 *
 * \param[in] appHandle The handle of pwa app.
 * \param[out] density The display density.
 *
 * \return #PWAOS_RESULT_SUCCESS the function is successfully completed, callback function is set or clear.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the appHandle is invalid.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_getDensity(
                                PWAOS_APP_HANDLE appHandle,
                                float* out_density);

/**
 *  \brief Input method status enumeration
 *
 *  This enumeration defines the status of the input method, used by the PWA engine to notify the pwa app
 *  when the input method needs to be shown or hidden. The PWA engine detects when the web page requires
 *  input (e.g., focus on an input field) and requests the pwa app to display the input method. Conversely,
 *  when input is complete or the page navigates away, the engine requests the input method to be hidden.
 */
typedef enum pwaosInputMethodStatus {
  inputMethodStatusShow = 0, /*!< pwa app should show the input method */
  inputMethodStatusHide = 1, /*!< pwa app should hide the input method */
} pwaosInputMethodStatus;

/**
 *  \brief Callback function prototype for input method status changes
 *
 *  This callback is triggered by the PWA engine to notify the pwa app of changes in the input method status.
 *  The pwa app should implement this callback to handle showing or hiding the input method based on the provided status.
 */
typedef void (*pwaosInputMethodCallback)(
                                 const pwaosInputMethodStatus stat,
                                 void* userData);

/**
 * \brief Set input method callback function on pwa app.
 *
 * This function .
 *
 * \param[in] appHandle The handle of pwa app.
 * \param[in] callback The callback function.
 * \param[in] userData The userData.
 *
 * \return #PWAOS_RESULT_SUCCESS the function is successfully completed, callback function is set or clear.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the appHandle is invalid.
 * \return #PWAOS_RESULT_ERROR_INTERNAL some exception occurs.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_setInputMethodCallback(
                                PWAOS_APP_HANDLE appHandle,
                                pwaosInputMethodCallback callback,
                                void* userData);

/**
 *  \brief pwaos app projector handle
 */
typedef pwaosHandle PWAOS_PROJECTOR_HANDLE;

#if defined(WIN32)
typedef HWND PWAOS_ACCELERATED_WIDGET_HANDLE;
#define INVALID_PWAOS_ACCELERATED_WIDGET_HANDLE  NULL
#else
typedef uint32_t PWAOS_ACCELERATED_WIDGET_HANDLE;
#define INVALID_PWAOS_ACCELERATED_WIDGET_HANDLE  0
//#error unknown platform
#endif

/**
 *  \brief pwaosProjectorType, the pwaOS projector types
 */
typedef enum pwaosProjectorType {
    PROJECTOR_TYPE_OFFSCREEN_SOFTWARE   = 0, /*!< software bitmap */
    PROJECTOR_TYPE_OFFSCREEN_OPENGL     = 1, /*!< OpenGL */
    #if defined(PWAOS_USE_GRAPHICS_API_EGL)
    PROJECTOR_TYPE_OFFSCREEN_EGL        = 2, /*!< EGL */
    #endif
    #if defined(PWAOS_USE_GRAPHICS_API_VULKAN)
    PROJECTOR_TYPE_OFFSCREEN_VULKAN     = 3, /*!< Vulkan */
    #endif
    #if defined(PWAOS_USE_GRAPHICS_API_D3D11)
    PROJECTOR_TYPE_OFFSCREEN_D3D11      = 4, /*!< D3D11 */
    #endif
    #if defined(PWAOS_USE_GRAPHICS_API_D3D12)
    PROJECTOR_TYPE_OFFSCREEN_D3D12      = 5, /*!< D3D12 */
    #endif

    PROJECTOR_TYPE_NATIVE_WIDGET        = 9999, /*!< native widget window */
} pwaosProjectorType;

/**
 *  \brief pwaosProjectorCreateInfo, the pwaOS projector create info
 */
typedef struct pwaosProjectorCreateInfo {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    pwaosProjectorType                  projectorType; /*!< The projector showing type */
    int                                 width; /*!< The projector width */
    int                                 height; /*!< The projector height */
} pwaosProjectorCreateInfo;

/**
 *  \brief pwaosProjectorCreateNativeInfoExt, the pwaOS projector create info for native widget
 */
typedef struct pwaosProjectorCreateNativeInfoExt {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    PWAOS_ACCELERATED_WIDGET_HANDLE     widget; /*!< The native accelerated widget */
} pwaosProjectorCreateNativeInfoExt;

#if defined(PWAOS_USE_GRAPHICS_API_EGL)
/**
 *  \brief pwaosProjectorCreateEGLInfoExt, the pwaOS projector create info for EGL
 */
typedef struct pwaosProjectorCreateEGLInfoExt {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    EGLDisplay                          display; /*!< must be a valid EGLDisplay value */
    EGLConfig                           config; /*!< must be a valid EGLConfig value */
    EGLContext                          context; /*!< must be a valid EGLContext value */
} pwaosProjectorCreateEGLInfoExt;
#endif

#if defined(PWAOS_USE_GRAPHICS_API_VULKAN)
/**
 *  \brief pwaosProjectorCreateVulkanInfoExt, the pwaOS projector create info for vulkan
 */
typedef struct pwaosProjectorCreateVulkanInfoExt {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    VkDevice                            device; /*!< is a valid Vulkan VkDevice. */
} pwaosProjectorCreateVulkanInfoExt;
#endif

#if defined(PWAOS_USE_GRAPHICS_API_D3D11)
/**
 *  \brief pwaosProjectorCreateD3D11InfoExt, the pwaOS projector create info for d3d11
 */
typedef struct pwaosProjectorCreateD3D11InfoExt {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    ID3D11Device*                       device; /*!< is a pointer to a valid ID3D11Device to use. */
} pwaosProjectorCreateD3D11InfoExt;
#endif

#if defined(PWAOS_USE_GRAPHICS_API_D3D12)
/**
 *  \brief pwaosProjectorCreateD3D12InfoExt, the pwaOS projector create info for d3d12
 */
typedef struct pwaosProjectorCreateD3D12InfoExt {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    ID3D12Device*                       device; /*!< is a pointer to a valid ID3D12Device to use. */
    ID3D12CommandQueue*                 commandQueue; /*!< is a pointer to a valid ID3D12CommandQueue to use. */
} pwaosProjectorCreateD3D12InfoExt;
#endif

/**
 * \brief Create the projector for the specified pwa app.
 *
 * This function can display pwa app on the accelerated widget directly.
 *
 * \param[in] appHandle The handle of pwa app.
 * \param[in] createInfo The info of creating pwaosProjector.
 * \param[out] out_projectorHandle The pwaos app projector handle.
 *
 * \return #PWAOS_RESULT_SUCCESS the projector for the pwa app was created successfully.
 * \return #PWAOS_RESULT_ERROR_VALIDATION_FAILURE the function usage was invalid, please check createInfo and its members, and whether the pointer is NULL.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the appHandle is invalid.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_CONNECTION_LOST the connection between pwaos service instance and pwaos server is broken.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_NOT_READY the pwaos server is starting.
 * \return #PWAOS_RESULT_ERROR_COMPOSITING_NOT_SYNCHRONIZED the compositing of pwa app is not synchronized.
 * \return #PWAOS_RESULT_ERROR_NOT_IMPLEMENT.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_createProjector(
                                PWAOS_APP_HANDLE appHandle,
                                const pwaosProjectorCreateInfo* createInfo,
                                PWAOS_PROJECTOR_HANDLE* out_projectorHandle);

/**
 * \brief Destroy and close the pwa projector.
 *
 * This function is to destroy the pwa projector which is created on the server side.
 *
 * \param[in] projectorHandle The handle of pwa projector.
 *
 * \return #PWAOS_RESULT_SUCCESS the projector was destroyed successfully.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the projectorHandle is invalid.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosApp_destroyProjector(PWAOS_PROJECTOR_HANDLE projectorHandle);

/**
 *  \brief pwaosProjectorDrawCallbackData, the callback data for projector onDraw
 */
typedef struct pwaosProjectorDrawCallbackData {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    int                                 width; /*!< The offscreen buffer width */
    int                                 height; /*!< The offscreen buffer height */
} pwaosProjectorDrawCallbackData;

typedef enum pwaosColorType {
    PWAOS_COLOR_TYPE_UNKNOWN = 0, /*!< unknow color type */
    PWAOS_COLOR_TYPE_RGBA8888 = 1, /*!< RGBA8888 color type */
    PWAOS_COLOR_TYPE_BGRA8888 = 2, /*!< BGRA8888 color type */
} pwaosColorType;

typedef struct pwaosProjectorDrawCallbackBitmapData {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    const void*                         bitmapPixel; /*!< The offscreen bitmap buffer, only available when the projector type is PROJECTOR_TYPE_OFFSCREEN_SOFTWARE */
    pwaosColorType                      colorType; /*!< Describes how pixel bits encode color */
    int                                 alphaType; /*!< Describes how pixel bits encode color */
    int                                 rowBytes; /*!< Describes pixels' row bytes */
} pwaosProjectorDrawCallbackBitmapData;

#if defined(PWAOS_USE_GRAPHICS_API_EGL)
typedef struct pwaosProjectorDrawCallbackEGLImageData {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    EGLImageKHR                         image; /*!< The offscreen EGLImageKHR, only available when the projector type is PROJECTOR_TYPE_OFFSCREEN_EGL */
} pwaosProjectorDrawCallbackEGLImageData;
#endif

#if defined(PWAOS_USE_GRAPHICS_API_VULKAN)
typedef struct pwaosProjectorDrawCallbackVkImageData {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    VkImage                             image; /*!< The offscreen vkimage, only available when the projector type is PROJECTOR_TYPE_OFFSCREEN_VULKAN */
} pwaosProjectorDrawCallbackVkImageData;
#endif

#if defined(PWAOS_USE_GRAPHICS_API_D3D11)
typedef struct pwaosProjectorDrawCallbackD3D11Data {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    ID3D11Texture2D*                    texture; /*!< The offscreen texture, only available when the projector type is PROJECTOR_TYPE_OFFSCREEN_D3D11 */
} pwaosProjectorDrawCallbackD3D11Data;
#endif

#if defined(PWAOS_USE_GRAPHICS_API_D3D12)
typedef struct pwaosProjectorDrawCallbackD3D12Data {
    pwaosStructureType                  type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS         next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    ID3D12Resource*                     resource; /*!< The offscreen resource, only available when the projector type is PROJECTOR_TYPE_OFFSCREEN_D3D12 */
} pwaosProjectorDrawCallbackD3D12Data;
#endif

/**
 *  \brief the onDraw callback function type for pwaos projector
 *
 * This function type is the onDraw callback for pwaos projector.
 *
 * \param[in] callbackData the data of type pwaosProjectorDrawCallbackData.
 * \param[in] userData The userData.
 *
 */
typedef void (*pwaosProjectorDrawCallback)(const pwaosProjectorDrawCallbackData* callbackData,
                                           void* userData);

/**
 * \brief Set onDraw callback function on pwaContents app.
 *
 * This function .
 *
 * \param[in] projectorHandle The handle of projector.
 * \param[in] callback The callback function.
 * \param[in] userData The userData.
 *
 * \return #PWAOS_RESULT_SUCCESS the function is successfully completed, callback function is set or clear.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the projectorHandle is invalid.
 * \return #PWAOS_RESULT_ERROR_INTERNAL some exception occurs.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosProjector_setDrawCallback(
                                PWAOS_PROJECTOR_HANDLE projectorHandle,
                                pwaosProjectorDrawCallback callback,
                                void* userData);

/*!
 * @typedef pwaosTime
 * @brief Represents a timestamp value used by the PWAOS runtime.
 */
typedef int64_t pwaosTime;

/*!
 * @struct pwaosEventDataBuffer
 * @brief Generic event buffer used for retrieving runtime event data.
 *
 * This structure acts as a type-erased container for all event payload types.
 * Applications typically pass this structure to an event polling function,
 * and the runtime fills it with a concrete event structure depending on the
 * event type.
 *
 * The @ref type field identifies the actual event payload stored in
 * @ref varying.
 *
 * The buffer size must be large enough to contain any supported event
 * structure.
 */
typedef struct pwaosEventDataBuffer {
    pwaosStructureType              type;  /*!< The pwaos structure type */
    const void* PWAOS_MAY_ALIAS     next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    uint8_t                         varying[4000];
} pwaosEventDataBuffer;

/*!
 * @struct pwaosEventDataInstanceStatusChanged
 * @brief Event generated when a pwaos service instance changes status.
 */
typedef struct pwaosEventDataInstanceStatusChanged {
    pwaosStructureType              type;  /*!< The pwaos structure type, must be set to the corresponding `PWAOS_TYPE_EVENT_DATA_INSTANCE_STATUS_CHANGED` value. */
    const void* PWAOS_MAY_ALIAS     next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    PWAOS_INSTANCE_HANDLE           instance;  /*!< The handle of pwaos service instance whose status has changed. */
    pwaosInstanceStatus             status;  /*!< The new status of the pwaos service instance. */
    pwaosTime                       time;  /*!< The Timestamp associated with the status transition event. */
} pwaosEventDataInstanceStatusChanged;

/*!
 * @struct pwaosEventDataAppStatusChanged
 * @brief Event generated when an application changes status.
 */
typedef struct pwaosEventDataAppStatusChanged {
    pwaosStructureType              type;  /*!< The pwaos structure type, must be set to the corresponding `PWAOS_TYPE_EVENT_DATA_APP_STATUS_CHANGED` value. */
    const void* PWAOS_MAY_ALIAS     next;  /*!< next is NULL or a pointer to the next structure in a structure chain. */
    PWAOS_APP_HANDLE                app;  /*!< The handle of pwa app whose status has changed. */
    pwaosAppStatus                  status;  /*!< The new status of the pwa app. */
    pwaosTime                       time;  /*!< The Timestamp associated with the status transition event. */
} pwaosEventDataAppStatusChanged;

/**
 * \brief Reason why a PWA application is in appStatusStopping state.
 */
typedef enum pwaosAppStoppingReason {
    PWAOS_APP_STOPPING_REASON_NORMAL       = 0, /*!< The app is stopping normally (e.g., user closed, navigation, shutdown). */
    PWAOS_APP_STOPPING_REASON_CRASH        = 1, /*!< The app is stopping due to a crash (e.g., renderer process died). */
    PWAOS_APP_STOPPING_REASON_UNRESPONSIVE = 2, /*!< The app is stopping because it became unresponsive (e.g., hung, watchdog timeout). */
    PWAOS_APP_STOPPING_REASON_NETWORK      = 3, /*!< The app is stopping because the network is unrearchable. */
    PWAOS_APP_STOPPING_REASON_UNKNOWN      = 4, /*!< The reason could not be determined. */
} pwaosAppStoppingReason;

typedef struct pwaosAppStoppingInfoExt {
    pwaosStructureType          type; /*!< Must be #PWAOS_TYPE_APP_STOPPING_INFO_EXT. */
    const void* PWAOS_MAY_ALIAS next;
    pwaosAppStoppingReason      stoppingReason; /*!< Reason why the app is stopping. */
} pwaosAppStoppingInfoExt;

/**
 * \brief process pwaos internal tasks and fetch pwaosEvent.
 *
 * This function is to process pwaos internal tasks and fetch pwaosEvent.
 *
 * \param[in] handle The handle of pwa service instance.
 *
 * \return #PWAOS_RESULT_SUCCESS the function fetch one pwaosEvent successfully.
 * \return #PWAOS_RESULT_ERROR_HANDLE_INVALID the instance handle is invalid.
 * \return #PWAOS_RESULT_ERROR_RUNTIME_NOT_READY the pwaos server is starting.
 * \return #PWAOS_RESULT_ERROR_INVALID_THREAD this function must be invoked on the same thread which is pwaos_init called.
 */
PWAOS_DLL_EXPORT pwaosResult pwaosInstance_pollEvent(PWAOS_INSTANCE_HANDLE handle, pwaosEventDataBuffer* eventData);

#ifdef __cplusplus
}
#endif

#endif // PWAOS_RUNTIME_CLIENT_API_H
