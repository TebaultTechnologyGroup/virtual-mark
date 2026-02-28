import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

type Role = "user" | "assistant";
interface ChatMessage { role: Role; content: string; }
interface ClientPayload { messages: ChatMessage[]; }

interface AgentOutput {
    type?: string;
    content?: Array<{ text?: string }>;
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
            return { status: 405, jsonBody: { error: "Method Not Allowed" } };
        }

        const payload = (await req.json()) as ClientPayload | undefined;
        if (!payload?.messages?.length) {
            return { status: 400, jsonBody: { error: "Invalid body. Expecting { messages: ChatMessage[] }." } };
        }

        const endpoint = getEnv("AGENT_ENDPOINT");
        const agentName = getEnv("AGENT_NAME");
        const agentVersion = getEnv("AGENT_VERSION");
        const agentModel = getEnv("AGENT_MODEL");
        const agentKey = getEnv("AGENT_KEY"); // Using the key instead of Managed Identity

        const url = `${endpoint}/tokens/create?api-version=2024-08-01-preview`;

        const upstream = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api-key": agentKey // Authenticating via Key
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
            return { status: upstream.status, jsonBody: { error: "Upstream agent error", detail: text } };
        }

        const data = await upstream.json() as AgentResponse;
        const message = data?.output?.find((item: AgentOutput) => item.type === "message");
        let content = message?.content?.[0]?.text ?? "(No response from agent)";

        // Programmatically strip the citations like 【4:1†source】
        content = content.replace(/【\d+:\d+†source】/g, "").trim();

        return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            jsonBody: { response: content }
        };

    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { status: 500, jsonBody: { error: "Internal Server Error", detail: msg } };
    }
}

app.http("chat", { route: "chat", methods: ["POST"], authLevel: "anonymous", handler });