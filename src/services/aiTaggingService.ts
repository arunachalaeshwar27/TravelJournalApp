/**
 * AI Image Tagging Service — Dual Provider Comparison (FREE)
 *
 * Both providers use Hugging Face Inference API (free tier, no billing needed).
 *
 *  🔵 BLIP  — Salesforce/blip-image-captioning-large
 *             Generates a natural-language caption → extracted as travel tags
 *
 *  🟢 ViT   — google/vit-base-patch16-224
 *             Image classification → top scoring ImageNet labels as tags
 *
 * Online  → call both in parallel
 * Offline → enqueue; retry when network resumes
 */

import RNFS from 'react-native-fs';
import {
  enqueueTaggingItem,
  getPendingTaggingItems,
  removeTaggingItem,
  incrementTaggingAttempts,
} from '@/database/syncQueueRepository';
import { updatePhotoTags } from '@/database/entryRepository';
import { TaggingQueueItem } from '@/types';
import { generateId } from '@/utils/generateId';
import { HUGGING_FACE_TOKEN, GOOGLE_VISION_API_KEY, OPENAI_API_KEY } from '@env';

const MAX_TAGS = 8;

const HF_BLIP_URL =
  'https://router.huggingface.co/hf-inference/models/Salesforce/blip-image-captioning-base';

const HF_VIT_URL =
  'https://router.huggingface.co/hf-inference/models/google/vit-base-patch16-224';

// Words to strip when converting a caption into tags
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'in', 'on', 'at', 'to', 'for', 'with', 'of', 'and', 'or',
  'it', 'its', 'there', 'this', 'that', 'very', 'some', 'from', 'by',
  'photo', 'picture', 'image', 'video', 'arafed', 'araffed', 'there',
  'group', 'couple', 'people', 'man', 'woman', 'standing', 'sitting',
  'front', 'background', 'foreground', 'blurry', 'view', 'close',
]);

// ─── Shared: read local image as binary (works on both iOS & Android) ─────────

async function getImageBytes(imageUri: string): Promise<ArrayBuffer> {
  const base64 = await RNFS.readFile(imageUri, 'base64');
  // atob is available in React Native (JSC & Hermes)
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ─── Shared: HF error helper ──────────────────────────────────────────────────

async function extractHFError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body?.error) return `${response.status}: ${body.error}`;
  } catch {}
  return `${response.status}: ${response.statusText}`;
}

// ─── Provider 1: BLIP image captioning ───────────────────────────────────────

// ─── Provider 1: OpenAI GPT-4o ───────────────────────────────────────────────

