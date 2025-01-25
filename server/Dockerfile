# Use CUDA-compatible Python base image
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/services/scribe

# Install Python and required system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /services/scribe

# Copy all requirements files
COPY app/requirements/ app/requirements/

# Install dependencies using production requirements
RUN pip3 install --no-cache-dir -r app/requirements/production.txt \
    && rm -rf ~/.cache/pip/*

# Create uploads directory with proper permissions
RUN mkdir -p /services/scribe/uploads && \
    chmod 777 /services/scribe/uploads

# Copy application code
COPY app/ app/

# Copy gunicorn configuration
COPY gunicorn.conf.py .

# Expose the Flask port
EXPOSE 5000

# Run the Flask app directly
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app.main:app"]
