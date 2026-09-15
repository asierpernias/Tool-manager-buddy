import { json } from "@sveltejs/kit";
import { ROBOFLOW_API_KEY } from "$env/static/private";

export async function POST({ request }) {
    const { offer, wrtcParams } = await request.json();

    if (!ROBOFLOW_API_KEY) {
        return json({ error: "ROBOFLOW_API_KEY not found" }, { status: 500 });
    }

    try {
        const { InferenceHTTPClient } = await import("@roboflow/inference-sdk");

        const client = InferenceHTTPClient.init({
            apiKey: ROBOFLOW_API_KEY,
            serverUrl: 'https://serverless.roboflow.com'
        });

        const answer = await client.initializeWebrtcWorker({
            offer,
            workflowSpec: wrtcParams.workflowSpec,
            config: {
                imageInputName: wrtcParams.imageInputName,
                streamOutputNames: wrtcParams.streamOutputNames,
                dataOutputNames: wrtcParams.dataOutputNames
            }
        });

        console.log('Roboflow answer:', JSON.stringify(answer, null, 2));
        return json(answer);
    } catch (error) {
        console.error("Error initializing WebRTC:", error);
        return json(
            { error: "The connection with Roboflow failed", detail: String(error) },
            { status: 500 }
        );
    }
}