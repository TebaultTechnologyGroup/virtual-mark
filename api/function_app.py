import azure.functions as func
from azure.ai.projects import AIProjectClient
import os
import re
import json

app = func.FunctionApp()

@app.route(route="chat", methods=["POST"])
def chat(req: func.HttpRequest) -> func.HttpResponse:
    try:
        # 1. Setup Client
        # Note: We use your AGENT_KEY directly as the credential for the Free Plan
        project_client = AIProjectClient.from_connection_string(
            conn_str=os.environ["FOUNDRY_PROJECT_ENDPOINT"],
            credential=os.environ["AGENT_KEY"]
        )

        # 2. Parse Request
        body = req.get_json()
        messages = body.get('messages', [])
        if not messages:
            return func.HttpResponse("No messages provided", status_code=400)
        
        user_input = messages[-1]['content']

        # 3. Create a thread and send the message
        # The SDK handles the API versioning and headers for you
        agent_id = os.environ["AGENT_ID"] # You can find this in Foundry portal
        thread = project_client.agents.create_thread()
        project_client.agents.create_message(thread_id=thread.id, role="user", content=user_input)
        
        # 4. Run the agent and wait for completion
        run = project_client.agents.create_and_process_run(thread_id=thread.id, assistant_id=agent_id)
        
        # 5. Get the last message (the response)
        msgs = project_client.agents.list_messages(thread_id=thread.id)
        raw_content = msgs.data[0].content[0].text.value

        # 6. Programmatically strip the citations
        clean_content = re.sub(r"【\d+:\d+†source】", "", raw_content).strip()

        return func.HttpResponse(
            json.dumps({"response": clean_content}),
            mimetype="application/json",
            status_code=200
        )

    except Exception as e:
        return func.HttpResponse(json.dumps({"error": str(e)}), status_code=500)