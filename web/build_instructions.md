# Cimbar WebAssembly 构建说明

本文档说明如何构建 Cimbar WebAssembly 模块，以便在网页中使用离线 Cimbar 解码功能。

## 前置要求

### 1. Docker（推荐方式）

使用 Docker 是最简单的构建方式，因为它提供了预配置的 Emscripten 环境。

```bash
# 安装 Docker（如果尚未安装）
# Ubuntu/Debian:
sudo apt update && sudo apt install docker.io

# CentOS/RHEL:
sudo yum install docker

# macOS:
# 从 https://docs.docker.com/docker-for-mac/install/ 下载安装

# Windows:
# 从 https://docs.docker.com/docker-for-windows/install/ 下载安装
```

### 2. 本地环境（高级用户）

如果您希望在本地环境中构建，需要安装：

- Emscripten SDK (emsdk)
- Python 3.6+
- CMake 3.16+
- Git

## 方法一：使用 Docker（推荐）

### 步骤 1：克隆并准备项目

```bash
# 如果您还没有项目代码
git clone https://github.com/sz3/libcimbar.git
cd libcimbar

# 确保您有最新的代码
git pull origin master
git submodule update --init --recursive
```

### 步骤 2：运行 Docker 构建

```bash
# 使用预配置的 Docker 镜像运行构建脚本
docker run --mount type=bind,source="$(pwd)",target="/usr/src/app" -it emscripten/emsdk:3.1.69 bash /usr/src/app/package-wasm.sh
```

### 步骤 3：验证构建结果

构建完成后，您应该在 `web/` 目录中看到以下文件：

```bash
ls -la web/
# 应该包含：
# - cimbar_js.js      (JavaScript 包装器)
# - cimbar_js.wasm    (WebAssembly 二进制文件)
# - cimbar.wasm.tar.gz (压缩包)
```

## 方法二：本地环境构建

### 步骤 1：安装 Emscripten

```bash
# 克隆 emsdk
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk

# 安装最新版本
./emsdk install latest
./emsdk activate latest

# 设置环境变量
source ./emsdk_env.sh
```

### 步骤 2：准备 OpenCV

```bash
cd /path/to/libcimbar

# 克隆 OpenCV（如果尚未存在）
git clone https://github.com/opencv/opencv.git opencv4
cd opencv4

# 创建 WASM 构建目录
mkdir opencv-build-wasm
cd opencv-build-wasm

# 构建 OpenCV for WebAssembly
python3 ../platforms/js/build_js.py build_wasm --emscripten_dir=/path/to/emsdk/upstream/emscripten
```

### 步骤 3：构建 Cimbar WASM

```bash
cd /path/to/libcimbar

# 创建构建目录
mkdir build-wasm
cd build-wasm

# 配置 CMake
emcmake cmake .. -DUSE_WASM=1 -DOPENCV_DIR=/path/to/libcimbar/opencv4

# 编译
make -j$(nproc) install

# 打包结果
cd ../web/
tar -czvf cimbar.wasm.tar.gz cimbar_js.js cimbar_js.wasm index.html main.js
```

## 验证构建

### 1. 检查文件大小

```bash
ls -lh web/cimbar_js.*
# cimbar_js.js 应该约为 50KB - 200KB
# cimbar_js.wasm 应该约为 1MB - 3MB
```

### 2. 测试 WebAssembly 模块

创建一个简单的测试 HTML 文件：

```html
<!DOCTYPE html>
<html>
<head>
    <title>Cimbar WASM Test</title>
</head>
<body>
    <h1>Testing Cimbar WebAssembly</h1>
    <div id="status">Loading...</div>
    
    <script src="cimbar_js.js"></script>
    <script>
        // 测试模块加载
        const Module = {
            onRuntimeInitialized: function() {
                document.getElementById('status').innerHTML = '✅ WebAssembly module loaded successfully!';
                
                // 测试解码器创建
                try {
                    const decoder = new Module.CimbarWasmDecoder();
                    console.log('Decoder created successfully');
                    decoder.configure(2, 3, true);
                    console.log('Decoder configured successfully');
                } catch (error) {
                    console.error('Error testing decoder:', error);
                }
            },
            onError: function(error) {
                document.getElementById('status').innerHTML = '❌ Error loading WebAssembly: ' + error;
            }
        };
        
        createCimbarModule(Module);
    </script>
</body>
</html>
```

### 3. 在本地服务器中测试

```bash
# 进入 web 目录
cd web/

# 启动简单的 HTTP 服务器
# Python 3:
python3 -m http.server 8000

# Python 2:
python -m SimpleHTTPServer 8000

# Node.js (如果安装了 http-server):
npx http-server -p 8000

# 然后在浏览器中访问 http://localhost:8000
```

## 故障排除

### 常见问题

1. **构建失败：找不到 OpenCV**
   ```
   错误: Could not find OpenCV
   解决: 确保正确设置了 OPENCV_DIR 参径
   ```

2. **WebAssembly 加载失败**
   ```
   错误: WASM module loading failed
   解决: 确保通过 HTTP 服务器访问，而不是直接打开文件
   ```

3. **内存不足错误**
   ```
   错误: Out of memory
   解决: 增加 Docker 容器内存限制或关闭其他应用程序
   ```

### 调试技巧

1. **启用详细输出**
   ```bash
   # 在构建时添加调试标志
   emcmake cmake .. -DUSE_WASM=1 -DCMAKE_BUILD_TYPE=Debug
   ```

2. **检查浏览器控制台**
   - 打开开发者工具 (F12)
   - 查看 Console 标签页的错误信息
   - 检查 Network 标签页确保文件正确加载

3. **验证文件完整性**
   ```bash
   # 检查 WASM 文件格式
   file web/cimbar_js.wasm
   # 应该显示: WebAssembly (wasm) binary module
   ```

## 部署到生产环境

### 1. 优化构建

```bash
# 创建优化版本
emcmake cmake .. -DUSE_WASM=1 -DCMAKE_BUILD_TYPE=Release -DOPENCV_DIR=/path/to/opencv4
make -j$(nproc) install
```

### 2. 启用 GZIP 压缩

在您的 Web 服务器中启用 GZIP 压缩来减少 WASM 文件大小：

**Apache (.htaccess):**
```apache
<Files "*.wasm">
    Header set Content-Encoding gzip
    Header set Content-Type application/wasm
</Files>
```

**Nginx:**
```nginx
location ~* \.wasm$ {
    gzip_static on;
    add_header Content-Type application/wasm;
}
```

### 3. 设置正确的 MIME 类型

确保服务器为 `.wasm` 文件设置正确的 MIME 类型：
```
application/wasm
```

## 更新和维护

### 更新到最新版本

```bash
# 更新主项目
git pull origin master
git submodule update --recursive

# 重新构建
docker run --mount type=bind,source="$(pwd)",target="/usr/src/app" -it emscripten/emsdk:3.1.69 bash /usr/src/app/package-wasm.sh
```

### 清理构建文件

```bash
# 清理构建文件
rm -rf build-wasm build-asmjs opencv4/opencv-build-wasm
rm -f web/cimbar_js.js web/cimbar_js.wasm web/cimbar.wasm.tar.gz
```

## 获取帮助

如果您在构建过程中遇到问题：

1. 检查 [项目 Issues](https://github.com/sz3/libcimbar/issues)
2. 参考 [官方文档](https://github.com/sz3/libcimbar)
3. 确保使用推荐的 Docker 镜像版本
4. 检查您的系统是否有足够的内存和磁盘空间

构建成功后，您就可以使用 `cimbar_scanner.html` 来进行离线 Cimbar 扫描了！