import re
from collections import defaultdict
import time
from typing import Dict, List, Tuple, Any, Callable
import json
import logging
import math
from app.services.chat.utils.google import GoogleFiles
from app.services.chat.models.general import Reference, ReferencesOutputSchema
from app.extensions import get_supabase, get_google
from google.genai import types

logger = logging.getLogger(__name__)


def clean_references(text: str, references: Dict[int, Dict[str, Any]]) -> str:
    """
    Replace citation references with <DOCUMENT>doc_id</DOCUMENT> tags.

    Handles multiple citation formats:
    - "[n]" - Single reference
    - "[n, m]" - Multiple comma-separated references
    - "[n, p. x]" - Reference with page number (ignores page info)
    - "[n-m]" - Range of references from n to m inclusive

    - If references[n]["file"] is True, we look up *all* documents whose
      .file == that file_id and emit one DOCUMENT tag per document.
    - Otherwise we emit a single DOCUMENT tag for that reference.
    """
    supabase = get_supabase()

    # 1) find which reference numbers point at files
    file_nums = {
        num: entry["id"] for num, entry in references.items() if entry.get("file")
    }

    # 2) batch-fetch documents for those files
    file_to_docs: Dict[str, list[str]] = defaultdict(list)
    if file_nums:
        file_ids = list(file_nums.values())
        rows = (
            supabase.table("documents")
            .select("id,file")
            .in_("file", file_ids)
            .execute()
            .data
            or []
        )
        for r in rows:
            file_to_docs[r["file"]].append(r["id"])

    # 3) replacement function for citation patterns
    def _replace(match: re.Match) -> str:
        citation_text = match.group(1)
        nums = []

        # Check for range pattern [n-m]
        range_match = re.match(r"(\d+)\s*-\s*(\d+)", citation_text)
        if range_match:
            start, end = int(range_match.group(1)), int(range_match.group(2))
            nums = list(range(start, end + 1))  # inclusive range
        else:
            # Handle comma-separated references and page numbers
            for part in citation_text.split(","):
                # Extract just the reference number, ignoring page info
                num_match = re.match(r"\s*(\d+)", part)
                if num_match:
                    nums.append(int(num_match.group(1)))

        parts: list[str] = []
        for n in nums:
            entry = references.get(n)
            if not entry:
                continue
            if entry.get("file"):
                # expand to every doc under that file
                fid = entry["id"]
                for doc_id in file_to_docs.get(fid, []):
                    parts.append(f"<DOCUMENT>{doc_id}</DOCUMENT>")
            else:
                # single document
                parts.append(f"<DOCUMENT>{entry['id']}</DOCUMENT>")
        return "".join(parts)

    # 4) apply across the entire text
    return re.sub(r"\[([0-9\s,\-\.p]+)\]", _replace, text)


async def fetch_chat_context(supabase, chat_id, class_id):
    # get all the messages in the chat
    messages = (
        supabase.table("messages").select("*").eq("chat", chat_id).execute().data or []
    )

    # get all of the figures for all the messages. Get figures where .message is in this messages list
    figures = (
        supabase.table("figures")
        .select("*")
        .in_("message", [message.get("id") for message in messages])
        .execute()
        .data
        or []
    )

    # get all of the summaries for all the messages. Get summaries where .message is in this messages list
    summaries = (
        supabase.table("summaries")
        .select("*")
        .in_("message", [message.get("id") for message in messages])
        .execute()
        .data
        or []
    )

    # get all of the questions for all the messages. Get questions where .message is in this messages list
    questions = (
        supabase.table("questions")
        .select("*")
        .in_("message", [message.get("id") for message in messages])
        .execute()
        .data
        or []
    )

    # get all of the outcomes for the class
    outcomes = (
        supabase.table("outcomes")
        .select("*")
        .eq("class", class_id)
        .eq("deleted", False)
        .execute()
        .data
        or []
    )

    # return list of figures, summaries, questions, in sorted order by created_at. Want to return the ids of each of these.
    figures = sorted(figures, key=lambda x: x.get("created_at"))
    summaries = sorted(summaries, key=lambda x: x.get("created_at"))
    questions = sorted(questions, key=lambda x: x.get("created_at"))
    return {
        "figures": [figure.get("id") for figure in figures],
        "summaries": [summary.get("id") for summary in summaries],
        "questions": [question.get("id") for question in questions],
        "outcomes": [outcome.get("id") for outcome in outcomes],
    }


