/* This code is subject to the terms of the Mozilla Public License, v.2.0. http://mozilla.org/MPL/2.0/. */
#include "cimb_translator/Config.h"
#include "compression/zstd_decompressor.h"
#include "encoder/Decoder.h"
#include "extractor/Extractor.h"
#include "extractor/SimpleCameraCalibration.h"
#include "extractor/Undistort.h"
#include "fountain/FountainInit.h"
#include "fountain/fountain_decoder_sink.h"
#include "serialize/str.h"

#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <vector>
#include <string>
#include <memory>

using namespace emscripten;

class CimbarWasmDecoder {
private:
    std::unique_ptr<Decoder> decoder;
    std::unique_ptr<fountain_decoder_sink<cimbar::zstd_decompressor<std::ofstream>>> fountain_sink;
    std::ofstream output_file;
    std::string output_filename;
    bool fountain_mode;
    int ecc_bytes;
    int color_bits;

public:
    CimbarWasmDecoder() : fountain_mode(true), ecc_bytes(2), color_bits(3) {
        initializeDecoder();
    }

    void initializeDecoder() {
        decoder = std::make_unique<Decoder>(ecc_bytes, color_bits);
        fountain_mode = true;
    }

    void configure(int ecc, int color_bits_param, bool fountain = true) {
        ecc_bytes = ecc;
        color_bits = color_bits_param;
        fountain_mode = fountain;
        initializeDecoder();
    }

    bool decodeImage(const std::string& image_data, const std::string& output_path) {
        try {
            // 将图像数据转换为OpenCV格式
            std::vector<uchar> buffer(image_data.begin(), image_data.end());
            cv::Mat img = cv::imdecode(buffer, cv::IMREAD_COLOR);
            
            if (img.empty()) {
                return false;
            }

            // 转换为RGB格式
            cv::cvtColor(img, img, cv::COLOR_BGR2RGB);
            cv::UMat uimg = img.getUMat(cv::ACCESS_RW);

            // 图像预处理
            Undistort<SimpleCameraCalibration> und;
            if (!und.undistort(uimg, uimg)) {
                // 如果undistort失败，继续使用原图
            }

            // 提取cimbar区域
            Extractor ext;
            int extract_result = ext.extract(uimg, uimg);
            if (!extract_result) {
                return false;
            }

            // 解码
            if (fountain_mode) {
                if (!fountain_sink) {
                    fountain_sink = std::make_unique<fountain_decoder_sink<cimbar::zstd_decompressor<std::ofstream>>>(
                        output_path, 1024 * 1024, true);
                }
                int bytes_decoded = decoder->decode_fountain(uimg, *fountain_sink, 2, true, 2);
                return bytes_decoded > 0;
            } else {
                output_file.open(output_path, std::ios::binary);
                if (!output_file.is_open()) {
                    return false;
                }
                
                auto decode_func = [this](cv::UMat m, unsigned cm, bool pre, int cc) {
                    return decoder->decode(m, output_file, cm, pre, cc);
                };
                
                int bytes_decoded = decode_func(uimg, 2, true, 2);
                output_file.close();
                return bytes_decoded > 0;
            }
        } catch (const std::exception& e) {
            return false;
        }
    }

    std::string getDecodedData() {
        if (fountain_sink) {
            // 返回解码的数据
            return fountain_sink->get_decoded_data();
        }
        return "";
    }

    bool isDecodingComplete() {
        if (fountain_sink) {
            return fountain_sink->is_complete();
        }
        return false;
    }

    void reset() {
        fountain_sink.reset();
        output_file.close();
        initializeDecoder();
    }
};

// JavaScript绑定
EMSCRIPTEN_BINDINGS(cimbar_decoder_module) {
    class_<CimbarWasmDecoder>("CimbarWasmDecoder")
        .constructor<>()
        .function("configure", &CimbarWasmDecoder::configure)
        .function("decodeImage", &CimbarWasmDecoder::decodeImage)
        .function("getDecodedData", &CimbarWasmDecoder::getDecodedData)
        .function("isDecodingComplete", &CimbarWasmDecoder::isDecodingComplete)
        .function("reset", &CimbarWasmDecoder::reset);
}