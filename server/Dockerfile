# Use NVIDIA's PyTorch image
FROM pytorch/pytorch:2.6.0-cuda12.6-cudnn9-runtime

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV DOCKER_ENV=true

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

# Install base dependencies (excluding packages provided by base image)
RUN pip3 install --no-cache-dir $(grep -v "^torch==" app/requirements.txt) \
    https://github.com/Dao-AILab/flash-attention/releases/download/v2.7.4.post1/flash_attn-2.7.4.post1+cu12torch2.6cxx11abiTRUE-cp311-cp311-linux_x86_64.whl

# Create directory for gunicorn logs
RUN mkdir -p /var/log/gunicorn && \
    chmod 777 /var/log/gunicorn

# Copy application code
COPY app/ app/
COPY gunicorn.conf.py .

# Expose the FastAPI port
EXPOSE 5000

# Start Gunicorn
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app.main:app"]