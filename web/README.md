# 离线 Cimbar 扫描器

这是一个完全离线的 Cimbar 条码识别网页应用，支持通过摄像头实时扫描或上传图像文件来解码 Cimbar 条码。

## 功能特性

- 📱 **摄像头实时扫描** - 使用手机或电脑摄像头实时扫描 Cimbar 条码
- 📁 **文件上传解码** - 支持上传多个 Cimbar 帧图像进行批量解码
- 🔄 **多帧重建** - 自动处理多个帧以重建完整文件
- 📥 **文件导出** - 解码完成后可直接下载原始文件
- 🌐 **完全离线** - 无需网络连接，支持离线使用
- 📲 **PWA 支持** - 可安装为手机应用程序
- 🎨 **现代界面** - 响应式设计，支持移动设备

## 快速开始

### 方法 1：直接使用（推荐）

1. 在浏览器中打开 `cimbar_scanner.html`
2. 点击"启动摄像头"开始扫描，或上传图像文件
3. 等待解码完成后下载结果文件

### 方法 2：本地服务器

```bash
# 进入 web 目录
cd web/

# 启动 HTTP 服务器
python3 -m http.server 8000

# 在浏览器中访问
# http://localhost:8000/cimbar_scanner.html
```

## 使用说明

### 摄像头扫描

1. **启动摄像头**：点击"启动摄像头"按钮
2. **对准条码**：将摄像头对准 Cimbar 条码
3. **自动识别**：系统会自动检测并解码条码帧
4. **切换摄像头**：如有多个摄像头可点击"切换摄像头"
5. **手动捕获**：也可以点击"手动捕获"进行单帧解码

### 文件上传

1. **选择文件**：点击上传区域或拖拽文件
2. **支持格式**：PNG、JPG、JPEG 格式的 Cimbar 帧图像
3. **批量上传**：可同时选择多个文件
4. **开始解码**：点击"解码文件"按钮开始处理

### 解码过程

- 系统会自动处理多个帧
- 显示实时进度和已解码帧数
- 当收集到足够的帧后会自动重建文件
- 解码完成后显示下载链接

## 技术要求

### WebAssembly 模块构建

要获得完整的解码功能，需要构建 WebAssembly 模块：

1. 查看 `build_instructions.md` 了解详细构建步骤
2. 使用 Docker 构建（推荐）：
   ```bash
   docker run --mount type=bind,source="$(pwd)",target="/usr/src/app" -it emscripten/emsdk:3.1.69 bash /usr/src/app/package-wasm.sh
   ```
3. 构建完成后会生成 `cimbar_js.js` 和 `cimbar_js.wasm` 文件

### 浏览器支持

- Chrome 57+ / Safari 11+ / Firefox 52+ / Edge 16+
- 支持 WebAssembly 的现代浏览器
- 摄像头功能需要 HTTPS 或 localhost 环境

## 文件说明

```
web/
├── cimbar_scanner.html       # 主要的扫描器网页
├── cimbar_decoder_wasm.js    # WebAssembly 解码器接口
├── decoder.html              # 原始解码器（仅文件上传）
├── decoder.js                # 解码器 JavaScript 库
├── index.html                # Cimbar 编码器
├── main.js                   # 编码器主要逻辑
├── pwa.json                  # PWA 清单文件
├── sw.js                     # Service Worker（离线支持）
├── build_instructions.md     # 构建说明
└── README.md                 # 本文件
```

## 离线使用

应用支持完全离线使用：

1. **Service Worker**：自动缓存所有必要文件
2. **PWA 支持**：可安装为独立应用
3. **本地处理**：所有解码过程在浏览器中进行

### 安装为 PWA

1. 在支持的浏览器中打开应用
2. 点击地址栏的"安装"图标
3. 确认安装后即可离线使用

## 故障排除

### 常见问题

1. **摄像头无法启动**
   - 检查浏览器是否允许摄像头访问
   - 确保在 HTTPS 或 localhost 环境下使用

2. **WebAssembly 模块未找到**
   - 按照 `build_instructions.md` 构建 WASM 模块
   - 确保 `cimbar_js.js` 和 `cimbar_js.wasm` 文件存在

3. **解码失败**
   - 确保图像清晰、光线充足
   - 尝试上传更多 Cimbar 帧图像
   - 检查图像格式是否支持

4. **文件无法下载**
   - 检查浏览器下载设置
   - 确保有足够的存储空间

### 调试模式

打开浏览器开发者工具（F12）查看详细日志信息。

## 性能优化

- **图像质量**：使用高分辨率、清晰的 Cimbar 图像
- **光线条件**：确保充足且均匀的光线
- **稳定扫描**：保持摄像头稳定，避免抖动
- **多帧收集**：让系统收集足够多的帧以提高成功率

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

基于 libcimbar 项目的 MPL-2.0 许可证。

## 相关链接

- [libcimbar 项目](https://github.com/sz3/libcimbar)
- [在线编码器](https://cimbar.org)
- [Android 解码应用](https://github.com/sz3/cfc)