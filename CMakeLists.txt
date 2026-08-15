cmake_minimum_required(VERSION 3.16)

project(VehicleBrakingSimulator
    VERSION 0.1
    LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(vehicle_simulator
    src/main.cpp
    src/VehicleModel.cpp
)

target_include_directories(vehicle_simulator
    PRIVATE
        ${PROJECT_SOURCE_DIR}/include
        ${PROJECT_SOURCE_DIR}/Crow/include
)

find_package(Threads REQUIRED)

add_executable(cpp_server
    src/cpp_server.cpp
)

target_include_directories(cpp_server
    PRIVATE
        ${PROJECT_SOURCE_DIR}/include
        ${PROJECT_SOURCE_DIR}/Crow/include
)

target_link_libraries(cpp_server PRIVATE Threads::Threads)