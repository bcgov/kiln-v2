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
	import { ensureUpload, fileStore, getFileKey, type UploadFileData } from '$lib/utils/fileStore';

	const isPortalIntegrated = import.meta.env.VITE_IS_PORTAL_INTEGRATED === 'true';

	type UploadFile = {
		id: string; // client-side id
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

	let files: File[] = $state([]);

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

	const uploadedFiles: UploadFile[] = $derived.by(() => {
		const prefilledFiles = (item?.value ?? []).map((f) => ({
			id: f.id,
			file: new File([], f.originalName),
			data: f
		}));
		const newFiles = files
			.map((file) => ({
				id: getFileKey(file),
				file,
				data: $fileStore.get(getFileKey(file))
			}))
			.filter((f): f is { id: string; file: File; data: Promise<UploadFileData> } => !!f.data);
		return [...prefilledFiles, ...newFiles];
	});

	$effect(() => {
		for (const file of files) {
			ensureUpload(file, maxFileSize);
		}
	})

	async function deleteFile(id: string) {
		files = files.filter((f) => getFileKey(f) !== id);
	}

	function validateFiles(files: ReadonlyArray<File>) {
		const existingFiles = new Set(uploadedFiles.map((f) => f.id));
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

	// Should probably be an async $derived once experimental.async is stable
	const rawValue: Attachment = (element) => {
		Promise.allSettled(uploadedFiles.map((f) => f.data)).then((saveDataResult) => {
			const saveData = saveDataResult.filter((s) => s.status === 'fulfilled').map((s) => s.value);
			element.setAttribute('data-raw-value', JSON.stringify(saveData));
		});
	};
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
				bind:files
				id={item.uuid}
				data-kiln-uuid={item.uuid}
				class={item.class}
				aria-label={labelText}
				multiple={item.attributes.multiple}
				{...a11y.ariaProps}
				{validateFiles}
				{oninput}
				{onblur}
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