# ------------------------------------------------------------
# helpers
# ------------------------------------------------------------
def format_ts(seconds: float | int | None) -> str:
    """
    Convert seconds → "MM:SS".
    • Pads minutes and seconds with leading zeros (00 - 99).
    • If seconds is None, returns "??:??".
    """
    if seconds is None:
        return "??:??"
    seconds = int(math.floor(seconds))
    m, s = divmod(seconds, 60)
    return f"{m:02d}:{s:02d}"


def doc_label(doc: dict, parent_type: str, ref_num: int) -> str:
    """
    Build the left-hand label before '-> DOCUMENT n'
    using the *new* MM:SS format for A/V files.
    """
    if parent_type in {"audio", "video"} and doc.get("start_time") is not None:
        start = format_ts(doc["start_time"])
        end = (
            f"-{format_ts(doc['end_time'])}" if doc.get("end_time") is not None else ""
        )
        return f"{start}{end} -> DOCUMENT {ref_num}"

    # fallback for PDFs, images, etc.
    return f"Page {doc['page']} -> DOCUMENT {ref_num}"


# ──────────────────────────────────────────────────────────────
# extra helper -------------------------------------------------
def reference_title(doc: dict, parent_type: str, file_title: str) -> str:
    """Produce a human-friendly title for a single document reference."""
    if parent_type in {"audio", "video"} and doc.get("start_time") is not None:
        start = format_ts(doc["start_time"])
        end = (
            f"-{format_ts(doc['end_time'])}" if doc.get("end_time") is not None else ""
        )
        return f"{file_title} - {start}{end}"
    else:  # PDFs, images …
        page = doc.get("page", 0)
        return f"{file_title} - Page {page}"


# ─── helper to build the page-range suffix ──────────────────────────────
def _page_range_for_file(docs: List[dict]) -> str:
    pages = sorted(d.get("page", 0) for d in docs if "page" in d)
    if not pages:
        return ""
    return f" (pages {pages[0]}-{pages[-1]})"


