# ───────────────── Base Image & Metadata ─────────────────
FROM pytorch/pytorch:2.6.0-cuda12.6-cudnn9-runtime

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    DOCKER_ENV=true \
    UNOPATH=/usr/lib/libreoffice/program

# ────────────────── System Packages ──────────────────────
RUN echo "ttf-mscorefonts-installer msttcorefonts-accepted-mscorefonts-eula select true" | debconf-set-selections && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        # core build & Python
        python3 python3-pip python3-dev build-essential swig curl \
        # media & conversion tools
        ffmpeg libmupdf-dev libmagic1 \
        # LaTeX suite
        texlive-latex-base texlive-latex-recommended texlive-latex-extra \
        texlive-pictures texlive-science texlive-fonts-recommended latexmk \
        # PDF/image converters
        pdf2svg poppler-utils imagemagick ghostscript \
        # LibreOffice + UNO bridge
        libreoffice-core libreoffice-writer libreoffice-impress \
        libreoffice-script-provider-python \
        python3-uno unoconv pandoc \
        # fonts
        fonts-dejavu fonts-liberation ttf-mscorefonts-installer && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# ──────────── unoconv Wrapper Script ────────────────────
# Move original binary, then create a wrapper that:
#  1) exports UNOPATH so unoconv can find pyuno :contentReference[oaicite:0]{index=0}
#  2) exec’s LibreOffice’s Python (with built-in uno) :contentReference[oaicite:1]{index=1}
RUN mv /usr/bin/unoconv /usr/bin/unoconv.orig && \
    printf '%s\n' \
      '#!/bin/sh' \
      'export UNOPATH=/usr/lib/libreoffice/program' \
      'exec /usr/lib/libreoffice/program/python /usr/bin/unoconv.orig "$@"' \
    > /usr/bin/unoconv && \
    chmod +x /usr/bin/unoconv

# ─────────── Verification During Build ──────────────────
# Confirm LibreOffice’s Python exists and that `import uno` succeeds
RUN ls /usr/lib/libreoffice/program/python* && \
    /usr/lib/libreoffice/program/python -c "import uno; print('OK, UNO bridge loaded')"

# ───────────────── Workdir & Caching ────────────────────
WORKDIR /app
RUN mkdir -p /app/cache/figures /var/log/gunicorn && \
    chmod -R 777 /app/cache /var/log/gunicorn

# ───────────────── Python Dependencies ──────────────────
COPY app/requirements.txt app/
RUN pip install --no-cache-dir -r app/requirements.txt

# ───────────────── Application Code ─────────────────────
COPY app/ app/
COPY gunicorn.conf.py .

# Fix occasional pdf2svg PATH issue
RUN which pdf2svg || ln -s $(which pdf2svg 2>/dev/null || echo /usr/local/bin/pdf2svg) /usr/bin/pdf2svg

# ────────────────── Entrypoint & Ports ──────────────────
EXPOSE 5000
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app.main:app"]
