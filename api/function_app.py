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

        # 2. DefaultAzureCredential automatically uses the Service Principal
        #    when these env vars are set:
        #      AZURE_CLIENT_ID     -> appId from az ad sp create-for-rbac
        #      AZURE_CLIENT_SECRET -> password from az ad sp create-for-rbac
        #      AZURE_TENANT_ID     -> tenant from az ad sp create-for-rbac
        #
        #    Locally it falls back to your `az login` session if those
        #    vars are not set in local.settings.json.
        project_client = AIProjectClient(
            endpoint=os.environ["PROJECT_ENDPOINT"],
            credential=DefaultAzureCredential(),
        )

        # 3. Call the agent by name and version
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