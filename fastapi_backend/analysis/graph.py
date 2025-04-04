import os
from typing import List, TypedDict
import sys
import rpy2.robjects as ro  # type: ignore
from dotenv import load_dotenv  # type: ignore
from langchain_core.messages import (
    BaseMessage,
    AIMessage,
    HumanMessage,
    ToolMessage,
)

sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
from backend.analysis.my_tools_executor import MyToolExecutor
from backend.analysis.tools_py import run_celltypist_annotation_tool

from langchain_core.prompts import MessagesPlaceholder, ChatPromptTemplate
from langchain_core.tools import Tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from backend import global_variables
from langsmith import Client
from backend.global_variables import ROOT_PATH




client = Client()

# Get the OpenAI key from the environment variable
openai_api_key = os.getenv("OPENAI_API_KEY")

# Check if the key is set
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY is not set.")
else:
    print("OPENAI_API_KEY loaded successfully.")
# Set R options to prevent deparse() from creating string vectors
ro.r("options(width=10000)")


# Define the list of tools  ## not working: plot_scatter_mitochondrial_genes,  plot_highly_variable_genes (produce plot, but give an error), plot_pca_heatmap, cluster_marker_genes

# from langchain_community.tools import TavilySearchResults
# tool_web_search = TavilySearchResults()


tools: List[Tool] = [
    # tool_web_search,
    # go_enrichment,
    # summarize_seurat, # removed because confuse llm while asking explaination of the plots
    # clear_history,
    # analyze_cluster_marker_genes_output,
    # cell_clusters,  #### problema con R
    # cell_embedding,
    # nearest_neighbor_cell_embedding,
    # log_normalize,
    # scale_data,
    # highly_variable_genes,
    # run_pca,
    # calculate_mitochondrial_genes,
    # plot_scatter_mitochondrial_genes,
    plot_violin_mitochondrial_genes,
    plot_pca,
    plot_scatter_cell_quality,
    plot_highly_variable_genes,
    plot_pca_heatmap,
    plot_pca_elbow,
    cluster_marker_genes,
    plot_embedding,
    plot_embedding_feature_expression,
    plot_violin_features,
    plot_dotplot
]  # type: ignore

#tools.extend([run_celltypist_annotation_tool])

# Define the LLM
llm = ChatOpenAI(model_name="gpt-4o", temperature=0.1)


# from langchain_ollama import ChatOllama
# llm = ChatOllama(
#     model="llama3.1",
#     temperature=0,
#     # other params...
# )

# Prompt for the chatbot
prompt = ChatPromptTemplate.from_messages(
    [
        MessagesPlaceholder(variable_name="messages"),
    ]
)

# Chain that uses the tools
chain = prompt | llm.bind_tools(tools)


# Definition of the state
class State(TypedDict):
    """Represents the state with a list of messages."""

    messages: List[BaseMessage]


def check_file_info(state: State):
    """
    Checks and processes the uploaded file information if submitted by user.
    """
    messages = state["messages"]

    if global_variables.UPLOADED_FILE == False:
        return

    if global_variables.UPLOADED_FILE == True:
        if global_variables.UPLOADED_TEXT == True:  ## uploaded PDF
            ai_message = AIMessage(
                content="This is the PDF PDF PDF PDF"
                + " this is the uploaded pdf file from the user, and it was correctly processed, no problems are detected:    "
                + global_variables.PDF_CONTENT_AS_STRING
                + "confirm the user that he uploaded a pdf file"
            )
            messages.append(ai_message)
            return {"messages": messages}
        if global_variables.UPLOADED_TEXT == False:  ## uploaded datafile

            ai_message = AIMessage(
                content="I see you uploaded a "
                + str(global_variables.JDATAFILE.getDataType())
                + " with "
                + str(global_variables.NUMCOLUMNS)
                + " columns and "
                + str(global_variables.NUMROWS)
                + " rows."
            )
            messages.append(ai_message)
            # ai_message = AIMessage(
            #     content="Here is the subset stats file: "
            #     + global_variables.SUBSET_STATS_FILE
            # )
            # messages.append(ai_message)
            global_variables.PDF_CONTENT_AS_STRING = "This is the PDF PDF PDF PDF and it was correctly processed, all is good"
            global_variables.UPLOADED_TEXT = False
            global_variables.UPLOADED_FILE = False

            return {"messages": messages}

    # metadata = get_last_uploaded_file_info() # since is not more on s3
    metadata = "Here is the metadata of the uploaded file: "  # + str(get_last_uploaded_file_info())
    ai_message = AIMessage(content=metadata)  # type: ignore
    state["messages"].append(ai_message)
    return state


