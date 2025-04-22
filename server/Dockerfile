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
    # More comprehensive LaTeX installation with TikZ support
    texlive-full \
    # Ensure these specific packages are installed
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-science \
    texlive-pictures \
    # PGF/TikZ specific packages
    pgf \
    latexmk \
    libmagic1 \
    pdf2svg \
    poppler-utils \
    ghostscript \
    # Add NVIDIA runtime libraries
    nvidia-cuda-toolkit \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Create cache directories with proper permissions
RUN mkdir -p /app/cache/figures && chmod -R 777 /app/cache

# Copy requirements files
COPY app/requirements.txt app/

# Install Python dependencies
RUN pip install --no-cache-dir -r app/requirements.txt

# Create directory for gunicorn logs
RUN mkdir -p /var/log/gunicorn && \
    chmod 777 /var/log/gunicorn

# Copy application code
COPY app/ app/
COPY gunicorn.conf.py .

# Verify pdf2svg installation and create symbolic links if needed
RUN which pdf2svg || echo "pdf2svg not found, creating symbolic link" && \
    if [ ! -f /usr/bin/pdf2svg ] && [ -f /usr/local/bin/pdf2svg ]; then \
        ln -s /usr/local/bin/pdf2svg /usr/bin/pdf2svg; \
    fi

# Expose the FastAPI port
EXPOSE 5000

# Start Gunicorn
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app.main:app"]