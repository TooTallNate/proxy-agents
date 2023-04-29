import * as http from "http";
import * as https from "https";
import type { Readable } from "stream";

export async function toBuffer(stream: Readable): Promise<Buffer> {
    let length = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        length += chunk.length;
        chunks.push(chunk);
    }
    return Buffer.concat(chunks, length);
}

export async function json(stream: Readable): Promise<Record<string, string>> {
    const buf = await toBuffer(stream);
    return JSON.parse(buf.toString('utf8'));
}

export function req(
	url: string | URL,
	opts: https.RequestOptions
): Promise<http.IncomingMessage> {
	return new Promise((resolve, reject) => {
        const href = typeof url === 'string' ? url : url.href;
		(href.startsWith("https:") ? https : http)
			.request(url, opts, resolve)
			.once("error", reject)
			.end();
	});
}