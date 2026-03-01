import azure.functions as func
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
import os
import re
import json

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


@app.route(route="chat", methods=["POST"])
def chat(req: func.HttpRequest) -> func.HttpResponse:
    headers = {"Content-Type": "application/json"}

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

        # 2. Build the project client.
        #    DefaultAzureCredential uses Managed Identity in production
        #    and your `az login` session for local dev.
        project_client = AIProjectClient(
            endpoint=os.environ["PROJECT_ENDPOINT"],
            credential=DefaultAzureCredential(),
        )

        # 3. Get the OpenAI client and call the agent by name + version.
        #    AGENT_NAME = "virtual-mark-agent"
        #    AGENT_VERSION = "9"
        openai_client = project_client.get_openai_client()

        response = openai_client.responses.create(
            input=[{"role": "user", "content": user_input}],
            extra_body={
                "agent": {
                    "name": os.environ["AGENT_NAME"],
                    "version": os.environ["AGENT_VERSION"],
                    "type": "agent_reference",
                }
            },
        )

        # 4. Extract the response text
        raw_content = response.output_text or "(No response from agent)"

        # 5. Strip citation markers like 【4:1†source】
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