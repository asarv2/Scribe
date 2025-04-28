# ────────────────────────────────────────────────────────────────
# Base image – CUDA 12.6, cuDNN 9, Python 3.11
# ────────────────────────────────────────────────────────────────
FROM pytorch/pytorch:2.6.0-cuda12.6-cudnn9-runtime

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    DOCKER_ENV=true

# ────────────────────────────────────────────────────────────────
# System packages
# ────────────────────────────────────────────────────────────────
RUN echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | \
        debconf-set-selections && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        # --- core build toolchain ----
        python3 python3-pip python3-dev build-essential swig curl \
        # --- media helpers ----------
        ffmpeg libmupdf-dev libmagic1 \
        # --- LaTeX stack (≈1.5 GB) --
        texlive-latex-base texlive-latex-recommended texlive-latex-extra \
        texlive-pictures texlive-science texlive-fonts-recommended latexmk \
        # --- graphics converters ----
        pdf2svg poppler-utils imagemagick ghostscript \
        # --- office → PDF pipeline --
        libreoffice-core libreoffice-writer libreoffice-impress pandoc \
        # --- fonts -------------------
        fonts-dejavu fonts-liberation ttf-mscorefonts-installer && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# ────────────────────────────────────────────────────────────────
# Workdir & caches
# ────────────────────────────────────────────────────────────────
WORKDIR /app
RUN mkdir -p /app/cache/figures /var/log/gunicorn && \
    chmod -R 777 /app/cache /var/log/gunicorn

# ────────────────────────────────────────────────────────────────
# Python dependencies
# ────────────────────────────────────────────────────────────────
COPY app/requirements.txt app/
RUN pip install --no-cache-dir -r app/requirements.txt

# ────────────────────────────────────────────────────────────────
# Application code
# ────────────────────────────────────────────────────────────────
COPY app/ app/
COPY gunicorn.conf.py .

# Fix occasional pdf2svg PATH issue in some base images
RUN which pdf2svg || { ln -s $(which pdf2svg 2>/dev/null || echo /usr/local/bin/pdf2svg) /usr/bin/pdf2svg; }

# ────────────────────────────────────────────────────────────────
# Network / entry-point
# ────────────────────────────────────────────────────────────────
EXPOSE 5000
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app.main:app"]