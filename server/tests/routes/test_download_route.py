# tests/routes/test_download_route.py
import os
import re
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
import asyncio

from app.extensions import get_supabase
from app.routes.download_route import router  # adjust if your module path is different


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


@pytest.fixture
def mock_supabase(monkeypatch, supabase):
    """
    Fixture to ensure the download_route uses our test supabase instance
    """
    monkeypatch.setattr("app.routes.download_route.get_supabase", lambda: supabase)
    return supabase


#
# ─── FIGURE DOWNLOAD TESTS ─────────────────────────────────────────────────────
#
def test_figure_chat_not_found(client, mock_supabase):
    r = client.get("/figure", params=[("figure_ids", "f1"), ("format", "png")])
    assert r.status_code == 404
    assert r.json()["detail"] == "Chat not found"


def test_figure_not_found(client, mock_supabase):
    # insert only a chat
    mock_supabase.table("chats").insert({"id": "chat1", "class": "cls1"}).execute()

    r = client.get(
        "/figure",
        params=[("figure_ids", "fig1"), ("chat_id", "chat1"), ("format", "png")],
    )
    assert r.status_code == 404
    assert r.json()["detail"] == "Figures not found"


@pytest.mark.parametrize("zip_flag,expected_type,expected_name", [
    (False, "image/png", "out.png"),
    (True,  "application/zip", "out.zip"),
])
def test_figure_png_variants(client, mock_supabase, monkeypatch, tmp_path, zip_flag, expected_type, expected_name):
    # prep DB with more complete figure data
    mock_supabase.table("chats").insert({"id": "chatPNG", "class": "clsPNG"}).execute()
    mock_supabase.table("figures").insert({
        "id": "figPNG",
        "code": "\\begin{tikzpicture}\\end{tikzpicture}",
        "title": "Test Figure",
        "description": "A test figure"
    }).execute()

    # Create dummy files that will be returned by our mocked functions
    png_path = tmp_path / "c.png"
    png_path.write_bytes(b"dummy png data")
    
    zip_path = tmp_path / "z.zip"
    zip_path.write_bytes(b"dummy zip data")

    # Mock the route handler's functions directly
    if zip_flag:
        async def mock_zip_pngs(*args, **kwargs):
            return str(zip_path), "out.zip"
        monkeypatch.setattr("app.routes.download_route.FigureDownloader.zip_pngs", mock_zip_pngs)
    else:
        async def mock_combine_pngs(*args, **kwargs):
            return str(png_path), "out.png"
        monkeypatch.setattr("app.routes.download_route.FigureDownloader.combine_pngs", mock_combine_pngs)

    params = [
        ("figure_ids", "figPNG"),
        ("chat_id", "chatPNG"),
        ("format", "png"),
    ]
    if zip_flag:
        params.append(("zip", "true"))

    r = client.get("/figure", params=params)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith(expected_type)
    disp = r.headers["content-disposition"]
    assert f"filename={expected_name}" in disp
    # Check that we got the dummy data
    expected_content = b"dummy zip data" if zip_flag else b"dummy png data"
    assert r.content == expected_content


def test_figure_all_formats(client, mock_supabase, monkeypatch, tmp_path):
    # prep DB with more complete figure data
    mock_supabase.table("chats").insert({"id": "chatAll", "class": "clsAll"}).execute()
    mock_supabase.table("figures").insert({
        "id": "f1",
        "code": "\\begin{tikzpicture}\\end{tikzpicture}",
        "title": "Test Figure",
        "description": "A test figure"
    }).execute()

    class DummyFig:
        def __init__(self, figs): 
            self.figures = figs  # Store figures for later use

        async def combine_pngs(self, c): 
            p = tmp_path / "P.png"; p.write_bytes(b"")
            return str(p), "P.png"
            
        async def zip_pngs(self, c):    
            p = tmp_path / "Z.zip"; p.write_bytes(b"")
            return str(p), "Z.zip"
            
        def combine_latex(self):
            p = tmp_path / "L.tex"; p.write_text("")
            return str(p), "L.tex"
            
        def zip_latexs(self):
            p = tmp_path / "L.zip"; p.write_bytes(b"")
            return str(p), "L.zip"
            
        def combine_pdf(self):
            p = tmp_path / "P.pdf"; p.write_bytes(b"")
            return str(p), "P.pdf"
            
        def _figure_block(self, code, title):
            return f"\\begin{{figure}}\\caption{{{title}}}\\end{{figure}}"

    monkeypatch.setattr(
        "app.services.download.figures.FigureDownloader", DummyFig
    )

    # latex non-zip
    r = client.get(
        "/figure",
        params=[("figure_ids", "f1"), ("chat_id", "chatAll"), ("format", "latex")],
    )
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/x-tex")

    # latex zip
    r = client.get(
        "/figure",
        params=[
            ("figure_ids", "f1"),
            ("chat_id", "chatAll"),
            ("format", "latex"),
            ("zip", "true"),
        ],
    )
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/zip")

    # pdf
    r = client.get(
        "/figure",
        params=[("figure_ids", "f1"), ("chat_id", "chatAll"), ("format", "pdf")],
    )
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/pdf")


#
# ─── SUMMARY DOWNLOAD TESTS ────────────────────────────────────────────────────
#
def test_summary_chat_not_found(client, mock_supabase):
    r = client.get("/summary", params=[("summary_ids", "s1"), ("format", "pdf"), ("chat_id", "no-such-chat")])
    assert r.status_code == 404
    assert r.json()["detail"] == "Chat not found"


def test_summary_not_found(client, mock_supabase):
    mock_supabase.table("chats").insert({"id": "chatS", "class": "clsS", "name": "NM"}).execute()
    r = client.get(
        "/summary",
        params=[("summary_ids", "sX"), ("chat_id", "chatS"), ("format", "pdf")],
    )
    assert r.status_code == 404
    assert r.json()["detail"] == "Summaries not found"


