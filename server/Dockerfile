# Use Python 3.12 as base image
FROM python:3.12-slim

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV FLASK_DEBUG=false

# Add environment variable to indicate Docker environment
ENV DOCKER_ENV=true

# Install system dependencies
RUN apt-get update && apt-get install -y \
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

# Install all Python dependencies including torch
RUN pip3 install --no-cache-dir -r app/requirements.txt

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

# Create directory for local model storage
RUN mkdir -p /app/models/deepseek-r1-7b

# Expose the Flask port
EXPOSE 5000

# Run with debugging enabled
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app.main:app"]
