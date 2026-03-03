import azure.functions as func
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
import os
import re
import json

# Initialize the client once at module load time, not per request.
# This means the token is fetched when the function app starts up,
# so the first user request doesn't pay the authentication cost.
_credential = DefaultAzureCredential()
_project_client = AIProjectClient(
    endpoint=os.environ["PROJECT_ENDPOINT"],
    credential=_credential,
)
_openai_client = _project_client.get_openai_client()

# Eagerly warm up the credential so the first real request doesn't fail
try:
    _credential.get_token("https://cognitiveservices.azure.com/.default")
except Exception:
    pass  # Log if needed, but don't block startup

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


@app.route(route="chat", methods=["POST"])
def chat(req: func.HttpRequest) -> func.HttpResponse:
    headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
    }

    try:
        # 1. Parse request body
        try:
            body = req.get_json()
        except ValueError:
            return func.HttpResponse(
                json.dumps({"error": "Invalid JSON body"}),
                status_code=400,
                headers=headers,
            )

        messages = body.get("messages", [])
        if not messages:
            return func.HttpResponse(
                json.dumps({"error": "No messages provided"}),
                status_code=400,
                headers=headers,
            )

        user_input = messages[-1]["content"]

        # 2. Call the agent using the module-level client
        response = _openai_client.responses.create(
            input=[{"role": "user", "content": user_input}],
            extra_body={
                "agent": {
                    "name": os.environ["AGENT_NAME"],
                    "version": os.environ["AGENT_VERSION"],
                    "type": "agent_reference",
                }
            },
        )

        # 3. Extract the response text
        raw_content = response.output_text or "(No response from agent)"

        # 4. Strip citation markers like 【4:1†source】
        clean_content = re.sub(r"【\d+:\d+†[^】]*】", "", raw_content).strip()

        return func.HttpResponse(
            json.dumps({"response": clean_content}),
            status_code=200,
            headers=headers,
        )

    except KeyError as e:
        return func.HttpResponse(
            json.dumps({"error": f"Missing environment variable: {e}"}),
            status_code=500,
            headers=headers,
        )
    except Exception as e:
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            headers=headers,
        )