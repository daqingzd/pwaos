cmake_minimum_required(VERSION 3.5...3.28)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_SOURCE_DIR}/bin)
project(pwaos_sdk C)

# 定义 PWAOS_SDK_DIR 宏为当前 CMakeLists.txt 所在目录
file(TO_CMAKE_PATH "${CMAKE_CURRENT_SOURCE_DIR}" PWAOS_SDK_DIR_PATH)
add_definitions(-DPWAOS_SDK_DIR="${PWAOS_SDK_DIR_PATH}")

include_directories(${CMAKE_SOURCE_DIR}/include)

if(WIN32)
link_directories(${CMAKE_SOURCE_DIR}/lib/win)
else()
link_directories(${CMAKE_SOURCE_DIR}/lib/linux)
endif()

function(_add_runtime_api_post_build TARGET_NAME)
    if(WIN32)
        add_custom_command(TARGET ${TARGET_NAME} POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${CMAKE_SOURCE_DIR}/lib/win/pwaos_runtime_api.dll"
            "$<TARGET_FILE_DIR:${TARGET_NAME}>"
            COMMENT "Automatically copying runtime DLL for ${TARGET_NAME}"
        )
    elseif(UNIX AND NOT APPLE)
        add_custom_command(TARGET ${TARGET_NAME} POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${CMAKE_SOURCE_DIR}/lib/linux/libpwaos_runtime_api.so"
            "$<TARGET_FILE_DIR:${TARGET_NAME}>"
            COMMENT "Automatically copying runtime SO for ${TARGET_NAME}"
        )
    endif()
endfunction()

file(GLOB SUB_DIR_LIST RELATIVE ${CMAKE_CURRENT_SOURCE_DIR} */)

set(EXCLUDE_DIRS "include" "lib" "runtime")

foreach(sub_dir ${SUB_DIR_LIST})
    if(NOT ${sub_dir} IN_LIST EXCLUDE_DIRS)
        if(EXISTS ${CMAKE_CURRENT_SOURCE_DIR}/${sub_dir}/CMakeLists.txt)
            add_subdirectory(${sub_dir})
        endif()
    endif()
endforeach()

set_property(DIRECTORY PROPERTY VS_STARTUP_PROJECT hello)