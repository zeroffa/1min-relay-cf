/**
 * Image processing utilities
 */

export function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const lowerUrl = url.toLowerCase();
  return imageExtensions.some(ext => lowerUrl.includes(ext)) || 
         lowerUrl.includes('data:image/') ||
         lowerUrl.includes('base64');
}

export function extractImageFromContent(content: any): string | null {
  if (typeof content === 'string') {
    return null;
  }
  
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item.type === 'image_url' && item.image_url?.url) {
        return item.image_url.url;
      }
    }
  }
  
  return null;
}
