import type { FORM_MODE } from '$lib/constants/formMode';
import type { FileUploadField } from '$lib/types/form';
import { writable, get } from 'svelte/store';
import { API } from './api';
import { getAuthHeader, getCookie } from './keycloak';

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

async function uploadFile(file: File, fieldName: string, maxFileSize: number) {
	if (file.size > maxFileSize) {
		throw new Error(`Exceeds ${fileSizeToString(maxFileSize)} limit`);
	}
	try {
		const endpoint = API.uploadFile;
		const state = sessionStorage.getItem('formParams');
		const sessionParams = state ? (JSON.parse(state) as Record<string, string>) : {};
		if (!sessionParams.attachmentId) {
			throw new Error('AttachmentId not set');
		}
		const username = getCookie('username');
		// const authHeader = await getAuthHeader();
		const form = new FormData();
		form.append(fieldName, file);
		const response = await fetch(
			`${endpoint}?attachmentId=${sessionParams.attachmentId}&username=${username}`,
			{
				method: 'POST',
				// headers: authHeader,
				body: form
			}
		);

		if (response.ok) {
			const result = await response.json();
			return {
				id: result.fileId,
				url: '',
				size: result.size,
				fileType: file.type,
				originalName: result.originalName
			};
		} else {
			const errorResult = await response.json();
			throw new Error(errorResult.error);
		}
	} catch (error) {
		console.error(error);
		throw error;
	}
}

async function mockUploadFile(
	file: File,
	_fieldName: string,
	maxFileSize: number
): Promise<UploadFileData> {
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

export function ensureUpload(
	file: File,
	fieldName: string,
	maxFileSize: number,
	formMode: FORM_MODE
) {
	const key = getFileKey(file);
	const upload = formMode === 'edit' ? uploadFile : mockUploadFile;
	// const upload = uploadFile;
	fileStore.update((map) => {
		if (!map.has(key)) {
			map.set(key, upload(file, fieldName, maxFileSize));
		}
		return map;
	});
}
