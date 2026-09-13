import { json } from "@sveltejs/kit";
import { InferenceHTTPClient } from "@roboflow/inference-sdk";
import { ROBOFLOW_API_KEY } from "$env/static/private";

export async function GET() {
    if (!ROBOFLOW_API_KEY) {
        return json(
            { error: "ROBOFLOW_API_KEY was not found" },
            { status: 500 }
        );
    }

    try {
        const client = InferenceHTTPClient.init({
            apiKey: ROBOFLOW_API_KEY,
            serverUrl: "https://serverless.roboflow.com"
        });

        const iceServers = await client.fetchTurnConfig();

        return json({ iceServers });
    } catch (error) {
        console.error("Error fetching Turn config:", error);

        return json(
            { error: "Could not fetch TURN config" },
            { status: 500 }
        );
    }
}

