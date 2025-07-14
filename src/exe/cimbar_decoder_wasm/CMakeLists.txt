set(TARGET cimbar_decoder_wasm)

add_executable(${TARGET} cimbar_decoder_wasm.cpp)

target_link_libraries(${TARGET} 
    cimbar_lib
    ${OPENCV_LIBS}
)

if(USE_WASM)
    set_target_properties(${TARGET} PROPERTIES
        SUFFIX ".js"
        LINK_FLAGS "-s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] -s EXPORTED_FUNCTIONS=['_main'] -s USE_WEBGL2=1 -s USE_GLFW=3 -s FULL_ES3=1"
    )
    
    if(USE_WASM STREQUAL "2")
        set_target_properties(${TARGET} PROPERTIES
            LINK_FLAGS "-s WASM=0"
        )
    endif()
endif()

install(TARGETS ${TARGET} DESTINATION bin)