# Function to reason with the LLM and print the results
def llm_reasoning(state: State):
    messages = state["messages"]

    # Execute the LLM chain with the prompt and tools ( questo per evitare errori di token, ma tuttavia inviare l'intero seurat formato json al frontend)
    # if len(messages[-1].content) > 8000:
    #     ## tagliare il messaggio
    #     messages[-1].content = messages[-1].content[:8000]

    result = chain.invoke({"messages": messages})

    # Add the result to the messages
    messages = state["messages"]
    messages.append(result)

    return {"messages": messages}


def check_tool_call(message):
    """
    Function to check if a message contains tool_calls
    """

    if isinstance(message, AIMessage):
        additional_kwargs = message.additional_kwargs
        if additional_kwargs and "tool_calls" in additional_kwargs:
            return len(additional_kwargs["tool_calls"]) > 0
    return False


def tool_execution_node(state):
    """
    Node to handle tool execution
    """
    messages = state["messages"]
    last_message = messages[-1]

    tool_calls = last_message.additional_kwargs.get("tool_calls", [])

    for tool_call in tool_calls:
        tool_call_id = tool_call.get("id", None)
        tool_name = tool_call.get("function", {}).get("name", None)
        tool_args = tool_call.get("function", {}).get("arguments", {})

        tool_executor = MyToolExecutor(tools)
        content = tool_executor.call_tool_with_args(tool_name, tool_args)
        
        tool_message = None
        if isinstance(content, str):
            tool_message = ToolMessage(
                content=content, 
                name=tool_name, 
                tool_call_id=tool_call_id
            )
        elif isinstance(content, tuple):
            tool_message = ToolMessage(
                content="Called creation plot",
                name=tool_name,
                tool_call_id=tool_call_id,
            )

        messages.append(tool_message)

    return {"messages": messages}


def finish(state):
    """
    Appends an AIMessage indicating the current loop count to the state's messages.
    """
    ai_message = AIMessage(content="end of loop number: " + str(len(state["messages"])))  # type: ignore
    state["messages"].append(ai_message)
    return state


def router(state):
    """
    Routing function to decide whether to call the tool
    """
    # messages = state["messages"]
    # last_message = messages[-1]

    # if check_tool_call(last_message):
    #     return "call_tool"
    # return "end"
    messages = state["messages"]
    last_message = messages[-1]
    if last_message.tool_calls:
        return "call_tool"
    return "end"


def create_graph():
    """
    Create the state graph with the ToolNode
    """
    graph_builder = StateGraph(State)
    graph_builder.add_node("process_file_if_submitted_by_user", check_file_info)
    graph_builder.add_node("chatbot", llm_reasoning)
    # graph_builder.add_node("finish", finish)

    graph_builder.add_node("execute_tool", tool_execution_node)

    graph_builder.set_entry_point("process_file_if_submitted_by_user")
    graph_builder.add_edge("process_file_if_submitted_by_user", "chatbot")

    graph_builder.add_conditional_edges(
        "chatbot",
        router,
        {"call_tool": "execute_tool", "end": END},
        # {"call_tool": "execute_tool", "end": "finish"},
    )

    # graph_builder.add_edge("finish", END)

    graph_builder.add_edge("execute_tool", "chatbot")

    return graph_builder.compile()


