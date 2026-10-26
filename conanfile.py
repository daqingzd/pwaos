import os
import shutil
import subprocess

from conan import ConanFile
from conan.errors import ConanInvalidConfiguration, ConanException
from conan.tools.files import copy, collect_libs
from conan.tools.scm import Git


class PwaosSdkRecipe(ConanFile):
    name = "pwaos_sdk"
    version = "0.2.a.0"
    # shared-library（同 /workspace/iop/conan/all 参考配方）：消费者要 #include
    # runtime_client_api.h 并链接 libpwaos_runtime_api.so；声明成 application
    # 会让 Conan 把 requires 的 headers/libs 特性置 False，CMakeDeps 生成的
    # 目标就没有 include 目录和库了。
    package_type = "shared-library"

    license = "MIT"
    author = "pwaos.net <daqingzd@pwaos.net>"
    url = "https://github.com/daqingzd/pwaos.git"
    description = "PWAOS runtime SDK (prebuilt libraries, headers and runtime binaries)"
    topics = ("pwaos", "runtime", "sdk", "prebuilt", "webapp", "webui")

    settings = "os", "compiler", "build_type", "arch"

    # SDK 内容由 source() 从 GitHub 拉取，不再从本地导出
    no_copy_source = True

    _repo_url = "https://github.com/daqingzd/pwaos.git"

    def _sdk_branches(self):
        """返回所有平台的分支名，不依赖 settings。"""
        return [
            ("linux", "sdk-linux-x64-v" + self.version),
            ("win", "sdk-win-x86-v" + self.version),
        ]

    def _platform_dir(self):
        """根据 settings 返回平台子目录名；不支持的平台直接报错。"""
        if self.settings.os == "Linux" and str(self.settings.arch) in ("x86_64", "x64"):
            return "linux"
        if self.settings.os == "Windows" and str(self.settings.arch) in ("x86", "x86_32"):
            return "win"
        raise ConanInvalidConfiguration(
            "pwaos_sdk does not support "
            + str(self.settings.os) + "/" + str(self.settings.arch)
            + ". Supported: Linux/x86_64, Windows/x86."
        )

    def _sdk_root(self):
        return os.path.join(self.source_folder, self._platform_dir())

    def validate(self):
        # validate() 在 source() 之前执行，只能访问 settings
        self._platform_dir()

    def _clone_platform(self, git, platform, branch):
        """Clone + LFS pull，网络抖动时自动重试（GitHub CDN 在此环境不稳定）。"""
        target = os.path.join(self.source_folder, platform)
        last_err = None
        for attempt in range(1, 4):
            try:
                git.clone(
                    url=self._repo_url,
                    target=platform,
                    args=["--branch", branch, "--depth", "1"],
                )
                # 拉取 LFS 大文件（pwaos_server 等）
                subprocess.run(["git", "lfs", "pull"], cwd=target, check=True)
                return
            except Exception as e:
                last_err = e
                self.output.warning(
                    f"clone/LFS attempt {attempt}/3 failed for {platform}: {e}"
                )
                # 失败的 clone 会留下不完整目录，必须清掉再重试
                shutil.rmtree(target, ignore_errors=True)
        raise ConanException(
            f"failed to clone {self._repo_url} branch {branch} after 3 attempts: {last_err}"
        )

    def source(self):
        git = Git(self, self.source_folder)
        for platform, branch in self._sdk_branches():
            self.output.info("Cloning pwaos_sdk branch: " + branch + " -> " + platform)
            self._clone_platform(git, platform, branch)

    def package(self):
        sdk_root = self._sdk_root()
        if not os.path.isdir(sdk_root):
            raise ConanInvalidConfiguration(
                "SDK platform directory not found in source: " + sdk_root
            )

        # 头文件
        copy(self, "*.h",
             src=os.path.join(sdk_root, "include"),
             dst=os.path.join(self.package_folder, "include"))
        copy(self, "*.hpp",
             src=os.path.join(sdk_root, "include"),
             dst=os.path.join(self.package_folder, "include"))

        # 库文件
        copy(self, "*.so*",
             src=os.path.join(sdk_root, "lib"),
             dst=os.path.join(self.package_folder, "lib"),
             keep_path=False)
        copy(self, "*.a",
             src=os.path.join(sdk_root, "lib"),
             dst=os.path.join(self.package_folder, "lib"),
             keep_path=False)
        copy(self, "*.lib",
             src=os.path.join(sdk_root, "lib"),
             dst=os.path.join(self.package_folder, "lib"),
             keep_path=False)

        # 可执行文件
        copy(self, "*",
             src=os.path.join(sdk_root, "bin"),
             dst=os.path.join(self.package_folder, "bin"),
             keep_path=False)

        # 运行时依赖：pwaos_server 及其配套库在 runtime/ 目录，
        # 客户端通过 pwaos_setRuntimeExecutablePath(PWAOS_SDK_DIR "/runtime") 定位
        copy(self, "*",
             src=os.path.join(sdk_root, "runtime"),
             dst=os.path.join(self.package_folder, "runtime"),
             keep_path=False)

        # 示例
        copy(self, "*",
             src=os.path.join(sdk_root, "examples"),
             dst=os.path.join(self.package_folder, "examples"))

        # 许可证
        copy(self, "LICENSE*",
             src=self.source_folder,
             dst=os.path.join(self.package_folder, "licenses"),
             keep_path=False)

        # 防止 LFS 拉取失败导致打出空包
        total = sum(len(files) for _, _, files in os.walk(self.package_folder))
        if total == 0:
            raise ConanInvalidConfiguration(
                "package() copied no files; check the SDK branch layout or LFS pull"
            )

    def package_info(self):
        # CMake 集成：下游 find_package(pwaos_sdk) 后可使用 pwaos_sdk::pwaos_sdk
        self.cpp_info.set_property("cmake_file_name", "pwaos_sdk")
        self.cpp_info.set_property("cmake_target_name", "pwaos_sdk::pwaos_sdk")

        self.cpp_info.includedirs = ["include"]
        self.cpp_info.libdirs = ["lib"]
        self.cpp_info.bindirs = ["bin"]

        # 按实际库文件名收集（自动去掉 lib 前缀和 .so/.a/.lib 后缀）
        self.cpp_info.libs = collect_libs(self, "lib")

        # 告诉消费者打包后的 runtime 目录位置（pwaos_server 所在），
        # 测试包与下游通过 PWAOS_RUNTIME_DIR 定位运行时
        runtime_dir = os.path.join(self.package_folder, "runtime")
        if os.path.isdir(runtime_dir):
            self.buildenv_info.define_path("PWAOS_RUNTIME_DIR", runtime_dir)
            self.runenv_info.define_path("PWAOS_RUNTIME_DIR", runtime_dir)

        if self.settings.os == "Linux":
            # 注意：不声明 system_libs。libpwaos_runtime_api.so 运行时依赖的
            # EGL/GLdispatch/glib-2.0/pcre 由系统库(.so.1)满足，作为 -l 传递
            # 会强迫消费者安装这些 dev 包，链接反而失败（链接期并不需要）。
            # 避免下游运行时找不到 .so
            self.cpp_info.sharedlinkflags = ["-Wl,-rpath,$ORIGIN/../lib"]
            self.cpp_info.exelinkflags = ["-Wl,-rpath,$ORIGIN/../lib"]
