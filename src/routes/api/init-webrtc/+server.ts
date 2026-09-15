import { json } from "@sveltejs/kit";
import { ROBOFLOW_API_KEY } from "$env/static/private";

export async function POST({ request }) {
    const { offer, wrtcParams } = await request.json();

    if (!ROBOFLOW_API_KEY) {
        return json({ error: "ROBOFLOW_API_KEY not found" }, { status: 500 });
    }

    try {

        const body = {
            workflow_configuration: {
                type: "WorkflowConfiguration",
                image_input_name: wrtcParams.image_input_name,
                workflow_parameters: {},
                workflows_thread_pool_workers: 4,
                cancel_thread_pool_tasks_on_exit: true,
                video_metadata_input_name: "video_metadata",
                workflow_specification: wrtcParams.workflowSpec
            },
            api_key: ROBOFLOW_API_KEY,
            webrtc_realtime_processing: true,
            webrtc_offer: {sdp: offer.sdp, type: offer.type},
            webrtc_config: null,
            stream_output: wrtcParams.streamOutputNames,
            data_output: wrtcParams.dataOutputNames,
        };

        const response = await fetch("https://serverless.roboflow.com/initialise_webrtc_worker", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const detail = await response.text();
            return json({error: "The connection with Roboflow failed", detail}, {status: response.status});
        }

        const answer = await response.json();

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