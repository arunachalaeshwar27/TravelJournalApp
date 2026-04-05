/**
 * AI Image Tagging Service — Google Cloud Vision API
 *
 * Strategy:
 *  - Server-side tagging is more secure (API key never exposed to client)
 *  - Called after every successful photo upload
 *  - Returns 3–5 high-confidence labels
 *
 * Free alternatives if Vision quota exceeded:
 *  - Clarifai: 1000 operations/month free
 *  - Hugging Face Inference API: free models (microsoft/resnet-50)
 *  - Imagga: 1000 units/month free
 *
 * On-device alternative (for truly offline tagging):
 *  - react-native-tensorflow-lite + MobileNet model
 */

import axios from 'axios';
import { logger } from '../config/logger';

const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';
const MAX_TAGS = 5;
const MIN_CONFIDENCE = 0.65; // Only return tags with >65% confidence

interface VisionLabel {
  description: string;
  score: number;
  topicality: number;
}

interface VisionResponse {
  responses: Array<{
    labelAnnotations?: VisionLabel[];
    error?: { message: string };
  }>;
}

/**
 * Tag an image using Google Cloud Vision API.
 * @param imageUrl - Public Firebase Storage URL
 * @returns Array of tag strings (lowercase)
 */
export async function tagImageWithVision(imageUrl: string): Promise<string[]> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    logger.warn('GOOGLE_VISION_API_KEY not set — skipping AI tagging');
    return [];
  }

  try {
    const { data } = await axios.post<VisionResponse>(
      `${VISION_API_URL}?key=${apiKey}`,
      {
        requests: [
          {
            image: { source: { imageUri: imageUrl } },
            features: [{ type: 'LABEL_DETECTION', maxResults: 10 }],
          },
        ],
      },
      { timeout: 10_000 },
    );

    const response = data.responses[0];

    if (response.error) {
      logger.error('Vision API error', { error: response.error.message });
      return [];
    }

    const labels = response.labelAnnotations ?? [];
    const tags = labels
      .filter(l => l.score >= MIN_CONFIDENCE)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_TAGS)
      .map(l => l.description.toLowerCase().trim());

    logger.debug('AI tagging completed', { imageUrl: imageUrl.slice(0, 60), tags });
    return tags;
  } catch (error) {
    logger.error('AI tagging failed', { error });
    return []; // Fail silently — tags are non-critical
  }
}

/**
 * Free alternative using Hugging Face (no billing required).
 * Model: google/vit-base-patch16-224 (image classification)
 */
export async function tagImageWithHuggingFace(imageUrl: string): Promise<string[]> {
  const HF_TOKEN = process.env.HUGGING_FACE_TOKEN;
  if (!HF_TOKEN) return [];

  try {
    const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageRes.data);

    const { data } = await axios.post<Array<{ label: string; score: number }>>(
      'https://api-inference.huggingface.co/models/google/vit-base-patch16-224',
      imageBuffer,
      {
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/octet-stream',
        },
        timeout: 15_000,
      },
    );

    return data
      .filter(r => r.score > 0.1)
      .slice(0, MAX_TAGS)
      .map(r => r.label.toLowerCase().split(',')[0].trim());
  } catch (error) {
    logger.error('HuggingFace tagging failed', { error });
    return [];
  }
}
