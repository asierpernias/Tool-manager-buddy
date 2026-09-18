<script lang="ts">
    import { onMount } from 'svelte';
    import { writable } from 'svelte/store';
    import { connectors, streams, webrtc } from '@roboflow/inference-sdk';

    let videoElement: HTMLVideoElement;
    let isLoading = $state(true);

    let globalState = 'Uknown';
    let actualState;

    type Prediction = {
        x: number;
        y: number;
        width: number;
        height: number;
        confidence: number;
        class: string
    };

    const ToolNames: Record<string, string> = {
    Caliper: 'caliper',
    Hammer: 'hammer',
    Metro: 'metro',
    Pliers: 'pliers',
    Ruler: 'ruler',
    'Surface treatment': 'surface treatment',
    'WD-40': 'WD-40'
};

const ToolIcons: Record<string, string> = {
    Caliper: '📐',
    Hammer: '🔨',
    Metro: '📏',
    Pliers: '🔩',
    Ruler: '📋',
    'Surface treatment': '🧴',
    'WD-40': '🔧'
};
    const toolStates = writable<Record<string,'on-table' | 'taken'>>(
        Object.fromEntries(Object.keys(ToolNames).map(k => [k, 'on-table']))
    );

    let detectedObjects = new Set<string>();
    let firstDetection = true;
    const THRESHOLD_FRAMES = 5;
    const missingFrames: Record<string, number> = Object.fromEntries(
        Object.keys(ToolNames).map(k => [k, 0])
    );
    const presentFrames: Record<string, number> = Object.fromEntries(
        Object.keys(ToolNames).map(k=> [k, 0])
    );
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

        if (currentObjects.size == 7) {
            actualState = 'ALL_IN';
        } else if (currentObjects.size == 0) {
            actualState = 'ALL_OUT';
        } else if (currentObjects.size == 1){
            actualState = "ONLY_ONE";
        } else if (currentObjects.size == 4){
            actualState = 'HALF';
        } else {
            actualState = 'Some_In';
        }

        if (actualState !== globalState){
            if (actualState === 'ALL_OUT'){
                speak("All the tools are out.");
                globalState = actualState;
            } else if (actualState === "ALL_IN"){
                speak("All the tools are on the desk.");
                globalState = actualState;
            } else if (actualState === "HALF"){
                speak("Half the tools are in, half out");
                globalState = actualState;
            } else if (actualState === "ONLY_ONE"){
                speak("Only one of your tools is in the table, either you are working, or you are really unorganized");
                globalState = actualState;
            }
        }
        

        if (firstDetection){
            detectedObjects = currentObjects;
            firstDetection = false;
            toolStates.set(
                Object.fromEntries(
                    Object.keys(ToolNames).map(k => [k, currentObjects.has(k) ? 'on-table' : 'taken'])
                ) 
            );
            return;
        }

        const newStates: Record<string, 'on-table' | 'taken'> = {};

        for (const objectClass of Object.keys(ToolNames)){
            const wasDetected = detectedObjects.has(objectClass);
            const isDetected = currentObjects.has(objectClass);

            if (wasDetected && !isDetected){
                missingFrames[objectClass]++;
                presentFrames[objectClass] = 0;

                if (missingFrames[objectClass] === THRESHOLD_FRAMES){
                    speak(`You have taken the ${ToolNames[objectClass]}`);
                    detectedObjects.delete(objectClass);
                }
                
            } else if (!wasDetected && isDetected){
                presentFrames[objectClass]++;
                missingFrames[objectClass] = 0;
                if (presentFrames[objectClass] === THRESHOLD_FRAMES){
                    speak(`You have returned the ${ToolNames[objectClass]}`);
                    detectedObjects.add(objectClass);
                }
            } else {
                missingFrames[objectClass] = 0;
                presentFrames[objectClass] = 0;
            }

            newStates[objectClass] = isDetected ? 'on-table' : 'taken';
        }

        toolStates.set(newStates);
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
                    workflowSpec: {
                        version: "1.0",
                        inputs: [{ type: "InferenceImage", name: "image" }],
                        steps: [
                            {
                                type: "roboflow_core/roboflow_object_detection_model@v2",
                                name: "model",
                                image: "$inputs.image",
                                model_id: "asier-cfans/buddy-1nkdy-4-rfdetr-large-t1"
                            }
                        ],
                        outputs: [
                            {
                                type: "JsonField",
                                name: "predictions",
                                selector: "$steps.model.predictions"
                            }
                        ]
                    },
                    imageInputName: "image",
                    streamOutputNames: [],
                    dataOutputNames: ["predictions"]
                },
                onData: (data: any) => {
                    console.log("RAW DATA", JSON.stringify(data, null, 2));
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
            isLoading = false;
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
    <header>
        <h1>Tool Manager Buddy</h1>
        <p>Warching your workspace!</p>
    </header>    
    <div class="layout">
        <div class="video-container"> 
            {#if isLoading}
                <div class="loading-overlay">
                    <p>Sorry for the wait, Buddy is waking up...</p>
                </div>
            {/if}
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

        <aside>
            <p class="aside-title">Tools availability</p>
            {#each Object.keys(ToolNames) as tool }
                <div class="tool-row" class:taken={$toolStates[tool] === 'taken'}>
                    <span class="tool-icon">{ToolIcons[tool]}</span>
                    <span class="tool-name">{ToolNames[tool]}</span>
                    <span class="tool-status">
                        {$toolStates[tool] === "on-table" ? "on table" : "taken"}
                    </span>
                </div>                
            {/each}
        </aside>
    </div>
</main>

<style>

    :global(body){
        margin: 0;
        background: #f8f8f6;
        font-family: 'Inter', system-ui, sans-serif;
        color: #1a1a1a;
    }

    header {
        padding: 1.5rem 2rem 0;
    }

    header h1 {
        font-size: 1.4rem;
        font-weight: 600;
        margin: 0;
        letter-spacing: -0.02em;
    }

    header p{
        margin: 0.2rem 0 1.2rem;
        margin: 0 auto;
        padding: 0 2rem 2rem;
    }

    main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 0 2rem 2rem;
    }
    video {
        width: 100%;
        max-width: 900px;
        border-radius: 12px;
        display: block;
    }

    .layout  {
        display:flex;
        gap: 1.5rem;
        align-items: flex-start;
    }

    .loading-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 1rem;
        text-align: center;
        padding: 0 2rem;
        z-index: 2;
    }

    .video-container {
        position: relative;
        flex: 1;
        border-radius: 12px;
        overflow: hidden;
        background: #000;
    }

    .video-container video {
        width: 100%;
        display: block;
    }

    .box {
        position: absolute;
        border: 3px solid #fff;
        box-sizing: border-box;
    }

    .box span{
        position: absolute;
        top: -2px;
        left: -2px;
        padding: 3px 7px;
        background: #fff;
        color: #1a1a1a;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        border-radius: 4px 4px 0 0;
    }

    aside {
        width: 200px;
        flex-shrink: 0;
        background: #fff;
        border-radius: 12px;
        padding: 1rem;
        border: 1px solid #ebebeb;
    }

    .aside-title{
        font-size: 0.75rem;
        color: #aaa;
        margin: 0 0  0.8rem 0;
        font-weight: 500;
    }

    .tool-row{
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.6rem 0;
        border-bottom: 1px solid #f0f0f0;
        transition: opacity 0.2s;
    }

    .tool-row:last-child{
        border-bottom: none;
    }

    .tool-icon {
        font-size: 1.2rem;
    }

    .tool-name {
        flex:1;
        font-size: 0.9rem;
        font-weight: 500;
        text-transform: capitalize;
    }

    .tool-status{
        font-size: 0.75rem;
        color: #22c55e;
        font-weight: 500;
    }

    .tool-row.taken .tool-status{
        color: #ef4444;
    }
    .tool-row.taken{
        opacity: 0.5;
    }
</style>