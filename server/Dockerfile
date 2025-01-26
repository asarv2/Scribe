# Use NVIDIA's PyTorch image instead
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Add environment variable to indicate Docker environment
ENV DOCKER_ENV=true

# Install Python and required system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy single requirements file
COPY app/requirements.txt app/

# Install dependencies (excluding torch since it's in the base image)
RUN pip3 install --no-cache-dir $(grep -v "^torch==" app/requirements.txt)

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && \
    chmod 777 /app/uploads

# Copy application code
COPY app/ app/

# Copy gunicorn configuration
COPY gunicorn.conf.py .

# Expose the Flask port
EXPOSE 5000

# Run the Flask app directly
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app.main:app"]
