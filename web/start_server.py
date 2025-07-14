#!/usr/bin/env python3
"""
简单的 HTTP 服务器，用于本地测试 Cimbar 扫描器
支持 HTTPS（摄像头功能需要）和 CORS
"""

import http.server
import socketserver
import ssl
import os
import argparse
import webbrowser
from datetime import datetime

class CimbarHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """自定义请求处理器，添加 CORS 支持和更好的 MIME 类型"""
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()
    
    def guess_type(self, path):
        """改进的 MIME 类型检测"""
        mimetype, encoding = super().guess_type(path)
        
        # 为 WebAssembly 文件设置正确的 MIME 类型
        path_str = str(path)
        if path_str.endswith('.wasm'):
            return 'application/wasm', encoding
        elif path_str.endswith('.js'):
            return 'application/javascript', encoding
        elif path_str.endswith('.json'):
            return 'application/json', encoding
        
        return mimetype, encoding
    
    def log_message(self, format, *args):
        """自定义日志格式"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{timestamp}] {format % args}")

def create_self_signed_cert():
    """创建自签名证书用于 HTTPS"""
    try:
        from cryptography import x509  # type: ignore
        from cryptography.x509.oid import NameOID  # type: ignore
        from cryptography.hazmat.primitives import hashes, serialization  # type: ignore
        from cryptography.hazmat.primitives.asymmetric import rsa  # type: ignore
        import ipaddress
        from datetime import datetime, timedelta
        
        print("正在生成自签名证书...")
        
        # 生成私钥
        key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        
        # 创建证书
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "CA"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, "San Francisco"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Cimbar Scanner"),
            x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
        ])
        
        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.utcnow()
        ).not_valid_after(
            datetime.utcnow() + timedelta(days=365)
        ).add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName("localhost"),
                x509.DNSName("127.0.0.1"),
                x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
            ]),
            critical=False,
        ).sign(key, hashes.SHA256())
        
        # 保存证书和私钥
        with open("server.crt", "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        
        with open("server.key", "wb") as f:
            f.write(key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))
        
        print("✅ 自签名证书已生成: server.crt, server.key")
        return True
        
    except ImportError:
        print("❌ 无法生成证书：缺少 cryptography 库")
        print("请安装: pip install cryptography")
        return False
    except Exception as e:
        print(f"❌ 生成证书失败: {e}")
        return False

def start_server(port=8000, use_https=False, open_browser=True):
    """启动 HTTP 服务器"""
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    print(f"🚀 启动 Cimbar 扫描器服务器...")
    print(f"📁 服务目录: {os.getcwd()}")
    
    # 检查必要的文件
    files_to_check = ['cimbar_scanner.html', 'pwa.json', 'sw.js']
    missing_files = [f for f in files_to_check if not os.path.exists(f)]
    
    if missing_files:
        print(f"⚠️  警告：缺少文件 {missing_files}")
    
    # 检查 WebAssembly 模块
    wasm_files = ['cimbar_js.js', 'cimbar_js.wasm']
    missing_wasm = [f for f in wasm_files if not os.path.exists(f)]
    
    if missing_wasm:
        print(f"⚠️  WebAssembly 模块未找到: {missing_wasm}")
        print("   解码功能将使用模拟器。请参考 build_instructions.md 构建完整模块。")
    
    # 创建服务器
    handler = CimbarHTTPRequestHandler
    httpd = socketserver.TCPServer(("", port), handler)
    
    # 配置 HTTPS
    if use_https:
        if not (os.path.exists("server.crt") and os.path.exists("server.key")):
            if not create_self_signed_cert():
                print("❌ 无法创建 HTTPS 证书，使用 HTTP")
                use_https = False
        
        if use_https:
            try:
                context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
                context.load_cert_chain("server.crt", "server.key")
                httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
                print("🔒 HTTPS 已启用（摄像头功能需要）")
            except Exception as e:
                print(f"❌ HTTPS 配置失败: {e}")
                use_https = False
    
    # 显示服务器信息
    protocol = "https" if use_https else "http"
    server_url = f"{protocol}://localhost:{port}"
    scanner_url = f"{server_url}/cimbar_scanner.html"
    
    print(f"")
    print(f"🌐 服务器已启动:")
    print(f"   主页: {server_url}")
    print(f"   📱 Cimbar 扫描器: {scanner_url}")
    print(f"   🎯 编码器: {server_url}/index.html")
    print(f"   📁 解码器: {server_url}/decoder.html")
    print(f"")
    print(f"💡 提示:")
    print(f"   - 摄像头功能需要 HTTPS 或 localhost")
    print(f"   - 按 Ctrl+C 停止服务器")
    if not use_https:
        print(f"   - 使用 --https 启用 HTTPS 以获得更好的摄像头支持")
    print(f"")
    
    # 自动打开浏览器
    if open_browser:
        print(f"🔗 正在打开浏览器...")
        webbrowser.open(scanner_url)
    
    # 启动服务器
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print(f"\n🛑 服务器已停止")
        httpd.shutdown()

def main():
    parser = argparse.ArgumentParser(description='Cimbar 扫描器本地测试服务器')
    parser.add_argument('-p', '--port', type=int, default=8000, help='端口号 (默认: 8000)')
    parser.add_argument('--https', action='store_true', help='启用 HTTPS (摄像头功能推荐)')
    parser.add_argument('--no-browser', action='store_true', help='不自动打开浏览器')
    
    args = parser.parse_args()
    
    start_server(
        port=args.port,
        use_https=args.https,
        open_browser=not args.no_browser
    )

if __name__ == '__main__':
    main()