@pytest.mark.parametrize("zip_flag,fmt,exp_type,uses_zip_method", [
    (False, "pdf", "application/pdf",    "download_pdf"),
    (False, "latex", "application/x-tex","download_latex"),
    (True,  "pdf", "application/zip",    "zip_pdfs"),
    (True,  "latex", "application/zip",  "zip_latexs"),
])
def test_summary_variants(client, mock_supabase, monkeypatch, tmp_path, zip_flag, fmt, exp_type, uses_zip_method):
    # prep DB with more complete data
    mock_supabase.table("chats").insert({"id":"chatSum","class":"clsSum","name":"MyChat"}).execute()
    # one summary referencing a figure & a doc
    mock_supabase.table("summaries").insert({
        "id":"s1",
        "title":"T1",
        "preamble":"P1",
        "body":"<DOCUMENT>d1</DOCUMENT>",
        "conclusion":"C1",
        "references":[],
        "figures":["f1"],
        "content": "Test content"  # Add content field
    }).execute()
    mock_supabase.table("figures").insert({
        "id":"f1",
        "code": "\\begin{tikzpicture}\\end{tikzpicture}",
        "title": "Test Figure"
    }).execute()
    mock_supabase.table("documents").insert({
        "id":"d1",
        "file":"file1",
        "page": 1,  # Add page field
        "title": "Test Document"
    }).execute()
    mock_supabase.table("files").insert({"id":"file1", "type":"pdf", "title":"Test File"}).execute()

    # dummy downloader with more complete implementation
    class DummySum:
        def __init__(self, summaries, fig_map, doc_map, files, class_id, chat_id): 
            self.summaries = summaries
            self.fig_map = fig_map
            self.doc_map = doc_map
            self.files = files
            
        def _page_ranges(self, docs):
            # Mock implementation that doesn't rely on page field
            return [(1, 1)]
            
        def _insert_docs(self, raw):
            # Mock implementation that doesn't try to process docs
            return raw

        def download_pdf(self, title):
            p = tmp_path/"out.pdf"; p.write_bytes(b""); return str(p)

        def download_latex(self, title):
            p = tmp_path/"out.tex"; p.write_text(""); return str(p)

        def zip_pdfs(self, title):
            p = tmp_path/"zp.zip"; p.write_bytes(b""); return str(p), "zp.zip"

        def zip_latexs(self, title):
            p = tmp_path/"zl.zip"; p.write_bytes(b""); return str(p), "zl.zip"
            
        def save(self, *args, **kwargs):
            return True

    monkeypatch.setattr(
        "app.services.download.summaries.SummaryDownloader", DummySum
    )

    params = [
        ("summary_ids","s1"),
        ("chat_id","chatSum"),
        ("format",fmt),
    ]
    if zip_flag:
        params.append(("zip","true"))

    r = client.get("/summary", params=params)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith(exp_type)
    cd = r.headers["content-disposition"]
    # check filename matches expectation
    if zip_flag:
        assert "filename=" in cd
    else:
        # non-zip uses chat name
        ext = ".pdf" if fmt=="pdf" else ".tex"
        assert f"{'MyChat'}{ext}" in cd


#
# ─── QUESTIONS DOWNLOAD TESTS ─────────────────────────────────────────────────
#
def test_questions_not_found(client, mock_supabase):
    r = client.get(
        "/questions",
        params=[("chat_id","cQ"),("question_ids","q1"),("format","pdf")],
    )
    assert r.status_code == 404
    assert r.json()["detail"] == "Questions not found"


@pytest.mark.parametrize("zip_flag,fmt,exp_type,method", [
    (False, "pdf", "application/pdf",    "download_pdf"),
    (False, "latex","application/x-tex", "download_latex"),
    (True,  "pdf", "application/zip",    "zip_pdfs"),
    (True,  "latex","application/zip",    "zip_latexs"),
])
def test_questions_variants(client, mock_supabase, monkeypatch, tmp_path, zip_flag, fmt, exp_type, method):
    # prep DB
    # two questions: one MCQ (frq=True), one FRQ (frq=False)
    mock_supabase.table("questions").insert([
        {"id":"q1","title":"T1","problem":"P1","options":["o"],"answers":["a"],"explanations":["e"],"references":[],"figures":[],"frq":True},
        {"id":"q2","title":"","problem":"LongProblemTextHere...","solution":"S2","references":[],"figures":[],"frq":False},
    ]).execute()

    # dummy downloader
    class DummyQ:
        def __init__(self, qdata, title, dir_id): pass

        def download_pdf(self):
            p = tmp_path/"q.pdf"; p.write_bytes(b""); return str(p)

        def download_latex(self):
            p = tmp_path/"q.tex"; p.write_text(""); return str(p)

        def zip_pdfs(self, title):
            p = tmp_path/"zq.zip"; p.write_bytes(b""); return str(p), "zq.zip"

        def zip_latexs(self, title):
            p = tmp_path/"zlq.zip"; p.write_bytes(b""); return str(p), "zlq.zip"

    monkeypatch.setattr(
        "app.services.download.questions.QuestionsDownloader", DummyQ
    )

    params = [
        ("chat_id","any"),
        ("question_ids","q1"),
        ("question_ids","q2"),
        ("format",fmt),
    ]
    if zip_flag:
        params.append(("zip","true"))

    r = client.get("/questions", params=params)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith(exp_type)
    cd = r.headers["content-disposition"]
    # ensure filename sanitized
    assert re.match(r".+\.(pdf|tex|zip)", cd.split("filename=")[1])
