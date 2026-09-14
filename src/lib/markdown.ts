import { marked } from 'marked';

/**
 * رندر مارک‌داون به HTML.
 * محتوای هاب توسط خود مالک نوشته می‌شود، بنابراین نیازی به sanitizer سنگین نیست؛
 * با این حال تگ‌های script حذف می‌شوند تا خطای سهوی هم بی‌اثر بماند.
 */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false, gfm: true, breaks: true }) as string;
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');
}
