import { error, json } from "@sveltejs/kit";
import { InferenceHTTPClient } from "@roboflow/inference-sdk";
import { ROBOFLOW_API_KEY } from "$env/static/private";

export async function POST({request}) {
        const {offer, wrtcParams} = await request.json();

        const apiKey = ROBOFLOW_API_KEY;

        if (!apiKey){
            return json({error: "ROBOFLOW_API_KEY not found"}, {status: 500});
        }

        const client = InferenceHTTPClient.init({
            apiKey,
            serverUrl: 'https://serverless.roboflow.com'
        });

        try {
            const answer = await client.initializeWebrtcWorker({
                offer,
                workspaceName: wrtcParams.workspaceName,
                workflowId: wrtcParams.workflowId,
                config: {
                    streamOutputNames: wrtcParams.streamOutputNames,
                    dataOutputNames: wrtcParams.dataOutputNames,
                    workflowsParameters: wrtcParams.workflowsParameters,
                    requestedPlan: wrtcParams.requestedPlan,
                    requestedRegion: wrtcParams.requestedRegion,
                    realtimeProcessing: wrtcParams.realtimeProcessing,
                }
            });

            console.log('ROBoflow answer:', JSON.stringify(answer, null, 2));
            return json(answer);
        } catch (error){
            console.error("Error initialazing WebRTC:", error);

            return json(
                {error: "The conexion with Roboflow failed"},
                {status: 500}
            );
        }
            
}       