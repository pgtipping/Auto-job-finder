from langchain.document_loaders import DirectoryLoader, PyPDFLoader
from langchain.text_splitter import CharacterTextSplitter
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import FAISS
from langchain.chains import RetrievalQA
from langchain.chat_models import ChatOpenAI
from langchain.prompts import PromptTemplate
import os
from dotenv import load_dotenv
load_dotenv()

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_BASE_URL = os.getenv('OPENAI_BASE_URL')

# Determine whether to use langchain. If a custom API address is set, use langchain
def should_use_langchain():
    should_use_langchain = OPENAI_BASE_URL is not None
    return should_use_langchain

# Read resume data
def read_resumes():
    # Read all files in the resume folder
    d_loader = DirectoryLoader("./resume", glob="*.pdf",loader_cls=PyPDFLoader)

    # Get PDF text, returning a list where each element is a page of the PDF document
    pdf_pages = d_loader.load()

    resume_text = ""

    for page in pdf_pages:
        # Create path to distinguish which resume it is
        # print(page.metadata.get('source'))

        page_text = page.page_content
        resume_text += page_text

    return resume_text

# Text splitting
def get_text_chunks(text):
    text_splitter = CharacterTextSplitter(
        separator="\n",
        chunk_size=2000,
        chunk_overlap=200,
        length_function=len
    )
    chunks = text_splitter.split_text(text)
    return chunks

# Vectorize and return vector store
def get_vectorstore(text_chunks):
    embeddings = OpenAIEmbeddings()
    # embeddings = HuggingFaceInstructEmbeddings(model_name="hkunlp/instructor-xl")
    vectorstore = FAISS.from_texts(texts=text_chunks, embedding=embeddings)
    return vectorstore

# Generate cover letter
def generate_letter(vectorstore, job_description):
    # Character limit
    character_limit = 300

    langchain_prompt_template = f"""
        You will play the role of a job seeker. Based on the resume content in context and the job description, directly write a polite and professional job application message to HR. The message should be strictly limited to {character_limit} characters, using professional language to combine the experiences and skills from the resume with the job description to highlight the applicant's strengths and maximize the chance of impressing the recruiter. Always write the message in English, starting with 'Dear Hiring Manager' and ending with the applicant's contact information. This is a job application message and should not contain anything outside of the application content, such as 'Based on your job requirements and personal resume, I will help you draft a job application email:', to allow for direct automated copy-paste sending.
        Job Description
        {job_description}"""+"""
        Resume Content:
        {context}
        Requirements:
        {question} 
    """

    question = "Based on the job description, what are the most suitable skills in the resume? What are the applicant's strengths?"

    PROMPT = PromptTemplate.from_template(langchain_prompt_template)
    llm = ChatOpenAI(temperature=3, openai_api_base=OPENAI_BASE_URL, openai_api_key=OPENAI_API_KEY)
    qa_chain = RetrievalQA.from_chain_type(
        llm, 
        retriever=vectorstore.as_retriever(),
        # return_source_documents=True,
        chain_type_kwargs={"prompt": PROMPT}
    )

    result = qa_chain({"query": question})
    letter = result['result']

    #去掉所有换行符，防止分成多段消息
    letter = letter.replace('\n', ' ')

    return letter
