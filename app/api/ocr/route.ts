import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'Image file is required' },
        { status: 400 }
      );
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (imageFile.size > maxSize) {
      return NextResponse.json(
        { error: '图片大小不能超过10MB' },
        { status: 400 }
      );
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: '不支持的图片格式，请上传 JPG、PNG、GIF 或 WEBP 格式' },
        { status: 400 }
      );
    }

    // In production, this would:
    // 1. Upload the image to Supabase Storage
    // 2. Call OCR API (like Tencent OCR, Baidu OCR, or Azure Computer Vision)
    // 3. Return the recognized text

    /*
    // Example: Azure Computer Vision OCR
    const visionResponse = await fetch(
      `https://${process.env.AZURE_COMPUTER_VISION_ENDPOINT}/vision/v3.1/ocr`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Ocp-Apim-Subscription-Key': process.env.AZURE_COMPUTER_VISION_KEY,
        },
        body: imageBuffer,
      }
    );
    */

    // Demo response - in production this would be the actual OCR result
    // The actual implementation should use a real OCR service
    const demoText = '这是一段模拟的图片OCR识别结果。在生产环境中，这里会调用腾讯云OCR、百度OCR或Azure Computer Vision等API进行真实的文字识别。建议使用移动端的拍照翻译功能获取更准确的结果。';

    return NextResponse.json({
      text: demoText,
      success: true,
    });
  } catch (error) {
    console.error('Error processing image:', error);
    return NextResponse.json(
      { error: '图片处理失败，请重试' },
      { status: 500 }
    );
  }
}