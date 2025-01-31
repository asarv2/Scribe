# Use NVIDIA's PyTorch image instead
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV FLASK_DEBUG=false

# Add environment variable to indicate Docker environment
ENV DOCKER_ENV=true

# Install Python and required system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-latex-recommended \
    texlive-pictures \
    texlive-science \
    texlive-fonts-recommended \
    latexmk \
    cm-super \
    dvipng \
    ghostscript \
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

# Create directory for gunicorn logs
RUN mkdir -p /var/log/gunicorn && \
    chmod 777 /var/log/gunicorn

# Create a directory for model cache
RUN mkdir -p /root/.cache/huggingface

# Pre-download the model during build
RUN python3 -c "from transformers import AutoModelForCausalLM, AutoTokenizer; AutoModelForCausalLM.from_pretrained('deepseek-ai/DeepSeek-R1-Distill-Qwen-7B', trust_remote_code=True); AutoTokenizer.from_pretrained('deepseek-ai/DeepSeek-R1-Distill-Qwen-7B')"

# Set the cache directory as a volume to persist it
VOLUME /root/.cache/huggingface

# Expose the Flask port
EXPOSE 5000

# Run with debugging enabled
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app.main:app"]
