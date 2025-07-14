// Cimbar WebAssembly 解码器接口
// 该文件提供了与 C++ WebAssembly 模块的接口

class CimbarWasmDecoder {
    constructor() {
        this.decoder = null;
        this.isInitialized = false;
        this.initPromise = null;
        this.Module = null;
    }

    async init() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise((resolve, reject) => {
            // 检查是否支持WebAssembly
            if (typeof WebAssembly === 'undefined') {
                reject(new Error('WebAssembly not supported in this browser'));
                return;
            }

            // 动态加载WebAssembly模块
            this.loadWasmModule()
                .then(() => {
                    this.isInitialized = true;
                    console.log('Cimbar WebAssembly decoder initialized successfully');
                    resolve();
                })
                .catch(error => {
                    console.error('Failed to initialize Cimbar decoder:', error);
                    reject(error);
                });
        });

        return this.initPromise;
    }

    async loadWasmModule() {
        return new Promise((resolve, reject) => {
            // 检查是否已有编译好的模块
            if (typeof createCimbarModule === 'function') {
                this.initializeWithExistingModule(resolve, reject);
                return;
            }

            // 尝试加载编译好的 WASM 文件
            const wasmScript = document.createElement('script');
            wasmScript.src = 'cimbar_js.js'; // 这是编译生成的文件
            wasmScript.onload = () => {
                this.initializeWithExistingModule(resolve, reject);
            };
            wasmScript.onerror = () => {
                // 如果无法加载编译好的文件，提供构建说明
                reject(new Error('WebAssembly module not found. Please build the WASM module first. See build instructions.'));
            };
            document.head.appendChild(wasmScript);
        });
    }

    initializeWithExistingModule(resolve, reject) {
        try {
            // 创建 Emscripten 模块实例
            const Module = {
                onRuntimeInitialized: () => {
                    try {
                        // 创建解码器实例
                        this.decoder = new Module.CimbarWasmDecoder();
                        this.Module = Module;
                        resolve();
                    } catch (error) {
                        reject(new Error(`Failed to create decoder instance: ${error.message}`));
                    }
                },
                onAbort: (what) => {
                    reject(new Error(`Module initialization aborted: ${what}`));
                },
                print: (text) => {
                    console.log('WASM:', text);
                },
                printErr: (text) => {
                    console.error('WASM Error:', text);
                }
            };

            // 如果存在全局的创建函数，调用它
            if (typeof createCimbarModule === 'function') {
                createCimbarModule(Module);
            } else if (typeof Module !== 'undefined' && Module.onRuntimeInitialized) {
                // 某些版本的 Emscripten 可能直接提供 Module
                Module.onRuntimeInitialized();
            } else {
                reject(new Error('WebAssembly module creation function not found'));
            }
        } catch (error) {
            reject(error);
        }
    }

    configure(ecc = 2, colorBits = 3, fountain = true) {
        if (!this.isInitialized || !this.decoder) {
            throw new Error('Decoder not initialized. Please call init() first.');
        }
        
        try {
            this.decoder.configure(ecc, colorBits, fountain);
            console.log(`Decoder configured: ECC=${ecc}, ColorBits=${colorBits}, Fountain=${fountain}`);
        } catch (error) {
            throw new Error(`Failed to configure decoder: ${error.message}`);
        }
    }

    async decodeImage(imageData, outputPath = 'decoded_output') {
        if (!this.isInitialized || !this.decoder) {
            throw new Error('Decoder not initialized. Please call init() first.');
        }

        try {
            let processedImageData;
            
            // 处理不同类型的图像数据
            if (typeof imageData === 'string') {
                // Base64 数据 URL
                processedImageData = this.dataURLToUint8Array(imageData);
            } else if (imageData instanceof ArrayBuffer) {
                processedImageData = new Uint8Array(imageData);
            } else if (imageData instanceof Uint8Array) {
                processedImageData = imageData;
            } else {
                throw new Error('Unsupported image data format');
            }

            // 将数据传递给 WASM 模块
            const dataPtr = this.Module._malloc(processedImageData.length);
            this.Module.HEAPU8.set(processedImageData, dataPtr);

            // 调用解码函数
            const success = this.decoder.decodeImageFromMemory(dataPtr, processedImageData.length, outputPath);
            
            // 清理内存
            this.Module._free(dataPtr);

            if (success) {
                const decodedData = this.getDecodedData();
                return {
                    success: true,
                    outputPath: outputPath,
                    decodedData: decodedData,
                    isComplete: this.isDecodingComplete()
                };
            } else {
                return {
                    success: false,
                    error: 'Failed to decode image - no valid cimbar pattern found'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: `Decoding error: ${error.message}`
            };
        }
    }

    async decodeMultipleImages(imageDataArray, outputPath = 'decoded_output') {
        if (!this.isInitialized || !this.decoder) {
            throw new Error('Decoder not initialized');
        }

        const results = [];
        let isComplete = false;
        let totalSuccess = 0;

        for (let i = 0; i < imageDataArray.length && !isComplete; i++) {
            const imageData = imageDataArray[i];
            const result = await this.decodeImage(imageData, outputPath);
            results.push(result);

            if (result.success) {
                totalSuccess++;
                console.log(`Successfully decoded frame ${i + 1}/${imageDataArray.length}`);
            }

            // 检查是否解码完成
            isComplete = this.isDecodingComplete();
            
            if (isComplete) {
                console.log(`Decoding completed after processing ${i + 1} frames`);
                break;
            }
        }

        return {
            success: isComplete,
            results: results,
            isComplete: isComplete,
            totalFrames: imageDataArray.length,
            successfulFrames: totalSuccess,
            decodedData: isComplete ? this.getDecodedData() : null
        };
    }

    getDecodedData() {
        if (!this.isInitialized || !this.decoder) {
            return null;
        }

        try {
            // 获取解码后的数据
            const dataPtr = this.decoder.getDecodedDataPtr();
            const dataSize = this.decoder.getDecodedDataSize();
            
            if (dataPtr === 0 || dataSize === 0) {
                return null;
            }

            // 从 WASM 内存中复制数据
            const dataArray = new Uint8Array(this.Module.HEAPU8.buffer, dataPtr, dataSize);
            const copiedData = new Uint8Array(dataArray);
            
            return new Blob([copiedData], { type: 'application/octet-stream' });
        } catch (error) {
            console.error('Error getting decoded data:', error);
            return null;
        }
    }

    isDecodingComplete() {
        if (!this.isInitialized || !this.decoder) {
            return false;
        }

        try {
            return this.decoder.isDecodingComplete();
        } catch (error) {
            console.error('Error checking decoding status:', error);
            return false;
        }
    }

    getProgress() {
        if (!this.isInitialized || !this.decoder) {
            return 0;
        }

        try {
            return this.decoder.getProgress();
        } catch (error) {
            console.error('Error getting progress:', error);
            return 0;
        }
    }

    reset() {
        if (this.decoder) {
            try {
                this.decoder.reset();
                console.log('Decoder reset successfully');
            } catch (error) {
                console.error('Error resetting decoder:', error);
            }
        }
    }

    // 辅助方法：将 Data URL 转换为 Uint8Array
    dataURLToUint8Array(dataURL) {
        // 移除 data URL 前缀
        const base64 = dataURL.split(',')[1];
        if (!base64) {
            throw new Error('Invalid data URL format');
        }

        // 解码 Base64
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        return bytes;
    }

    // 辅助方法：将 File 对象转换为 ArrayBuffer
    async fileToArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // 辅助方法：创建下载链接
    createDownloadLink(data, filename = 'decoded_file.bin') {
        const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        return link;
    }

    // 获取解码器状态信息
    getStatus() {
        if (!this.isInitialized) {
            return 'Not initialized';
        }
        
        try {
            return {
                initialized: this.isInitialized,
                isComplete: this.isDecodingComplete(),
                progress: this.getProgress(),
                hasData: this.getDecodedData() !== null
            };
        } catch (error) {
            return 'Error getting status';
        }
    }
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.CimbarWasmDecoder = CimbarWasmDecoder;
}

// 为 Node.js 环境导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CimbarWasmDecoder;
}