# ─── helper that yields (expanded, all, mapping) ─────────────────────────
async def get_mapped_references(
    supabase,
    file_ids: List[str] | None,  # files in *this* message
    document_ids: List[str] | None,  # pages in *this* message
    all_file_ids: List[str] | None,  # files seen in the chat
    all_document_ids: List[str] | None,  # pages seen in the chat
) -> Tuple[
    List[Reference],  # expanded_refs   (this-turn + pages)
    List[Reference],  # all_refs        (whole-chat)
    Dict[int, Dict[str, Any]],
]:
    # ------------------------------------------------------------------ #
    # 0) normalise sets
    cur_fset = set(file_ids or [])
    cur_dset = set(document_ids or [])
    all_fset = set(all_file_ids or []) | cur_fset
    all_dset = set(all_document_ids or []) | cur_dset
    if not (all_fset or all_dset):
        return [], [], {}

    # ------------------------------------------------------------------ #
    # 1) pull every document row we need (for the *whole* chat)
    or_clauses = []
    if all_dset:
        or_clauses.append(f"id.in.({','.join(all_dset)})")
    if all_fset:
        or_clauses.append(f"file.in.({','.join(all_fset)})")

    doc_rows = (
        supabase.table("documents").select("*").or_(",".join(or_clauses)).execute().data
        or []
    )
    docs_by_file: Dict[str, List[dict]] = defaultdict(list)
    for r in doc_rows:
        docs_by_file[r["file"]].append(r)

    file_rows = (
        supabase.table("files")
        .select("*")
        .in_("id", list({r["file"] for r in doc_rows} | all_fset))
        .execute()
        .data
        or []
    )
    file_meta = {f["id"]: f for f in file_rows}

    # ------------------------------------------------------------------ #
    # 2) upload to Google (only pages referenced *this* turn)
    gf = GoogleFiles(
        file_ids=list({r["file"] for r in doc_rows} | all_fset),
        document_ids=list(cur_dset),
        supabase_client=supabase,
    )
    file_gids = dict(zip((m["file_id"] for m in gf.files_data), gf.get_files()))
    document_gids = dict(
        zip((m["document_id"] for m in gf.documents_data), gf.get_documents())
    )

    # ------------------------------------------------------------------ #
    # 3) build all_refs + global mapping
    next_num = 1
    mapping_all: Dict[int, Dict[str, Any]] = {}
    all_refs: List[Reference] = []

    def _assign(id_: str, is_file: bool) -> int:
        nonlocal next_num
        mapping_all[next_num] = {"id": id_, "file": is_file}
        next_num += 1
        return next_num - 1

    for fid in sorted(
        {r["file"] for r in doc_rows} | all_fset, key=lambda i: file_meta[i]["title"]
    ):
        meta = file_meta[fid]
        ftype = meta["type"]

        num = _assign(fid, True)
        all_refs.append(
            Reference(
                number=num,
                title=meta["title"] + _page_range_for_file(docs_by_file[fid]),
                url=file_gids.get(fid, ""),
                file=True,
            )
        )

        key_fn = (
            (lambda d: d.get("start_time") or 0)
            if ftype in {"audio", "video"}
            else (lambda d: d.get("page", 0))
        )
        for doc in sorted(docs_by_file[fid], key=key_fn):
            did = doc["id"]
            dnum = _assign(did, False)
            all_refs.append(
                Reference(
                    number=dnum,
                    title=reference_title(doc, ftype, meta["title"]),
                    url=document_gids.get(did, ""),
                    file=False,
                )
            )

    # after you finish building mapping_all + all_refs  ────────────────
    id_to_num = {entry["id"]: num for num, entry in mapping_all.items()}

    expanded_nums: set[int] = set()

    # — direct hits (whatever was attached this turn) ------------------
    for n, entry in mapping_all.items():
        if (entry["file"] and entry["id"] in cur_fset) or (
            not entry["file"] and entry["id"] in cur_dset
        ):
            expanded_nums.add(n)

    # — add every page that belongs to those files ---------------------
    for fid in cur_fset:  # each file uploaded *this* turn
        for doc in docs_by_file[fid]:  # every page row of that file
            doc_id_num = id_to_num.get(doc["id"])
            if doc_id_num is not None:
                expanded_nums.add(doc_id_num)

    expanded_refs = [r for r in all_refs if r.number in expanded_nums]

    return expanded_refs, all_refs, mapping_all


def emit_user_references(references: List[Reference]) -> List[Dict[str, Any]]:
    """
    Emit the two-part tool call:
    """
    if not references:
        return []

    payload = ReferencesOutputSchema(references=references).model_dump()

    return [
        {
            "type": "function_call",
            "name": "user_references",
            "id": "references",
            "call_id": "references",
            "arguments": json.dumps({}),
            "status": "completed",
        },
        {
            "type": "function_call_output",
            "id": "references",
            "call_id": "references",
            "output": json.dumps(payload),
            "status": "completed",
        },
    ]


def emit_google_references(references: List[Reference]) -> List[Dict[str, Any]]:
    # insert these into the conversation history
    inputs = []
    for reference in references:
        if reference.url:
            inputs.append(
                {
                    "type": "input_image",
                    "image_url": f"https://generativelanguage.googleapis.com/v1beta/{reference.url}",
                    "detail": "low",
                }
            )
            inputs.append(
                {
                    "type": "input_text",
                    "text": f"Reference {reference.number}: {reference.title}",
                }
            )
    return inputs