if __name__ == "__main__":
    # Initialize the environment and create the global seurat_object

    from backend import global_variables

    global_variables.DEBUG = False

    initialize_environment()

    graph = create_graph()

    from langchain_core.runnables.graph import MermaidDrawMethod, CurveStyle

    graph.get_graph().draw_mermaid_png(
        curve_style=CurveStyle.LINEAR,
        wrap_label_n_words=9,
        output_file_path="../../analysis/graph.png",
        draw_method=MermaidDrawMethod.PYPPETEER,
        background_color="white",
        padding=10,
    )

    initial_state = {"messages": [HumanMessage(content="fammi un hvg plot")]}

    # initial_state_two_messages = {
    #     "messages": [
    #         HumanMessage(
    #             content="fammi un violin plot",
    #             additional_kwargs={},
    #             response_metadata={},
    #         ),
    #         AIMessage(
    #             content="",
    #             additional_kwargs={
    #                 "tool_calls": [
    #                     {
    #                         "id": "call_DWhLVufQhLAdujXXiNoKejjH",
    #                         "function": {
    #                             "arguments": "{}",
    #                             "name": "plot_violin_mitochondrial_genes",
    #                         },
    #                         "type": "function",
    #                     }
    #                 ],
    #                 "refusal": None,
    #             },
    #             response_metadata={
    #                 "token_usage": {
    #                     "completion_tokens": 18,
    #                     "prompt_tokens": 756,
    #                     "total_tokens": 774,
    #                     "completion_tokens_details": {
    #                         "audio_tokens": 0,
    #                         "reasoning_tokens": 0,
    #                         "accepted_prediction_tokens": 0,
    #                         "rejected_prediction_tokens": 0,
    #                     },
    #                     "prompt_tokens_details": {
    #                         "audio_tokens": 0,
    #                         "cached_tokens": 0,
    #                     },
    #                 },
    #                 "model_name": "gpt-4o-mini-2024-07-18",
    #                 "system_fingerprint": "fp_0ba0d124f1",
    #                 "finish_reason": "tool_calls",
    #                 "logprobs": None,
    #             },
    #             id="run-cc81d4f9-70fa-4891-8979-01884c8df7cf-0",
    #             tool_calls=[
    #                 {
    #                     "name": "plot_violin_mitochondrial_genes",
    #                     "args": {},
    #                     "id": "call_DWhLVufQhLAdujXXiNoKejjH",
    #                     "type": "tool_call",
    #                 }
    #             ],
    #             usage_metadata={
    #                 "input_tokens": 756,
    #                 "output_tokens": 18,
    #                 "total_tokens": 774,
    #                 "input_token_details": {"audio": 0, "cache_read": 0},
    #                 "output_token_details": {"audio": 0, "reasoning": 0},
    #             },
    #         ),
    #         ToolMessage(
    #             content="Violin plot generated successfully",
    #             name="plot_violin_mitochondrial_genes",
    #             tool_call_id="call_DWhLVufQhLAdujXXiNoKejjH",
    #         ),
    #         AIMessage(
    #             content="Il violin plot è stato generato con successo! Se hai bisogno di ulteriori analisi o visualizzazioni, fammi sapere!",
    #             additional_kwargs={"refusal": None},
    #             response_metadata={
    #                 "token_usage": {
    #                     "completion_tokens": 28,
    #                     "prompt_tokens": 795,
    #                     "total_tokens": 823,
    #                     "completion_tokens_details": {
    #                         "audio_tokens": 0,
    #                         "reasoning_tokens": 0,
    #                         "accepted_prediction_tokens": 0,
    #                         "rejected_prediction_tokens": 0,
    #                     },
    #                     "prompt_tokens_details": {
    #                         "audio_tokens": 0,
    #                         "cached_tokens": 0,
    #                     },
    #                 },
    #                 "model_name": "gpt-4o-mini-2024-07-18",
    #                 "system_fingerprint": "fp_0ba0d124f1",
    #                 "finish_reason": "stop",
    #                 "logprobs": None,
    #             },
    #             id="run-c70a1748-22bb-4a33-a225-01f9078cf638-0",
    #             usage_metadata={
    #                 "input_tokens": 795,
    #                 "output_tokens": 28,
    #                 "total_tokens": 823,
    #                 "input_token_details": {"audio": 0, "cache_read": 0},
    #                 "output_token_details": {"audio": 0, "reasoning": 0},
    #             },
    #         ),
    #         HumanMessage(
    #             content="fammi un altro violin plot",
    #             additional_kwargs={},
    #             response_metadata={},
    #         ),
    #     ]
    # }
    import pprint

    # Creare un'istanza di PrettyPrinter con indentazione personalizzata
    pp = pprint.PrettyPrinter(indent=4, width=120)

    for s in graph.stream(initial_state):
        my_dict = list(s.values())[0]

        pp.pprint(my_dict)