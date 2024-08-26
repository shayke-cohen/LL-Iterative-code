import { promises as fs } from 'node:fs';
import cache from "./cache";

// todo: migrate to new app ID (Ace app)
const appID = '8458cf37-de63-4d33-b188-8da4dd203a7d';
// todo: use as secret (env var)
const appSecret = '08cc4854-2bb6-40ed-b3c8-a113ddb88e8e';
const instanceId = '914675a9-30e7-4abc-98ea-e12ccfff252a';

async function createToken(): Promise<string> {
    const fetch = (await import('node-fetch')).default;
    const body = JSON.stringify({
        grant_type: 'client_credentials',
        client_id: appID,
        client_secret: appSecret,
        instance_id: instanceId,
    });

    const response = await fetch('https://www.wixapis.com/oauth2/token', {
        method: 'POST',
        body: body,
        headers: {
            'Content-Type': 'application/json',
        },
    });

    const json: any = await response.json();
    return json.access_token;
}

interface UploadUrlResponse {
    uploadUrl: string;
    // Add other properties if necessary
}

async function createUploadUrl(token: string, filename: string): Promise<string> {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://www.wixapis.com/site-media/v1/files/generate-upload-url', {
        method: 'POST',
        headers: {
            Authorization: token,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            mimeType: 'image/png',
            fileName: filename,
            namespace: 'NO_NAMESPACE',
        }),
    });

    const json: any = await response.json() as UploadUrlResponse;
    return json.uploadUrl;
}

async function uploadFile(uploadUrl: string, fileName: string, fileContent: Buffer): Promise<any> {
    const fetch = (await import('node-fetch')).default;
    const params = new URLSearchParams({ filename: fileName });
    const urlWithParams = `${uploadUrl}?${params.toString()}`;

    const headers = {
        'Content-Type': 'image/png',
    };

    try {
        const response = await fetch(urlWithParams, {
            method: 'PUT',
            headers: headers,
            body: fileContent,
        });

        const json = await response.json();
        return json;
    } catch (error) {
        console.error('Error uploading file', error);
        return null;
    }
}

export default async function uploadImage(path: string): Promise<string> {
    const fileContent = await fs.readFile(path);
    const fromCache = await cache.getFromCache(fileContent);
    if (fromCache) {
        return fromCache;
    }

    const token = await createToken();
    const uploadUrl = await createUploadUrl(token, path);
    const response = await uploadFile(uploadUrl, path, fileContent);
    const url = response.file.url;

    await cache.setInCache(fileContent, url);
    return url;
}