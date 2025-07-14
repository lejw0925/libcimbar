class CimbarWasmDecoder {
    constructor() {
        this.decoder = null;
        this.isInitialized = false;
        this.initPromise = null;
    }

    async init() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise((resolve, reject) => {
            // 检查是否支持WebAssembly
            if (typeof WebAssembly === 'undefined') {
                reject(new Error('WebAssembly not supported'));
                return;
            }

            // 加载WebAssembly模块
            this.loadWasmModule()
                .then(() => {
                    this.isInitialized = true;
                    resolve();
                })
                .catch(reject);
        });

        return this.initPromise;
    }

    async loadWasmModule() {
        return new Promise((resolve, reject) => {
            // 创建Module对象
            const Module = {
                onRuntimeInitialized: () => {
                    try {
                        this.decoder = new Module.CimbarWasmDecoder();
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                },
                onError: (error) => {
                    reject(new Error(`WASM loading failed: ${error}`));
                }
            };

            // 加载WASM文件
            const script = document.createElement('script');
            script.src = 'cimbar_decoder_wasm.js';
            script.onload = () => {
                // WASM模块会自动初始化
            };
            script.onerror = () => {
                reject(new Error('Failed to load WASM module'));
            };
            document.head.appendChild(script);
        });
    }

    configure(ecc = 2, colorBits = 3, fountain = true) {
        if (!this.isInitialized) {
            throw new Error('Decoder not initialized');
        }
        this.decoder.configure(ecc, colorBits, fountain);
    }

    async decodeImage(imageData, outputPath = 'decoded_output') {
        if (!this.isInitialized) {
            throw new Error('Decoder not initialized');
        }

        try {
            // 将图像数据转换为字符串格式
            const imageString = this.arrayBufferToString(imageData);
            
            // 调用WASM解码函数
            const success = this.decoder.decodeImage(imageString, outputPath);
            
            if (success) {
                return {
                    success: true,
                    outputPath: outputPath,
                    decodedData: this.decoder.getDecodedData()
                };
            } else {
                return {
                    success: false,
                    error: 'Failed to decode image'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async decodeMultipleImages(imageDataArray, outputPath = 'decoded_output') {
        if (!this.isInitialized) {
            throw new Error('Decoder not initialized');
        }

        const results = [];
        let isComplete = false;

        for (let i = 0; i < imageDataArray.length; i++) {
            const imageData = imageDataArray[i];
            const result = await this.decodeImage(imageData, outputPath);
            results.push(result);

            // 检查是否解码完成
            if (this.decoder.isDecodingComplete()) {
                isComplete = true;
                break;
            }
        }

        return {
            success: isComplete,
            results: results,
            isComplete: isComplete,
            decodedData: this.decoder.getDecodedData()
        };
    }

    reset() {
        if (this.decoder) {
            this.decoder.reset();
        }
    }

    arrayBufferToString(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return binary;
    }

    // 辅助方法：将File对象转换为ArrayBuffer
    async fileToArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // 辅助方法：创建下载链接
    createDownloadLink(data, filename) {
        const blob = new Blob([data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        return link;
    }
}

// 导出到全局作用域
window.CimbarWasmDecoder = CimbarWasmDecoder;