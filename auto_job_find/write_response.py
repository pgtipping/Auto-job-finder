import json
import os
import time
from selenium.webdriver.support import expected_conditions as EC

import openai
from openai import OpenAI
from selenium.webdriver import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from langchain_functions import get_text_chunks, get_vectorstore, read_resumes, should_use_langchain, generate_letter

import functions
import finding_jobs

# Check OpenAI version compatibility
from packaging import version
from dotenv import load_dotenv

load_dotenv()

required_version = version.parse("1.1.1")
current_version = version.parse(openai.__version__)
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
if current_version < required_version:
    raise ValueError(
        f"Error: OpenAI version {openai.__version__} is less than the required version 1.1.1"
    )
else:
    print("OpenAI version is compatible.")

# Initialize OpenAI client
client = OpenAI(api_key=OPENAI_API_KEY)

if not should_use_langchain():
    # Create or load assistant
    assistant_id = functions.create_assistant(
        client)  # this function comes from "functions.py"


def create_thread(client):
    # Function to create a new thread and return its ID
    try:
        response = client.beta.threads.create()  # No assistant_id needed
        thread_id = response.id
        return thread_id
    except Exception as e:
        print(f"Error creating thread: {e}")
        return None


def chat(user_input, assistant_id, thread_id=None):
    if thread_id is None:
        thread_id = create_thread(client)
        if thread_id is None:
            return json.dumps({"error": "Failed to create a new thread"})

    print(f"Received message: {user_input} in thread {thread_id}")

    # Run the Assistant
    try:
        # Add the user's message to the thread
        client.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=user_input
        )

        # Start the Assistant Run
        run = client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=assistant_id
        )

        # Check if the Run requires action (function call)
        while True:
            run_status = client.beta.threads.runs.retrieve(
                thread_id=thread_id,
                run_id=run.id,
                timeout=60  # Set timeout to 60 seconds
            )

            if run_status.status == 'completed':
                break
            elif run_status.status == 'requires_action':
                # Here you can handle specific actions if your assistant requires them
                # ...
                time.sleep(1)  # Wait for a second before checking again

        # Retrieve and return the latest message from the assistant
        messages = client.beta.threads.messages.list(thread_id=thread_id)
        assistant_message = messages.data[0].content[0].text.value

        # Replace newlines with a single space
        formatted_message = assistant_message.replace("\n", " ").replace(" ", "").replace("真诚的，龙思卓", "")
        import re
        formatted_message = re.sub(r'【.*?】', '', formatted_message)


        # response_data = json.dumps({"response": assistant_message, "thread_id": thread_id})
        return formatted_message

    except Exception as e:
        print(f"An error occurred: {e}")
        error_response = json.dumps({"error": str(e)})
        return error_response


def send_response_to_chat_box(driver, response):
    # Locate chat input box
    chat_box = driver.find_element(By.XPATH, "//*[@id='chat-input']")

    # Clear any existing text in the input box
    chat_box.clear()

    # Paste response into input box
    chat_box.send_keys(response)
    time.sleep(3)

    # Simulate pressing Enter to send message
    chat_box.send_keys(Keys.ENTER)
    time.sleep(1)


def send_response_and_go_back(driver, response):
    # Call function to send response
    send_response_to_chat_box(driver, response)

    time.sleep(10)
    # Return to previous page
    driver.back()
    time.sleep(3)


def send_job_descriptions_to_chat(url, browser_type, label, assistant_id=None, vectorstore=None):
    # Start browsing and get job descriptions
    finding_jobs.open_browser_with_options(url, browser_type)
    finding_jobs.log_in()

    job_index = 1  # Starting index
    while True:
        try:
            # Get driver instance
            driver = finding_jobs.get_driver()

            # Change dropdown option
            finding_jobs.select_dropdown_option(driver, label)
            # Call function from finding_jobs.py to get description
            job_description = finding_jobs.get_job_description_by_index(job_index)
            if job_description:
                element = driver.find_element(By.CSS_SELECTOR, '.op-btn.op-btn-chat').text
                print(element)
                if element == 'Contact Now':
                    # Send description to chat and print response
                    if should_use_langchain():
                        response = generate_letter(vectorstore, job_description)
                    else:
                        response = chat(job_description, assistant_id)
                    print(response)
                    time.sleep(1)
                    # Click contact button

                    contact_button = driver.find_element(By.XPATH,
                                                         "//*[@id='wrap']/div[2]/div[2]/div/div/div[2]/div/div[1]/div[2]/a[2]")

                    contact_button.click()

                    # Wait for reply box to appear
                    xpath_locator_chat_box = "//*[@id='chat-input']"
                    chat_box = WebDriverWait(driver, 50).until(
                        EC.presence_of_element_located((By.XPATH, xpath_locator_chat_box))
                    )

                    # Call function to send response
                    send_response_and_go_back(driver, response)

            # Wait for a while before processing next job description
            time.sleep(3)
            # job_index += 1

        except Exception as e:
            print(f"An error occurred: {e}")
            break


if __name__ == '__main__':
    url = "https://www.zhipin.com/web/geek/job-recommend?ka=header-job-recommend"
    browser_type = "chrome"
    label = "iOS（深圳）"  # Dropdown menu item to select
    if should_use_langchain():
        text = read_resumes()
        chunks = get_text_chunks(text)
        vectorstore = get_vectorstore(chunks)
        send_job_descriptions_to_chat(url, browser_type, label, vectorstore=vectorstore)
    else:
        assistant_id = functions.create_assistant(client)
        send_job_descriptions_to_chat(url, browser_type, label, assistant_id=assistant_id)
