import time

from selenium import webdriver
from selenium.common import NoSuchElementException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Global WebDriver instance
driver = None


def get_driver():
    global driver
    return driver


def open_browser_with_options(url, browser):
    global driver
    options = Options()
    options.add_experimental_option("detach", True)

    if browser == "chrome":
        driver = webdriver.Chrome(options=options)
        driver.maximize_window()
    elif browser == "edge":
        driver = webdriver.Edge()
        driver.maximize_window()
    elif browser == "safari":
        driver = webdriver.Safari()
        driver.maximize_window()
    else:
        raise ValueError("Browser type not supported")

    driver.get(url)

    # Wait until page contains specific XPath element
    xpath_locator = "//*[@id='header']/div[1]/div[3]/div/a"
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, xpath_locator))
    )


def log_in():
    global driver

    # Click button
    login_button = driver.find_element(By.XPATH, "//*[@id='header']/div[1]/div[3]/div/a")
    login_button.click()

    # Wait for WeChat login button to appear
    xpath_locator_wechat_login = "//*[@id='wrap']/div/div[2]/div[2]/div[2]/div[1]/div[4]/a"
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, xpath_locator_wechat_login))
    )

    wechat_button = driver.find_element(By.XPATH, "//*[@id='wrap']/div/div[2]/div[2]/div[2]/div[1]/div[4]/a")
    wechat_button.click()

    xpath_locator_wechat_logo = "//*[@id='wrap']/div/div[2]/div[2]/div[1]/div[2]/div[1]/img"
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, xpath_locator_wechat_logo))
    )

    xpath_locator_login_success = "//*[@id='header']/div[1]/div[3]/ul/li[2]/a"
    WebDriverWait(driver, 60).until(
        EC.presence_of_element_located((By.XPATH, xpath_locator_login_success))
    )


def get_job_description():
    global driver

    # Locate job description element using given XPath
    xpath_locator_job_description = "//*[@id='wrap']/div[2]/div[2]/div/div/div[2]/div/div[2]/p"

    # Ensure element is loaded and text can be retrieved
    job_description_element = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, xpath_locator_job_description))
    )

    # Get job description text
    job_description = job_description_element.text
    print(job_description)  # Print job description, or you can do other processing here

    # Return job description text if function requires it
    return job_description


def select_dropdown_option(driver, label):
    # Try to find text in elements with specific class
    trigger_elements = driver.find_elements(By.XPATH, "//*[@class='recommend-job-btn has-tooltip']")

    # Mark whether element is found
    found = False

    for element in trigger_elements:
        if label in element.text:
            # Ensure element is visible and clickable
            WebDriverWait(driver, 10).until(EC.element_to_be_clickable(element))
            element.click()  # Click found element
            found = True
            break

    # If text is found in button, don't continue with following operations
    if found:
        # Uncomment to provide time to select more tags
        # time.sleep(20)
        return

    # If text is not found in button, perform original dropdown operation
    trigger_selector = "//*[@id='wrap']/div[2]/div[1]/div/div[1]/div"
    WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, trigger_selector))
    ).click()  # Open dropdown menu

    dropdown_selector = "ul.dropdown-expect-list"
    WebDriverWait(driver, 10).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, dropdown_selector))
    )

    option_selector = f"//li[contains(text(), '{label}')]"
    WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, option_selector))
    ).click()  # Select option in dropdown menu


def get_job_description_by_index(index):
    try:
        job_selector = f"//*[@id='wrap']/div[2]/div[2]/div/div/div[1]/ul/li[{index}]"
        job_element = driver.find_element(By.XPATH, job_selector)
        job_element.click()

        description_selector = "//*[@id='wrap']/div[2]/div[2]/div/div/div[2]/div/div[2]/p"
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, description_selector))
        )
        job_description_element = driver.find_element(By.XPATH, description_selector)
        return job_description_element.text

    except NoSuchElementException:
        print(f"No job found at index {index}.")
        return None


# Variables
url = "https://www.zhipin.com/web/geek/job-recommend?ka=header-job-recommend"
browser_type = "chrome"
