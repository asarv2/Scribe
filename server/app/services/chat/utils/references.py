import re
from collections import defaultdict
from typing import Dict, List, Tuple, Any, Callable
import json
import logging
import math
from app.services.chat.models.main import Documents

logger = logging.getLogger(__name__)

def clean_references(text: str, references: Dict[int, str]) -> str:
    # Find all reference patterns like [1] or [1, 2, 3]
    ref_patterns = re.findall(r'\[([0-9\s,]+)\]', text)
    
    for pattern in ref_patterns:
        original = f"[{pattern}]"
        # Split by comma and strip whitespace for each number
        ref_nums = [int(num.strip()) for num in pattern.split(',')]
        
        # Replace with appropriate tags
        replacement = ""
        for num in ref_nums:
            if num in references:
                replacement += f"<DOCUMENT>{references[num]}</DOCUMENT>"
        
        text = text.replace(original, replacement)
    
    return text

async def fetch_chat_context(supabase, chat_id, class_id):
    # get all the messages in the chat
    messages = supabase.table("messages").select("*").eq("chat", chat_id).execute().data or []

    # get all of the figures for all the messages. Get figures where .message is in this messages list
    figures = supabase.table("figures").select("*").in_("message", [message.get("id") for message in messages]).execute().data or []

    # get all of the summaries for all the messages. Get summaries where .message is in this messages list
    summaries = supabase.table("summaries").select("*").in_("message", [message.get("id") for message in messages]).execute().data or []

    # get all of the questions for all the messages. Get questions where .message is in this messages list
    questions = supabase.table("questions").select("*").in_("message", [message.get("id") for message in messages]).execute().data or []

    # get all of the references from the figure.references, summary.references, and question.references
    references = {figure.get("id"): figure.get("references") for figure in figures}
    references.update({summary.get("id"): summary.get("references") for summary in summaries})
    references.update({question.get("id"): question.get("references") for question in questions})

    # get all of the outcomes for the class
    outcomes = supabase.table("outcomes").select("*").eq("class", class_id).eq("deleted", False).execute().data or []

    # return list of figures, summaries, questions, in sorted order by created_at. Want to return the ids of each of these.
    figures = sorted(figures, key=lambda x: x.get("created_at"))
    summaries = sorted(summaries, key=lambda x: x.get("created_at"))
    questions = sorted(questions, key=lambda x: x.get("created_at"))
    return {
        "figures": [figure.get("id") for figure in figures],
        "summaries": [summary.get("id") for summary in summaries],
        "questions": [question.get("id") for question in questions],
        "references": list(set(references)),
        "outcomes": [outcome.get("id") for outcome in outcomes]
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
    Build the left-hand label before '-> REFERENCE n'
    using the *new* MM:SS format for A/V files.
    """
    if parent_type in {"audio", "video"} and doc.get("start_time") is not None:
        start = format_ts(doc["start_time"])
        end   = (
            f"-{format_ts(doc['end_time'])}"
            if doc.get("end_time") is not None
            else ""
        )
        return f"{start}{end} -> REFERENCE {ref_num}"

    # fallback for PDFs, images, etc.
    return f"Page {doc['page']} -> REFERENCE {ref_num}"

# ------------------------------------------------------------
# main
# ------------------------------------------------------------
async def get_mapped_references(
    supabase,
    file_ids: List[str] | None,
    document_ids: List[str] | None,
    chat_references: List[str] | None,
) -> Tuple[Dict[int, str], str, List[str], List[str]]:

    logger.info(
        "Fetching mapped references for file_ids: %s, document_ids: %s, chat_refs: %s",
        file_ids,
        document_ids,
        chat_references,
    )

    # ---------- 1. normalise ----------
    orig_file_ids        = file_ids or []
    orig_document_ids    = document_ids or []

    file_ids_set         = set(orig_file_ids)
    direct_doc_ids       = set(orig_document_ids)
    chat_doc_ids         = set(chat_references or [])
    wanted_doc_ids       = direct_doc_ids | chat_doc_ids

    if not (file_ids_set or wanted_doc_ids):
        return {}, "", [], []                     # nothing to do

    # ---------- 2. pull docs ----------
    or_parts = []
    if wanted_doc_ids:
        or_parts.append(f"id.in.({','.join(wanted_doc_ids)})")
    if file_ids_set:
        or_parts.append(f"file.in.({','.join(file_ids_set)})")

    docs_query = supabase.table("documents").select("*")
    if or_parts:
        docs_query = docs_query.or_(",".join(or_parts))
    all_docs: List[dict] = docs_query.execute().data or []

    docs_by_file: Dict[str, List[dict]] = defaultdict(list)
    for d in all_docs:
        docs_by_file[d["file"]].append(d)

    # ---------- 3. fetch files we will mention ----------
    all_file_ids = {fid for fid in (docs_by_file.keys() | file_ids_set) if fid}
    file_rows = (
        supabase.table("files")
        .select("*")
        .in_("id", list(all_file_ids))
        .execute()
        .data
        or []
    )
    file_meta = {f["id"]: f for f in file_rows}

    # ---------- 4. build output ----------
    description_lines: List[str] = []
    ref_map: Dict[int, str] = {}
    ref_lookup: Dict[str, int] = {}
    next_ref = 1

    ordered_file_ids: List[str]     = []
    ordered_document_ids: List[str] = []

    # 4a. files supplied explicitly
    for fid in sorted(file_ids_set, key=lambda _id: file_meta[_id]["title"]):
        ordered_file_ids.append(fid)
        f_type = file_meta[fid]["type"]
        description_lines.append(file_meta[fid]["title"])

        # choose sort key based on type
        if f_type in {"audio", "video"}:
            key_fn = lambda d: (d.get("start_time") or 0.0)
        else:
            key_fn = lambda d: d.get("page", 0)

        for doc in sorted(docs_by_file.get(fid, []), key=key_fn):
            if doc["id"] not in ref_lookup:
                ref_lookup[doc["id"]] = next_ref
                ref_map[next_ref] = doc["id"]
                next_ref += 1
                if doc["id"] in direct_doc_ids:
                    ordered_document_ids.append(doc["id"])

            description_lines.append(
                doc_label(doc, f_type, ref_lookup[doc["id"]])
            )
        description_lines.append("")  # blank line

    # 4b. stray docs
    stray_docs = [
        d for d in all_docs if d["file"] not in file_ids_set
    ]
    # sort across files: (title, start/page)
    stray_docs.sort(
        key=lambda d: (
            file_meta[d["file"]]["title"],
            d.get("start_time") if file_meta[d["file"]]["type"] in {"audio", "video"} else d.get("page", 0),
        )
    )

    for doc in stray_docs:
        fid   = doc["file"]
        ftype = file_meta[fid]["type"]
        title = file_meta[fid]["title"]

        if fid not in ordered_file_ids:
            # we don't push fid itself to ordered_file_ids because the caller asked
            # that this list reflect only originals – not ‘discovered’ files.
            pass

        if doc["id"] not in ref_lookup:
            ref_lookup[doc["id"]] = next_ref
            ref_map[next_ref] = doc["id"]
            next_ref += 1
            if doc["id"] in direct_doc_ids:
                ordered_document_ids.append(doc["id"])

        description_lines.append(
            f"{title}, {doc_label(doc, ftype, ref_lookup[doc['id']])}"
        )

    # ---------- 5. finalise ----------
    if description_lines and description_lines[-1] == "":
        description_lines.pop()
    description = "\n".join(description_lines)

    return ref_map, description, ordered_file_ids, ordered_document_ids



# ── Generic small utilities ────────────────────────────────────────────────
def _get_refs_rev(documents) -> Dict[str, int]:
    return {v: k for k, v in documents.references.items()}

def _replace_tags(text: str,
                  token_pat: str,
                  repl_fn: Callable[[str], str]) -> str:
    for token in re.findall(token_pat, text):
        text = text.replace(token, repl_fn(token))
    return text

def _process_doc_tags(text: str, refs_rev: Dict[str, int]) -> str:
    return _replace_tags(
        text,
        r'<DOCUMENT>(.*?)</DOCUMENT>',
        lambda full: f"[{refs_rev.get(full[10:-11], 'unknown')}]"
    )

def _process_fig_tags(text: str, figs_rev: Dict[str, int]) -> str:
    return _replace_tags(
        text,
        r'<FIGURE>(.*?)</FIGURE>',
        lambda full: f"{{{figs_rev.get(full[8:-9], 'unknown figure')}}}"
    )

# ── DB → model mappers  (all ≤ 6 lines each) ──────────────────────────────
def _row_to_figure(row, refs_rev) -> Dict[str, Any]:
    return {
        "title": row.get("title", ""),
        "latex_code": row.get("code", ""),
        "references": [refs_rev[r] for r in (row.get("references") or []) if r in refs_rev],
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
        "references": [refs_rev[r] for r in (row.get("references") or []) if r in refs_rev],
        "figures": [_row_to_figure(f, refs_rev) for f in fig_rows],
    }

def _row_to_summary(row, refs_rev, fig_rows, figs_rev) -> Dict[str, Any]:
    proc = lambda t: _process_fig_tags(_process_doc_tags(t, refs_rev), figs_rev)
    return {
        "title": row.get("title", ""),
        "preamble": proc(row.get("preamble", "")),
        "body": proc(row.get("body", "")),
        "conclusion": proc(row.get("conclusion", "")),
        "references": [refs_rev[r] for r in (row.get("references") or []) if r in refs_rev],
        "figures": [_row_to_figure(f, refs_rev) for f in fig_rows],
    }

# ── One convenience for wiring up the chat-history blocks ────────────────
def _emit_call(tool_name: str,
               call_id: str,
               payload: Dict[str, Any]) -> List[Dict[str, Any]]:
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
        "plural":   "create_figures",
        "id_key":   "figure_id",
        "row_to_model": _row_to_figure,
        "table":    "figures",
    },
    "question": {
        "singular": "create_question",
        "plural":   "create_questions",
        "id_key":   "question_id",
        "row_to_model": _row_to_question,
        "table":    "questions",
    },
    "summary": {
        "singular": "create_summary",
        "plural":   "create_summaries",
        "id_key":   "summary_id",
        "row_to_model": _row_to_summary,
        "table":    "summaries",
    },
}

# ──────────────────────────────────────────────────────────────────────────
# Public entry-point that replaces the three old build_*_history routines
# and also auto-picks singular vs plural for _process_tags_from_message.
# ──────────────────────────────────────────────────────────────────────────
async def build_history(kind: str,
                        ids: List[str],
                        db,
                        documents) -> List[Dict[str, Any]]:
    """
    kind ∈ {'figure','question','summary'} ; ids = list of DB row IDs.
    """
    meta = _KIND[kind]
    refs_rev = _get_refs_rev(documents)

    rows = await _fetch_rows(db, meta["table"], ids)
    if not rows:
        return []

    # Figures nested inside Q/S
    fig_rows_by_id = {}
    if kind in ("question", "summary"):
        fig_ids = [fid for r in rows for fid in (r.get("figures") or [])]
        fig_rows = await _fetch_rows(db, "figures", fig_ids)
        fig_rows_by_id = {r["id"]: r for r in fig_rows}

    models, responses = [], []
    for r in rows:
        # Build nested figs + {id → {1},{2},…} map where needed
        figs = [fig_rows_by_id[fid] for fid in (r.get("figures") or [])]
        figs_rev = {fid: idx + 1 for idx, fid in enumerate([f["id"] for f in figs])}
        model = meta["row_to_model"](r, refs_rev, figs, figs_rev) \
            if kind != "figure" else _row_to_figure(r, refs_rev)
        models.append(model)
        responses.append({"success": True,
                          "error": None,
                          meta["id_key"]: r["id"]})

    single = len(models) == 1
    tool_name = meta["singular"] if single else meta["plural"]
    payload_key = f"{kind}{'' if single else 's'}"  # e.g. 'figure' vs 'figures'
    payload = {payload_key: models, "responses": responses}
    call_id = f"{kind}_{'_'.join(ids)}"
    return _emit_call(tool_name, call_id, payload)


# ──────────────────────────────────────────────────────────────────────────
#  process_special_tags  (top-level wrapper remains almost unchanged)
# ──────────────────────────────────────────────────────────────────────────
async def process_special_tags(message: str,
                               supabase_client,
                               documents,
                               *,
                               figure_id: str | None = None,
                               question_id: str | None = None,
                               summary_id: str | None = None,
                              ):
    supplied = sum(x is not None for x in (figure_id, question_id, summary_id))
    if supplied > 1:
        raise ValueError("Pass at most one of figure_id / question_id / summary_id")

    if figure_id:
        return await build_history("figure", [figure_id], supabase_client, documents)
    if question_id:
        return await build_history("question", [question_id], supabase_client, documents)
    if summary_id:
        return await build_history("summary", [summary_id], supabase_client, documents)

    # No ID fast-path → scan the raw message
    return await _process_tags_from_message(message, supabase_client, documents)

# ──────────────────────────────────────────────────────────────────────────
#  _process_tags_from_message  (only the *inside* changed)  # ★
# ──────────────────────────────────────────────────────────────────────────
async def _process_tags_from_message(message, db, documents):
    """
    Same docstring as before, but now calls build_history() which in turn
    auto-selects singular vs plural tools. Almost all heavy lifting moved
    out, so this becomes ~60 lines instead of 300+.
    """
    import json
    refs_rev = _get_refs_rev(documents)
    parts: List[Dict[str, Any]] = []

    # --- cheap inline tag replacements (DOCUMENT/FIGURE placeholders) ----
    message = _process_doc_tags(message, refs_rev)
    # we'll replace <FIGURE>… later once we have figs_rev mapping

    # --- locate generation tags ------------------------------------------
    TAG_PAT = {
        "figure":   r'<FIGURE_GENERATING>',
        "question": r'<QUESTION_GENERATING>',
        "summary":  r'<SUMMARY_GENERATING>',
    }
    tags: List[Tuple[int,int,str]] = []
    for kind, pat in TAG_PAT.items():
        for m in re.finditer(pat, message):
            tags.append((m.start(), m.end(), kind))
    tags.sort()  # by start idx

    if not tags:
        return [{"role": "assistant", "content": message}]  # no magic tags

    # --- pull all rows we could possibly need in *one* go -----------------
    chat_id = documents.chat_id
    msgs   = (db.table("messages").select("id").eq("chat", chat_id).execute().data) or []
    msg_ids = [m["id"] for m in msgs]

    # cache: table -> rows
    cache = {}
    for tbl in ("figures", "questions", "summaries"):
        cache[tbl] = (db.table(tbl).select("*").in_("message", msg_ids).execute().data) or []

    # mapping id → row for quick lookup
    by_id = {row["id"]: row for tbl in cache.values() for row in tbl}

    # Build global figure-index map {fig_id: 1,2,3…} so we can replace
    figs_rev: Dict[str,int] = {}
    next_idx = 1
    for q in cache["questions"] + cache["summaries"]:
        for fid in q.get("figures", []):
            if fid not in figs_rev:
                figs_rev[fid] = next_idx; next_idx += 1
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
        ids  = [r["id"] for r in rows]
        parts += await build_history(kind, ids, db, documents)
        last = end

    # trailing text
    if last < len(message):
        tail = message[last:]
        if tail.strip():
            parts.append({"role": "assistant", "content": tail})

    return parts