<script lang="ts">
	import type { FileUploadField, Item } from '$lib/types/form';
	import {
		buildFieldAria,
		computeIsReadOnly,
		computeIsRequired,
		getFieldLabel
	} from '$lib/utils/helpers';
	import { FileUploaderDropContainer, FileUploaderItem } from 'carbon-components-svelte';
	import PrintRow from './common/PrintRow.svelte';
	import { rulesFromAttributes } from '$lib/utils/validation';
	import type { Attachment } from 'svelte/attachments';

	const isPortalIntegrated = import.meta.env.VITE_IS_PORTAL_INTEGRATED === 'true';

	type UploadFileData = FileUploadField['value'][number];
	type UploadFile = {
		id: string;
		file: File;
		data: Promise<UploadFileData> | UploadFileData;
	};

	let {
		item,
		printing = false
	}: {
		item: Omit<Item, 'value' | 'attributes'> & FileUploadField;
		printing?: boolean;
	} = $props();

	let uploadedFiles: UploadFile[] = $state(
		(item?.value ?? []).map((f) => ({ id: f.id, file: new File([], f.originalName), data: f }))
	);
	const uploadedFileKeys = $derived(uploadedFiles.map((f) => getFileKey(f.file)));

	let touched = $state(false);

	const isRequired = $derived(computeIsRequired(item.is_required, isPortalIntegrated));
	const isReadOnly = $derived(computeIsReadOnly(item.is_read_only, isPortalIntegrated));

	const labelText = $derived(getFieldLabel(item));
	const enableVarSub = $derived(item.attributes?.enableVarSub ?? false);
	const helperText = $derived(item.help_text ?? item.description ?? '');
	const [maxFileSize, fileSizeFormatError] = $derived(fileSizeToBytes(item.attributes.maxFileSize));

	const rules = $derived(rulesFromAttributes(item.attributes, { is_required: isRequired }));

	const a11y = $derived(
		buildFieldAria({
			uuid: item.uuid,
			labelText,
			helperText,
			isRequired,
			readOnly: isReadOnly
		})
	);

	const anyError = $derived.by(() => {
		if (isReadOnly) return '';
		if (fileSizeFormatError) return fileSizeFormatError.message;
		if (!touched) return '';
		return '';
	});

	function oninput() {
		touched = true;
	}

	function onblur() {
		touched = true;
	}

	async function uploadFile(file: File, id: string): Promise<UploadFileData> {
		if (file.size > maxFileSize) {
			throw new Error(`Exceeds ${fileSizeToString(maxFileSize)} limit`);
		}
		const waitTime = Math.random() * 1000;
		await new Promise((f) => setTimeout(f, waitTime));
		return {
			id,
			url: '',
			size: file.size,
			fileType: file.type,
			originalName: file.name
		};
	}

	async function deleteFile(id: string) {
		uploadedFiles = uploadedFiles.filter((f) => f.id !== id);
	}

	function getFileKey(file: File): string {
		return `${file.name}-${file.size}-${file.lastModified}`;
	}

	function onchange({ detail: files }: { detail: ReadonlyArray<File> }) {
		const existingFiles = new Set(uploadedFileKeys);
		for (const file of files) {
			if (existingFiles.has(getFileKey(file))) {
				continue;
			}
			const id = crypto.randomUUID();
			uploadedFiles.push({
				id,
				file,
				data: uploadFile(file, id)
			});
		}
	}

	function validateFiles(files: ReadonlyArray<File>) {
		const existingFiles = new Set(uploadedFileKeys);
		return files.filter((file) => !existingFiles.has(getFileKey(file)));
	}

	function fileSizeToBytes(value: string | number): [number, Error | undefined] {
		if (typeof value === 'number') {
			return [value, undefined];
		}

		const units: Record<string, number> = {
			B: 1,
			KB: 1024,
			MB: 1024 ** 2,
			GB: 1024 ** 3,
			TB: 1024 ** 4
		};

		const match = value
			.trim()
			.toUpperCase()
			.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)?$/);

		if (!match) {
			return [0, new Error(`Form schema error: Invalid file size format: ${value}`)];
		}

		const number = parseFloat(match[1]);
		const unit = match[2] || 'B';

		if (!units[unit]) {
			return [0, new Error(`Form schema error: Unknown unit: ${unit}`)];
		}

		return [Math.round(number * units[unit]), undefined];
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

	// Should probably be an async $derived once experimental.async is stable
	const rawValue: Attachment = (element) => {
		Promise.allSettled(uploadedFiles.map((f) => f.data)).then(saveDataResult => {
			const saveData = saveDataResult.filter(s => s.status === 'fulfilled').map(s => s.value);
			element.setAttribute('data-raw-value', JSON.stringify(saveData));
		});
	}
</script>

<div class="field-container text-input-field">
	<PrintRow {item} {printing} {labelText}>
		{#snippet value()}
			{#each uploadedFiles as { id, data } (id)}
				{#await data then value}
					<div>{value.originalName}</div>
				{:catch}
					<!-- omit errored files -->
				{/await}
			{/each}
		{/snippet}
	</PrintRow>

	<div class="web-input" class:visible={!printing && item.visible_web !== false}>
		<p id={a11y.labelId} class="bx--label" class:moustache={enableVarSub}>
			<span class:required={isRequired}>{@html labelText}</span>
		</p>
		{#if helperText}
			<p id={a11y.helperId} class="bx--label-description" class:moustache={enableVarSub}>
				{helperText}
			</p>
		{/if}
		{#if !isReadOnly}
			<FileUploaderDropContainer
				id={item.uuid}
				data-kiln-uuid={item.uuid}
				class={item.class}
				aria-label={labelText}
				multiple={item.attributes.multiple}
				{...a11y.ariaProps}
				{validateFiles}
				{oninput}
				{onblur}
				on:change={onchange}
				{@attach rawValue}
			/>
		{/if}
		{#if anyError}
			<div
				id={a11y.errorId}
				class="bx--form-requirement"
				class:moustache={enableVarSub}
				role="alert"
			>
				{anyError}
			</div>
		{/if}
		{#each uploadedFiles as { id, file, data } (id)}
			{#await data}
				<FileUploaderItem {id} name={file.name} status="uploading" />
			{:then value}
				<FileUploaderItem
					{id}
					name={value.originalName}
					status="edit"
					iconDescription="Delete file"
					on:delete={() => {
						deleteFile(id);
					}}
				/>
			{:catch error}
				<FileUploaderItem
					{id}
					name={file.name}
					status="edit"
					invalid
					errorSubject={error.message}
					iconDescription="Delete file"
					on:delete={() => {
						deleteFile(id);
					}}
				/>
			{/await}
		{/each}
	</div>
</div>

<style>
	.bx--form-requirement {
		color: var(--cds-text-error, red);
		display: block;
		max-height: none;
		margin-top: 0;
		margin-bottom: 0.5rem;
		&:last-child {
			margin-bottom: 0;
		}
	}
</style>