def emit_google_cache(
    chat_id: str,
    model: str,
    system_prompt: str,
    new_references: bool,
    all_references: List[Reference],  # references for all messages in the chat
    token_limit: int = 50_000,
) -> str | None:
    """
    Creates/refreshes a Google Gemini cache for a chat only when:
      - the existing cache is expired/absent, OR
      - we see new file/document references since last time.
    Returns the (possibly reused) cache name, or None if no cache is needed.
    """
    supabase = get_supabase()
    google = get_google()

    # ————————————————
    # 1) Load existing cache row (if any)
    rows = supabase.table("google").select("*").eq("chat", chat_id).execute().data or []

    upsert_data: Dict[str, Any] = {"chat": chat_id}

    old_cache_name = None
    if rows:
        old = rows[0]
        upsert_data["id"] = old["id"]  # ensure update, not insert
        old_cache_name = old.get("google_id")

    # ————————————————
    # 3) If we have an old cache and no new references and it's still unexpired → reuse
    if old_cache_name and not new_references:
        try:
            cache_obj = google.caches.get(name=old_cache_name)
            # assume expire_time is a datetime with .timestamp()
            if cache_obj.expire_time.timestamp() > time.time() + 20:
                logger.info(f"Reusing cache {old_cache_name}; no new refs")
                return old_cache_name
        except Exception:
            # expired / missing → fall through to create new
            logger.info(f"Existing cache {old_cache_name} invalid or expired")

    # ————————————————
    # 4) Fetch all File objects
    file_objects = []
    for ref in all_references:
        if ref.url:
            try:
                f = google.files.get(name=ref.url)
                file_objects.append(f)
            except Exception as e:
                logger.error(f"Couldn't fetch {ref.url}: {e}")

    if not file_objects:
        return None

    # 5) Count tokens; bail if under threshold
    tc = google.models.count_tokens(
        model=model.replace("gemini/", ""), contents=[system_prompt] + file_objects
    )
    # `tc.total_tokens` if the SDK returns a usage object
    total = getattr(tc, "total_tokens", tc)
    if total < token_limit:
        logger.info(f"Only {total} tokens; below {token_limit}, no cache needed")
        return None

    # ————————————————
    # 6) Create new cache
    cache = google.caches.create(
        model=model.replace("gemini/", ""),
        config=types.CreateCachedContentConfig(
            system_instruction=system_prompt, contents=file_objects, ttl="300s"
        ),
    )
    logger.info(
        f"Created cache {cache.name}; tokens used={cache.usage_metadata.total_token_count}"
    )

    # 7) Upsert cache info *and* update used_files/used_documents
    upsert_data.update(
        {"google_id": cache.name, "tokens": cache.usage_metadata.total_token_count}
    )
    supabase.table("google").upsert(upsert_data).execute()

    return cache.name


def get_cached_tokens(cache_name: str) -> int:
    supabase_client = get_supabase()
    rows = (
        supabase_client.table("google")
        .select("*")
        .eq("google_id", cache_name)
        .execute()
        .data
        or []
    )
    if not rows:
        return 0
    return rows[0].get("tokens", 0)


# ── Generic small utilities ────────────────────────────────────────────────
def _get_refs_rev(documents) -> Dict[str, int]:
    """
    Build a lookup from document_id → ref_number
    assuming documents.references is Dict[int, {"id": str, ...}].
    """
    return {
        entry["id"]: num for num, entry in documents.references.items() if "id" in entry
    }


def _replace_tags(text: str, token_pat: str, repl_fn: Callable[[str], str]) -> str:
    for token in re.findall(token_pat, text):
        text = text.replace(token, repl_fn(token))
    return text


def _process_doc_tags(text: str, refs_rev: Dict[str, int]) -> str:
    return re.sub(
        r"<DOCUMENT>(.*?)</DOCUMENT>",
        lambda m: f"[{refs_rev.get(m.group(1), 'unknown')}]",
        text,
    )


def _process_fig_tags(text: str, figs_rev: Dict[str, int]) -> str:
    return re.sub(
        r"<FIGURE>(.*?)</FIGURE>",
        lambda m: f"{{{figs_rev.get(m.group(1), 'unknown figure')}}}",
        text,
    )


# ── DB → model mappers  (all ≤ 6 lines each) ──────────────────────────────
def _row_to_figure(row, refs_rev) -> Dict[str, Any]:
    return {
        "title": row.get("title", ""),
        "latex_code": row.get("code", ""),
        "references": [
            refs_rev[r] for r in (row.get("references") or []) if r in refs_rev
        ],
    }


def _row_to_question(row, refs_rev, fig_rows, figs_rev) -> Dict[str, Any]:
    return {
        "title": row.get("title", ""),
        "question_type": "frq" if row.get("frq") else "mcq",
        "question": _process_fig_tags(
            _process_doc_tags(row.get("question", ""), refs_rev), figs_rev
        ),
        "options": row.get("options", []),
        "answer": (row.get("answers") or [""])[0],
        "explanations": row.get("explanations", []),
        "references": [
            refs_rev[r] for r in (row.get("references") or []) if r in refs_rev
        ],
        "figures": [_row_to_figure(f, refs_rev) for f in fig_rows],
    }