async function tagWithOpenAI(imageUri: string): Promise<string[]> {
  if (!OPENAI_API_KEY) return [];
  const base64 = await RNFS.readFile(imageUri, 'base64');
  const imageUrl = `data:image/jpeg;base64,${base64}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Provide exactly 5 keywords for this travel photo as a comma-separated list. Focus on location, activity, and mood. Avoid generic words like "travel" or "photo".',
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      max_tokens: 100,
    }),
  });

  const data = await response.json();
  if (data?.error) throw new Error(data.error.message);

  const content = data.choices?.[0]?.message?.content ?? '';
  return content
    .toLowerCase()
    .replace(/[^a-z0-9,\s]/g, '')
    .split(',')
    .map((tag: string) => tag.trim())
    .filter((tag: string) => tag.length > 2 && !STOP_WORDS.has(tag));
}

// ─── Provider 2: Google Cloud Vision ──────────────────────────────────────────

async function tagWithGoogleVision(imageUri: string): Promise<string[]> {
  if (!GOOGLE_VISION_API_KEY) return [];
  const base64 = await RNFS.readFile(imageUri, 'base64');

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: 'LABEL_DETECTION', maxResults: 10 }],
          },
        ],
      }),
    },
  );

  const data = await response.json();
  if (data?.error) throw new Error(data.error.message);

  const labels = data.responses?.[0]?.labelAnnotations ?? [];
  return labels
    .map((label: any) => label.description.toLowerCase())
    .filter((tag: string) => tag.length > 2 && !STOP_WORDS.has(tag))
    .slice(0, 8);
}

// (HF fallbacks moved below)
async function tagWithBLIP(imageUri: string): Promise<string[]> {
  const bytes = await getImageBytes(imageUri);
  const data: Array<{ generated_text: string }> = await hfRequest(HF_BLIP_URL, bytes);
  const caption = data[0]?.generated_text ?? '';

  return caption
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 5);
}

async function tagWithViT(imageUri: string): Promise<string[]> {
  const bytes = await getImageBytes(imageUri);
  const data: Array<{ label: string; score: number }> = await hfRequest(HF_VIT_URL, bytes);

  return data
    .filter(item => item.score > 0.15)
    .map(item => item.label.split(',')[0].toLowerCase())
    .filter(tag => !STOP_WORDS.has(tag))
    .slice(0, 5);
}

// ─── Public comparison result type ───────────────────────────────────────────

export interface TagComparisonResult {
  /** Merged, deduplicated tags — applied to the entry */
  mergedTags: string[];
  openAITags: string[];
  googleTags: string[];
  openAIError?: string;
  googleError?: string;
}

// ─── tagPhotoOnline — calls both providers in parallel ───────────────────────

export async function tagPhotoOnline(imageUri: string): Promise<TagComparisonResult> {
  const [openAIResult, googleResult, blipResult, vitResult] = await Promise.allSettled([
    tagWithOpenAI(imageUri),
    tagWithGoogleVision(imageUri),
    tagWithBLIP(imageUri),
    tagWithViT(imageUri),
  ]);

  const openAITags = openAIResult.status === 'fulfilled' ? openAIResult.value : [];
  const googleTags = googleResult.status === 'fulfilled' ? googleResult.value : [];
  const blipFallback = blipResult.status === 'fulfilled' ? blipResult.value : [];
  const vitFallback = vitResult.status === 'fulfilled' ? vitResult.value : [];

  const openAIError = openAIResult.status === 'rejected' ? String(openAIResult.reason) : undefined;
  const googleError = googleResult.status === 'rejected' ? String(googleResult.reason) : undefined;
console.log("openAITags",openAIResult );
console.log('googleTags',googleResult)
console.log('blipFallback',blipFallback)
console.log('vitFallback',vitFallback)

  // Merge Priority: Google (Labels) + OpenAI (Concepts) + HF (Classification Fallback)
  // Deduplicate and limit
  const mergedTags = [...new Set([
    ...googleTags,
    ...openAITags,
    ...(googleTags.length === 0 ? vitFallback : []),
    ...(openAITags.length === 0 ? blipFallback : [])
  ])].slice(0, MAX_TAGS);

  return { mergedTags, openAITags, googleTags, openAIError, googleError };
}

/**
 * Called when a new photo is added.
 * Online  → call both HF models in parallel, return comparison result.
 * Offline → enqueue for retry on network restore.
 */
export async function processPhoto(opts: {
  photoId: string;
  entryId: string;
  localUri: string;
  isOnline: boolean;
}): Promise<TagComparisonResult> {
  const { photoId, entryId, localUri, isOnline } = opts;

  if (isOnline) {
    try {
      
      return await tagPhotoOnline(localUri);
    } catch (e) {
      console.warn('[AI Tagging] Failed, queuing for retry:', e);
      await enqueueForRetry(photoId, entryId, localUri);
      return { 
        mergedTags: [], 
        openAITags: [], 
        googleTags: [], 
        openAIError: String(e) 
      };
    }
  }

  await enqueueForRetry(photoId, entryId, localUri);
  return { mergedTags: [], openAITags: [], googleTags: [] };
}

async function enqueueForRetry(
  photoId: string,
  entryId: string,
  localUri: string,
): Promise<void> {
  const item: TaggingQueueItem = {
    id: generateId(),
    photoId,
    entryId,
    localUri,
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  await enqueueTaggingItem(item);
}

/**
 * Process all pending tagging queue items (called on network restore).
 */
export async function processPendingTaggingQueue(): Promise<void> {
  const items = await getPendingTaggingItems();
  for (const item of items) {
    await incrementTaggingAttempts(item.id);
    try {
      const { mergedTags } = await tagPhotoOnline(item.localUri);
      await updatePhotoTags(item.photoId, mergedTags, 'done');
      await removeTaggingItem(item.id);
    } catch {
      if (item.attempts >= 2) {
        await updatePhotoTags(item.photoId, [], 'failed');
        await removeTaggingItem(item.id);
      }
    }
  }
}

async function hfRequest(url: string, bytes: ArrayBuffer) {
  for (let i = 0; i < 3; i++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HUGGING_FACE_TOKEN}`,
        'Content-Type': 'application/octet-stream',
        Accept: 'application/json',
      },
      body: bytes,
    });

    const text = await response.text();
    

  const cleanText = text.trim();
  
  

// 🔥 safer check using includes instead of startsWith
if (!cleanText.includes("[") && !cleanText.includes("{")) {
  
  return [];
}


    const data = JSON.parse(cleanText);
    if (data?.error?.includes("loading")) {
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  }

  return [];
}
