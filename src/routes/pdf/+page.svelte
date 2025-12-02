<script lang="ts">
    import PrivateRoute from "$lib/PrivateRoute.svelte";
    import { InlineLoading, InlineNotification } from "carbon-components-svelte";

    import { API } from "$lib/utils/api";
    import { usePdfLoader } from "$lib/utils/usePdfLoader";

    const loader = usePdfLoader({
        apiEndpoint: API.loadPDFFromICMData,    // your PDF endpoint
        transformParams: (params) => ({ ...params })
    });

    let { isLoading, error, pdfBlob } = loader;

    let pdfUrl: string | null = null;

    // Whenever the blob becomes available, convert to a local URL
    $: if ($pdfBlob) {
        pdfUrl = URL.createObjectURL($pdfBlob);
    }
</script>

<style>
    .pdf-container {
        width: 100%;
        height: calc(100vh - 20px); 
        border: none;
    }
</style>

<PrivateRoute>
    {#if $isLoading}
        <InlineLoading description="Generating PDF..." status="active" />

    {:else if $error}
        <InlineNotification kind="error" title="Error" subtitle={$error} />

    {:else if pdfUrl}
        <!-- Inline PDF viewer -->
        <iframe class="pdf-container" src={pdfUrl} title="pdfForm"></iframe>

    {:else}
        <InlineNotification kind="warning" title="No PDF" subtitle="No PDF was generated." />
    {/if}
</PrivateRoute>