def _row_to_summary(row, refs_rev, fig_rows, figs_rev) -> Dict[str, Any]:
    def proc(t):
        return _process_fig_tags(_process_doc_tags(t, refs_rev), figs_rev)

    return {
        "title": row.get("title", ""),
        "preamble": proc(row.get("preamble", "")),
        "body": proc(row.get("body", "")),
        "conclusion": proc(row.get("conclusion", "")),
        "references": [
            refs_rev[r] for r in (row.get("references") or []) if r in refs_rev
        ],
        "figures": [_row_to_figure(f, refs_rev) for f in fig_rows],
    }


def _row_to_report(row, refs_rev, fig_rows, figs_rev) -> Dict[str, Any]:
    def proc(t):
        return _process_fig_tags(_process_doc_tags(t, refs_rev), figs_rev)

    return {
        "title": row.get("title", ""),
        "content": proc(row.get("content", "")),
        "references": [
            refs_rev[r] for r in (row.get("references") or []) if r in refs_rev
        ],
        "figures": [_row_to_figure(f, refs_rev) for f in fig_rows],
    }


# ── One convenience for wiring up the chat-history blocks ────────────────
def _emit_call(
    tool_name: str, call_id: str, payload: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Return the standard [function_call, function_call_output] pair."""
    return [
        {
            "type": "function_call",
            "name": tool_name,
            "id": call_id,
            "call_id": call_id,
            "arguments": json.dumps(payload),
            "status": "completed",
        },
        {
            "type": "function_call_output",
            "id": call_id,
            "call_id": call_id,
            "output": json.dumps(payload.get("responses")),
            "status": "completed",
        },
    ]


# ── Fetch once, use everywhere ───────────────────────────────────────────
async def _fetch_rows(db, table: str, ids: List[str]) -> List[dict]:
    if not ids:
        return []
    return (
        db.table(table)
        .select("*")
        .in_("id", ids if isinstance(ids, list) else [ids])
        .execute()
        .data
        or []
    )


# ── Dispatch table that drives *everything*  # ★ ─────────────────────────
_KIND: Dict[str, Dict[str, Any]] = {
    "figure": {
        "singular": "create_figure",
        "plural": "create_figures",
        "id_key": "figure_id",
        "row_to_model": _row_to_figure,
        "table": "figures",
    },
    "question": {
        "singular": "create_question",
        "plural": "create_questions",
        "id_key": "question_id",
        "row_to_model": _row_to_question,
        "table": "questions",
    },
    "summary": {
        "singular": "create_summary",
        "plural": "create_summaries",
        "id_key": "summary_id",
        "row_to_model": _row_to_summary,
        "table": "summaries",
    },
    "report": {
        "singular": "create_report",
        "plural": "create_reports",
        "id_key": "report_id",
        "row_to_model": _row_to_report,
        "table": "reports",
    },
}


# ──────────────────────────────────────────────────────────────────────────
# Public entry-point that replaces the three old build_*_history routines
# and also auto-picks singular vs plural for _process_tags_from_message.
# ──────────────────────────────────────────────────────────────────────────
async def build_history(
    kind: str, ids: List[str], db, documents
) -> List[Dict[str, Any]]:
    """
    kind ∈ {'figure','question','summary', 'report'} ; ids = list of DB row IDs.
    """
    meta = _KIND[kind]
    refs_rev = _get_refs_rev(documents)

    rows = await _fetch_rows(db, meta["table"], ids)
    if not rows:
        return []

    # Figures nested inside Q/S
    fig_rows_by_id = {}
    if kind in ("question", "summary", "report"):
        fig_ids = [fid for r in rows for fid in (r.get("figures") or [])]
        fig_rows = await _fetch_rows(db, "figures", fig_ids)
        fig_rows_by_id = {r["id"]: r for r in fig_rows}

    models, responses = [], []
    for r in rows:
        # Build nested figs + {id → {1},{2},…} map where needed
        figs = [fig_rows_by_id[fid] for fid in (r.get("figures") or [])]
        figs_rev = {fid: idx + 1 for idx, fid in enumerate([f["id"] for f in figs])}
        model = (
            meta["row_to_model"](r, refs_rev, figs, figs_rev)
            if kind != "figure"
            else _row_to_figure(r, refs_rev)
        )
        models.append(model)
        responses.append({"success": True, "error": None, meta["id_key"]: r["id"]})

    single = len(models) == 1
    tool_name = meta["singular"] if single else meta["plural"]
    payload_key = f"{kind}{'' if single else 's'}"  # e.g. 'figure' vs 'figures'
    payload = {payload_key: models, "responses": responses}
    call_id = f"{kind}_{'_'.join(ids)}"
    return _emit_call(tool_name, call_id, payload)


# ──────────────────────────────────────────────────────────────────────────
#  process_special_tags  (top-level wrapper remains almost unchanged)
# ──────────────────────────────────────────────────────────────────────────
async def process_special_tags(
    message: str,
    supabase_client,
    documents,
    *,
    figure_id: str | None = None,
    question_id: str | None = None,
    summary_id: str | None = None,
    report_id: str | None = None,
):
    supplied = sum(
        x is not None for x in (figure_id, question_id, summary_id, report_id)
    )
    if supplied > 1:
        raise ValueError(
            "Pass at most one of figure_id / question_id / summary_id / report_id"
        )

    if figure_id:
        return await build_history("figure", [figure_id], supabase_client, documents)
    if question_id:
        return await build_history(
            "question", [question_id], supabase_client, documents
        )
    if summary_id:
        return await build_history("summary", [summary_id], supabase_client, documents)
    if report_id:
        return await build_history("report", [report_id], supabase_client, documents)

    # No ID fast-path → scan the raw message
    return await _process_tags_from_message(message, supabase_client, documents)


# ──────────────────────────────────────────────────────────────────────────
#  _process_tags_from_message  (only the *inside* changed)  # ★
# ──────────────────────────────────────────────────────────────────────────
async def _process_tags_from_message(message, db, documents) -> List[Dict[str, Any]]:
    """
    Same docstring as before, but now calls build_history() which in turn
    auto-selects singular vs plural tools. Almost all heavy lifting moved
    out, so this becomes ~60 lines instead of 300+.
    """

    refs_rev = _get_refs_rev(documents)
    parts: List[Dict[str, Any]] = []

    # --- cheap inline tag replacements (DOCUMENT/FIGURE placeholders) ----
    message = _process_doc_tags(message, refs_rev)
    # we'll replace <FIGURE>… later once we have figs_rev mapping

    # --- locate generation tags ------------------------------------------
    TAG_PAT = {
        "figure": r"<FIGURE_GENERATING>",
        "question": r"<QUESTION_GENERATING>",
        "summary": r"<SUMMARY_GENERATING>",
        "report": r"<REPORT_GENERATING>",
    }
    tags: List[Tuple[int, int, str]] = []
    for kind, pat in TAG_PAT.items():
        for m in re.finditer(pat, message):
            tags.append((m.start(), m.end(), kind))
    tags.sort()  # by start idx

    if not tags:
        return [{"role": "assistant", "content": message}]  # no magic tags

    # --- pull all rows we could possibly need in *one* go -----------------
    chat_id = documents.chat_id
    msgs = (db.table("messages").select("id").eq("chat", chat_id).execute().data) or []
    msg_ids = [m["id"] for m in msgs]

    # cache: table -> rows
    cache = {}
    for tbl in ("figures", "questions", "summaries", "reports"):
        cache[tbl] = (
            db.table(tbl).select("*").in_("message", msg_ids).execute().data
        ) or []

    # Build global figure-index map {fig_id: 1,2,3…} so we can replace
    figs_rev: Dict[str, int] = {}
    next_idx = 1
    for q in cache["questions"] + cache["summaries"] + cache["reports"]:
        for fid in q.get("figures", []):
            if fid not in figs_rev:
                figs_rev[fid] = next_idx
                next_idx += 1
    # last step: actually swap inline <FIGURE> tags in *whole* message
    message = _process_fig_tags(message, figs_rev)

    # --- walk the message and inject tool calls --------------------------
    last = 0
    for start, end, kind in tags:
        if start > last:
            txt = message[last:start]
            if txt.strip():
                parts.append({"role": "assistant", "content": txt})

        # collect the rows that belong to this message
        rows = [r for r in cache[_KIND[kind]["table"]] if r["message"] in msg_ids]
        ids = [r["id"] for r in rows]
        parts += await build_history(kind, ids, db, documents)
        last = end

    # trailing text
    if last < len(message):
        tail = message[last:]
        if tail.strip():
            parts.append({"role": "assistant", "content": tail})

    return parts
