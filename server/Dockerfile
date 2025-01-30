# Use a newer Python base image
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime-python3.11

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

# Expose the Flask port
EXPOSE 5000

# Run with debugging enabled
CMD ["gunicorn", "--config", "gunicorn.conf.py", "--log-level", "debug", "--capture-output", "--enable-stdio-inheritance", "app.main:app"]
