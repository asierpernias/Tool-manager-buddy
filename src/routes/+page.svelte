<script lang="ts">
    import { onMount } from 'svelte';
    import { writable } from 'svelte/store';
    import { connectors, streams, webrtc } from '@roboflow/inference-sdk';

    let videoElement: HTMLVideoElement;

    type Prediction = {
        x: number;
        y: number;
        width: number;
        height: number;
        confidence: number;
        class: string
    };

    const ToolNames: Record<string, string> = {
        Hammer: 'hammer',
        Caliper: 'caliper',
        'WD-40': "WD-40"
    };

    let detectedObjects = new Set<string>();
    let firstDetection = true;
    const boxed = writable<Prediction[]>([]);

    function speak(text: string){
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1;

        window.speechSynthesis.speak(utterance);
    }

    function updateObjectStates(predictions: Prediction[]){
        const currentObjects = new Set(
            predictions
                .filter((prediction) => prediction.confidence >= 0.5)
                .map((prediction) => prediction.class)
        );

        if (firstDetection){
            detectedObjects = currentObjects;
            firstDetection = false;
            return;
        }

        for (const objectClass of Object.keys(ToolNames)){
            const wasDetected = detectedObjects.has(objectClass);
            const isDetected = currentObjects.has(objectClass);

            if (wasDetected && !isDetected){
                speak(`You have taken the ${ToolNames[objectClass]}`);
            }

            if (!wasDetected && isDetected){
                speak(`The ${ToolNames[objectClass]} has returned`)
            }
        }

        detectedObjects = currentObjects;
    }

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
                    const predictions =
                        data.serialized_output_data?.predictions?.predictions ?? [];

                    boxed.set(
                        [...predictions].filter(
                            (prediction: Prediction) => prediction.confidence >= 0.35
                        )
                    );

                    updateObjectStates(predictions);
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
    <div class="video-container"> 
        <video
            bind:this={videoElement}
            autoplay
            playsinline
            muted
        ></video>

        {#each $boxed as box}
            <div 
                class="box"
                style="
                    left: {(box.x - box.width / 2) / 640 * 100}%;
                    top: {(box.y - box.height / 2) / 480 * 100}%;
                    width: {(box.width) / 640 * 100}%;
                    height: {(box.height) / 480 * 100}%;
                "
            >
                <span>
                    {ToolNames[box.class] ?? box.class}
                    {Math.round(box.confidence * 100)}%
                </span>
            </div>
        {/each}
    </div>
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

    .video-container {
        position: relative;
        width: 100%;
        max-width: 900px;
    }

    .video-container video {
        width: 100%;
        display: block;
    }

    .box {
        position: absolute;
        border: 3px solid;
        box-sizing: border-box;
    }

    .box span{
        position: absolute;
        top: -28px;
        left: -3px;
        padding: 4px 8px;
        background: black;
        color: white;
        font-size: 14px;
        font-weight: bold;
        white-space: nowrap;
    }
</style>