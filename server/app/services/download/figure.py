from PIL import Image
import io
import math
import zipfile
import re
import os
import httpx
import asyncio
import logging
from app.extensions import FIGURES_DIR
import subprocess
import pathlib

logger = logging.getLogger(__name__)

FIG_COLORS = {"bg": (255, 255, 255, 0)}  # transparent canvas

DOC_RE = re.compile(r"\\(documentclass|begin\{document\}|end\{document\})", re.I)
PREAMBLE_RE = re.compile(
    r"\\(usepackage|requirepackage|pgfplotsset|usetikzlibrary|tikz(set)?"
    r"|definecolor|newcommand|renewcommand|Declare)\b",
    re.I,
)

FIGURE_RE = re.compile(r"\\begin\{figure\}", re.I)
FIG_OR_DOC_RE = re.compile(r"\\(begin\{figure\}|documentclass)", re.I)


def _split_preamble(code: str):
    pre, body = [], []
    for ln in code.splitlines():
        if DOC_RE.match(ln.strip()):  # ← throw these lines away
            continue
        (pre if PREAMBLE_RE.match(ln.strip()) else body).append(ln)
    return pre, body


class FigureDownloader:
    def __init__(self, figures: list[dict]):
        self.figures = figures

    # ---------------------------------------------------------------- PNG --
    async def _fetch_png(self, class_id: str, fig_id: str) -> bytes:
        url = f"https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/figures/{class_id}/{fig_id}.png"
        async with httpx.AsyncClient() as c:
            r = await c.get(url)
            r.raise_for_status()
            return r.content

    async def combine_pngs(self, class_id: str) -> tuple[str, str]:
        imgs = await asyncio.gather(
            *[self._fetch_png(class_id, f["id"]) for f in self.figures]
        )
        pil = [Image.open(io.BytesIO(b)).convert("RGBA") for b in imgs]

        cols = math.ceil(math.sqrt(len(pil)))
        rows = math.ceil(len(pil) / cols)
        w, h = max(i.width for i in pil), max(i.height for i in pil)

        sheet = Image.new("RGBA", (cols * w, rows * h), FIG_COLORS["bg"])
        for idx, im in enumerate(pil):
            r, c = divmod(idx, cols)
            sheet.paste(im, (c * w, r * h))

        out_dir = self._out_dir()
        path = os.path.join(out_dir, "combined.png")
        sheet.save(path)
        return path, "combined.png"

    async def zip_pngs(self, class_id: str) -> tuple[str, str]:
        imgs = await asyncio.gather(
            *[self._fetch_png(class_id, f["id"]) for f in self.figures]
        )
        bio = io.BytesIO()
        with zipfile.ZipFile(bio, "w", zipfile.ZIP_DEFLATED) as zf:
            for fig, data in zip(self.figures, imgs):
                safe = self._safe(fig["title"]) + ".png"
                zf.writestr(safe, data)
        bio.seek(0)
        out_dir = self._out_dir()
        zip_path = os.path.join(out_dir, "figures_png.zip")
        with open(zip_path, "wb") as fp:
            fp.write(bio.getvalue())
        return zip_path, "figures_png.zip"

    # -------------------------------------------------------------- LaTeX --
    def combine_latex(self) -> tuple[str, str]:
        combined_body = "\n".join(
            self._figure_block(f["code"], f["title"]) for f in self.figures
        )
        doc = self._minimal_doc(preamble_code="", body_code=combined_body)
        return self._write(doc, "combined.tex")

    def zip_latexs(self) -> tuple[str, str]:
        bio = io.BytesIO()
        with zipfile.ZipFile(bio, "w", zipfile.ZIP_DEFLATED) as zf:
            for f in self.figures:
                body = self._figure_block(f["code"], f["title"], caption=False)
                tex = self._minimal_doc(preamble_code="", body_code=body)
                zf.writestr(self._safe(f["title"]) + ".tex", tex)
        bio.seek(0)
        out_dir = self._out_dir()
        path = os.path.join(out_dir, "figures_tex.zip")
        with open(path, "wb") as fp:
            fp.write(bio.getvalue())
        return path, "figures_tex.zip"

    # --------------------------------------------------------------- PDF ---
    def combine_pdf(self) -> tuple[str, str]:
        preamble, figures = set(), []
        for f in self.figures:
            pre, body = _split_preamble(f["code"])
            # ✱ 1.  Strip any class / begin‑end doc lines entirely
            pre = [
                ln
                for ln in pre
                if not re.match(
                    r"\\(documentclass|begin{document}|end{document})", ln.strip()
                )
            ]
            preamble.update(pre)
            figures.append(self._figure_block("\n".join(body), f["title"]))

        tex_string = self._minimal_doc(
            preamble_code="\n".join(sorted(set(preamble))), body_code="\n".join(figures)
        )

        out = pathlib.Path(self._out_dir())
        tex = out / "combined.tex"
        tex.write_text(tex_string, encoding="utf-8")

        cmd = ["latexmk", "-pdf", "-interaction=nonstopmode", tex.name]
        proc = subprocess.run(
            cmd, cwd=out, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
        )
        if proc.returncode != 0:
            # grab only the '!' error lines for the log
            err_lines = [
                line
                for line in proc.stdout.splitlines()
                if line.lstrip().startswith("!")
            ]
            logging.error(
                "LaTeX failed:\n%s",
                "\n".join(err_lines[:20] or ["<no '! lines found>"]),
            )
            raise RuntimeError("LaTeX compilation failed (see server log)")
        return str(out / "combined.pdf"), "combined.pdf"

    # ------------------------------------------------ util ---------------

    def _figure_block(self, body_code: str, title: str, caption: bool = True) -> str:
        # enlarge every snippet
        body_code = self._enlarge(body_code)

        # if the snippet already owns its own figure/doc env, don't nest another one
        if FIG_OR_DOC_RE.search(body_code):
            return body_code + "\n\\clearpage"

        cap = f"\\caption{{{title}}}" if caption else ""
        return (
            "\\begin{figure}[htbp]\\centering\n"
            + body_code
            + "\n"
            + cap
            + "\n\\end{figure}\n\\clearpage"
        )

    def _enlarge(self, code: str) -> str:
        """Wrap code in a resizebox that scales it to 50% of the linewidth."""
        return "\\resizebox{0.5\\linewidth}{!}{%\n" + code.strip() + "\n}"

    def _minimal_doc(self, *, preamble_code: str, body_code: str) -> str:
        body_code = re.sub(r"\\end{document}.*", "", body_code, flags=re.S)
        body_code = re.sub(r"\\begin{document}", "", body_code)
        return "\n".join(
            [
                r"\documentclass{article}",
                r"\usepackage[margin=1in]{geometry}",
                r"\usepackage{tikz,pgfplots,amsmath,amssymb}",
                preamble_code,  # <— injected extras
                r"\pgfplotsset{compat=newest}",
                r"\begin{document}",
                body_code,
                r"\end{document}",
            ]
        )

    def _write(self, text: str, filename: str) -> tuple[str, str]:
        out_dir = self._out_dir()
        path = os.path.join(out_dir, filename)
        with open(path, "w") as fp:
            fp.write(text)
        return path, filename

    def _out_dir(self) -> str:
        d = os.path.join(FIGURES_DIR, self.figures[0]["id"])
        os.makedirs(d, exist_ok=True)
        return d

    @staticmethod
    def _safe(name: str) -> str:
        return re.sub(r"[^\w\.]", "_", name)
