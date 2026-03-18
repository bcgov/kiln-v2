import type { FileUploadField } from '$lib/types/form';
import { writable, get } from 'svelte/store';

export type UploadFileData = FileUploadField['value'][number];

export const fileStore = writable<Map<string, Promise<UploadFileData>>>(new Map());

export function getFileKey(file: File): string {
	return `${file.name}-${file.size}-${file.lastModified}`;
}

function fileSizeToString(bytes: number, decimals = 2): string {
	if (bytes === 0) return '0 B';
	if (bytes < 0) return 'Invalid size';

	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const k = 1024;
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	if (i >= units.length) {
		return (
			(bytes / Math.pow(k, units.length - 1)).toFixed(decimals) + ' ' + units[units.length - 1]
		);
	}

	return (bytes / Math.pow(k, i)).toFixed(decimals) + ' ' + units[i];
}

async function uploadFile(file: File, maxFileSize: number): Promise<UploadFileData> {
	if (file.size > maxFileSize) {
		throw new Error(`Exceeds ${fileSizeToString(maxFileSize)} limit`);
	}
	const waitTime = Math.random() * 1000;
	await new Promise((f) => setTimeout(f, waitTime));
	return {
		id: crypto.randomUUID(),
		url: '',
		size: file.size,
		fileType: file.type,
		originalName: file.name
	};
}

export function ensureUpload(file: File, maxFileSize: number) {
    const key = getFileKey(file);
    fileStore.update(map => {
        if (!map.has(key)) {
            map.set(key, uploadFile(file, maxFileSize));
        }
        return map;
    });
}
