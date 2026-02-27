import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

type Role = "system" | "user" | "assistant" | "tool";
interface ChatMessage { role: Role; content: string; }
interface ClientPayload { messages: ChatMessage[]; stream?: boolean; }
interface OpenAIMessage { role: Role; content: string; }
interface OpenAIChoice { index: number; message: OpenAIMessage; finish_reason?: string; }
interface OpenAIResponse { choices?: OpenAIChoice[]; }

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

        const endpoint = getEnv("AGENT_RESPONSE_API");
        const apiKey = getEnv("AGENT_API_KEY");

        const upstream = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "api-key": apiKey },
            body: JSON.stringify({ messages: payload.messages, stream: false })
        });

        if (!upstream.ok) {
            const text = await upstream.text();
            ctx.error(`Agent API error: ${upstream.status} ${text}`);
            return { status: upstream.status, jsonBody: { error: "Upstream agent error", detail: text } };
        }

        const data = (await upstream.json()) as OpenAIResponse;
        const content = data?.choices?.[0]?.message?.content ?? "(No response from agent)";
        return { status: 200, headers: { "Content-Type": "application/json" }, jsonBody: { response: content } };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.error(`Handler failed: ${msg}`);
        return { status: 500, jsonBody: { error: "Internal Server Error", detail: msg } };
    }
}

app.http("chat", { route: "chat", methods: ["POST"], authLevel: "anonymous", handler });