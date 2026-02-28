import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { DefaultAzureCredential } from "@azure/identity";

type Role = "user" | "assistant";
interface ChatMessage { role: Role; content: string; }
interface ClientPayload { messages: ChatMessage[]; }

interface AgentOutput {
    type?: string;
    content?: Array<{
        text?: string;
    }>;
}

interface AgentResponse {
    output?: AgentOutput[];
}


function getEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing required environment variable: ${name}`);
    return v;
}

async function handler(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
    try {
        if (req.method !== "POST") {
            return { status: 405, headers: { Allow: "POST" }, jsonBody: { error: "Method Not Allowed" } };
        }

        const payload = (await req.json()) as ClientPayload | undefined;
        if (!payload?.messages?.length) {
            return { status: 400, jsonBody: { error: "Invalid body. Expecting { messages: ChatMessage[] }." } };
        }

        const endpoint = getEnv("AGENT_ENDPOINT");       // https://virtual-mark-foundry.services.ai.azure.com/api/projects/proj-virtual-mark
        const agentName = getEnv("AGENT_NAME");           // virtual-mark-agent
        const agentVersion = getEnv("AGENT_VERSION");     // 7

        const credential = new DefaultAzureCredential();
        const tokenResponse = await credential.getToken("https://ai.azure.com/.default");
        const bearerToken = tokenResponse.token;

        ctx.log(`Calling endpoint: ${endpoint}`);

        const url = `${endpoint}/openai/responses?api-version=2025-11-15-preview`;
        const agentModel = getEnv("AGENT_MODEL");


        const agentKey = getEnv("AGENT_KEY"); // Make sure this is in your Env Variables

        const upstream = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api-key": agentKey // Use 'api-key' for Azure AI services
            },
            body: JSON.stringify({
                model: agentModel,
                input: payload.messages,
                agent: {
                    name: agentName,
                    version: agentVersion,
                    type: "agent_reference"
                }
            })
        });


        if (!upstream.ok) {
            const text = await upstream.text();
            ctx.error(`Agent API error: ${upstream.status} ${text}`);
            return { status: upstream.status, jsonBody: { error: "Upstream agent error", detail: text } };
        }

        const data = await upstream.json() as AgentResponse;
        const message = data?.output?.find((item: AgentOutput) => item.type === "message");
        let content = message?.content?.[0]?.text ?? "(No response from agent)";

        // remove source citations like 【1:23†source】
        content = content.replace(/【\d+:\d+†source】/g, "").trim();
        return { status: 200, headers: { "Content-Type": "application/json" }, jsonBody: { response: content } };

    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.error(`Handler failed: ${msg}`);
        return { status: 500, jsonBody: { error: "Internal Server Error", detail: msg } };
    }
}

app.http("chat", { route: "chat", methods: ["POST"], authLevel: "anonymous", handler });