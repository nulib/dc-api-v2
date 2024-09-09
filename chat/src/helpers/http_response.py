from helpers.metrics import debug_response
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda, RunnablePassthrough

def extract_prompt_value(v):
    if isinstance(v, list):
        return [extract_prompt_value(item) for item in v]
    elif isinstance(v, dict) and 'label' in v:
        return [v.get('label')]
    else:
        return v

class HTTPResponse:
    def __init__(self, config):
        self.config = config
        self.store = {}

    def debug_response_passthrough(self):
        return RunnableLambda(lambda x: debug_response(self.config, x, self.original_question))

    def original_question_passthrough(self):
        def get_and_send_original_question(docs):
            source_documents = []
            for doc in docs["context"]:
                doc.metadata = {key: extract_prompt_value(doc.metadata.get(key)) for key in self.config.attributes if key in doc.metadata}
                source_document = doc.metadata.copy()
                source_document["content"] = doc.page_content
                source_documents.append(source_document)
                
            self.context = source_documents

            original_question = {
                "question": self.config.question,
                "source_documents": source_documents,
            }
                
            self.original_question = original_question
            return docs
        
        return RunnablePassthrough(get_and_send_original_question)

    def prepare_response(self):
        try:
            retriever = self.config.opensearch.as_retriever(search_type="similarity", search_kwargs={"k": self.config.k, "size": self.config.size, "_source": {"excludes": ["embedding"]}})
            chain = (
                {"context": retriever, "question": RunnablePassthrough()}
                | self.original_question_passthrough()
                | self.config.prompt
                | self.config.client
                | StrOutputParser()
                | self.debug_response_passthrough()
            )
            response = chain.invoke(self.config.question)
            response["context"] = self.context
        except Exception as err:
            response = {
                "question": self.config.question,
                "error": str(err),
                "source_documents": [],
            }
        return response

        