import { json } from "@sveltejs/kit";
import { ROBOFLOW_API_KEY } from "$env/static/private";

export async function GET() {
    if (!ROBOFLOW_API_KEY) {
        return json(
            { error: "ROBOFLOW_API_KEY was not found" },
            { status: 500 }
        );
    }

    try {
        const response = await fetch(
            `https://api.roboflow.com/webrtc_turn_config?api_key=${ROBOFLOW_API_KEY}`,
            {method: "GET", headers: {"Content-Type": "application/json"}}
        );

        const iceServers = response.ok ? (await response.json()) : null;
        return json({ iceServers });
    } catch (error) {
        console.error("Error fetching Turn config:", error);

        return json(
            { error: "Could not fetch TURN config" },
            { status: 500 }
        );
    }
}

