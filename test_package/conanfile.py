import os

from conan import ConanFile
from conan.tools.build import can_run
from conan.tools.cmake import CMake, cmake_layout


class PwaosSdkTestPackageConan(ConanFile):
    settings = "os", "arch", "compiler", "build_type"
    test_type = "explicit"
    generators = "CMakeToolchain", "CMakeDeps", "VirtualRunEnv"

    def requirements(self):
        # 显式 traits：pwaos_sdk 携带头文件+客户端库，消费者要编译链接。
        # 不写的话，APP 型包的默认 traits 是 headers=False/libs=False，
        # CMakeDeps 生成的目标将没有 include 目录和库。
        self.requires(self.tested_reference_str, headers=True, libs=True, run=True)

    def layout(self):
        cmake_layout(self)

    def build(self):
        cmake = CMake(self)
        cmake.configure()
        cmake.build()

    def test(self):
        if can_run(self):
            # Default: link/ABI smoke (no server needed). The full hello
            # runtime flow runs when PWAOS_TEST_RUNTIME=1 is set; the packaged
            # runtime dir is exported as PWAOS_RUNTIME_DIR by the package's
            # runenv and reached through the "conanrun" environment.
            # Extra client args (forwarded by the client to pwaos_server,
            # e.g. --no-sandbox) come via PWAOS_TEST_ARGS.
            bin_path = os.path.join(self.cpp.build.bindirs[0], "test_package")
            extra = os.environ.get("PWAOS_TEST_ARGS", "")
            self.run((bin_path + " " + extra).strip(), env="conanrun")
