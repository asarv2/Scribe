# Use NVIDIA's PyTorch image with CUDA development tools
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-devel

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV DOCKER_ENV=true
ENV SKIP_MODEL_DOWNLOAD=true

# Install Python and required system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    libmupdf-dev \
    swig \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy requirements files
COPY app/requirements.txt app/
COPY app/requirements_gpu.txt app/

# Install base dependencies (excluding packages provided by base image)
RUN pip3 install --no-cache-dir $(grep -v "^torch==" app/requirements.txt)

# Install GPU-specific dependencies
RUN pip3 install --no-cache-dir -r app/requirements_gpu.txt

# Create directory for gunicorn logs
RUN mkdir -p /var/log/gunicorn && \
    chmod 777 /var/log/gunicorn

# Copy application code
COPY app/ app/
COPY download_model.py .
COPY gunicorn.conf.py .

# Create startup script with conditional model download
RUN echo '#!/bin/bash\n\
if [ "$SKIP_MODEL_DOWNLOAD" != "true" ]; then\n\
    python3 download_model.py\n\
fi\n\
gunicorn --config gunicorn.conf.py app.main:app' > /app/start.sh && \
chmod +x /app/start.sh

# Expose the FastAPI port
EXPOSE 5000

# Run startup script
CMD ["/app/start.sh"]