# Technology Context - 2023-03-17

## Technology Stack

### Frontend

- **Web**: React with Next.js for server-side rendering (matching ApplyRight stack)
- **Mobile**: React Native for cross-platform mobile development
- **State Management**: Redux/Context API
- **Styling**: Tailwind CSS (for visual consistency with ApplyRight)
- **UI Components**: Material-UI/Chakra UI

### Backend

- **API Server**: Next.js serverless functions on Vercel
- **Automation Engine**: Python with FastAPI in Docker container
- **Database**: PostgreSQL
- **ORM**: Prisma/Sequelize
- **Authentication**: Shared authentication with ApplyRight
- **API Documentation**: Swagger/OpenAPI

### Containerization & Deployment

- **Container Technology**: Docker
- **Container Hosting**: Fly.io (free tier)
- **Frontend Hosting**: Vercel (consistent with ApplyRight)
- **Database Hosting**: Existing PostgreSQL database
- **Storage**: AWS S3 for document storage

### Integration

- **API Gateway**: Express/Next.js API routes
- **Message Broker**: Background tasks for asynchronous operations
- **Service Discovery**: Environment-based configuration
- **Webhooks**: Bi-directional webhook system for real-time updates

### External APIs

- **ApplyRight API**: Primary integration point for resume and cover letter data
- **Job Platform**: LinkedIn API
- **Email**: SendGrid/Mailgun
- **Storage**: AWS S3 for document storage

### Testing

- **Unit Testing**: Jest
- **E2E Testing**: Cypress
- **API Testing**: Postman/Supertest
- **Load Testing**: JMeter
- **Integration Testing**: Special focus on ApplyRight integration testing

## Implementation Details

### Docker Container Configuration

```dockerfile
FROM python:3.9-slim

WORKDIR /app

# Install Chrome for Selenium automation
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && apt-get clean

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create volume mount points for external storage
VOLUME /app/data

# Expose port for API
EXPOSE 8080

# Run application
CMD ["python", "app.py"]
```

### Python Dependencies

```
# requirements.txt
fastapi==0.95.1
uvicorn==0.22.0
selenium==4.9.0
webdriver-manager==3.8.6
boto3==1.26.135
requests==2.30.0
python-dotenv==1.0.0
psycopg2-binary==2.9.6
openai==0.27.6
beautifulsoup4==4.12.2
pydantic==1.10.7
```

### Fly.io Configuration

```toml
# fly.toml
app = "auto-job-finder"
primary_region = "ewr"  # Choose your nearest region

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]
```

## Development Environment

### Prerequisites

- Node.js (v14+)
- Python (v3.9+)
- Docker and Docker Compose
- PostgreSQL
- Git
- Access to ApplyRight development environment
- Fly.io CLI tools

### Local Setup

```bash
# Clone repository
git clone <repository-url>

# Install dependencies
pip install -r requirements.txt
npm install  # (for future frontend)

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration and ApplyRight API credentials

# Run Docker container locally
docker build -t auto-job-finder .
docker run -p 8080:8080 -v $(pwd)/data:/app/data auto-job-finder

# Deploy to Fly.io
fly deploy
```

### Development Workflow

1. Create feature branch from main
2. Implement changes with tests
3. Test ApplyRight integration
4. Test Docker container locally
5. Submit PR for review
6. Automated tests run in CI
7. Code review and approval
8. Merge to main branch
9. Automatic deployment to Fly.io

## Technical Constraints

### Performance Requirements

- API response time < 200ms
- Page load time < 2s
- Support for 1000+ concurrent users
- Fast data exchange with ApplyRight API
- Automation container startup time < 30s

### Security Requirements

- OWASP Top 10 compliance
- Regular security audits
- Sensitive data encryption
- Rate limiting and DDOS protection
- Secure API communication with ApplyRight
- Secure handling of user credentials for job platforms

### Compliance Requirements

- GDPR compliance for EU users
- CCPA compliance for California users
- SOC 2 compliance for data handling
- Compliance with ApplyRight's data handling policies
- LinkedIn terms of service compliance

### Browser Compatibility

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

## Dependencies

### Python Dependencies

- `fastapi`: API framework for the automation service
- `uvicorn`: ASGI server for FastAPI
- `selenium`: Web automation
- `webdriver-manager`: ChromeDriver management
- `boto3`: AWS S3 integration
- `requests`: HTTP client
- `python-dotenv`: Environment variable management
- `psycopg2-binary`: PostgreSQL driver
- `openai`: OpenAI API integration
- `beautifulsoup4`: HTML parsing
- `pydantic`: Data validation

### JavaScript Dependencies

- `next`: Frontend framework
- `react`: UI library
- `axios`: HTTP client
- `swr`: Data fetching
- `tailwindcss`: CSS framework
- `@headlessui/react`: Accessible UI components

## Integration Points

### ApplyRight API

- **Authentication**: Shared authentication system
- **User Data**: Access to user profiles and subscription information
- **Resume Data**: Retrieval of optimized resumes
- **Cover Letter Data**: Retrieval of generated cover letters
- **Status Updates**: Sending application status updates
- **Webhooks**: Real-time event notifications

### LinkedIn API

- **Authentication**: OAuth flow for user authorization
- **Job Search**: Querying available jobs
- **Quick Apply**: Submit applications via API when available
- **Status Tracking**: Monitor application status

### AWS S3

- **Document Storage**: Store resumes and cover letters
- **Temporary Storage**: Cache job application data
- **Cross-Service Access**: Shared access between ApplyRight and Auto Job Finder

### Email Service

- **Application Confirmation**: Notify users of submitted applications
- **Status Updates**: Alert users to application status changes
- **Manual Action Required**: Notify when manual completion is needed
