
<script lang="ts">
    import { onMount } from 'svelte';
    import { connectors, streams, webrtc } from '@roboflow/inference-sdk';

    let videoElement: HTMLVideoElement;

    onMount(() => {
        let connection: any;

        async function start() {
            const camera = await streams.useCamera();

            console.log('1 - Cámara obtenida:', camera);

            const connector = connectors.withProxyUrl('/api/init-webrtc', {
                turnConfigUrl: "/api/turn-config"
            });

            console.log(
                '¿Tiene getIceServers?:',
                typeof connector.getIceServers
            );

            if (connector.getIceServers) {
                try {
                    const iceServers = await connector.getIceServers();

                    console.log('ICE servers:', iceServers);
                } catch (error) {
                    console.error(
                        'Error obteniendo ICE servers:',
                        error
                    );
                }
            }
            connection = await webrtc.useStream({
                source: camera,
                connector,
                wrtcParams: {
                    workspaceName: 'asier-cfans',
                    workflowId: 'buddy-1nkdy',
                    streamOutputNames: [],
                    dataOutputNames: ['predictions'],
                    processingTimeout: 3600,
                    requestedPlan: 'webrtc-gpu-medium',
                    requestedRegion: 'us'
                },
                onData: (data: any) => {
                    console.log('Predictions:', JSON.stringify(data, null, 2));
                }
            });
            console.log('2 - WebRTC conectado');
            if (videoElement && camera) {
                videoElement.srcObject = camera;
                await videoElement.play();
            }
        }
        start().catch((error) => {
            console.error(
                'Error completo:',
                JSON.stringify(error, null, 2)
            );

            console.error('Error starting Buddy:', error);
        });
        return () => {
            connection?.close?.();
        };
    });
</script>

<svelte:head>
    <title>Third hand Buddy</title>
    <meta
        name="description"
        content="Third hand Buddy -- a tools assistant with artificial vision"
    />
</svelte:head>

<main>
    <h1>Third hand Buddy</h1>
    <video
        bind:this={videoElement}
        autoplay
        playsinline
        muted
    ></video>
</main>

<style>
    main {
        max-width: 1000px;
        margin: 0 auto;
        padding: 2rem;
    }
    video {
        width: 100%;
        max-width: 900px;
        border-radius: 12px;
        display: block;
    }
</style>

