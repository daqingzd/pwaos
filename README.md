Please switch branch to find correct platform and CPU architecture.

On windows: 
1) Install Visual Studio 2019 or later and CMake.
2) Generate the Visual Studio solution:
  cmake . -A Win32
3) Open pwaos_sdk.sln in Visual Studio 2019 and run.

On Linux:
1) Install CMake and GCC.
2) Generate MakeFiles and Build.
  cmake .
  make

Support:
For questions or to request the SDK for other platforms or
CPU architectures, please contact daqingzd@pwaos.net.
